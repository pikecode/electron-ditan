import { buildPaletteCached } from './palette_cache.js'
import { createStrategy } from './strategies/factory.js'
import { ensureBackgroundFillEntry, pickBlankFillEntry } from './strategies/whiteBias.js'
import {
  sampleCellMeanRGB,
  sampleCellStats,
  estimateImageBackground,
  isCellBackgroundCandidate,
  DEFAULT_MIN_SAMPLES_PER_CELL
} from './cellSampling.js'

export { DEFAULT_MIN_SAMPLES_PER_CELL }

export function collectSampleColorsForGrid(
  imageData,
  rows,
  cols,
  minSamples = DEFAULT_MIN_SAMPLES_PER_CELL,
  samplingContext = null
) {
  const sampleColors = []
  if (samplingContext?.cellStatsGrid && samplingContext?.emptyMask) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (samplingContext.emptyMask[r]?.[c]) continue
        const stat = samplingContext.cellStatsGrid[r]?.[c]
        if (!stat) continue
        sampleColors.push({ r: stat.r, g: stat.g, b: stat.b })
      }
    }
    return sampleColors
  }

  const cellWidthPx = imageData.width / cols
  const cellHeightPx = imageData.height / rows
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cellWidthPx)
      const y0 = Math.floor(r * cellHeightPx)
      const x1 = Math.min(Math.floor(x0 + cellWidthPx), imageData.width)
      const y1 = Math.min(Math.floor(y0 + cellHeightPx), imageData.height)
      const m = sampleCellMeanRGB(imageData, x0, y0, x1, y1, minSamples)
      sampleColors.push(m)
    }
  }
  return sampleColors
}

function floodBorderConnectedMask(candidateMask) {
  const rows = candidateMask.length
  const cols = rows ? candidateMask[0].length : 0
  const emptyMask = Array.from({ length: rows }, () => Array(cols).fill(false))
  const queue = []

  const push = (r, c) => {
    if (r < 0 || c < 0 || r >= rows || c >= cols) return
    if (!candidateMask[r][c] || emptyMask[r][c]) return
    emptyMask[r][c] = true
    queue.push([r, c])
  }

  for (let c = 0; c < cols; c++) {
    push(0, c)
    push(rows - 1, c)
  }
  for (let r = 1; r < rows - 1; r++) {
    push(r, 0)
    push(r, cols - 1)
  }

  for (let i = 0; i < queue.length; i++) {
    const [r, c] = queue[i]
    push(r - 1, c)
    push(r + 1, c)
    push(r, c - 1)
    push(r, c + 1)
  }

  return emptyMask
}

export function buildSamplingContext(imageData, rows, cols, minSamples = DEFAULT_MIN_SAMPLES_PER_CELL) {
  const cellWidthPx = imageData.width / cols
  const cellHeightPx = imageData.height / rows
  const backgroundInfo = estimateImageBackground(imageData, minSamples)
  const cellStatsGrid = Array.from({ length: rows }, () => Array(cols))
  const candidateMask = Array.from({ length: rows }, () => Array(cols).fill(false))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = Math.floor(c * cellWidthPx)
      const y0 = Math.floor(r * cellHeightPx)
      const x1 = Math.min(Math.floor(x0 + cellWidthPx), imageData.width)
      const y1 = Math.min(Math.floor(y0 + cellHeightPx), imageData.height)
      const stat =
        x0 >= imageData.width || y0 >= imageData.height
          ? {
              r: 255,
              g: 255,
              b: 255,
              v: 0,
              sampleCount: 0,
              opaqueCount: 0,
              opaqueRatio: 0,
              backgroundLikeRatio: 0
            }
          : sampleCellStats(imageData, x0, y0, x1, y1, {
              minSamples,
              backgroundRgb: backgroundInfo?.rgb || null,
              backgroundDistanceThreshold: backgroundInfo?.pixelDistanceThreshold
            })

      cellStatsGrid[r][c] = stat
      candidateMask[r][c] = isCellBackgroundCandidate(stat, backgroundInfo)
    }
  }

  return {
    backgroundInfo,
    cellStatsGrid,
    emptyMask: floodBorderConnectedMask(candidateMask)
  }
}

/**
 * Runs sampling → cached buildPalette → strategy.apply on `cells` (mutates).
 * @param {object} opts
 * @param {ImageData} opts.imageData
 * @param {number} opts.rows
 * @param {number} opts.cols
 * @param {object} opts.paletteConfig
 * @param {string} opts.strategyName
 * @param {object} opts.strategyParams
 * @param {any[][]} opts.cells — GridModel.cells-shaped array
 * @param {(t:number)=>void} [opts.onProgress] 0..1
 * @param {number} [opts.minSamples]
 */
export function runAutoColorizePipeline(opts) {
  const {
    imageData,
    rows,
    cols,
    paletteConfig,
    strategyName,
    strategyParams,
    cells,
    onProgress,
    minSamples = DEFAULT_MIN_SAMPLES_PER_CELL
  } = opts

  const samplingContext = buildSamplingContext(imageData, rows, cols, minSamples)
  let pc = paletteConfig
  if (pc.type === 'count') {
    pc = { ...pc, allColors: pc.allColors || [] }
  }

  const sampleColors = collectSampleColorsForGrid(imageData, rows, cols, minSamples, samplingContext)
  onProgress?.(0.06)

  const requestedPaletteSize =
    pc.type === 'count'
      ? Math.max(1, Number(pc.colorCount) || 0)
      : (pc.colors || pc.allColors || []).length
  const paletteCandidates = pc.type === 'count'
    ? (pc.allColors || [])
    : (pc.colors || pc.allColors || [])
  const palette = ensureBackgroundFillEntry(
    buildPaletteCached(pc, sampleColors, imageData, rows, cols, minSamples),
    paletteCandidates,
    samplingContext?.backgroundInfo?.rgb || null,
    requestedPaletteSize || undefined
  )
  const emptyFill = pickBlankFillEntry(
    palette,
    samplingContext?.backgroundInfo?.rgb || null
  )
  onProgress?.(0.1)

  const strategy = createStrategy(strategyName, palette, strategyParams || {})
  const cellWidthPx = imageData.width / cols
  const cellHeightPx = imageData.height / rows

  const wrapProgress = onProgress
    ? (phase01) => {
        onProgress(0.1 + Math.min(1, Math.max(0, phase01)) * 0.88)
      }
    : undefined

  strategy.apply({
    cells,
    rows,
    cols,
    imageData,
    cellWidthPx,
    cellHeightPx,
    offsetX: 0,
    offsetY: 0,
    onProgress: wrapProgress,
    minSamples,
    cellStatsGrid: samplingContext.cellStatsGrid,
    emptyMask: samplingContext.emptyMask,
    emptyFill
  })

  onProgress?.(1)
}

export function serializeCellsColors(cells, rows, cols) {
  const colors = []
  const colorIds = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      colors.push(cells[r][c].color)
      colorIds.push(cells[r][c].color_id)
    }
  }
  return { colors, colorIds }
}

export function applyFlatColorsToCells(cells, rows, cols, colors, colorIds) {
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells[r][c].color = colors[i]
      cells[r][c].color_id = colorIds[i]
      i++
    }
  }
}
