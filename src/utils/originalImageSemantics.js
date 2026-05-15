const BAKED_GRID_PREVIEW_KIND = 'baked-grid-preview'
const analysisCache = new Map()

function normalizeImageSource(src) {
  if (typeof src !== 'string') return ''
  const value = src.trim()
  if (!value) return ''
  if (/^(data:|blob:|https?:|file:)/i.test(value)) return value
  return `data:image/png;base64,${value.replace(/\s/g, '')}`
}

function parseHexChannel(value) {
  return Number.parseInt(value, 16)
}

function parseColor(value) {
  const input = String(value || '').trim()
  if (!input || input === 'transparent') return null

  if (input.startsWith('#')) {
    const hex = input.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = parseHexChannel(hex[0] + hex[0])
      const g = parseHexChannel(hex[1] + hex[1])
      const b = parseHexChannel(hex[2] + hex[2])
      const a = hex.length === 4 ? parseHexChannel(hex[3] + hex[3]) : 255
      return { r, g, b, a }
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseHexChannel(hex.slice(0, 2))
      const g = parseHexChannel(hex.slice(2, 4))
      const b = parseHexChannel(hex.slice(4, 6))
      const a = hex.length === 8 ? parseHexChannel(hex.slice(6, 8)) : 255
      return { r, g, b, a }
    }
  }

  const rgbMatch = input.match(/^rgba?\(([^)]+)\)$/i)
  if (!rgbMatch) return null
  const parts = rgbMatch[1].split(',').map(part => part.trim())
  if (parts.length < 3) return null
  const r = Number(parts[0])
  const g = Number(parts[1])
  const b = Number(parts[2])
  const alphaValue = parts.length >= 4 ? Number(parts[3]) : 1
  if (![r, g, b, alphaValue].every(Number.isFinite)) return null
  return {
    r: Math.max(0, Math.min(255, Math.round(r))),
    g: Math.max(0, Math.min(255, Math.round(g))),
    b: Math.max(0, Math.min(255, Math.round(b))),
    a: Math.max(0, Math.min(255, Math.round(alphaValue <= 1 ? alphaValue * 255 : alphaValue)))
  }
}

function getPixel(data, width, x, y) {
  const idx = (y * width + x) * 4
  return {
    r: data[idx] || 0,
    g: data[idx + 1] || 0,
    b: data[idx + 2] || 0,
    a: data[idx + 3] || 0
  }
}

function averageSamples(samples) {
  const total = samples.reduce((acc, sample) => {
    acc.r += sample.r
    acc.g += sample.g
    acc.b += sample.b
    acc.a += sample.a
    return acc
  }, { r: 0, g: 0, b: 0, a: 0 })
  const count = Math.max(1, samples.length)
  return {
    r: total.r / count,
    g: total.g / count,
    b: total.b / count,
    a: total.a / count
  }
}

function getMaxChannelSpread(samples) {
  const values = {
    r: samples.map(sample => sample.r),
    g: samples.map(sample => sample.g),
    b: samples.map(sample => sample.b),
    a: samples.map(sample => sample.a)
  }
  return Math.max(
    Math.max(...values.r) - Math.min(...values.r),
    Math.max(...values.g) - Math.min(...values.g),
    Math.max(...values.b) - Math.min(...values.b),
    Math.max(...values.a) - Math.min(...values.a)
  )
}

function getMaxColorDistance(left, right) {
  return Math.max(
    Math.abs((left?.r || 0) - (right?.r || 0)),
    Math.abs((left?.g || 0) - (right?.g || 0)),
    Math.abs((left?.b || 0) - (right?.b || 0)),
    Math.abs((left?.a ?? 255) - (right?.a ?? 255))
  )
}

function resolveGridScale(width, height, rows, cols) {
  const scaleX = width / cols
  const scaleY = height / rows
  const roundedScaleX = Math.round(scaleX)
  const roundedScaleY = Math.round(scaleY)
  const sameIntegerScale =
    roundedScaleX >= 4 &&
    roundedScaleX === roundedScaleY &&
    Math.abs(scaleX - roundedScaleX) <= 0.08 &&
    Math.abs(scaleY - roundedScaleY) <= 0.08
  return sameIntegerScale ? roundedScaleX : 0
}

function buildCacheKey({ imageSrc, width, height, rows, cols }) {
  const source = normalizeImageSource(imageSrc)
  if (!source) return ''
  return [
    width,
    height,
    rows,
    cols,
    source.length,
    source.slice(0, 48),
    source.slice(-24)
  ].join('|')
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('original-image-load-failed'))
    img.src = src
  })
}

export async function resolveImageIntrinsicSize(src, fallback = {}) {
  const normalizedSource = normalizeImageSource(src)
  if (!normalizedSource) {
    return {
      width: Number(fallback?.width) || 0,
      height: Number(fallback?.height) || 0
    }
  }

  try {
    const img = await loadImageElement(normalizedSource)
    return {
      width: Number(img.naturalWidth || img.width || fallback?.width || 0) || 0,
      height: Number(img.naturalHeight || img.height || fallback?.height || 0) || 0
    }
  } catch (_) {
    return {
      width: Number(fallback?.width) || 0,
      height: Number(fallback?.height) || 0
    }
  }
}

export function buildOriginalImageRecord({ dataUrl, width, height, analysis = null }) {
  const normalizedSource = normalizeImageSource(dataUrl)
  if (!normalizedSource) return null
  const record = {
    data: normalizedSource,
    thumbnail: normalizedSource,
    size: {
      width: Number(width) || 0,
      height: Number(height) || 0
    }
  }
  if (analysis?.looksBakedGridPreview) {
    record.sourceKind = BAKED_GRID_PREVIEW_KIND
    record.gridScale = Number(analysis.scale) || 0
  }
  return record
}

export function isMarkedBakedGridPreview(image) {
  return String(image?.sourceKind || '').trim().toLowerCase() === BAKED_GRID_PREVIEW_KIND
}

export async function analyzeOriginalImageAgainstGrid({
  imageSrc,
  width,
  height,
  rows,
  cols,
  cellsMatrix
}) {
  const normalizedSource = normalizeImageSource(imageSrc)
  const safeRows = Number(rows || 0)
  const safeCols = Number(cols || 0)
  const matrix = Array.isArray(cellsMatrix) ? cellsMatrix : []
  if (!normalizedSource || !safeRows || !safeCols || !matrix.length) {
    return { looksBakedGridPreview: false, scale: 0, sampledCells: 0, matchedCells: 0 }
  }

  const cacheKey = buildCacheKey({
    imageSrc: normalizedSource,
    width,
    height,
    rows: safeRows,
    cols: safeCols
  })
  if (cacheKey && analysisCache.has(cacheKey)) {
    return analysisCache.get(cacheKey)
  }

  let result = { looksBakedGridPreview: false, scale: 0, sampledCells: 0, matchedCells: 0 }
  try {
    const img = await loadImageElement(normalizedSource)
    const imgWidth = Number(img.naturalWidth || img.width || width || 0)
    const imgHeight = Number(img.naturalHeight || img.height || height || 0)
    const scale = resolveGridScale(imgWidth, imgHeight, safeRows, safeCols)
    if (!scale) {
      if (cacheKey) analysisCache.set(cacheKey, result)
      return result
    }

    const canvas = document.createElement('canvas')
    canvas.width = imgWidth
    canvas.height = imgHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      if (cacheKey) analysisCache.set(cacheKey, result)
      return result
    }

    ctx.drawImage(img, 0, 0)
    const imageData = ctx.getImageData(0, 0, imgWidth, imgHeight).data
    const totalCells = safeRows * safeCols
    const step = Math.max(1, Math.floor(Math.sqrt(totalCells / 180)))
    let sampledCells = 0
    let matchedCells = 0

    for (let row = 0; row < safeRows; row += step) {
      const rowCells = Array.isArray(matrix[row]) ? matrix[row] : []
      for (let col = 0; col < safeCols; col += step) {
        const expected = parseColor(rowCells[col]?.color || rowCells[col]?.hex)
        if (!expected || expected.a <= 8) continue

        const xStart = Math.floor(col * scale)
        const yStart = Math.floor(row * scale)
        const xEnd = Math.min(imgWidth - 1, Math.floor((col + 1) * scale) - 1)
        const yEnd = Math.min(imgHeight - 1, Math.floor((row + 1) * scale) - 1)
        if (xEnd < xStart || yEnd < yStart) continue

        const xMid = Math.floor((xStart + xEnd) / 2)
        const yMid = Math.floor((yStart + yEnd) / 2)
        const samples = [
          getPixel(imageData, imgWidth, xMid, yMid),
          getPixel(imageData, imgWidth, xStart, yStart),
          getPixel(imageData, imgWidth, xEnd, yStart),
          getPixel(imageData, imgWidth, xStart, yEnd),
          getPixel(imageData, imgWidth, xEnd, yEnd)
        ]

        sampledCells += 1
        const spread = getMaxChannelSpread(samples)
        const avgSample = averageSamples(samples)
        const distance = getMaxColorDistance(avgSample, expected)
        if (spread <= 4 && distance <= 10) {
          matchedCells += 1
        }
      }
    }

    const looksBakedGridPreview =
      sampledCells >= 20 &&
      matchedCells / sampledCells >= 0.95

    result = { looksBakedGridPreview, scale, sampledCells, matchedCells }
  } catch (_) {
    result = { looksBakedGridPreview: false, scale: 0, sampledCells: 0, matchedCells: 0 }
  }

  if (cacheKey) analysisCache.set(cacheKey, result)
  return result
}
