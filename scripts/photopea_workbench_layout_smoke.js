#!/usr/bin/env node

const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const fsp = fs.promises
const http = require('http')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const viewport = {
  width: Number(process.env.PHOTOPEA_SMOKE_WIDTH || 1440) || 1440,
  height: Number(process.env.PHOTOPEA_SMOKE_HEIGHT || 980) || 980
}

function uniqueItems(values) {
  const output = []
  for (const value of values) {
    if (!value) continue
    if (!output.includes(value)) output.push(value)
  }
  return output
}

function directoryContainsPhotopeaBundle(root) {
  if (!root) return false
  return (
    fs.existsSync(path.join(root, 'index.html')) &&
    fs.existsSync(path.join(root, 'static', 'js', 'pp.js'))
  )
}

function resolvePhotopeaBundleRoot() {
  const candidates = uniqueItems([
    process.env.PHOTOPEA_APP_ROOT,
    path.join(projectRoot, 'vendor', 'photopea-app'),
    path.join(projectRoot, 'vendor', 'psv2'),
    path.join(projectRoot, '..', 'psv2'),
    path.join(projectRoot, 'psv2')
  ])
  return candidates.find(directoryContainsPhotopeaBundle) || ''
}

function getMimeTypeForFile(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase()
  switch (ext) {
    case '.html': return 'text/html; charset=utf-8'
    case '.js': return 'application/javascript; charset=utf-8'
    case '.css': return 'text/css; charset=utf-8'
    case '.json': return 'application/json; charset=utf-8'
    case '.svg': return 'image/svg+xml'
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.gif': return 'image/gif'
    case '.ico': return 'image/x-icon'
    case '.woff': return 'font/woff'
    case '.woff2': return 'font/woff2'
    case '.ttf': return 'font/ttf'
    case '.otf': return 'font/otf'
    default: return 'application/octet-stream'
  }
}

async function startStaticServer(rootPath) {
  const normalizedRoot = path.resolve(rootPath)
  const rootWithSep = `${normalizedRoot}${path.sep}`
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1')
      let relativePath = decodeURIComponent(url.pathname || '/')
      if (relativePath === '/' || !relativePath) relativePath = '/index.html'
      const absolutePath = path.resolve(normalizedRoot, `.${relativePath}`)
      const withinRoot =
        absolutePath === normalizedRoot || absolutePath.startsWith(rootWithSep)
      if (!withinRoot) {
        response.writeHead(403)
        response.end('Forbidden')
        return
      }

      const stat = await fsp.stat(absolutePath).catch(() => null)
      if (!stat || !stat.isFile()) {
        response.writeHead(404)
        response.end('Not Found')
        return
      }

      response.writeHead(200, {
        'Content-Type': getMimeTypeForFile(absolutePath),
        'Cache-Control': 'no-store'
      })
      fs.createReadStream(absolutePath).pipe(response)
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end(error?.message || 'Internal Server Error')
    }
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject)
      resolve()
    })
  })

  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    server,
    origin: `http://127.0.0.1:${port}`
  }
}

function rendererSmoke() {
  function waitForStableBody(timeoutMs = 30000) {
    const startedAt = Date.now()
    return new Promise((resolve, reject) => {
      const tick = () => {
        const bodyText = document.body?.textContent || ''
        const hasBundleUi = /Photopea|文件|编辑|图像|图层|选择|滤镜|视图|窗口|更多|File|Edit|Image|Layer|Select|Filter|View|Window|More/i.test(bodyText)
        const bodyRect = document.body?.getBoundingClientRect()
        const htmlRect = document.documentElement?.getBoundingClientRect()
        if (hasBundleUi && bodyRect?.width > 0 && bodyRect?.height > 0 && htmlRect?.height > 0) {
          resolve()
          return
        }
        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error('photopea-workbench-load-timeout'))
          return
        }
        setTimeout(tick, 250)
      }
      tick()
    })
  }

  return waitForStableBody().then(() => {
    const htmlStyle = getComputedStyle(document.documentElement)
    const bodyStyle = getComputedStyle(document.body)
    const bodyRect = document.body.getBoundingClientRect()
    const htmlRect = document.documentElement.getBoundingClientRect()
    const candidates = Array.prototype.slice.call(document.body.querySelectorAll('*'))
      .map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id || '',
          className: String(element.className || '').slice(0, 80),
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left
        }
      })
      .filter((item) => item.width >= window.innerWidth * 0.9 && item.height >= window.innerHeight * 0.75)
      .sort((a, b) => (b.width * b.height) - (a.width * a.height))
      .slice(0, 8)

    const fullViewportElement = candidates[0] || null
    const passed =
      Math.abs(window.innerWidth - bodyRect.width) <= 2 &&
      Math.abs(window.innerHeight - bodyRect.height) <= 2 &&
      Math.abs(window.innerHeight - htmlRect.height) <= 2 &&
      Boolean(fullViewportElement)

    return {
      passed,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      html: {
        width: Math.round(htmlRect.width),
        height: Math.round(htmlRect.height),
        overflow: htmlStyle.overflow
      },
      body: {
        width: Math.round(bodyRect.width),
        height: Math.round(bodyRect.height),
        margin: bodyStyle.margin,
        overflow: bodyStyle.overflow
      },
      fullViewportElement: fullViewportElement
        ? {
            tag: fullViewportElement.tag,
            id: fullViewportElement.id,
            className: fullViewportElement.className,
            width: Math.round(fullViewportElement.width),
            height: Math.round(fullViewportElement.height),
            top: Math.round(fullViewportElement.top),
            left: Math.round(fullViewportElement.left)
          }
        : null
    }
  })
}

async function closeWindowIgnoringBeforeUnload(win, timeoutMs = 5000) {
  if (!win || win.isDestroyed()) return { passed: true, alreadyDestroyed: true }

  win.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault()
  })

  return await new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({
        passed: false,
        closed: win.isDestroyed(),
        error: 'photopea-workbench-close-timeout'
      })
    }, timeoutMs)

    win.once('closed', () => {
      clearTimeout(timer)
      resolve({
        passed: true,
        closed: true
      })
    })

    let forceClosing = false
    win.once('close', (event) => {
      if (forceClosing || win.isDestroyed()) return
      forceClosing = true
      event.preventDefault()
      win.destroy()
    })

    try {
      win.close()
    } catch (error) {
      clearTimeout(timer)
      resolve({
        passed: false,
        closed: win.isDestroyed(),
        error: error?.message || String(error)
      })
    }
  })
}

async function main() {
  const bundleRoot = resolvePhotopeaBundleRoot()
  if (!bundleRoot) throw new Error('photopea-bundle-missing')

  await app.whenReady()
  const staticServer = await startStaticServer(bundleRoot)
  const screenshotPath = path.join(projectRoot, '数据', '_analysis', 'photopea-workbench-smoke.png')
  const win = new BrowserWindow({
    width: viewport.width,
    height: viewport.height,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    title: 'PSD 工作台 Smoke',
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      spellcheck: false,
      backgroundThrottling: false
    }
  })

  try {
    await win.loadURL(`${staticServer.origin}/index.html`)
    const result = await win.webContents.executeJavaScript(
      `(${rendererSmoke.toString()})()`,
      true
    )
    await fsp.mkdir(path.dirname(screenshotPath), { recursive: true })
    const screenshot = await win.webContents.capturePage()
    await fsp.writeFile(screenshotPath, screenshot.toPNG())
    result.screenshotPath = screenshotPath
    await win.webContents.executeJavaScript(
      `window.addEventListener('beforeunload', function(event) {
        event.preventDefault();
        event.returnValue = 'blocked-by-smoke-test';
        return 'blocked-by-smoke-test';
      }); true;`,
      true
    )
    result.close = await closeWindowIgnoringBeforeUnload(win)
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    if (!result.passed || !result.close?.passed) {
      throw new Error('photopea-workbench-layout-smoke-failed')
    }
  } finally {
    try { win.destroy() } catch (_) {}
    try { staticServer.server.close() } catch (_) {}
    app.quit()
  }
}

main().catch((error) => {
  console.error(error)
  app.exit(1)
})
