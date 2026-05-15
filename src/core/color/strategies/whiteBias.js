import { deltaE00, rgbToLab } from '../../color/color_space.js'

function getBrightness({ r, g, b }) {
  return (r * 299 + g * 587 + b * 114) / 1000
}

function getChannelSpread({ r, g, b }) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function parseHexRgb(hex) {
  if (!hex || typeof hex !== 'string') return null
  const raw = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return null
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16)
  }
}

export function normalizePaletteEntry(entry) {
  if (!entry) return null
  const hex = String(entry.hex || entry.color || '').trim().toUpperCase()
  const rgb = entry.rgb || parseHexRgb(hex)
  if (!hex || !rgb) return null
  return {
    ...entry,
    id: entry.id ?? entry.code ?? entry.number ?? entry.name ?? hex,
    name: entry.name || entry.number || '',
    hex,
    rgb,
    lab: entry.lab || rgbToLab(rgb)
  }
}

export function normalizePaletteEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => normalizePaletteEntry(entry))
    .filter(Boolean)
}

export function isBrightNeutralBackgroundRgb(rgb) {
  if (!rgb) return false
  return getBrightness(rgb) >= 236 && getChannelSpread(rgb) <= 24
}

export function findPureWhitePaletteEntry(palette) {
  if (!Array.isArray(palette)) return null
  return (
    normalizePaletteEntries(palette).find((entry) => {
      const rgb = entry?.rgb
      return rgb && rgb.r === 255 && rgb.g === 255 && rgb.b === 255
    }) || null
  )
}

export function pickBlankFillEntry(palette, backgroundRgb = null) {
  const normalizedPalette = normalizePaletteEntries(palette)
  if (!normalizedPalette.length) return null
  const pureWhite = findPureWhitePaletteEntry(normalizedPalette)
  if (pureWhite) return pureWhite
  return pickBackgroundFillEntry(normalizedPalette, backgroundRgb) || normalizedPalette[0]
}

export function findNearestPaletteEntry(palette, rgb) {
  const normalizedPalette = normalizePaletteEntries(palette)
  if (!normalizedPalette.length || !rgb) return normalizedPalette[0] || null
  const lab = rgbToLab(rgb)
  let best = null
  let bestDist = Infinity
  for (const entry of normalizedPalette) {
    const d = deltaE00(lab, entry.lab)
    if (d < bestDist) {
      bestDist = d
      best = entry
    }
  }
  return best
}

export function pickBackgroundFillEntry(palette, backgroundRgb = null) {
  const normalizedPalette = normalizePaletteEntries(palette)
  if (!normalizedPalette.length) return null
  const resolvedBackground = backgroundRgb || { r: 255, g: 255, b: 255 }
  const pureWhite = findPureWhitePaletteEntry(normalizedPalette)
  if (pureWhite && isBrightNeutralBackgroundRgb(resolvedBackground)) {
    return pureWhite
  }
  return findNearestPaletteEntry(normalizedPalette, resolvedBackground) || pureWhite || normalizedPalette[0]
}

export function ensureBackgroundFillEntry(palette, candidateEntries, backgroundRgb = null, maxSize = null) {
  const normalizedPalette = normalizePaletteEntries(palette)
  if (!normalizedPalette.length) return normalizedPalette

  const fillEntry = pickBlankFillEntry(
    candidateEntries && candidateEntries.length ? candidateEntries : normalizedPalette,
    backgroundRgb
  )
  if (!fillEntry) return normalizedPalette

  if (normalizedPalette.some((entry) => entry.id === fillEntry.id || entry.hex === fillEntry.hex)) {
    return normalizedPalette
  }

  const limit = Math.max(0, Number(maxSize) || normalizedPalette.length)
  if (!limit || normalizedPalette.length < limit) {
    return [...normalizedPalette, fillEntry]
  }
  if (limit <= 1) return [fillEntry]
  return [...normalizedPalette.slice(0, limit - 1), fillEntry]
}

export function preferPureWhiteEntry(lab, stat, bestEntry, bestDist, whiteEntry) {
  if (!lab || !stat || !bestEntry || !whiteEntry || bestEntry.id === whiteEntry.id) {
    return { entry: bestEntry, dist: bestDist }
  }

  if (!whiteEntry.lab) whiteEntry.lab = rgbToLab(whiteEntry.rgb)

  const brightness = getBrightness(stat)
  const spread = getChannelSpread(stat)
  const backgroundLikeRatio = Number(stat.backgroundLikeRatio || 0)
  const whiteDist = deltaE00(lab, whiteEntry.lab)

  const brightBackgroundWhite =
    backgroundLikeRatio >= 0.5 &&
    brightness >= 236 &&
    whiteDist <= bestDist + 12

  const cleanNearWhite =
    brightness >= 244 &&
    spread <= 18 &&
    whiteDist <= bestDist + 6

  const pureWhiteLike =
    brightness >= 248 &&
    spread <= 10 &&
    whiteDist <= bestDist + 3

  if (brightBackgroundWhite || cleanNearWhite || pureWhiteLike) {
    return { entry: whiteEntry, dist: whiteDist }
  }

  return { entry: bestEntry, dist: bestDist }
}

export function shouldForceBackgroundFillCell(stat, backgroundInfo = null) {
  if (!stat) return true

  const alphaCoverage =
    Number.isFinite(stat.alphaCoverage) ? stat.alphaCoverage : Number(stat.opaqueRatio || 0)
  const transparentRatio =
    Number.isFinite(stat.transparentRatio) ? stat.transparentRatio : Math.max(0, 1 - alphaCoverage)
  if (stat.opaqueCount === 0 || Number(stat.opaqueRatio || 0) <= 0.08) {
    return true
  }
  if (transparentRatio >= 0.45) {
    return true
  }

  const brightness = getBrightness(stat)
  const spread = getChannelSpread(stat)
  const backgroundLikeRatio = Number(stat.backgroundLikeRatio || 0)

  if (backgroundInfo?.transparentAsWhite) {
    if (transparentRatio >= 0.25 && brightness >= 230 && spread <= 56) {
      return true
    }
    if (transparentRatio >= 0.12 && backgroundLikeRatio >= 0.72 && brightness >= 226 && spread <= 64) {
      return true
    }
  }

  return false
}
