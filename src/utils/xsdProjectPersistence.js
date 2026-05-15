function safeParseObject(value) {
  if (value == null) return null
  if (typeof value === 'string') {
    try {
      return safeParseObject(JSON.parse(value))
    } catch {
      return null
    }
  }
  if (typeof value !== 'object') return null
  return value
}

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeXsdSource(source) {
  const raw = safeParseObject(source)
  if (!raw) return null

  const path = String(raw.path || '').trim()
  const name = String(raw.name || '').trim()
  const size = toNumber(raw.size, 0)

  if (!path && !name && !size) return null
  return { path, name, size }
}

function normalizeStitch(stitch) {
  if (Array.isArray(stitch)) {
    const [x, y, colorIndex] = stitch
    return {
      x: toNumber(x, 0),
      y: toNumber(y, 0),
      colorIndex: toNumber(colorIndex, 0)
    }
  }

  const raw = safeParseObject(stitch)
  if (!raw) return null

  return {
    x: toNumber(raw.x ?? raw.gridX ?? raw.grid_x, 0),
    y: toNumber(raw.y ?? raw.gridY ?? raw.grid_y, 0),
    colorIndex: toNumber(raw.colorIndex ?? raw.color_index ?? raw.palindex ?? raw.palIndex, 0)
  }
}

function normalizeStitches(stitches) {
  if (!Array.isArray(stitches)) return []
  return stitches
    .map(normalizeStitch)
    .filter(Boolean)
}

function encodeStitches(stitches) {
  return normalizeStitches(stitches).map(stitch => [
    stitch.x,
    stitch.y,
    stitch.colorIndex
  ])
}

export function buildPersistedXsdParsed(xsdParsed, options = {}) {
  const raw = safeParseObject(xsdParsed)
  if (!raw) return null

  const source = normalizeXsdSource(options.source || raw.source || raw.xsdSource)
  const fabricWidth = toNumber(raw.rebuild?.fabricWidth ?? raw.fabricWidth ?? raw.fabric_width, 0)
  const fabricHeight = toNumber(raw.rebuild?.fabricHeight ?? raw.fabricHeight ?? raw.fabric_height, 0)
  const scale = Math.max(1, toNumber(raw.rebuild?.scale ?? raw.scale, 1))
  const stitches = encodeStitches(raw.rebuild?.stitches ?? raw.stitches)

  const persisted = {
    displayMeta: raw.displayMeta || null
  }

  if (source) {
    persisted.source = source
  }

  if (fabricWidth > 0 && fabricHeight > 0 && stitches.length > 0) {
    persisted.rebuild = {
      fabricWidth,
      fabricHeight,
      scale,
      stitches
    }
  }

  if (!persisted.displayMeta && !persisted.source && !persisted.rebuild) {
    return null
  }

  return persisted
}

export function hydratePersistedXsdParsed(xsdParsed, options = {}) {
  const persisted = buildPersistedXsdParsed(xsdParsed, options)
  if (!persisted) return null

  const rebuild = persisted.rebuild || null
  return {
    displayMeta: persisted.displayMeta || null,
    source: persisted.source || null,
    imageBase64: options.imageBase64 || null,
    imageWidth: toNumber(options.imageWidth, 0),
    imageHeight: toNumber(options.imageHeight, 0),
    fabricWidth: toNumber(rebuild?.fabricWidth, 0),
    fabricHeight: toNumber(rebuild?.fabricHeight, 0),
    scale: Math.max(1, toNumber(rebuild?.scale, 1)),
    stitches: normalizeStitches(rebuild?.stitches)
  }
}

export function extractPersistedXsdSource(xsdParsed) {
  return buildPersistedXsdParsed(xsdParsed)?.source || null
}

export function hasPersistedXsdRebuildPayload(xsdParsed) {
  const persisted = buildPersistedXsdParsed(xsdParsed)
  return !!(
    persisted?.rebuild?.fabricWidth &&
    persisted?.rebuild?.fabricHeight &&
    Array.isArray(persisted?.rebuild?.stitches) &&
    persisted.rebuild.stitches.length
  )
}
