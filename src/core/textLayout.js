export const COVER_TEXT_DEFAULT_FONT_FAMILY = 'Noto Sans SC'
export const COVER_TEXT_DEFAULT_FONT_STACK = `"${COVER_TEXT_DEFAULT_FONT_FAMILY}", sans-serif`
let coverTextFontReadyPromise = null

function toFiniteNumber(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export function resolveTextFontFamily(fontFamily) {
  const value = typeof fontFamily === 'string' ? fontFamily.trim() : ''
  return value || COVER_TEXT_DEFAULT_FONT_FAMILY
}

export function buildTextFont({ weight = 'normal', fontSize = 12, fontFamily } = {}) {
  const resolvedWeight = typeof weight === 'string' && weight.trim() ? weight.trim() : 'normal'
  const resolvedSize = Math.max(1, toFiniteNumber(fontSize, 12))
  const resolvedFamily = resolveTextFontFamily(fontFamily)
  return `${resolvedWeight} ${resolvedSize}px "${resolvedFamily}", sans-serif`
}

export function applyTextStyle(ctx, { weight = 'normal', fontSize = 12, fontFamily, color = '#000000', baseline = 'alphabetic' } = {}) {
  if (!ctx) return null
  ctx.font = buildTextFont({ weight, fontSize, fontFamily })
  ctx.fillStyle = color
  ctx.textBaseline = baseline
  return ctx.font
}

export function getTextMeasureContext(preferredCtx = null) {
  if (preferredCtx) return preferredCtx
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  return canvas.getContext('2d')
}

export function measureTextBox(ctx, text, options = {}) {
  const fontSize = Math.max(1, toFiniteNumber(options.fontSize, 12))
  const resolvedText = text == null ? '' : String(text)
  const resolvedFamily = resolveTextFontFamily(options.fontFamily)
  const resolvedWeight = typeof options.weight === 'string' && options.weight.trim() ? options.weight.trim() : 'normal'
  const font = buildTextFont({ weight: resolvedWeight, fontSize, fontFamily: resolvedFamily })
  if (!ctx) {
    return {
      width: resolvedText.length * fontSize,
      height: fontSize,
      ascent: fontSize * 0.8,
      descent: fontSize * 0.2,
      font,
      fontSize,
      fontFamily: resolvedFamily,
      weight: resolvedWeight
    }
  }
  ctx.save()
  ctx.font = font
  const metrics = ctx.measureText(resolvedText)
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.2
  ctx.restore()
  return {
    width: metrics.width || 0,
    height: ascent + descent,
    ascent,
    descent,
    font,
    fontSize,
    fontFamily: resolvedFamily,
    weight: resolvedWeight
  }
}

export function computeRectTextLayout(rect, text, options = {}, ctx = null) {
  const metrics = measureTextBox(ctx, text, options)
  const x = toFiniteNumber(rect?.x, 0)
  const y = toFiniteNumber(rect?.y, 0)
  const width = Math.max(0, toFiniteNumber(rect?.width, metrics.width))
  const height = Math.max(0, toFiniteNumber(rect?.height, metrics.height))
  const align = typeof options.align === 'string' && options.align.trim() ? options.align.trim() : 'center'
  const rawPaddingX = options.paddingX
  const paddingX = Number.isFinite(+rawPaddingX)
    ? Math.max(0, +rawPaddingX)
    : Math.max(0, Math.min(width * 0.1, metrics.fontSize * 0.35))
  let left = x + (width - metrics.width) / 2
  if (align === 'left') {
    left = x + paddingX
  } else if (align === 'right') {
    left = x + Math.max(0, width - metrics.width - paddingX)
  }
  const top = y + (height - metrics.height) / 2
  return {
    ...metrics,
    left,
    top,
    baselineY: top + metrics.ascent
  }
}

export function computeCenteredTextLayout(rect, text, options = {}, ctx = null) {
  return computeRectTextLayout(rect, text, { ...options, align: 'center' }, ctx)
}

export function drawTextRun(ctx, text, x, y, options = {}) {
  if (!ctx) return
  ctx.save()
  applyTextStyle(ctx, options)
  const shadowColor = typeof options.shadowColor === 'string' ? options.shadowColor : ''
  const shadowBlur = Math.max(0, toFiniteNumber(options.shadowBlur, 0))
  if (shadowColor && shadowBlur > 0) {
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = shadowBlur
  }
  ctx.fillText(text == null ? '' : String(text), toFiniteNumber(x, 0), toFiniteNumber(y, 0))
  ctx.restore()
}

export function ensureCoverTextFontReady() {
  if (coverTextFontReadyPromise) return coverTextFontReadyPromise
  if (typeof document === 'undefined' || !document.fonts?.load) {
    coverTextFontReadyPromise = Promise.resolve()
    return coverTextFontReadyPromise
  }
  const sample = '封面文字 Cover Title 123'
  coverTextFontReadyPromise = Promise.all([
    document.fonts.load(buildTextFont({ fontSize: 16, fontFamily: COVER_TEXT_DEFAULT_FONT_FAMILY, weight: 'normal' }), sample),
    document.fonts.load(buildTextFont({ fontSize: 16, fontFamily: COVER_TEXT_DEFAULT_FONT_FAMILY, weight: 'bold' }), sample)
  ]).then(() => undefined)
  return coverTextFontReadyPromise
}
