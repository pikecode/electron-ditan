/** Target minimum opaque pixel samples per grid cell (adaptive step). */
export const DEFAULT_MIN_SAMPLES_PER_CELL = 64
const DEFAULT_BACKGROUND_PIXEL_DISTANCE = 26

/**
 * Largest step s such that ceil(pxW/s)*ceil(pxH/s) >= minSamples.
 * Fewer, larger steps when the cell is small; finer steps when the cell is large.
 */
export function getAdaptiveSampleStep(pxW, pxH, minSamples = DEFAULT_MIN_SAMPLES_PER_CELL) {
  if (pxW <= 0 || pxH <= 0) return 1
  const area = pxW * pxH
  if (area <= minSamples) return 1

  let lo = 1
  let hi = Math.max(pxW, pxH)
  let best = 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const cnt = Math.ceil(pxW / mid) * Math.ceil(pxH / mid)
    if (cnt >= minSamples) {
      best = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return Math.max(1, best)
}

function getBrightness({ r, g, b }) {
  return (r * 299 + g * 587 + b * 114) / 1000
}

function getChannelSpread({ r, g, b }) {
  return Math.max(r, g, b) - Math.min(r, g, b)
}

function rgbDistance(a, b) {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function normalizeSamplingOptions(minSamplesOrOptions) {
  if (typeof minSamplesOrOptions === 'number') {
    return {
      minSamples: minSamplesOrOptions,
      backgroundRgb: null,
      backgroundDistanceThreshold: DEFAULT_BACKGROUND_PIXEL_DISTANCE
    }
  }
  const opts = minSamplesOrOptions || {}
  return {
    minSamples: opts.minSamples ?? DEFAULT_MIN_SAMPLES_PER_CELL,
    backgroundRgb: opts.backgroundRgb || null,
    backgroundDistanceThreshold:
      opts.backgroundDistanceThreshold ?? DEFAULT_BACKGROUND_PIXEL_DISTANCE
  }
}

export function sampleCellStats(imageData, x0, y0, x1, y1, minSamplesOrOptions = DEFAULT_MIN_SAMPLES_PER_CELL) {
  const { data, width } = imageData
  const { minSamples, backgroundRgb, backgroundDistanceThreshold } = normalizeSamplingOptions(minSamplesOrOptions)
  const pxW = x1 - x0
  const pxH = y1 - y0
  if (pxW <= 0 || pxH <= 0) {
    return {
      r: 255,
      g: 255,
      b: 255,
      v: 0,
      sampleCount: 0,
      opaqueCount: 0,
      opaqueRatio: 0,
      backgroundLikeRatio: 0
    }
  }

  const step = getAdaptiveSampleStep(pxW, pxH, minSamples)
  let sr = 0
  let sg = 0
  let sb = 0
  let sr2 = 0
  let sg2 = 0
  let sb2 = 0
  let sampleCount = 0
  let opaqueCount = 0
  let transparentCount = 0
  let alphaCoverageSum = 0
  let backgroundLikeCount = 0

  for (let y = y0; y < y1; y += step) {
    const rowOff = y * width
    for (let x = x0; x < x1; x += step) {
      sampleCount++
      const idx = (rowOff + x) * 4
      const a = data[idx + 3]
      const alpha01 = a / 255
      alphaCoverageSum += alpha01
      if (a === 0) {
        transparentCount++
        continue
      }

      const r8 = Math.round(data[idx] * alpha01 + 255 * (1 - alpha01))
      const g8 = Math.round(data[idx + 1] * alpha01 + 255 * (1 - alpha01))
      const b8 = Math.round(data[idx + 2] * alpha01 + 255 * (1 - alpha01))
      sr += r8
      sg += g8
      sb += b8
      sr2 += r8 * r8
      sg2 += g8 * g8
      sb2 += b8 * b8
      opaqueCount++

      if (backgroundRgb && rgbDistance({ r: r8, g: g8, b: b8 }, backgroundRgb) <= backgroundDistanceThreshold) {
        backgroundLikeCount++
      }
    }
  }

  if (opaqueCount === 0) {
    return {
      r: 255,
      g: 255,
      b: 255,
      v: 0,
      sampleCount,
      opaqueCount: 0,
      transparentCount,
      opaqueRatio: 0,
      alphaCoverage: sampleCount > 0 ? alphaCoverageSum / sampleCount : 0,
      transparentRatio: sampleCount > 0 ? 1 - alphaCoverageSum / sampleCount : 0,
      backgroundLikeRatio: 0
    }
  }

  const rMean = sr / opaqueCount
  const gMean = sg / opaqueCount
  const bMean = sb / opaqueCount
  const vr = sr2 / opaqueCount - rMean * rMean
  const vg = sg2 / opaqueCount - gMean * gMean
  const vb = sb2 / opaqueCount - bMean * bMean

  return {
    r: Math.round(rMean),
    g: Math.round(gMean),
    b: Math.round(bMean),
    v: (vr + vg + vb) / 3,
    sampleCount,
    opaqueCount,
    transparentCount,
    opaqueRatio: sampleCount > 0 ? opaqueCount / sampleCount : 0,
    alphaCoverage: sampleCount > 0 ? alphaCoverageSum / sampleCount : 0,
    transparentRatio: sampleCount > 0 ? 1 - alphaCoverageSum / sampleCount : 0,
    backgroundLikeRatio: opaqueCount > 0 ? backgroundLikeCount / opaqueCount : 0
  }
}

export function sampleCellMeanRGB(imageData, x0, y0, x1, y1, minSamples = DEFAULT_MIN_SAMPLES_PER_CELL) {
  const stat = sampleCellStats(imageData, x0, y0, x1, y1, minSamples)
  return { r: stat.r, g: stat.g, b: stat.b }
}

/** Mean RGB + variance (for Wu / similar), using the same sampling grid as sampleCellMeanRGB. */
export function sampleCellMeanAndVariance(imageData, x0, y0, x1, y1, minSamples = DEFAULT_MIN_SAMPLES_PER_CELL) {
  const stat = sampleCellStats(imageData, x0, y0, x1, y1, minSamples)
  return { r: stat.r, g: stat.g, b: stat.b, v: stat.v }
}

export function detectImageTransparency(imageData, maxSamples = 4096) {
  if (!imageData?.width || !imageData?.height || !imageData?.data) {
    return { hasTransparency: false, transparentRatio: 0, sampled: 0 }
  }

  const { data, width, height } = imageData
  const pixelCount = width * height
  if (!pixelCount) {
    return { hasTransparency: false, transparentRatio: 0, sampled: 0 }
  }

  const step = Math.max(1, Math.floor(Math.sqrt(pixelCount / Math.max(1, maxSamples))))
  let sampled = 0
  let transparent = 0

  for (let y = 0; y < height; y += step) {
    const rowOff = y * width
    for (let x = 0; x < width; x += step) {
      sampled++
      const alpha = data[(rowOff + x) * 4 + 3]
      if (alpha === 0) transparent++
    }
  }

  return {
    hasTransparency: transparent > 0,
    transparentRatio: sampled > 0 ? transparent / sampled : 0,
    sampled
  }
}

export function estimateImageBackground(imageData, minSamples = DEFAULT_MIN_SAMPLES_PER_CELL) {
  if (!imageData?.width || !imageData?.height) return null

  const transparencyInfo = detectImageTransparency(imageData)
  if (transparencyInfo.hasTransparency) {
    return {
      rgb: { r: 255, g: 255, b: 255 },
      brightness: 255,
      referenceVariance: 0,
      pixelDistanceThreshold: 32,
      cellDistanceThreshold: 42,
      dominanceThreshold: 0.7,
      maxVariance: 180,
      maxBrightnessDelta: 40,
      maxSpread: 42,
      transparentAsWhite: true,
      transparentRatio: transparencyInfo.transparentRatio
    }
  }

  const patchW = Math.max(8, Math.round(imageData.width * 0.08))
  const patchH = Math.max(8, Math.round(imageData.height * 0.08))
  const regions = [
    [0, 0, patchW, patchH],
    [Math.max(0, imageData.width - patchW), 0, imageData.width, patchH],
    [0, Math.max(0, imageData.height - patchH), patchW, imageData.height],
    [
      Math.max(0, imageData.width - patchW),
      Math.max(0, imageData.height - patchH),
      imageData.width,
      imageData.height
    ]
  ]

  const samples = regions
    .map(([x0, y0, x1, y1]) => sampleCellStats(imageData, x0, y0, x1, y1, minSamples))
    .filter((stat) => stat.opaqueCount > 0)

  if (!samples.length) return null

  samples.sort((a, b) => a.v - b.v || getBrightness(b) - getBrightness(a))
  const picked = samples.slice(0, Math.min(3, samples.length))
  let totalWeight = 0
  let sr = 0
  let sg = 0
  let sb = 0
  let sv = 0
  for (const stat of picked) {
    const weight = 1 / (stat.v + 1)
    totalWeight += weight
    sr += stat.r * weight
    sg += stat.g * weight
    sb += stat.b * weight
    sv += stat.v * weight
  }
  if (totalWeight <= 0) return null

  const rgb = {
    r: Math.round(sr / totalWeight),
    g: Math.round(sg / totalWeight),
    b: Math.round(sb / totalWeight)
  }
  const brightness = getBrightness(rgb)
  const referenceVariance = sv / totalWeight
  const brightBackground = brightness >= 235

  return {
    rgb,
    brightness,
    referenceVariance,
    pixelDistanceThreshold: brightBackground ? 32 : 24,
    cellDistanceThreshold: brightBackground ? 42 : 30,
    dominanceThreshold: brightBackground ? 0.7 : 0.8,
    maxVariance: Math.max(180, Math.min(1600, referenceVariance * 6 + 180)),
    maxBrightnessDelta: brightBackground ? 40 : 26,
    maxSpread: brightBackground ? 42 : 28
  }
}

export function isCellBackgroundCandidate(stat, backgroundInfo) {
  if (!stat) return false
  const alphaCoverage =
    Number.isFinite(stat.alphaCoverage) ? stat.alphaCoverage : Number(stat.opaqueRatio || 0)
  const transparentRatio =
    Number.isFinite(stat.transparentRatio) ? stat.transparentRatio : Math.max(0, 1 - alphaCoverage)
  if (stat.opaqueCount === 0 || stat.opaqueRatio <= 0.08 || transparentRatio >= 0.45) return true

  const brightness = getBrightness(stat)
  const spread = getChannelSpread(stat)
  const veryBrightNeutral = brightness >= 247 && spread <= 18 && stat.v <= 220
  if (veryBrightNeutral) return true

  if (backgroundInfo?.transparentAsWhite) {
    const transparentDominantEdge =
      transparentRatio >= 0.25 &&
      brightness >= 230 &&
      spread <= 56
    if (transparentDominantEdge) return true
  }

  if (!backgroundInfo) return false

  const bgDistance = rgbDistance(stat, backgroundInfo.rgb)
  const brightnessDelta = Math.abs(brightness - backgroundInfo.brightness)
  const lowVariance = stat.v <= backgroundInfo.maxVariance
  const closeToBackground =
    bgDistance <= backgroundInfo.cellDistanceThreshold &&
    brightnessDelta <= backgroundInfo.maxBrightnessDelta
  const mostlyBackground =
    stat.backgroundLikeRatio >= backgroundInfo.dominanceThreshold &&
    spread <= backgroundInfo.maxSpread

  return (closeToBackground && lowVariance) || (mostlyBackground && (lowVariance || closeToBackground))
}
