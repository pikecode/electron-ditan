function clamp01(value, fallback = 1) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  if (num <= 0) return 0
  if (num >= 1) return 1
  return num
}

function createCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width || 1))
  canvas.height = Math.max(1, Math.round(height || 1))
  return canvas
}

function layerBlendModeToCanvas(blendMode) {
  switch (String(blendMode || 'normal').toLowerCase()) {
    case 'normal': return 'source-over'
    case 'darken': return 'darken'
    case 'multiply': return 'multiply'
    case 'lighten': return 'lighten'
    case 'screen': return 'screen'
    case 'overlay': return 'overlay'
    case 'soft light': return 'soft-light'
    case 'hard light': return 'hard-light'
    case 'color dodge': return 'color-dodge'
    case 'color burn': return 'color-burn'
    case 'difference': return 'difference'
    case 'exclusion': return 'exclusion'
    case 'hue': return 'hue'
    case 'saturation': return 'saturation'
    case 'color': return 'color'
    case 'luminosity': return 'luminosity'
    default: return 'source-over'
  }
}

function isRenderableLayer(layer) {
  if (!layer || layer.hidden) return false
  if (clamp01(layer.opacity, 1) <= 0) return false
  return true
}

function collectVisibleBlendModes(layers, output = new Set()) {
  if (!Array.isArray(layers)) return output
  for (const layer of layers) {
    if (!isRenderableLayer(layer)) continue
    if (Array.isArray(layer.children) && layer.children.length) {
      collectVisibleBlendModes(layer.children, output)
      continue
    }
    output.add(String(layer.blendMode || 'normal').toLowerCase())
  }
  return output
}

function countVisibleBitmapLayers(layers) {
  let count = 0
  if (!Array.isArray(layers)) return count
  for (const layer of layers) {
    if (!isRenderableLayer(layer)) continue
    if (Array.isArray(layer.children) && layer.children.length) {
      count += countVisibleBitmapLayers(layer.children)
      continue
    }
    if (layer.canvas) count += 1
  }
  return count
}

function normalizeTemplateName(value) {
  return String(value || '')
    .trim()
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
}

function collectPatternOverlayMeta(layers, output = []) {
  if (!Array.isArray(layers)) return output
  for (const layer of layers) {
    if (!isRenderableLayer(layer)) continue
    const patternOverlay = layer?.effects?.patternOverlay
    if (patternOverlay?.enabled && patternOverlay?.pattern?.name) {
      output.push({
        layerName: layer.name || '',
        clipping: !!layer.clipping,
        blendMode: String(patternOverlay.blendMode || '').toLowerCase(),
        opacity: clamp01(patternOverlay.opacity, 1),
        angle: Number.isFinite(Number(patternOverlay.angle)) ? Number(patternOverlay.angle) : 0,
        scale: Number.isFinite(Number(patternOverlay.scale)) ? Number(patternOverlay.scale) : 1,
        align: patternOverlay.align !== false,
        phase: {
          x: Number(patternOverlay.phase?.x) || 0,
          y: Number(patternOverlay.phase?.y) || 0
        },
        pattern: {
          name: patternOverlay.pattern.name,
          normalizedName: normalizeTemplateName(patternOverlay.pattern.name),
          id: patternOverlay.pattern.id || ''
        }
      })
    }
    if (Array.isArray(layer.children) && layer.children.length) {
      collectPatternOverlayMeta(layer.children, output)
    }
  }
  return output
}

function renderBitmapLayer(ctx, layer, scaleX, scaleY) {
  const source = layer?.canvas
  if (!source) return

  const left = Number.isFinite(layer?.left) ? layer.left : 0
  const top = Number.isFinite(layer?.top) ? layer.top : 0
  const width = source.width || Math.max(0, (Number(layer?.right) || 0) - left)
  const height = source.height || Math.max(0, (Number(layer?.bottom) || 0) - top)
  if (width <= 0 || height <= 0) return

  ctx.save()
  ctx.globalAlpha = clamp01(layer.opacity, 1) * clamp01(layer.fillOpacity, 1)
  ctx.globalCompositeOperation = layerBlendModeToCanvas(layer.blendMode)
  ctx.drawImage(
    source,
    Math.round(left * scaleX),
    Math.round(top * scaleY),
    Math.max(1, Math.round(width * scaleX)),
    Math.max(1, Math.round(height * scaleY))
  )
  ctx.restore()
}

function renderLayerTree(ctx, layers, scaleX, scaleY) {
  if (!Array.isArray(layers)) return
  for (const layer of layers) {
    if (!isRenderableLayer(layer)) continue
    if (Array.isArray(layer.children) && layer.children.length) {
      const blendMode = String(layer.blendMode || 'pass through').toLowerCase()
      if (blendMode === 'pass through' && clamp01(layer.opacity, 1) >= 0.999) {
        renderLayerTree(ctx, layer.children, scaleX, scaleY)
        continue
      }
      const groupCanvas = createCanvas(ctx.canvas.width, ctx.canvas.height)
      const groupCtx = groupCanvas.getContext('2d', { willReadFrequently: true })
      renderLayerTree(groupCtx, layer.children, scaleX, scaleY)
      renderBitmapLayer(ctx, { ...layer, canvas: groupCanvas, left: 0, top: 0, blendMode }, 1, 1)
      continue
    }
    renderBitmapLayer(ctx, layer, scaleX, scaleY)
  }
}

async function readPsdFromBlob(blob) {
  const mod = await import('ag-psd')
  const readPsd = mod.readPsd || mod.default?.readPsd
  if (typeof readPsd !== 'function') throw new Error('psd-read-unavailable')
  const buf = await blob.arrayBuffer()
  return readPsd(new Uint8Array(buf))
}

export function isPsdTemplate(template) {
  const format = String(template?.format || '').toLowerCase()
  if (format === 'psd') return true
  return template?.meta?.renderMode === 'psd-layered' || template?.meta?.sourceFormat === 'psd'
}

export { normalizeTemplateName }

export function getTemplatePreviewSource(template) {
  if (typeof template?.base64 === 'string' && template.base64.trim()) {
    return template.base64
  }
  return ''
}

export async function buildPsdTemplateRecord(fileOrBlob) {
  const sourceBlob = fileOrBlob instanceof Blob ? fileOrBlob : new Blob([await fileOrBlob.arrayBuffer()], { type: fileOrBlob?.type || 'image/vnd.adobe.photoshop' })
  const psd = await readPsdFromBlob(sourceBlob)
  const previewCanvas = createCanvas(psd.width, psd.height)
  const previewCtx = previewCanvas.getContext('2d', { willReadFrequently: true })
  if (psd.canvas) {
    previewCtx.drawImage(psd.canvas, 0, 0)
  } else {
    renderLayerTree(previewCtx, psd.children, 1, 1)
  }

  const blendModes = [...collectVisibleBlendModes(psd.children)]
  const patternOverlays = collectPatternOverlayMeta(psd.children)
  const primaryPatternOverlay = patternOverlays[0] || null
  return {
    width: psd.width,
    height: psd.height,
    base64: previewCanvas.toDataURL('image/png'),
    sourceBlob,
    meta: {
      sourceFormat: 'psd',
      previewFormat: 'png',
      renderMode: 'psd-layered',
      psdRole: primaryPatternOverlay ? 'effect-template' : 'pattern-source',
      visibleLayerCount: countVisibleBitmapLayers(psd.children),
      blendModes,
      patternOverlays,
      primaryPatternOverlay
    }
  }
}

export async function composePsdTemplateWithBaseImage({
  templateBlob,
  baseImage,
  outputWidth,
  outputHeight
}) {
  if (!templateBlob) throw new Error('psd-template-blob-missing')
  if (!baseImage) throw new Error('psd-base-image-missing')

  const psd = await readPsdFromBlob(templateBlob)
  const targetWidth = Math.max(1, Math.round(outputWidth || psd.width))
  const targetHeight = Math.max(1, Math.round(outputHeight || psd.height))
  const scaleX = targetWidth / Math.max(1, psd.width)
  const scaleY = targetHeight / Math.max(1, psd.height)

  const mergedCanvas = createCanvas(targetWidth, targetHeight)
  const mergedCtx = mergedCanvas.getContext('2d', { willReadFrequently: true })
  mergedCtx.imageSmoothingEnabled = true
  mergedCtx.imageSmoothingQuality = 'high'
  mergedCtx.clearRect(0, 0, targetWidth, targetHeight)
  mergedCtx.drawImage(baseImage, 0, 0, targetWidth, targetHeight)
  renderLayerTree(mergedCtx, psd.children, scaleX, scaleY)

  const maskCanvas = createCanvas(targetWidth, targetHeight)
  const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true })
  maskCtx.clearRect(0, 0, targetWidth, targetHeight)
  if (psd.canvas) {
    maskCtx.drawImage(psd.canvas, 0, 0, targetWidth, targetHeight)
  } else {
    renderLayerTree(maskCtx, psd.children, scaleX, scaleY)
  }
  mergedCtx.save()
  mergedCtx.globalCompositeOperation = 'destination-in'
  mergedCtx.drawImage(maskCanvas, 0, 0)
  mergedCtx.restore()

  return {
    mergedCanvas,
    maskCanvas,
    width: targetWidth,
    height: targetHeight
  }
}
