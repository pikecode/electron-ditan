export const STITCH_TEXTURE_CROSS_COLOR = '#DDE1E6'
const FIXED_WHITE_STITCH_CROSS_COLOR = '#FFFFFF'
export const STITCH_CROSS_LINE_CAP = 'square'
export const STITCH_CROSS_LINE_JOIN = 'miter'
export const STITCH_PREVIEW_MODE_REAL = 'real'
export const STITCH_PREVIEW_MODE_CONTRAST = 'contrast'
export const STITCH_PREVIEW_MODE_TEXTURE = 'texture'
const DEFAULT_CROSS_WIDTH_RATIO = 0.14
const DEFAULT_CROSS_MIN_WIDTH = 1
const DEFAULT_CROSS_INSET_RATIO = 0.5

function parseRgb(color) {
  if (!color || typeof color !== 'string') return null
  const s = color.trim()
  let m = s.match(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i)
  if (m) {
    let h = m[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16)
    }
  }
  m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (m) return { r: +m[1], g: +m[2], b: +m[3] }
  return null
}

function relLuminance01({ r, g, b }) {
  const f = (v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const R = f(r)
  const G = f(g)
  const B = f(b)
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}

function isNearWhiteCrossColor(color) {
  const rgb = parseRgb(color)
  if (!rgb) return false
  const minChannel = Math.min(rgb.r, rgb.g, rgb.b)
  const maxChannel = Math.max(rgb.r, rgb.g, rgb.b)
  if (minChannel < 244) return false
  return (maxChannel - minChannel) <= 16 || relLuminance01(rgb) >= 0.94
}

export function shouldUseFixedWhiteCross(color) {
  return isNearWhiteCrossColor(color)
}

export function normalizeStitchPreviewMode(mode) {
  if (mode === STITCH_PREVIEW_MODE_CONTRAST || mode === STITCH_PREVIEW_MODE_TEXTURE) return mode
  return STITCH_PREVIEW_MODE_REAL
}

export function shouldDrawTexturePreview(previewMode) {
  return normalizeStitchPreviewMode(previewMode) === STITCH_PREVIEW_MODE_TEXTURE
}

export function resolveCrossStrokeColor(color) {
  if (!color) return '#000'
  return shouldUseFixedWhiteCross(color) ? FIXED_WHITE_STITCH_CROSS_COLOR : color
}

export function shouldDrawCrossOutline(color, outlined = false, previewMode = STITCH_PREVIEW_MODE_REAL) {
  const mode = normalizeStitchPreviewMode(previewMode)
  return !!outlined || mode !== STITCH_PREVIEW_MODE_REAL || shouldUseFixedWhiteCross(color)
}

export function resolveCrossOutlineColor(
  color,
  outlineColor = null,
  outlineColorPercentage = 80,
  previewMode = STITCH_PREVIEW_MODE_REAL
) {
  if (outlineColor) return outlineColor
  const rgb = parseRgb(color)
  if (!rgb) return 'rgba(0,0,0,0.35)'
  const mode = normalizeStitchPreviewMode(previewMode)
  let ratio = Math.max(0, Math.min(1, Number(outlineColorPercentage || 80) / 100))
  if (mode === STITCH_PREVIEW_MODE_REAL && shouldUseFixedWhiteCross(color)) {
    ratio = Math.min(ratio, 0.82)
  }
  const r = Math.round(rgb.r * ratio)
  const g = Math.round(rgb.g * ratio)
  const b = Math.round(rgb.b * ratio)
  return `rgb(${r},${g},${b})`
}

export function resolveCrossOutlineWidth(strokeWidth, {
  outlineThickness = 0.2,
  color = null,
  previewMode = STITCH_PREVIEW_MODE_REAL
} = {}) {
  const width = Number(strokeWidth) || 0
  if (!isFinite(width) || width <= 0) return width
  if (normalizeStitchPreviewMode(previewMode) === STITCH_PREVIEW_MODE_REAL) {
    if (shouldUseFixedWhiteCross(color)) {
      return Math.max(width + 0.8, width * 1.28)
    }
    return Math.max(width + 0.35, width * 1.12)
  }
  return Math.max(width + 0.6, width * (1.2 + Number(outlineThickness || 0.2)))
}

export function resolveCrossStrokeWidth(baseSize, {
  widthRatio = DEFAULT_CROSS_WIDTH_RATIO,
  minWidth = DEFAULT_CROSS_MIN_WIDTH,
  maxWidth = Infinity
} = {}) {
  const size = Number(baseSize) || 0
  if (!isFinite(size) || size <= 0) return size
  const width = Math.max(minWidth, size * widthRatio)
  return Math.min(maxWidth, width)
}

export function resolveCrossGeometry(x, y, cellWidth, cellHeight, {
  pad = 0,
  strokeWidth = 1,
  insetRatio = DEFAULT_CROSS_INSET_RATIO
} = {}) {
  const inset = Math.max(0, Number(strokeWidth) || 0) * insetRatio
  return {
    startX: x + pad + inset,
    startY: y + pad + inset,
    endX: x + cellWidth - pad - inset,
    endY: y + cellHeight - pad - inset
  }
}

export function parseRgbForStitch(color) {
  return parseRgb(color)
}
