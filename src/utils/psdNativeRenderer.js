function getIpcRenderer() {
  if (typeof window !== 'undefined' && window?.electron?.ipcRenderer) {
    return window.electron.ipcRenderer
  }
  try {
    const { ipcRenderer } = require('electron')
    return ipcRenderer
  } catch (_) {
    return null
  }
}

async function blobToUint8Array(blob, length = 4) {
  const slice = blob.slice(0, length)
  const buffer = await slice.arrayBuffer()
  return new Uint8Array(buffer)
}

function inferExtensionFromMime(mime = '') {
  const normalized = String(mime || '').toLowerCase()
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return '.jpg'
  if (normalized.includes('png')) return '.png'
  if (normalized.includes('webp')) return '.webp'
  if (normalized.includes('gif')) return '.gif'
  if (normalized.includes('bmp')) return '.bmp'
  if (normalized.includes('tiff')) return '.tif'
  if (normalized.includes('psd') || normalized.includes('photoshop')) return '.psd'
  return ''
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(String(dataUrl || ''))
  if (!match) throw new Error('invalid-data-url')
  const mime = match[1] || 'application/octet-stream'
  const encoded = match[3] || ''
  const binary = match[2] ? atob(encoded) : decodeURIComponent(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return new Blob([bytes], { type: mime })
}

async function loadSourceBlob(source) {
  if (source instanceof Blob) return source
  const normalized = String(source || '').trim()
  if (!normalized) throw new Error('psd-native-source-missing')
  if (/^data:/i.test(normalized)) return dataUrlToBlob(normalized)

  const response = await fetch(normalized)
  if (!response.ok) {
    throw new Error(`psd-native-source-fetch-failed:${response.status}`)
  }
  return response.blob()
}

function buildFileName(name, mime, fallbackBase) {
  const raw = String(name || '').trim()
  if (raw) return raw
  const ext = inferExtensionFromMime(mime) || ''
  return `${fallbackBase}${ext}`
}

export function canUsePsdNativeRenderer() {
  return !!getIpcRenderer()
}

export function canUsePhotopeaRenderer() {
  return !!getIpcRenderer()
}

export async function findLocalPsdEffectTemplateCandidate({
  templateName = '',
  width = 0,
  height = 0,
  projectName = '',
  lookupTokens = []
} = {}) {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) return null

  const result = await ipcRenderer.invoke('psd:find-local-effect-template', {
    templateName: String(templateName || '').trim(),
    width: Number(width || 0) || 0,
    height: Number(height || 0) || 0,
    projectName: String(projectName || '').trim(),
    lookupTokens: Array.isArray(lookupTokens)
      ? lookupTokens.map(token => String(token || '').trim()).filter(Boolean)
      : []
  })
  if (!result?.ok) {
    throw new Error(result?.error || 'local-psd-search-failed')
  }
  return result?.candidate || null
}

export async function inspectTemplateBlob(blob) {
  if (!(blob instanceof Blob)) {
    return { ok: false, isPsd: false, signature: '' }
  }
  try {
    const bytes = await blobToUint8Array(blob, 4)
    const signature = Array.from(bytes).map(value => String.fromCharCode(value)).join('')
    return {
      ok: true,
      isPsd: signature === '8BPS',
      signature
    }
  } catch (error) {
    return {
      ok: false,
      isPsd: false,
      signature: '',
      error: error?.message || String(error)
    }
  }
}

export async function renderPsdEffectTemplateWithPython({
  templateBlob,
  source,
  edgeSource = null,
  fit = 'stretch',
  templateName = '',
  sourceName = '',
  edgeSourceName = '',
  sourcePreprocess = null
}) {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) throw new Error('electron-ipc-unavailable')
  if (!(templateBlob instanceof Blob)) throw new Error('psd-native-template-blob-missing')
  const templateInspect = await inspectTemplateBlob(templateBlob)
  if (templateInspect.ok && !templateInspect.isPsd) {
    throw new Error(`psd-native-template-invalid-signature:${templateInspect.signature || 'unknown'}`)
  }

  const resolvedSourceBlob = await loadSourceBlob(source)
  const resolvedEdgeSourceBlob = edgeSource ? await loadSourceBlob(edgeSource) : null
  const payload = {
    fit,
    templateName: buildFileName(
      templateName,
      templateBlob.type || 'image/vnd.adobe.photoshop',
      'template'
    ),
    sourceName: buildFileName(sourceName, resolvedSourceBlob.type || 'image/png', 'source'),
    templateMime: templateBlob.type || 'image/vnd.adobe.photoshop',
    sourceMime: resolvedSourceBlob.type || 'application/octet-stream',
    templateBuffer: await templateBlob.arrayBuffer(),
    sourceBuffer: await resolvedSourceBlob.arrayBuffer(),
    edgeSourceName: resolvedEdgeSourceBlob
      ? buildFileName(edgeSourceName, resolvedEdgeSourceBlob.type || 'image/png', 'edge-source')
      : '',
    edgeSourceMime: resolvedEdgeSourceBlob?.type || '',
    edgeSourceBuffer: resolvedEdgeSourceBlob ? await resolvedEdgeSourceBlob.arrayBuffer() : null,
    sourcePreprocess:
      sourcePreprocess && typeof sourcePreprocess === 'object'
        ? {
            mode: String(sourcePreprocess.mode || '').trim(),
            cellScale: Number(sourcePreprocess.cellScale || 0) || 0
          }
        : null
  }

  const result = await ipcRenderer.invoke('psd:render-effect-template', payload)
  if (!result?.ok) {
    throw new Error(result?.error || 'psd-native-render-failed')
  }
  return result
}

export async function renderPsdEffectTemplateWithPhotopea({
  templateBlob,
  source,
  edgeSource = null,
  fit = 'stretch',
  templateName = '',
  sourceName = '',
  edgeSourceName = '',
  sourcePreprocess = null
}) {
  const ipcRenderer = getIpcRenderer()
  if (!ipcRenderer) throw new Error('electron-ipc-unavailable')
  if (!(templateBlob instanceof Blob)) throw new Error('photopea-template-blob-missing')
  const templateInspect = await inspectTemplateBlob(templateBlob)
  if (templateInspect.ok && !templateInspect.isPsd) {
    throw new Error(`photopea-template-invalid-signature:${templateInspect.signature || 'unknown'}`)
  }

  const resolvedSourceBlob = await loadSourceBlob(source)
  const resolvedEdgeSourceBlob = edgeSource ? await loadSourceBlob(edgeSource) : null
  const payload = {
    fit,
    templateName: buildFileName(
      templateName,
      templateBlob.type || 'image/vnd.adobe.photoshop',
      'template'
    ),
    sourceName: buildFileName(sourceName, resolvedSourceBlob.type || 'image/png', 'source'),
    templateMime: templateBlob.type || 'image/vnd.adobe.photoshop',
    sourceMime: resolvedSourceBlob.type || 'application/octet-stream',
    templateBuffer: await templateBlob.arrayBuffer(),
    sourceBuffer: await resolvedSourceBlob.arrayBuffer(),
    edgeSourceName: resolvedEdgeSourceBlob
      ? buildFileName(edgeSourceName, resolvedEdgeSourceBlob.type || 'image/png', 'edge-source')
      : '',
    edgeSourceMime: resolvedEdgeSourceBlob?.type || '',
    edgeSourceBuffer: resolvedEdgeSourceBlob ? await resolvedEdgeSourceBlob.arrayBuffer() : null,
    sourcePreprocess:
      sourcePreprocess && typeof sourcePreprocess === 'object'
        ? {
            mode: String(sourcePreprocess.mode || '').trim(),
            cellScale: Number(sourcePreprocess.cellScale || 0) || 0
          }
        : null
  }

  const result = await ipcRenderer.invoke('photopea:render-effect-template', payload)
  if (!result?.ok) {
    throw new Error(result?.error || 'photopea-render-failed')
  }
  return result
}
