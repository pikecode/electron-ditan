// merge.worker.js - 在 Worker 线程处理图像合成
// 避免大图像操作阻塞主线程

import {
  fastAverageAlpha,
  fastSobelAngles,
  fastQuantize,
  batchApplyMask,
  shadeColor
} from '../core/merge/pixelUtils.js'

self.onmessage = async (e) => {
  const { type, payload, id } = e.data
  const reportProgress = (progress) => {
    self.postMessage({
      type: 'progress',
      id,
      progress
    })
  }

  try {
    switch (type) {
      case 'applyTemplateMask': {
        const result = await handleTemplateMask(payload)
        self.postMessage({ type: 'success', id, result })
        break
      }
      case 'applyMutualTransparency': {
        const result = await handleMutualTransparency(payload)
        self.postMessage({ type: 'success', id, result })
        break
      }
      case 'applyStitchEffect': {
        const result = await handleStitchEffect(payload, reportProgress)
        self.postMessage({ type: 'success', id, result })
        break
      }
      case 'quantize': {
        const result = await handleQuantize(payload)
        self.postMessage({ type: 'success', id, result })
        break
      }
      default:
        self.postMessage({ type: 'error', id, error: 'Unknown type: ' + type })
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      error: err?.message || String(err)
    })
  }
}

function handleTemplateMask({ templateImageData, targetImageData, mode, options = {} }) {
  const { alphaThreshold = 1, color, tolerance = 0 } = options

  // 创建输出
  const output = new ImageData(
    new Uint8ClampedArray(targetImageData.data),
    targetImageData.width,
    targetImageData.height
  )

  batchApplyMask(output, templateImageData, alphaThreshold, mode, { color, tolerance })

  return {
    imageData: output,
    width: output.width,
    height: output.height
  }
}

async function handleMutualTransparency({ templateImageData, targetImageData, alphaThreshold = 1 }) {
  const w = Math.max(templateImageData.width, targetImageData.width)
  const h = Math.max(templateImageData.height, targetImageData.height)

  // 创建输出
  const tmplOutput = new ImageData(
    new Uint8ClampedArray(templateImageData.data),
    templateImageData.width,
    templateImageData.height
  )
  const tgtOutput = new ImageData(
    new Uint8ClampedArray(targetImageData.data),
    targetImageData.width,
    targetImageData.height
  )

  const t1 = tmplOutput.data
  const t2 = tgtOutput.data
  const minLen = Math.min(t1.length, t2.length)

  for (let i = 3; i < minLen; i += 4) {
    if (t1[i] <= alphaThreshold || t2[i] <= alphaThreshold) {
      t1[i] = 0
      t2[i] = 0
    }
  }

  return {
    template: { imageData: tmplOutput, width: w, height: h },
    target: { imageData: tgtOutput, width: w, height: h }
  }
}

async function handleStitchEffect({ imageData, options }, reportProgress) {
  const {
    palette,
    paletteSize = 32,
    cellSize = 2,
    highlight = 0.15,
    shadow = 0.18,
    directionMode = 'sobel',
    fixedAngleDeg = 45,
    alphaThreshold = 8
  } = options

  const { width: w, height: h } = imageData

  // 预计算 alpha
  const alphaRef = new Uint8ClampedArray(w * h)
  for (let i = 3, p = 0; i < imageData.data.length; i += 4, p++) {
    alphaRef[p] = imageData.data[i]
  }

  // 颜色量化
  const quant = fastQuantize(imageData.data, palette, paletteSize)

  // 应用量化
  const quantData = new Uint8ClampedArray(imageData.data)
  for (let i = 0, p = 0; i < quantData.length; i += 4, p++) {
    const q = quant.colors[quant.map[p]]
    quantData[i] = q[0]
    quantData[i + 1] = q[1]
    quantData[i + 2] = q[2]
  }

  // 计算方向
  const quantImageData = new ImageData(quantData, w, h)
  const angleField = directionMode === 'sobel'
    ? fastSobelAngles(quantImageData, w, h)
    : new Float32Array(w * h).fill(fixedAngleDeg * Math.PI / 180)

  // 创建输出 canvas
  const outCanvas = new OffscreenCanvas(w, h)
  const octx = outCanvas.getContext('2d')

  // 绘制量化底色
  const qCanvas = new OffscreenCanvas(w, h)
  const qctx = qCanvas.getContext('2d')
  qctx.putImageData(quantImageData, 0, 0)
  octx.drawImage(qCanvas, 0, 0)

  // 绘制针迹效果
  const threadCanvas = new OffscreenCanvas(cellSize, cellSize)
  const tctx = threadCanvas.getContext('2d')
  const half = cellSize / 2

  for (let y = 0; y < h; y += cellSize) {
    for (let x = 0; x < w; x += cellSize) {
      const aAvg = fastAverageAlpha(alphaRef, w, h, x, y, cellSize, cellSize)
      if (aAvg <= alphaThreshold) continue

      const idx = (y * w + x) * 4
      const r = quantData[idx]
      const g = quantData[idx + 1]
      const b = quantData[idx + 2]
      const ang = angleField[y * w + x]

      tctx.clearRect(0, 0, cellSize, cellSize)

      const grad = shadeColor([r, g, b], highlight, shadow, Math.cos(ang))
      const alphaFactor = aAvg / 255

      tctx.globalAlpha = alphaFactor
      tctx.fillStyle = `rgb(${grad.base[0]},${grad.base[1]},${grad.base[2]})`
      tctx.fillRect(0, 0, cellSize, cellSize)

      tctx.save()
      tctx.translate(half, half)
      tctx.rotate(ang)
      const lw = Math.max(1, cellSize * 0.15)
      tctx.strokeStyle = `rgb(${grad.hi[0]},${grad.hi[1]},${grad.hi[2]})`
      tctx.lineWidth = lw
      tctx.beginPath()
      tctx.moveTo(-half, -lw)
      tctx.lineTo(half, -lw)
      tctx.stroke()
      tctx.strokeStyle = `rgb(${grad.sh[0]},${grad.sh[1]},${grad.sh[2]})`
      tctx.beginPath()
      tctx.moveTo(-half, lw)
      tctx.lineTo(half, lw)
      tctx.stroke()
      tctx.restore()
      tctx.globalAlpha = 1

      octx.drawImage(threadCanvas, x, y)
    }

    // 每行完成后报告进度
    if ((y / cellSize) % 10 === 0) {
      reportProgress(Math.min(1, (y + cellSize) / h))
    }
  }

  // 返回结果
  const outputImageData = octx.getImageData(0, 0, w, h)
  return {
    imageData: outputImageData,
    width: w,
    height: h
  }
}

function handleQuantize({ imageData, palette, paletteSize }) {
  const result = fastQuantize(imageData.data, palette, paletteSize)
  return {
    colors: result.colors,
    map: Array.from(result.map), // Transfer to main thread
    width: imageData.width,
    height: imageData.height
  }
}
