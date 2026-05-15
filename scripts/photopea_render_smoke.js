#!/usr/bin/env node

const { app, BrowserWindow } = require('electron')
const fs = require('fs')
const fsp = fs.promises
const http = require('http')
const os = require('os')
const path = require('path')
const crypto = require('crypto')
const { spawn } = require('child_process')
const projectRoot = path.resolve(__dirname, '..')

function uniqueItems(values) {
  const output = []
  for (const value of values) {
    if (!value) continue
    if (!output.includes(value)) output.push(value)
  }
  return output
}

function parseArgs(argv) {
  const options = {
    mode: 'live',
    fit: 'stretch',
    sourcePreprocess: 'none',
    cellScale: 0
  }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[index + 1]
    switch (key) {
      case 'template':
        options.template = next
        index += 1
        break
      case 'source':
        options.source = next
        index += 1
        break
      case 'output':
        options.output = next
        index += 1
        break
      case 'fit':
        options.fit = next || options.fit
        index += 1
        break
      case 'source-preprocess':
        options.sourcePreprocess = next || options.sourcePreprocess
        index += 1
        break
      case 'cell-scale':
        options.cellScale = Number(next || 0) || 0
        index += 1
        break
      case 'photopea-root':
        options.photopeaRoot = next
        index += 1
        break
      case 'editor-url':
        options.editorUrl = next
        index += 1
        break
      case 'mode':
        options.mode = next || options.mode
        index += 1
        break
      default:
        break
    }
  }
  return options
}

function resolvePythonCandidates() {
  return uniqueItems([
    process.env.PSD_RENDER_PYTHON,
    process.env.PYTHON,
    process.env.PYTHON3,
    path.join(projectRoot, '.venv-psd-open', 'bin', 'python'),
    path.join(projectRoot, '.venv-psd-open', 'Scripts', 'python.exe'),
    'python3',
    'python'
  ])
}

async function runCommandCollect(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || projectRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: options.env || process.env
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', chunk => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', chunk => {
      stderr += chunk.toString()
    })
    child.on('error', error => {
      error.stdout = stdout
      error.stderr = stderr
      reject(error)
    })
    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr, code })
        return
      }
      const error = new Error(`command failed: ${command} ${args.join(' ')}`)
      error.stdout = stdout
      error.stderr = stderr
      error.code = code
      reject(error)
    })
  })
}

async function resolvePythonCommand() {
  const candidates = resolvePythonCandidates()
  for (const candidate of candidates) {
    try {
      await runCommandCollect(candidate, ['--version'])
      return candidate
    } catch (_) {}
  }
  throw new Error('python-not-found')
}

function directoryContainsPhotopeaBundle(root) {
  if (!root) return false
  return (
    fs.existsSync(path.join(root, 'index.html')) &&
    fs.existsSync(path.join(root, 'static', 'js', 'pp.js'))
  )
}

function resolvePhotopeaBundleRoot(explicitRoot) {
  const candidates = uniqueItems([
    explicitRoot,
    process.env.PHOTOPEA_APP_ROOT,
    path.join(projectRoot, 'vendor', 'photopea-app'),
    path.join(projectRoot, '..', 'psv2'),
    path.join(projectRoot, 'psv2')
  ])
  return candidates.find(directoryContainsPhotopeaBundle) || ''
}

function resolvePhotopeaRemoteEditorUrl(explicitUrl) {
  return String(explicitUrl || process.env.PHOTOPEA_EDITOR_URL || 'https://www.photopea.com').trim()
}

function buildPhotopeaEditorUrl(editorBase, options = {}) {
  const normalized = String(editorBase || '').trim()
  if (!normalized) return ''
  if (options.useAsIs || /\/index\.html(?:[?#].*)?$/i.test(normalized)) {
    return normalized
  }
  return `${normalized.replace(/\/+$/, '')}/index.html`
}

function resolveEditorUrlForBridge(bridgeOrigin, editorUrl) {
  const normalized = String(editorUrl || '').trim()
  if (!normalized) return ''
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return normalized
  return new URL(normalized, `${String(bridgeOrigin || '').replace(/\/+$/, '')}/`).toString()
}

function buildBridgeUrl(bridgeOrigin, editorUrl) {
  const bridgeUrl = new URL(`${String(bridgeOrigin || '').replace(/\/+$/, '')}/photopea-bridge.html`)
  bridgeUrl.searchParams.set('editorSrc', editorUrl)
  return bridgeUrl.toString()
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
    case '.zip': return 'application/zip'
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

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:.*?;base64,(.+)$/)
  if (!match) return Buffer.alloc(0)
  return Buffer.from(match[1], 'base64')
}

function mimeTypeFromFormat(format) {
  const normalized = String(format || '').trim().toLowerCase()
  if (normalized === 'jpg' || normalized === 'jpeg') return 'image/jpeg'
  if (normalized === 'webp') return 'image/webp'
  if (normalized === 'gif') return 'image/gif'
  return 'image/png'
}

function buildPhotopeaApiUrl(editorBaseUrl, config) {
  const target = new URL(String(editorBaseUrl || '').trim())
  target.hash = encodeURIComponent(JSON.stringify(config))
  return target.toString()
}

function parsePhotopeaServerPayload(buffer, preferredFormat = 'png') {
  const headerText = buffer.slice(0, 2000).toString('utf8').replace(/\0+$/g, '')
  let metadata = null
  for (let index = headerText.lastIndexOf('}'); index >= 0; index = headerText.lastIndexOf('}', index - 1)) {
    const candidate = headerText.slice(0, index + 1).trim()
    if (!candidate) continue
    try {
      metadata = JSON.parse(candidate)
      break
    } catch (_) {}
  }
  if (!metadata) throw new Error('photopea-server-json-invalid')

  const preferred = String(preferredFormat || '').trim().toLowerCase()
  const versions = Array.isArray(metadata.versions) ? metadata.versions : []
  const version =
    versions.find(item => String(item?.format || '').trim().toLowerCase() === preferred) ||
    versions[0]
  if (!version) throw new Error('photopea-server-version-missing')

  const start = 2000 + (Number(version.start || 0) || 0)
  const size = Number(version.size || 0) || 0
  if (size <= 0) throw new Error('photopea-server-file-size-invalid')

  return {
    metadata,
    format: String(version.format || preferredFormat || 'png').trim().toLowerCase(),
    fileBuffer: buffer.slice(start, start + size)
  }
}

async function patchTemplate(options) {
  const python = await resolvePythonCommand()
  const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'photopea-smoke-'))
  const outputPsd = path.join(workDir, `patched_${crypto.randomUUID()}.psd`)
  const metadataJson = path.join(workDir, `patch_${crypto.randomUUID()}.json`)
  const patchScript = path.join(projectRoot, 'scripts', 'psd_open_source_patch.py')
  const args = [
    patchScript,
    '--psd',
    path.resolve(options.template),
    '--source',
    path.resolve(options.source),
    '--output-psd',
    outputPsd,
    '--fit',
    options.fit,
    '--source-preprocess',
    options.sourcePreprocess || 'none',
    '--cell-scale',
    String(Number(options.cellScale || 0) || 0),
    '--metadata-json',
    metadataJson
  ]
  const result = await runCommandCollect(python, args)
  const metadata = JSON.parse(await fsp.readFile(metadataJson, 'utf8'))
  return {
    workDir,
    patchedPsdPath: outputPsd,
    patchMetadata: metadata,
    stdout: result.stdout,
    stderr: result.stderr,
    python
  }
}

async function runRenderTask(bridgeWindow, payload) {
  const serialized = JSON.stringify(payload)
  return bridgeWindow.webContents.executeJavaScript(
    `window.runPhotopeaRenderTask(${serialized})`,
    true
  )
}

async function runRenderAttempt(bridgeOrigin, patched, outputPath, editorMeta) {
  const bridgeWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
      spellcheck: false
    }
  })
  bridgeWindow.removeMenu?.()
  const consoleLogs = []
  bridgeWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    consoleLogs.push({
      type: 'console-message',
      level,
      message,
      line,
      sourceId
    })
  })
  bridgeWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    consoleLogs.push({
      type: 'did-fail-load',
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    })
  })

  try {
    await bridgeWindow.loadURL(buildBridgeUrl(bridgeOrigin, editorMeta.editorUrl))
    const renderResult = await runRenderTask(bridgeWindow, {
      psdPath: patched.patchedPsdPath,
      exportFormat: 'png',
      timeoutMs: 120000,
      documentName: path.basename(outputPath, path.extname(outputPath)),
      editorSrc: editorMeta.editorUrl
    })

    if (!renderResult?.ok || !renderResult.outputDataUrl) {
      const error = new Error(renderResult?.error || 'photopea-render-failed')
      error.logs = [...(renderResult?.logs || []), ...consoleLogs]
      throw error
    }

    const pngBuffer = dataUrlToBuffer(renderResult.outputDataUrl)
    await fsp.mkdir(path.dirname(outputPath), { recursive: true })
    await fsp.writeFile(outputPath, pngBuffer)

    return {
      ok: true,
      outputPath,
      editorMode: editorMeta.mode,
      editorUrl: editorMeta.editorUrl,
      photopeaRoot: editorMeta.photopeaRoot || '',
      photopeaOrigin: editorMeta.photopeaOrigin || '',
      photopeaMessages: renderResult.messages || [],
      photopeaLogs: [...(renderResult.logs || []), ...consoleLogs],
      elapsedMs: renderResult.elapsedMs || 0
    }
  } finally {
    try {
      bridgeWindow.destroy()
    } catch (_) {}
  }
}

async function runApiRenderAttempt(patched, outputPath, editorUrl) {
  const exportFormat = 'png'
  const timeoutMs = 120000
  const apiLogs = []
  let settleResult = null
  const resultPromise = new Promise((resolve, reject) => {
    settleResult = { resolve, reject }
  })

  const apiServer = http.createServer(async (request, response) => {
    const replyHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-store'
    }

    if (request.method === 'OPTIONS') {
      response.writeHead(204, replyHeaders)
      response.end()
      return
    }

    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1')
      if (request.method === 'GET' && requestUrl.pathname === '/asset/input.psd') {
        apiLogs.push({ type: 'asset-request', path: requestUrl.pathname })
        response.writeHead(200, {
          ...replyHeaders,
          'Content-Type': 'image/vnd.adobe.photoshop'
        })
        fs.createReadStream(patched.patchedPsdPath).pipe(response)
        return
      }

      if (request.method === 'POST' && requestUrl.pathname === '/save') {
        apiLogs.push({ type: 'save-request', path: requestUrl.pathname })
        const chunks = []
        request.on('data', chunk => {
          chunks.push(chunk)
        })
        request.on('end', async () => {
          try {
            const parsed = parsePhotopeaServerPayload(Buffer.concat(chunks), exportFormat)
            await fsp.mkdir(path.dirname(outputPath), { recursive: true })
            await fsp.writeFile(outputPath, parsed.fileBuffer)
            response.writeHead(200, {
              ...replyHeaders,
              'Content-Type': 'application/json; charset=utf-8'
            })
            response.end(JSON.stringify({ message: 'saved' }))
            settleResult.resolve({
              ok: true,
              outputPath,
              editorMode: 'api',
              editorUrl,
              photopeaRoot: '',
              photopeaOrigin: '',
              photopeaMessages: [],
              photopeaLogs: apiLogs.slice(0),
              elapsedMs: 0,
              serverMetadata: parsed.metadata,
              outputDataUrl: `data:${mimeTypeFromFormat(parsed.format)};base64,${parsed.fileBuffer.toString('base64')}`
            })
          } catch (error) {
            response.writeHead(500, {
              ...replyHeaders,
              'Content-Type': 'application/json; charset=utf-8'
            })
            response.end(JSON.stringify({ error: error?.message || String(error) }))
            settleResult.reject(error)
          }
        })
        request.on('error', error => {
          settleResult.reject(error)
        })
        return
      }

      response.writeHead(404, {
        ...replyHeaders,
        'Content-Type': 'text/plain; charset=utf-8'
      })
      response.end('Not Found')
    } catch (error) {
      response.writeHead(500, {
        ...replyHeaders,
        'Content-Type': 'text/plain; charset=utf-8'
      })
      response.end(error?.message || 'Internal Server Error')
    }
  })

  await new Promise((resolve, reject) => {
    apiServer.once('error', reject)
    apiServer.listen(0, '127.0.0.1', () => {
      apiServer.removeListener('error', reject)
      resolve()
    })
  })

  const address = apiServer.address()
  const apiOrigin = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`
  const photopeaUrl = buildPhotopeaApiUrl(editorUrl, {
    files: [`${apiOrigin}/asset/input.psd`],
    server: {
      version: 1,
      url: `${apiOrigin}/save`,
      formats: [exportFormat]
    },
    environment: {
      vmode: 2,
      intro: false,
      localsave: false,
      autosave: 1
    }
  })

  const browserWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      spellcheck: false
    }
  })
  browserWindow.removeMenu?.()
  browserWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    apiLogs.push({
      type: 'console-message',
      level,
      message,
      line,
      sourceId
    })
  })
  browserWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    apiLogs.push({
      type: 'did-fail-load',
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    })
  })

  try {
    await browserWindow.loadURL(photopeaUrl)
    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`photopea-api-timeout:${timeoutMs}`)), timeoutMs)
      })
    ])
    result.photopeaLogs = apiLogs.slice(0)
    result.photopeaOrigin = apiOrigin
    return result
  } finally {
    try {
      browserWindow.destroy()
    } catch (_) {}
    try {
      apiServer.close()
    } catch (_) {}
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const renderMode = ['live', 'api'].includes(String(options.mode || '').trim().toLowerCase())
    ? String(options.mode || '').trim().toLowerCase()
    : 'live'
  if (!options.template || !options.source) {
    throw new Error(
      'usage: electron ./scripts/photopea_render_smoke.js --template <template.psd> --source <source.png> [--output <output.png>] [--editor-url <url>] [--mode live|api]'
    )
  }

  const patched = await patchTemplate(options)
  const outputPath =
    options.output
      ? path.resolve(options.output)
      : path.join(
          patched.workDir,
          `${path.basename(options.source, path.extname(options.source))}_photopea.png`
        )
  const attempts = []
  let staticServer = null
  let bridgeServer = null
  let localPhotopeaRoot = ''

  try {
    if (renderMode === 'api') {
      const remoteEditorUrl = resolvePhotopeaRemoteEditorUrl(options.editorUrl)
      const apiSummary = await runApiRenderAttempt(patched, outputPath, remoteEditorUrl)
      process.stdout.write(`${JSON.stringify({
        ...apiSummary,
        patchedPsdPath: patched.patchedPsdPath,
        workDir: patched.workDir,
        patchMetadata: patched.patchMetadata
      }, null, 2)}\n`)
      return
    }

    bridgeServer = await startStaticServer(path.join(projectRoot, 'public'))
    if (!options.editorUrl) {
      localPhotopeaRoot = resolvePhotopeaBundleRoot(options.photopeaRoot)
      if (localPhotopeaRoot) {
        try {
          staticServer = await startStaticServer(localPhotopeaRoot)
          const localSummary = await runRenderAttempt(bridgeServer.origin, patched, outputPath, {
            mode: 'local',
            editorUrl: buildPhotopeaEditorUrl(staticServer.origin),
            photopeaRoot: localPhotopeaRoot,
            photopeaOrigin: staticServer.origin
          })
          localSummary.attempts = attempts
          process.stdout.write(`${JSON.stringify({
            ...localSummary,
            patchedPsdPath: patched.patchedPsdPath,
            workDir: patched.workDir,
            patchMetadata: patched.patchMetadata
          }, null, 2)}\n`)
          return
        } catch (error) {
          attempts.push({
            ok: false,
            mode: 'local',
            editorUrl: staticServer?.origin ? buildPhotopeaEditorUrl(staticServer.origin) : '',
            photopeaRoot: localPhotopeaRoot,
            photopeaOrigin: staticServer?.origin || '',
            error: error?.message || String(error),
            logs: error?.logs || []
          })
        }
      }
    }

    const remoteEditorUrl = buildPhotopeaEditorUrl(
      resolvePhotopeaRemoteEditorUrl(options.editorUrl),
      { useAsIs: true }
    )
    const resolvedRemoteEditorUrl = resolveEditorUrlForBridge(bridgeServer.origin, remoteEditorUrl)
    let remoteSummary
    try {
      remoteSummary = await runRenderAttempt(bridgeServer.origin, patched, outputPath, {
        mode: 'remote',
        editorUrl: resolvedRemoteEditorUrl
      })
    } catch (error) {
      error.attempts = attempts
      throw error
    }
    remoteSummary.attempts = attempts
    process.stdout.write(`${JSON.stringify({
      ...remoteSummary,
      patchedPsdPath: patched.patchedPsdPath,
      workDir: patched.workDir,
      patchMetadata: patched.patchMetadata
    }, null, 2)}\n`)
  } finally {
    try {
      staticServer?.server?.close()
    } catch (_) {}
    try {
      bridgeServer?.server?.close()
    } catch (_) {}
  }
}

app.whenReady().then(async () => {
  try {
    await main()
    app.quit()
  } catch (error) {
    const payload = {
      ok: false,
      error: error?.message || String(error),
      attempts: error?.attempts || [],
      logs: error?.logs || [],
      stdout: error?.stdout || '',
      stderr: error?.stderr || ''
    }
    process.stderr.write(`${JSON.stringify(payload, null, 2)}\n`)
    app.exit(1)
  }
})
