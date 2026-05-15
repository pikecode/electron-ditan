#!/usr/bin/env node

const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { pathToFileURL } = require('url')

const projectRoot = path.resolve(__dirname, '..')
const tempHtml = path.join(os.tmpdir(), 'easystitch-merge-effect-smoke.html')

function parseArgs(argv) {
  const options = {
    output: ''
  }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '--output') {
      options.output = argv[index + 1] || ''
      index += 1
    }
  }
  return options
}

function writeSmokeHtml() {
  const opencvUrl = pathToFileURL(path.join(projectRoot, 'public', 'opencv.js')).toString()
  const brushifyUrl = pathToFileURL(path.join(projectRoot, 'public', 'brushify.js')).toString()
  fs.writeFileSync(
    tempHtml,
    `<!doctype html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <script>
    window.cvReady = false;
    window.Module = {
      locateFile: f => f,
      onRuntimeInitialized(){
        if(!window.cv && window.Module) window.cv = window.Module;
        window.cvReady = true;
      }
    };
  </script>
  <script src="${opencvUrl}"></script>
  <script src="${brushifyUrl}"></script>
</body>
</html>`,
    'utf8'
  )
}

function rendererSmoke(options = {}) {
  function waitForRuntime(timeoutMs = 30000) {
    const started = Date.now()
    return new Promise((resolve, reject) => {
      const tick = () => {
        if (window.cv && window.cv.Mat && window.cv.imread && window.BrushifyJS) {
          resolve()
          return
        }
        if (Date.now() - started > timeoutMs) {
          reject(new Error('runtime-timeout'))
          return
        }
        setTimeout(tick, 100)
      }
      tick()
    })
  }

  function createGridCanvas({ cols = 96, rows = 72, block = 8 } = {}) {
    const canvas = document.createElement('canvas')
    canvas.width = cols * block
    canvas.height = rows * block
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const band = Math.floor((x + y) / 8) % 3
        const checker = (x + y) % 2
        const r = 58 + band * 36 + checker * 16
        const g = 76 + ((x * 5 + y * 3) % 64)
        const b = 112 + ((x * 2 + y * 7) % 58)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(x * block, y * block, block, block)
      }
    }
    return canvas
  }

  function createTemplateCanvas(width, height) {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const imageData = ctx.createImageData(width, height)
    const data = imageData.data
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4
        const wave = Math.sin((x + y) * 0.12) * 16 + Math.sin(x * 0.31) * 7
        const v = Math.max(0, Math.min(255, Math.round(128 + wave)))
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas
  }

  function matToCanvas(mat) {
    const canvas = document.createElement('canvas')
    canvas.width = mat.cols
    canvas.height = mat.rows
    window.cv.imshow(canvas, mat)
    return canvas
  }

  function applyBaselineParams(instance) {
    instance.params.linearLightCompositeMaxPixels = 36000000
    instance.params.linearLightBlendInEncodedSpace = true
    instance.params.linearLightGridPresoftenEnabled = false
    instance.params.linearLightPixelArtDeblockEnabled = false
    instance.params.linearLightShadowDeblockEnabled = false
    instance.params.linearLightPostLift = 0
    instance.params.linearLightTextureRelief = 0
    instance.params.mergePureMicroContrast = 0
  }

  function applyOptimizedParams(instance) {
    instance.params.linearLightCompositeMaxPixels = 36000000
    instance.params.linearLightBlendInEncodedSpace = true
    instance.params.linearLightGridPresoftenEnabled = true
    instance.params.linearLightGridPresoftenSigma = 1.05
    instance.params.linearLightPixelArtDeblockEnabled = true
    instance.params.linearLightPixelArtDeblockMinScale = 1.35
    instance.params.linearLightShadowDeblockEnabled = true
    instance.params.linearLightShadowDeblockSigma = 1.25
    instance.params.linearLightShadowDeblockStart = 0.14
    instance.params.linearLightShadowDeblockEnd = 0.46
    instance.params.linearLightShadowDeblockMix = 0.52
    instance.params.linearLightPostLift = 3
    instance.params.linearLightTextureRelief = 0.0336
    instance.params.mergePureMicroContrast = 4
  }

  function renderPair(gridCanvas, templateCanvas, configure) {
    const cv = window.cv
    const grid = cv.imread(gridCanvas)
    const templ = cv.imread(templateCanvas)
    const brushify = new window.BrushifyJS()
    configure(brushify)
    const pair = brushify.psPatternOverlayComposite(grid, templ, true, 0.55)
    grid.delete()
    templ.delete()
    if (!pair || !pair.merged || pair.merged.empty()) {
      throw new Error('merge-output-empty')
    }
    const canvas = matToCanvas(pair.merged)
    pair.merged.delete()
    if (pair.effect) pair.effect.delete()
    return canvas
  }

  function lumaAt(data, width, x, y) {
    const i = (y * width + x) * 4
    return data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722
  }

  function seamScore(canvas, block = 8) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    const { width, height } = canvas
    const data = ctx.getImageData(0, 0, width, height).data
    let seamSum = 0
    let seamCount = 0
    let innerSum = 0
    let innerCount = 0

    for (let y = 2; y < height - 2; y += 1) {
      for (let x = 2; x < width - 2; x += 1) {
        const dx = Math.abs(lumaAt(data, width, x, y) - lumaAt(data, width, x - 1, y))
        const dy = Math.abs(lumaAt(data, width, x, y) - lumaAt(data, width, x, y - 1))
        const verticalSeam = x % block === 0
        const horizontalSeam = y % block === 0
        if (verticalSeam || horizontalSeam) {
          seamSum += verticalSeam && horizontalSeam ? (dx + dy) * 0.5 : (verticalSeam ? dx : dy)
          seamCount += 1
        } else if (x % block === Math.floor(block / 2) || y % block === Math.floor(block / 2)) {
          innerSum += (dx + dy) * 0.5
          innerCount += 1
        }
      }
    }

    const seam = seamCount ? seamSum / seamCount : 0
    const inner = innerCount ? innerSum / innerCount : 0
    return {
      seam,
      inner,
      ratio: seam / Math.max(1e-6, inner)
    }
  }

  function canvasToDataUrl(canvas) {
    return canvas.toDataURL('image/png')
  }

  return waitForRuntime().then(() => {
    const gridCanvas = createGridCanvas()
    const templateCanvas = createTemplateCanvas(gridCanvas.width, gridCanvas.height)
    const baselineCanvas = renderPair(gridCanvas, templateCanvas, applyBaselineParams)
    const optimizedCanvas = renderPair(gridCanvas, templateCanvas, applyOptimizedParams)
    const baseline = seamScore(baselineCanvas)
    const optimized = seamScore(optimizedCanvas)
    const reduction = baseline.seam > 0
      ? (baseline.seam - optimized.seam) / baseline.seam
      : 0
    const ratioReduction = baseline.ratio > 0
      ? (baseline.ratio - optimized.ratio) / baseline.ratio
      : 0
    const passed = reduction >= 0.18 || ratioReduction >= 0.18
    return {
      passed,
      metrics: {
        baseline,
        optimized,
        reduction,
        ratioReduction
      },
      images: options.includeImages
        ? {
            grid: canvasToDataUrl(gridCanvas),
            baseline: canvasToDataUrl(baselineCanvas),
            optimized: canvasToDataUrl(optimizedCanvas)
          }
        : null
    }
  })
}

function dataUrlToBuffer(dataUrl) {
  const index = String(dataUrl || '').indexOf(',')
  return Buffer.from(index >= 0 ? dataUrl.slice(index + 1) : dataUrl, 'base64')
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  writeSmokeHtml()

  await app.whenReady()
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: false,
      sandbox: false,
      webSecurity: false
    }
  })

  try {
    await win.loadFile(tempHtml)
    const result = await win.webContents.executeJavaScript(
      `(${rendererSmoke.toString()})(${JSON.stringify({ includeImages: !!options.output })})`,
      true
    )

    if (options.output && result.images) {
      fs.mkdirSync(options.output, { recursive: true })
      for (const [name, dataUrl] of Object.entries(result.images)) {
        fs.writeFileSync(path.join(options.output, `${name}.png`), dataUrlToBuffer(dataUrl))
      }
      fs.writeFileSync(
        path.join(options.output, 'metrics.json'),
        JSON.stringify(result.metrics, null, 2),
        'utf8'
      )
    }

    process.stdout.write(`${JSON.stringify(result.metrics, null, 2)}\n`)
    if (!result.passed) {
      throw new Error('merge-effect-smoke-failed: seam reduction below threshold')
    }
  } finally {
    try { win.destroy() } catch (_) {}
    app.quit()
  }
}

main().catch((error) => {
  console.error(error)
  app.exit(1)
})
