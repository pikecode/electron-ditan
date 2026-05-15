const { app, BrowserWindow, ipcMain, globalShortcut } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')
const crypto = require('crypto')
const http = require('http')
const { pathToFileURL } = require('url')
const { spawn } = require('child_process')
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev')
const fsp = fs.promises

try {
  require('@electron/remote/main').initialize()
} catch (e) {
  console.warn('[EasyStitch] @electron/remote main init:', e.message)
}

// macOS 配置
if (process.platform === 'darwin') {
  app.commandLine.appendSwitch('disable-features', 'VizDisplayCompositor')
  app.commandLine.appendSwitch('disable-web-security')
  app.setName('EasyStitch')
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

let mainWindow
let photopeaWorkbenchWindow = null
let photopeaBridgeWindow = null
let photopeaBridgeEditorSrc = ''
let photopeaRenderQueue = Promise.resolve()
let photopeaServer = null
let photopeaServerRoot = ''
let photopeaServerOrigin = ''
let photopeaBridgeServer = null
let photopeaBridgeServerRoot = ''
let photopeaBridgeServerOrigin = ''
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    webPreferences: { nodeIntegration:true, contextIsolation:false, enableRemoteModule:true, webSecurity:false, spellcheck:false, autoHideMenuBar:true },
    icon: path.join(__dirname, 'assets/icon.png'), title:'EasyStitch', show:false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  })
  const indexHtml = path.join(__dirname, 'dist', 'index.html')
  if (!fs.existsSync(indexHtml)) {
    console.error('[EasyStitch] 找不到页面文件:', indexHtml)
    console.error('请在项目根目录执行: npm run build:vue  再启动 Electron（勿在非项目目录运行 electron）')
  } else if (isDev) {
    console.log('[EasyStitch] 加载页面:', indexHtml)
  }
  mainWindow.loadFile(indexHtml)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (process.platform === 'win32') {
      mainWindow.setMenuBarVisibility(false)
    }
    globalShortcut.register('F12', () => {
      if (!mainWindow?.webContents) return
      if (mainWindow.webContents.isDevToolsOpened()) mainWindow.webContents.closeDevTools(); else mainWindow.webContents.openDevTools()
    })
  })
  mainWindow.on('closed', () => { mainWindow = null; globalShortcut.unregisterAll() })
}

app.whenReady().then(() => {
  if (process.platform === 'darwin') {
    const originalStderr = process.stderr.write
    process.stderr.write = function(chunk, enc, cb){
      const msg = chunk.toString()
      if (msg.includes('_TIPropertyValueIsValid') || msg.includes('imkxpc_getApplicationProperty') || msg.includes('Text input context does not respond')) return true
      return originalStderr.call(process.stderr, chunk, enc, cb)
    }
  }
  createWindow()
})

app.on('window-all-closed', () => { globalShortcut.unregisterAll(); if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
app.on('before-quit', () => {
  try {
    if (photopeaWorkbenchWindow && !photopeaWorkbenchWindow.isDestroyed()) {
      photopeaWorkbenchWindow.destroy()
    }
  } catch (_) {}
  try {
    if (photopeaBridgeWindow && !photopeaBridgeWindow.isDestroyed()) {
      photopeaBridgeWindow.destroy()
    }
  } catch (_) {}
  try {
    if (photopeaServer) {
      photopeaServer.close()
    }
  } catch (_) {}
  try {
    if (photopeaBridgeServer) {
      photopeaBridgeServer.close()
    }
  } catch (_) {}
  photopeaWorkbenchWindow = null
  photopeaBridgeWindow = null
  photopeaBridgeEditorSrc = ''
  photopeaServer = null
  photopeaServerRoot = ''
  photopeaServerOrigin = ''
  photopeaBridgeServer = null
  photopeaBridgeServerRoot = ''
  photopeaBridgeServerOrigin = ''
})

// ============ IPC: Color Palettes & Groups (IndexedDB front-end only) ============
// 这些 IPC 仅作为统一入口，直接在渲染进程使用 colorAPI / colorGroupAPI 时可逐步移除

ipcMain.handle('noop', () => ({ ok:true }))

ipcMain.handle('photopea:open-workbench-window', async () => {
  try {
    const result = await openPhotopeaWorkbenchWindow()
    return {
      ok: true,
      url: result.url,
      origin: result.origin,
      bundleRoot: result.bundleRoot
    }
  } catch (error) {
    const projectRoot = resolveProjectRoot()
    return {
      ok: false,
      error: error?.message || String(error),
      setupHint: createPhotopeaSetupHint(projectRoot)
    }
  }
})

// 保留项目导出打包逻辑
const { dialog } = require('electron')
const archiver = require('archiver')
function dataUrlToBuffer(dataUrl){ if(!dataUrl) return null; const idx=dataUrl.indexOf(','); const b64= idx>=0? dataUrl.slice(idx+1): dataUrl; return Buffer.from(b64,'base64') }

async function createZipPackage(payload){
  const { name, manifest, meta, images, timestamp } = payload || {}
  const defaultName = name || 'EasyStitchProject'
  const ts = new Date(timestamp || Date.now())
  const stamp = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`
  const fileName = `${defaultName}_${stamp}.easystitch.zip`
  const { filePath, canceled } = await dialog.showSaveDialog({ title:'保存项目', defaultPath:fileName, filters:[{ name:'EasyStitch Project', extensions:['zip'] }] })
  if (canceled || !filePath) return { ok:false, canceled:true }
  return await new Promise((resolve,reject)=>{
    const output = fs.createWriteStream(filePath)
    const archive = archiver('zip', { zlib:{ level:9 } })
    output.on('close', ()=> resolve({ ok:true, filePath, bytes: archive.pointer() }))
    output.on('error', err=> reject(err))
    archive.on('error', err=> reject(err))
    archive.pipe(output)
    archive.append(JSON.stringify(manifest,null,2), { name:'manifest.json' })
    archive.append(JSON.stringify(meta,null,2), { name:'data/project_meta.json' })
    if (images?.gridPurePng) archive.append(dataUrlToBuffer(images.gridPurePng), { name:'grid_pure.png' })
    if (images?.gridPureJpg) archive.append(dataUrlToBuffer(images.gridPureJpg), { name:'grid_pure.jpg' })
    archive.finalize()
  })
}

ipcMain.handle('project:export', async (_, payload)=>{ try { return await createZipPackage(payload) } catch(e){ return { ok:false, error:e.message } } })

ipcMain.handle('project:export:v2', async (_, payload)=>{
  try {
    return
  } catch(e) { return { ok:false, error:e.message } }
})

function uniqueItems(items) {
  const output = []
  for (const item of items || []) {
    if (!item || output.includes(item)) continue
    output.push(item)
  }
  return output
}

function sanitizeFileStem(value, fallback = 'file') {
  const normalized = String(value || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
  return normalized || fallback
}

function normalizeTemplateName(value) {
  return String(value || '')
    .trim()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
}

function extractTemplateNameTokens(value) {
  const normalized = normalizeTemplateName(value)
  if (!normalized) return []
  const matches = normalized.match(/[0-9]+x[0-9]+|[a-z0-9]+/g) || []
  const output = []
  for (const token of matches) {
    if (token.length < 2 || output.includes(token)) continue
    output.push(token)
  }
  return output
}

function normalizeLookupTokens(tokens) {
  const output = []
  for (const token of Array.isArray(tokens) ? tokens : []) {
    const normalized = String(token || '').trim().toLowerCase()
    if (!normalized || output.includes(normalized)) continue
    output.push(normalized)
  }
  return output
}

function countSharedTokens(leftTokens, rightTokens) {
  if (!leftTokens.length || !rightTokens.length) return 0
  let count = 0
  for (const token of leftTokens) {
    if (rightTokens.includes(token)) count += 1
  }
  return count
}

function getAspectRatio(width, height) {
  const safeWidth = Number(width || 0) || 0
  const safeHeight = Number(height || 0) || 0
  if (!(safeWidth > 0 && safeHeight > 0)) return 0
  return safeWidth / safeHeight
}

async function readPsdHeaderInfo(filePath) {
  let handle = null
  try {
    handle = await fsp.open(filePath, 'r')
    const header = Buffer.alloc(26)
    await handle.read(header, 0, header.length, 0)
    if (header.slice(0, 4).toString('ascii') !== '8BPS') return null
    return {
      signature: '8BPS',
      channels: header.readUInt16BE(12),
      height: header.readUInt32BE(14),
      width: header.readUInt32BE(18),
      depth: header.readUInt16BE(22),
      colorMode: header.readUInt16BE(24)
    }
  } catch (_) {
    return null
  } finally {
    try { await handle?.close() } catch (_) {}
  }
}

function shouldSkipSearchDirectory(name) {
  const normalized = String(name || '').trim().toLowerCase()
  return [
    '.git',
    'node_modules',
    'dist',
    'build',
    '.next',
    '.nuxt',
    '.cache',
    'library'
  ].includes(normalized)
}

async function collectPsdFilesFromRoots(roots, options = {}) {
  const maxDepth = Math.max(1, Number(options.maxDepth || 3) || 3)
  const maxFiles = Math.max(1, Number(options.maxFiles || 600) || 600)
  const queue = (roots || []).map(root => ({ dir: root, depth: 0 }))
  const seenDirs = new Set()
  const files = []

  while (queue.length && files.length < maxFiles) {
    const current = queue.shift()
    const dirPath = current?.dir
    if (!dirPath) continue

    let realPath = ''
    try {
      realPath = await fsp.realpath(dirPath)
    } catch (_) {
      continue
    }
    if (seenDirs.has(realPath)) continue
    seenDirs.add(realPath)

    let entries = []
    try {
      entries = await fsp.readdir(realPath, { withFileTypes: true })
    } catch (_) {
      continue
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break
      const entryName = String(entry?.name || '')
      if (!entryName || entryName.startsWith('.')) continue
      const absolutePath = path.join(realPath, entryName)
      if (entry.isDirectory()) {
        if (current.depth >= maxDepth || shouldSkipSearchDirectory(entryName)) continue
        queue.push({ dir: absolutePath, depth: current.depth + 1 })
        continue
      }
      if (entry.isFile() && /\.psd$/i.test(entryName)) {
        files.push(absolutePath)
      }
    }
  }

  return files
}

function scoreLocalPsdCandidate(candidate, payload = {}) {
  if (!candidate) return { score: Number.NEGATIVE_INFINITY, reason: '' }

  let score = 0
  const reasons = []
  const targetWidth = Number(payload?.width || 0) || 0
  const targetHeight = Number(payload?.height || 0) || 0
  const candidateWidth = Number(candidate?.width || 0) || 0
  const candidateHeight = Number(candidate?.height || 0) || 0
  const targetAspect = getAspectRatio(targetWidth, targetHeight)
  const candidateAspect = getAspectRatio(candidateWidth, candidateHeight)
  const templateTokens = extractTemplateNameTokens(payload?.templateName)
  const projectTokens = extractTemplateNameTokens(payload?.projectName)
  const lookupTokens = normalizeLookupTokens(payload?.lookupTokens)
  const candidateTokens = extractTemplateNameTokens(candidate?.name)
  const templateTokenCount = countSharedTokens(templateTokens, candidateTokens)
  const projectTokenCount = countSharedTokens(projectTokens, candidateTokens)
  const lookupTokenCount = countSharedTokens(lookupTokens, candidateTokens)
  const exactSizeMatch =
    targetWidth > 0 &&
    targetHeight > 0 &&
    candidateWidth === targetWidth &&
    candidateHeight === targetHeight

  if (templateTokenCount > 0) {
    score += templateTokenCount * 120
    reasons.push(`template-token:${templateTokenCount}`)
  }
  if (projectTokenCount > 0) {
    score += projectTokenCount * 96
    reasons.push(`project-token:${projectTokenCount}`)
  }
  if (lookupTokenCount > 0) {
    score += lookupTokenCount * 140
    reasons.push(`lookup-token:${lookupTokenCount}`)
  }

  if (targetWidth > 0 && targetHeight > 0 && candidateWidth > 0 && candidateHeight > 0) {
    if (exactSizeMatch) {
      score += 360
      reasons.push('size:exact')
    } else {
      const delta = Math.abs(candidateWidth - targetWidth) + Math.abs(candidateHeight - targetHeight)
      if (delta <= 6) {
        score += 260
        reasons.push('size:near')
      } else {
        score -= delta * 0.12
      }
    }
  }

  if (targetAspect > 0 && candidateAspect > 0) {
    const aspectDelta = Math.abs(candidateAspect - targetAspect) / targetAspect
    if (aspectDelta <= 0.002) {
      score += 88
      reasons.push('aspect:exact')
    } else if (aspectDelta <= 0.02) {
      score += 36
      reasons.push('aspect:near')
    } else {
      score -= aspectDelta * 420
    }
  }

  if (/印刷|ps|photopea|定义在ps/i.test(String(candidate?.name || ''))) {
    score += 18
    reasons.push('name:ps')
  }

  const mtimeMs = Number(candidate?.mtimeMs || 0) || 0
  if (mtimeMs > 0) {
    score += mtimeMs / 1e13
  }

  return {
    score,
    reason: reasons.join(','),
    templateTokenCount,
    projectTokenCount,
    lookupTokenCount,
    exactSizeMatch
  }
}

function resolveLocalPsdSearchRoots(projectRoot, extraRoots = []) {
  const homeDir = os.homedir()
  const envRoots = String(process.env.EASYSTITCH_PSD_SEARCH_ROOTS || '')
    .split(path.delimiter)
    .map(item => item.trim())
    .filter(Boolean)

  const candidates = uniqueItems([
    ...extraRoots,
    ...envRoots,
    projectRoot ? path.join(projectRoot, '数据') : '',
    projectRoot ? path.join(projectRoot, 'data') : '',
    projectRoot,
    path.join(homeDir, 'Desktop'),
    path.join(homeDir, 'Downloads'),
    path.join(homeDir, 'Documents')
  ])

  return candidates.filter(item => item && fs.existsSync(item))
}

async function findBestLocalPsdEffectTemplate(payload = {}, projectRoot = resolveProjectRoot()) {
  const roots = resolveLocalPsdSearchRoots(projectRoot, Array.isArray(payload?.searchRoots) ? payload.searchRoots : [])
  const psdFiles = await collectPsdFilesFromRoots(roots, {
    maxDepth: payload?.maxDepth,
    maxFiles: payload?.maxFiles
  })

  let best = null
  let exactSizeMatchCount = 0
  for (const filePath of psdFiles) {
    const header = await readPsdHeaderInfo(filePath)
    if (!header?.width || !header?.height) continue

    const stat = await fsp.stat(filePath).catch(() => null)
    const candidate = {
      name: path.basename(filePath, path.extname(filePath)),
      filePath,
      fileUrl: pathToFileURL(filePath).toString(),
      width: header.width,
      height: header.height,
      signature: header.signature,
      size: stat?.size || 0,
      mtimeMs: stat?.mtimeMs || 0
    }
    const ranked = scoreLocalPsdCandidate(candidate, payload)
    if (!Number.isFinite(ranked.score)) continue
    if (ranked.exactSizeMatch) {
      exactSizeMatchCount += 1
    }
    if (!best || ranked.score > best.score) {
      best = {
        ...candidate,
        score: ranked.score,
        reason: ranked.reason,
        templateTokenCount: ranked.templateTokenCount,
        projectTokenCount: ranked.projectTokenCount,
        lookupTokenCount: ranked.lookupTokenCount,
        exactSizeMatch: ranked.exactSizeMatch
      }
    }
  }

  if (
    best &&
    best.exactSizeMatch &&
    exactSizeMatchCount > 1 &&
    best.templateTokenCount <= 0 &&
    best.projectTokenCount <= 0 &&
    best.lookupTokenCount <= 0
  ) {
    best = null
  }

  return {
    roots,
    scannedCount: psdFiles.length,
    best: best && best.score >= 180 ? best : null
  }
}

function extensionFromMime(mime = '') {
  const value = String(mime || '').toLowerCase()
  if (value.includes('jpeg') || value.includes('jpg')) return '.jpg'
  if (value.includes('png')) return '.png'
  if (value.includes('webp')) return '.webp'
  if (value.includes('gif')) return '.gif'
  if (value.includes('bmp')) return '.bmp'
  if (value.includes('tiff')) return '.tif'
  if (value.includes('psd') || value.includes('photoshop')) return '.psd'
  return ''
}

function extensionFromNameOrMime(name = '', mime = '', fallback = '.bin') {
  const extFromName = path.extname(String(name || '').trim())
  if (/^\.[a-z0-9]{1,8}$/i.test(extFromName)) return extFromName
  return extensionFromMime(mime) || fallback
}

function buildTempFilePath(dir, originalName, mime, fallbackStem, fallbackExt) {
  const stem = sanitizeFileStem(originalName, fallbackStem)
  const ext = extensionFromNameOrMime(originalName, mime, fallbackExt)
  return path.join(dir, `${stem}${ext}`)
}

function toNodeBuffer(binaryPayload) {
  if (!binaryPayload) return null
  if (Buffer.isBuffer(binaryPayload)) return binaryPayload
  if (binaryPayload instanceof ArrayBuffer) return Buffer.from(binaryPayload)
  if (ArrayBuffer.isView(binaryPayload)) {
    return Buffer.from(binaryPayload.buffer, binaryPayload.byteOffset, binaryPayload.byteLength)
  }
  if (Array.isArray(binaryPayload)) return Buffer.from(binaryPayload)
  throw new Error('invalid-binary-payload')
}

function resolveProjectRoot() {
  const candidates = uniqueItems([
    __dirname,
    typeof app.getAppPath === 'function' ? app.getAppPath() : '',
    process.cwd(),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked') : '',
    process.resourcesPath || ''
  ])
  return candidates.find(item => item && fs.existsSync(item)) || __dirname
}

function resolvePsdRenderScriptPath(projectRoot) {
  const candidates = uniqueItems([
    path.join(__dirname, 'scripts', 'psd_open_source_render.py'),
    projectRoot ? path.join(projectRoot, 'scripts', 'psd_open_source_render.py') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'psd_open_source_render.py') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'scripts', 'psd_open_source_render.py') : ''
  ])
  return candidates.find(item => item && fs.existsSync(item)) || ''
}

function resolvePhotopeaPatchScriptPath(projectRoot) {
  const candidates = uniqueItems([
    path.join(__dirname, 'scripts', 'psd_open_source_patch.py'),
    projectRoot ? path.join(projectRoot, 'scripts', 'psd_open_source_patch.py') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'scripts', 'psd_open_source_patch.py') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'scripts', 'psd_open_source_patch.py') : ''
  ])
  return candidates.find(item => item && fs.existsSync(item)) || ''
}

function resolvePhotopeaBundleRoot(projectRoot) {
  const candidates = uniqueItems([
    process.env.PHOTOPEA_APP_ROOT,
    projectRoot ? path.join(projectRoot, 'vendor', 'photopea-app') : '',
    projectRoot ? path.join(projectRoot, 'vendor', 'psv2') : '',
    projectRoot ? path.join(projectRoot, '..', 'psv2') : '',
    projectRoot ? path.join(projectRoot, 'psv2') : '',
    path.join(__dirname, 'vendor', 'photopea-app'),
    path.join(__dirname, 'vendor', 'psv2'),
    path.join(__dirname, '..', 'psv2'),
    path.join(__dirname, 'psv2'),
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'vendor', 'photopea-app') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'vendor', 'photopea-app') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'vendor', 'psv2') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'vendor', 'psv2') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'psv2') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'psv2') : ''
  ])
  return (
    candidates.find(item => {
      if (!item || !fs.existsSync(item)) return false
      return fs.existsSync(path.join(item, 'index.html')) && fs.existsSync(path.join(item, 'static', 'js', 'pp.js'))
    }) || ''
  )
}

function resolvePhotopeaBridgePath(projectRoot) {
  const candidates = uniqueItems([
    path.join(__dirname, 'dist', 'photopea-bridge.html'),
    path.join(__dirname, 'public', 'photopea-bridge.html'),
    projectRoot ? path.join(projectRoot, 'dist', 'photopea-bridge.html') : '',
    projectRoot ? path.join(projectRoot, 'public', 'photopea-bridge.html') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'photopea-bridge.html') : '',
    process.resourcesPath ? path.join(process.resourcesPath, 'dist', 'photopea-bridge.html') : ''
  ])
  return candidates.find(item => item && fs.existsSync(item)) || ''
}

function resolvePythonCandidates(projectRoot) {
  const candidates = []
  const envCandidates = [
    process.env.PSD_RENDER_PYTHON,
    process.env.PYTHON,
    process.env.PYTHON3
  ]
  for (const candidate of envCandidates) {
    if (candidate) candidates.push(candidate)
  }
  if (projectRoot) {
    candidates.push(path.join(projectRoot, '.venv-psd-open', 'bin', 'python'))
    candidates.push(path.join(projectRoot, '.venv-psd-open', 'Scripts', 'python.exe'))
  }
  candidates.push('python3')
  candidates.push('python')
  return uniqueItems(candidates)
}

function createPsdRenderSetupHint(projectRoot) {
  const root = projectRoot || resolveProjectRoot()
  return [
    'PSD 原生渲染需要可用的 Python 环境。',
    `建议在项目目录执行: cd "${root}"`,
    '然后执行: python3 -m venv .venv-psd-open',
    '再执行: source .venv-psd-open/bin/activate',
    '再执行: python -m pip install --upgrade pip setuptools wheel',
    '再执行: python -m pip install -r scripts/requirements-psd-open-source.txt',
    'macOS 还需要: brew install vips'
  ].join('\n')
}

function createPhotopeaSetupHint(projectRoot) {
  const root = projectRoot || resolveProjectRoot()
  const siblingPath = path.resolve(root, '..', 'psv2')
  return [
    'Photopea 渲染默认会回退到官方在线编辑器。',
    `默认远端地址: ${resolvePhotopeaRemoteEditorUrl()}`,
    '如需覆盖远端地址，可设置环境变量 PHOTOPEA_EDITOR_URL。',
    '如需离线/局域网渲染，可设置 PHOTOPEA_APP_ROOT 指向本地兼容包。',
    `或将本地包放到项目同级目录: "${siblingPath}"`,
    '本地包目录内至少需要: index.html 与 static/js/pp.js'
  ].join('\n')
}

function resolvePhotopeaRemoteEditorUrl() {
  return String(process.env.PHOTOPEA_EDITOR_URL || 'https://www.photopea.com').trim()
}

function buildPhotopeaEditorUrl(editorBase, options = {}) {
  const normalized = String(editorBase || '').trim()
  if (!normalized) return ''
  if (options.useAsIs || /\/index\.html(?:[?#].*)?$/i.test(normalized)) {
    return normalized
  }
  return `${normalized.replace(/\/+$/, '')}/index.html`
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

function buildPhotopeaBridgeUrl(bridgePath, editorUrl, bridgeOrigin = '') {
  const bridgeUrl = bridgeOrigin
    ? new URL(`${bridgeOrigin.replace(/\/+$/, '')}/${path.basename(bridgePath)}`)
    : pathToFileURL(bridgePath)
  bridgeUrl.searchParams.set('editorSrc', editorUrl)
  return bridgeUrl.toString()
}

function destroyPhotopeaBridgeWindow() {
  try {
    if (photopeaBridgeWindow && !photopeaBridgeWindow.isDestroyed()) {
      photopeaBridgeWindow.destroy()
    }
  } catch (_) {}
  photopeaBridgeWindow = null
  photopeaBridgeEditorSrc = ''
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
    case '.txt': return 'text/plain; charset=utf-8'
    default: return 'application/octet-stream'
  }
}

function closePhotopeaServer() {
  try {
    if (photopeaServer) {
      photopeaServer.close()
    }
  } catch (_) {}
  photopeaServer = null
  photopeaServerRoot = ''
  photopeaServerOrigin = ''
}

function closePhotopeaBridgeServer() {
  try {
    if (photopeaBridgeServer) {
      photopeaBridgeServer.close()
    }
  } catch (_) {}
  photopeaBridgeServer = null
  photopeaBridgeServerRoot = ''
  photopeaBridgeServerOrigin = ''
}

async function createScopedStaticServer(rootPath) {
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
    normalizedRoot,
    origin: `http://127.0.0.1:${port}`
  }
}

async function ensurePhotopeaServer(bundleRoot) {
  const normalizedRoot = path.resolve(bundleRoot)
  if (
    photopeaServer &&
    photopeaServer.listening &&
    photopeaServerRoot === normalizedRoot &&
    photopeaServerOrigin
  ) {
    return photopeaServerOrigin
  }

  closePhotopeaServer()
  const scopedServer = await createScopedStaticServer(bundleRoot)
  photopeaServer = scopedServer.server
  photopeaServerRoot = scopedServer.normalizedRoot
  photopeaServerOrigin = scopedServer.origin
  return photopeaServerOrigin
}

async function openPhotopeaWorkbenchWindow() {
  const projectRoot = resolveProjectRoot()
  const bundleRoot = resolvePhotopeaBundleRoot(projectRoot)
  if (!bundleRoot) {
    throw new Error('photopea-bundle-missing')
  }

  const origin = await ensurePhotopeaServer(bundleRoot)
  const editorUrl = buildPhotopeaEditorUrl(origin)
  if (!editorUrl) {
    throw new Error('photopea-editor-url-missing')
  }

  if (photopeaWorkbenchWindow && !photopeaWorkbenchWindow.isDestroyed()) {
    if (photopeaWorkbenchWindow.isMinimized()) photopeaWorkbenchWindow.restore()
    photopeaWorkbenchWindow.show()
    photopeaWorkbenchWindow.focus()
    return { url: editorUrl, origin, bundleRoot }
  }

  let forceClosing = false
  const win = new BrowserWindow({
    width: 1440,
    height: 980,
    minWidth: 1100,
    minHeight: 760,
    show: false,
    title: 'PSD 工作台',
    backgroundColor: '#121212',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      webSecurity: false,
      spellcheck: false
    }
  })

  photopeaWorkbenchWindow = win
  win.removeMenu?.()
  if (process.platform === 'win32') {
    win.setMenuBarVisibility(false)
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      return new URL(url).origin === origin ? { action: 'allow' } : { action: 'deny' }
    } catch (_) {
      return { action: 'deny' }
    }
  })

  win.webContents.on('will-navigate', (event, targetUrl) => {
    try {
      if (new URL(targetUrl).origin !== origin) event.preventDefault()
    } catch (_) {
      event.preventDefault()
    }
  })
  win.webContents.on('will-prevent-unload', (event) => {
    event.preventDefault()
  })

  win.once('ready-to-show', () => {
    if (win.isDestroyed()) return
    win.show()
    win.focus()
  })
  win.on('close', (event) => {
    if (forceClosing || win.isDestroyed()) return
    forceClosing = true
    event.preventDefault()
    win.destroy()
  })
  win.on('closed', () => {
    if (photopeaWorkbenchWindow === win) {
      photopeaWorkbenchWindow = null
    }
  })
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) win.destroy()
    if (photopeaWorkbenchWindow === win) {
      photopeaWorkbenchWindow = null
    }
  })

  await win.loadURL(editorUrl)
  return { url: editorUrl, origin, bundleRoot }
}

async function ensurePhotopeaBridgeServer(projectRoot) {
  const bridgePath = resolvePhotopeaBridgePath(projectRoot)
  if (!bridgePath) {
    throw new Error('photopea-bridge-page-missing')
  }
  const bridgeRoot = path.dirname(bridgePath)
  const normalizedRoot = path.resolve(bridgeRoot)
  if (
    photopeaBridgeServer &&
    photopeaBridgeServer.listening &&
    photopeaBridgeServerRoot === normalizedRoot &&
    photopeaBridgeServerOrigin
  ) {
    return {
      bridgePath,
      bridgeOrigin: photopeaBridgeServerOrigin
    }
  }

  closePhotopeaBridgeServer()
  const scopedServer = await createScopedStaticServer(bridgeRoot)
  photopeaBridgeServer = scopedServer.server
  photopeaBridgeServerRoot = scopedServer.normalizedRoot
  photopeaBridgeServerOrigin = scopedServer.origin
  return {
    bridgePath,
    bridgeOrigin: photopeaBridgeServerOrigin
  }
}

async function ensurePhotopeaBridgeWindow(projectRoot, editorUrl) {
  if (
    photopeaBridgeWindow &&
    !photopeaBridgeWindow.isDestroyed() &&
    photopeaBridgeEditorSrc === editorUrl
  ) {
    return photopeaBridgeWindow
  }

  destroyPhotopeaBridgeWindow()

  const { bridgePath, bridgeOrigin } = await ensurePhotopeaBridgeServer(projectRoot)
  const bridgeUrl = buildPhotopeaBridgeUrl(bridgePath, editorUrl, bridgeOrigin)
  const win = new BrowserWindow({
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
  win.removeMenu?.()
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('render-process-gone', () => {
    destroyPhotopeaBridgeWindow()
  })

  photopeaBridgeWindow = win
  photopeaBridgeEditorSrc = editorUrl
  await win.loadURL(bridgeUrl)
  return win
}

async function runPhotopeaBridgeRenderOnce(projectRoot, taskPayload, editorMeta = {}) {
  const editorUrl = String(editorMeta.editorUrl || '').trim()
  if (!editorUrl) {
    throw new Error('photopea-editor-url-missing')
  }
  const bridgePath = resolvePhotopeaBridgePath(projectRoot)
  if (!bridgePath) {
    throw new Error('photopea-bridge-page-missing')
  }

  const bridgeWindow = await ensurePhotopeaBridgeWindow(projectRoot, editorUrl)
  const consoleLogs = []
  const handleConsoleMessage = (_event, level, message, line, sourceId) => {
    consoleLogs.push({
      type: 'console-message',
      level,
      message,
      line,
      sourceId
    })
    if (consoleLogs.length > 200) consoleLogs.shift()
  }
  const handleDidFailLoad = (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    consoleLogs.push({
      type: 'did-fail-load',
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    })
    if (consoleLogs.length > 200) consoleLogs.shift()
  }
  bridgeWindow.webContents.on('console-message', handleConsoleMessage)
  bridgeWindow.webContents.on('did-fail-load', handleDidFailLoad)
  const jsPayload = JSON.stringify({
    ...taskPayload,
    editorSrc: editorUrl
  })

  let result
  try {
    result = await bridgeWindow.webContents.executeJavaScript(
      `window.runPhotopeaRenderTask(${jsPayload})`,
      true
    )
  } finally {
    bridgeWindow.webContents.removeListener('console-message', handleConsoleMessage)
    bridgeWindow.webContents.removeListener('did-fail-load', handleDidFailLoad)
  }

  if (!result?.ok) {
    const error = new Error(result?.error || 'photopea-render-failed')
    error.bridgeLogs = [...(result?.logs || []), ...consoleLogs]
    throw error
  }

  return {
    ...result,
    consoleLogs,
    bundleRoot: editorMeta.bundleRoot || '',
    editorOrigin: editorMeta.editorOrigin || '',
    bridgePath,
    editorUrl,
    editorMode: editorMeta.mode || 'remote',
    editorLabel: editorMeta.label || editorUrl
  }
}

async function runPhotopeaRemoteApiRender(taskPayload, editorUrl) {
  const exportFormat = String(taskPayload?.exportFormat || 'png').trim().toLowerCase() || 'png'
  const timeoutMs = Math.max(30000, Number(taskPayload?.timeoutMs || 0) || 120000)
  const startedAt = Date.now()
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
        fs.createReadStream(String(taskPayload?.psdPath || '')).pipe(response)
        return
      }

      if (request.method === 'POST' && requestUrl.pathname === '/save') {
        apiLogs.push({ type: 'save-request', path: requestUrl.pathname })
        const chunks = []
        request.on('data', chunk => {
          chunks.push(chunk)
        })
        request.on('end', () => {
          try {
            const parsed = parsePhotopeaServerPayload(Buffer.concat(chunks), exportFormat)
            response.writeHead(200, {
              ...replyHeaders,
              'Content-Type': 'application/json; charset=utf-8'
            })
            response.end(JSON.stringify({ message: 'saved' }))
            settleResult.resolve({
              ok: true,
              outputDataUrl: `data:${mimeTypeFromFormat(parsed.format)};base64,${parsed.fileBuffer.toString('base64')}`,
              messages: [],
              logs: apiLogs.slice(0),
              elapsedMs: Date.now() - startedAt,
              serverMetadata: parsed.metadata,
              editorMode: 'remote-api',
              editorUrl,
              editorOrigin: apiOrigin,
              bundleRoot: '',
              bridgePath: ''
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
  browserWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  browserWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    apiLogs.push({
      type: 'console-message',
      level,
      message,
      line,
      sourceId
    })
    if (apiLogs.length > 200) apiLogs.shift()
  })
  browserWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    apiLogs.push({
      type: 'did-fail-load',
      errorCode,
      errorDescription,
      validatedURL,
      isMainFrame
    })
    if (apiLogs.length > 200) apiLogs.shift()
  })

  try {
    await browserWindow.loadURL(photopeaUrl)
    const result = await Promise.race([
      resultPromise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`photopea-api-timeout:${timeoutMs}`)), timeoutMs)
      })
    ])
    result.logs = apiLogs.slice(0)
    return result
  } catch (error) {
    error.logs = apiLogs.slice(0)
    throw error
  } finally {
    try {
      browserWindow.destroy()
    } catch (_) {}
    try {
      apiServer.close()
    } catch (_) {}
  }
}

async function runPhotopeaBridgeRender(projectRoot, taskPayload) {
  const attempts = []
  const localBundleRoot = resolvePhotopeaBundleRoot(projectRoot)
  const remoteEditorUrl = buildPhotopeaEditorUrl(resolvePhotopeaRemoteEditorUrl(), { useAsIs: true })
  const seenEditorUrls = new Set()

  const attemptRender = async (editorMeta) => {
    const editorUrl = String(editorMeta?.editorUrl || '').trim()
    if (!editorUrl || seenEditorUrls.has(editorUrl)) return null
    seenEditorUrls.add(editorUrl)
    try {
      const result = await runPhotopeaBridgeRenderOnce(projectRoot, taskPayload, editorMeta)
      return {
        ...result,
        attempts
      }
    } catch (error) {
      attempts.push({
        ok: false,
        mode: editorMeta?.mode || 'remote',
        label: editorMeta?.label || editorUrl,
        editorUrl,
        bundleRoot: editorMeta?.bundleRoot || '',
        editorOrigin: editorMeta?.editorOrigin || '',
        error: error?.message || String(error),
        bridgeLogs: error?.bridgeLogs || []
      })
      destroyPhotopeaBridgeWindow()
      return null
    }
  }

  if (localBundleRoot) {
    try {
      const editorOrigin = await ensurePhotopeaServer(localBundleRoot)
      const localResult = await attemptRender({
        mode: 'local',
        label: 'local-bundle',
        bundleRoot: localBundleRoot,
        editorOrigin,
        editorUrl: buildPhotopeaEditorUrl(editorOrigin)
      })
      if (localResult) return localResult
    } catch (error) {
      attempts.push({
        ok: false,
        mode: 'local',
        label: 'local-bundle-server',
        editorUrl: '',
        bundleRoot: localBundleRoot,
        editorOrigin: '',
        error: error?.message || String(error),
        bridgeLogs: error?.bridgeLogs || []
      })
    }
  }

  try {
    const remoteResult = await runPhotopeaRemoteApiRender(taskPayload, remoteEditorUrl)
    return {
      ...remoteResult,
      attempts
    }
  } catch (error) {
    attempts.push({
      ok: false,
      mode: 'remote-api',
      label: 'official-remote-api',
      editorUrl: remoteEditorUrl,
      bundleRoot: '',
      editorOrigin: '',
      error: error?.message || String(error),
      bridgeLogs: error?.bridgeLogs || [],
      logs: error?.logs || []
    })
  }

  const combinedMessage =
    attempts.length > 0
      ? attempts
        .map(item => `${item.label}: ${item.error}`)
        .join('\n')
      : 'photopea-render-failed'
  const error = new Error(combinedMessage)
  error.bridgeLogs = attempts.flatMap(item => item.bridgeLogs || item.logs || [])
  error.attempts = attempts
  throw error
}

function enqueuePhotopeaTask(taskFactory) {
  photopeaRenderQueue = photopeaRenderQueue.then(taskFactory, taskFactory)
  return photopeaRenderQueue
}

function runCommandCollect(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
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
      error.command = command
      error.args = args
      reject(error)
    })
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve({ stdout, stderr, code, signal })
        return
      }
      const error = new Error(`PSD 原生渲染进程退出，code=${code}${signal ? ` signal=${signal}` : ''}`)
      error.stdout = stdout
      error.stderr = stderr
      error.code = code
      error.signal = signal
      error.command = command
      error.args = args
      reject(error)
    })
  })
}

async function runPsdRenderScript(scriptPath, args, projectRoot) {
  const pythonCandidates = resolvePythonCandidates(projectRoot)
  let lastError = null

  for (const pythonCommand of pythonCandidates) {
    try {
      const result = await runCommandCollect(pythonCommand, [scriptPath, ...args], { cwd: projectRoot })
      return { ...result, pythonCommand }
    } catch (error) {
      lastError = error
      const combined = `${error?.stderr || ''}\n${error?.stdout || ''}`
      const retryable =
        error?.code === 'ENOENT' ||
        /No module named|ModuleNotFoundError|can't open file|No such file or directory/i.test(combined)
      if (!retryable) break
    }
  }

  throw lastError || new Error('PSD 原生渲染启动失败')
}

async function readJsonIfExists(filePath) {
  try {
    const raw = await fsp.readFile(filePath, 'utf-8')
    return JSON.parse(raw)
  } catch (_) {
    return null
  }
}

ipcMain.handle('psd:render-effect-template', async (_, payload) => {
  const projectRoot = resolveProjectRoot()
  const setupHint = createPsdRenderSetupHint(projectRoot)

  try {
    const scriptPath = resolvePsdRenderScriptPath(projectRoot)
    if (!scriptPath) {
      return {
        ok: false,
        error: `找不到 PSD 原生渲染脚本。\n${setupHint}`,
        setupHint
      }
    }

    const templateBuffer = toNodeBuffer(payload?.templateBuffer)
    const sourceBuffer = toNodeBuffer(payload?.sourceBuffer)
    const edgeSourceBuffer = payload?.edgeSourceBuffer ? toNodeBuffer(payload?.edgeSourceBuffer) : null
    if (!templateBuffer?.length) throw new Error('psd-native-template-buffer-missing')
    if (!sourceBuffer?.length) throw new Error('psd-native-source-buffer-missing')

    const fit = ['stretch', 'cover', 'contain'].includes(String(payload?.fit || ''))
      ? String(payload.fit)
      : 'stretch'
    const sourcePreprocessMode = String(payload?.sourcePreprocess?.mode || '').trim().toLowerCase()
    const safeSourcePreprocessMode =
      sourcePreprocessMode === 'baked-grid-preview' ? sourcePreprocessMode : 'none'
    const sourceCellScale = Number(payload?.sourcePreprocess?.cellScale || 0) || 0
    const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'easystitch-psd-render-'))
    const templatePath = buildTempFilePath(
      workDir,
      payload?.templateName || 'template.psd',
      payload?.templateMime || 'image/vnd.adobe.photoshop',
      'template',
      '.psd'
    )
    const sourcePath = buildTempFilePath(
      workDir,
      payload?.sourceName || 'source.png',
      payload?.sourceMime || 'image/png',
      'source',
      '.png'
    )
    const edgeSourcePath = edgeSourceBuffer?.length
      ? buildTempFilePath(
          workDir,
          payload?.edgeSourceName || 'edge-source.png',
          payload?.edgeSourceMime || 'image/png',
          'edge-source',
          '.png'
        )
      : ''
    const outputPath = path.join(workDir, `rendered_${crypto.randomUUID()}.png`)
    const metricsPath = path.join(workDir, `metrics_${crypto.randomUUID()}.json`)

    await fsp.writeFile(templatePath, templateBuffer)
    await fsp.writeFile(sourcePath, sourceBuffer)
    if (edgeSourcePath) {
      await fsp.writeFile(edgeSourcePath, edgeSourceBuffer)
    }

    const scriptArgs = [
      '--psd', templatePath,
      '--source', sourcePath,
      '--output', outputPath,
      '--fit', fit,
      '--source-preprocess', safeSourcePreprocessMode,
      '--cell-scale', String(sourceCellScale),
      '--metrics-json', metricsPath
    ]
    if (edgeSourcePath) {
      scriptArgs.push('--edge-source', edgeSourcePath)
    }

    const result = await runPsdRenderScript(
      scriptPath,
      scriptArgs,
      projectRoot
    )

    const outputBuffer = await fsp.readFile(outputPath)
    const metrics = await readJsonIfExists(metricsPath)

    return {
      ok: true,
      outputPath,
      outputDataUrl: `data:image/png;base64,${outputBuffer.toString('base64')}`,
      metrics,
      debugDir: workDir,
      runner: {
        python: result.pythonCommand,
        script: scriptPath
      },
      stdout: result.stdout,
      stderr: result.stderr
    }
  } catch (error) {
    const detailParts = [
      error?.message || 'PSD 原生渲染失败'
    ]
    const stderr = String(error?.stderr || '').trim()
    if (stderr) detailParts.push(stderr)
    detailParts.push(setupHint)
    return {
      ok: false,
      error: detailParts.join('\n'),
      stdout: error?.stdout || '',
      stderr: error?.stderr || '',
      setupHint
    }
  }
})

ipcMain.handle('psd:find-local-effect-template', async (_, payload) => {
  try {
    const projectRoot = resolveProjectRoot()
    const result = await findBestLocalPsdEffectTemplate(payload, projectRoot)
    return {
      ok: true,
      candidate: result.best,
      searchedRoots: result.roots,
      scannedCount: result.scannedCount
    }
  } catch (error) {
    return {
      ok: false,
      error: error?.message || 'local-psd-search-failed'
    }
  }
})

ipcMain.handle('photopea:render-effect-template', async (_, payload) =>
  enqueuePhotopeaTask(async () => {
    const projectRoot = resolveProjectRoot()
    const pythonSetupHint = createPsdRenderSetupHint(projectRoot)
    const photopeaSetupHint = createPhotopeaSetupHint(projectRoot)
    const setupHint = `${photopeaSetupHint}\n\n${pythonSetupHint}`

    try {
      const patchScriptPath = resolvePhotopeaPatchScriptPath(projectRoot)
      if (!patchScriptPath) {
        return {
          ok: false,
          error: `找不到 Photopea PSD patch 脚本。\n${setupHint}`,
          setupHint
        }
      }

      const templateBuffer = toNodeBuffer(payload?.templateBuffer)
      const sourceBuffer = toNodeBuffer(payload?.sourceBuffer)
      const edgeSourceBuffer = payload?.edgeSourceBuffer ? toNodeBuffer(payload?.edgeSourceBuffer) : null
      if (!templateBuffer?.length) throw new Error('photopea-template-buffer-missing')
      if (!sourceBuffer?.length) throw new Error('photopea-source-buffer-missing')

      const fit = ['stretch', 'cover', 'contain'].includes(String(payload?.fit || ''))
        ? String(payload.fit)
        : 'stretch'
      const sourcePreprocessMode = String(payload?.sourcePreprocess?.mode || '').trim().toLowerCase()
      const safeSourcePreprocessMode =
        sourcePreprocessMode === 'baked-grid-preview' ? sourcePreprocessMode : 'none'
      const sourceCellScale = Number(payload?.sourcePreprocess?.cellScale || 0) || 0

      const workDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'easystitch-photopea-render-'))
      const templatePath = buildTempFilePath(
        workDir,
        payload?.templateName || 'template.psd',
        payload?.templateMime || 'image/vnd.adobe.photoshop',
        'template',
        '.psd'
      )
      const sourcePath = buildTempFilePath(
        workDir,
        payload?.sourceName || 'source.png',
        payload?.sourceMime || 'image/png',
        'source',
        '.png'
      )
      const edgeSourcePath = edgeSourceBuffer?.length
        ? buildTempFilePath(
            workDir,
            payload?.edgeSourceName || 'edge-source.png',
            payload?.edgeSourceMime || 'image/png',
            'edge-source',
            '.png'
          )
        : ''
      const patchedPsdPath = path.join(workDir, `patched_${crypto.randomUUID()}.psd`)
      const outputPngPath = path.join(workDir, `rendered_${crypto.randomUUID()}.png`)
      const metadataPath = path.join(workDir, `patch_${crypto.randomUUID()}.json`)

      await fsp.writeFile(templatePath, templateBuffer)
      await fsp.writeFile(sourcePath, sourceBuffer)
      if (edgeSourcePath) {
        await fsp.writeFile(edgeSourcePath, edgeSourceBuffer)
      }

      const patchArgs = [
        '--psd', templatePath,
        '--source', sourcePath,
        '--output-psd', patchedPsdPath,
        '--fit', fit,
        '--source-preprocess', safeSourcePreprocessMode,
        '--cell-scale', String(sourceCellScale),
        '--metadata-json', metadataPath
      ]
      if (edgeSourcePath) {
        patchArgs.push('--edge-source', edgeSourcePath)
      }

      const patchResult = await runPsdRenderScript(
        patchScriptPath,
        patchArgs,
        projectRoot
      )

      const patchMetadata = await readJsonIfExists(metadataPath)
      const photopeaResult = await runPhotopeaBridgeRender(projectRoot, {
        psdPath: patchedPsdPath,
        exportFormat: 'png',
        timeoutMs: 120000,
        documentName: sanitizeFileStem(payload?.sourceName || 'rendered', 'rendered')
      })

      const pngBuffer = dataUrlToBuffer(photopeaResult.outputDataUrl)
      if (pngBuffer?.length) {
        await fsp.writeFile(outputPngPath, pngBuffer)
      }

      return {
        ok: true,
        outputPath: outputPngPath,
        patchedPsdPath,
        outputDataUrl: photopeaResult.outputDataUrl,
        metrics: {
          ...(patchMetadata || {}),
          photopea: {
            elapsedMs: photopeaResult.elapsedMs || 0,
            messages: photopeaResult.messages || [],
            logs: [...(photopeaResult.logs || []), ...(photopeaResult.consoleLogs || [])]
          }
        },
        debugDir: workDir,
        runner: {
          python: patchResult.pythonCommand,
          patchScript: patchScriptPath,
          photopeaMode: photopeaResult.editorMode,
          photopeaAttempts: photopeaResult.attempts || [],
          photopeaBundleRoot: photopeaResult.bundleRoot,
          bridgePage: photopeaResult.bridgePath,
          editorUrl: photopeaResult.editorUrl
        },
        stdout: patchResult.stdout,
        stderr: patchResult.stderr
      }
    } catch (error) {
      destroyPhotopeaBridgeWindow()
      const detailParts = [
        error?.message || 'Photopea 渲染失败'
      ]
      const stderr = String(error?.stderr || '').trim()
      if (stderr) detailParts.push(stderr)
      detailParts.push(setupHint)
      return {
        ok: false,
        error: detailParts.join('\n'),
        stdout: error?.stdout || '',
        stderr: error?.stderr || '',
        bridgeLogs: error?.bridgeLogs || [],
        attempts: error?.attempts || [],
        setupHint
      }
    }
  })
)
