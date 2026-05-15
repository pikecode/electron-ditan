import { buildPalette } from './palette_builder.js'

const MAX_ENTRIES = 16
/** @type {Map<string, ReturnType<typeof buildPalette>>} */
const cache = new Map()

export function fingerprintImageData(imageData) {
  const { width, height, data } = imageData
  let h = 2166136261 >>> 0
  const n = data.length
  const stride = Math.max(16, Math.floor(n / 8000) & ~3)
  for (let i = 0; i < n; i += stride) {
    h ^= data[i]
    h = Math.imul(h, 16777619) >>> 0
    h ^= data[i + 1]
    h = Math.imul(h, 16777619) >>> 0
    h ^= data[i + 2]
    h = Math.imul(h, 16777619) >>> 0
    h ^= data[i + 3]
    h = Math.imul(h, 16777619) >>> 0
  }
  return `${width}x${height}:${h.toString(16)}`
}

/**
 * Stable key for palette configuration. Includes colorCount so changing 10→20→30 invalidates cache.
 */
export function paletteConfigCacheKey(paletteConfig) {
  if (!paletteConfig) return 'null'
  if (paletteConfig.type === 'count') {
    const ids = (paletteConfig.allColors || []).map((c) => String(c.id)).sort().join('\0')
    return `c|${paletteConfig.colorCount}|${ids.length}|${ids}`
  }
  if (paletteConfig.type === 'group') {
    const list = paletteConfig.colors || paletteConfig.allColors || []
    const ids = list.map((c) => String(c.id)).sort().join('\0')
    return `g|${paletteConfig.groupId || ''}|${paletteConfig.colorCount ?? ''}|${ids.length}|${ids}`
  }
  try {
    return `raw|${JSON.stringify(paletteConfig)}`
  } catch {
    return 'raw|!'
  }
}

function cacheKeyParts(paletteConfig, imageData, rows, cols, sampleMin) {
  const imgFp = fingerprintImageData(imageData)
  return `${paletteConfigCacheKey(paletteConfig)}|${imgFp}|${rows}x${cols}|s${sampleMin}`
}

function touch(key, value) {
  if (cache.delete(key)) cache.set(key, value)
  else {
    cache.set(key, value)
    while (cache.size > MAX_ENTRIES) {
      const first = cache.keys().next().value
      cache.delete(first)
    }
  }
}

/**
 * buildPalette with LRU cache for identical palette config + image fingerprint + grid + sampling preset.
 */
export function buildPaletteCached(paletteConfig, sampleColors, imageData, rows, cols, sampleMin) {
  if (!paletteConfig) return []
  const key = cacheKeyParts(paletteConfig, imageData, rows, cols, sampleMin)
  const hit = cache.get(key)
  if (hit) {
    touch(key, hit)
    return hit
  }
  const built = buildPalette(paletteConfig, sampleColors)
  touch(key, built)
  return built
}

export function clearPaletteBuildCache() {
  cache.clear()
}
