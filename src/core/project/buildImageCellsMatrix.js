import {
  collectSampleColorsForGrid,
  buildSamplingContext,
  DEFAULT_MIN_SAMPLES_PER_CELL
} from '../color/autoColorizePipeline.js'
import { estimateImageBackground } from '../color/cellSampling.js'
import { buildPalette } from '../color/palette_builder.js'
import {
  ensureBackgroundFillEntry,
  pickBlankFillEntry,
  shouldForceBackgroundFillCell
} from '../color/strategies/whiteBias.js'
import { GridModel } from '../model/GridModel.js'

function loadImage(imageBase64) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image decode failed'))
    img.src = imageBase64
  })
}

async function getImageDataFromBase64(imageBase64) {
  const img = await loadImage(imageBase64)
  const width = img.naturalWidth || img.width
  const height = img.naturalHeight || img.height
  if (!width || !height) {
    throw new Error('Image size is invalid')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas context unavailable')
  }

  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, width, height)
}

function normalizePaletteColors(paletteColors) {
  return (Array.isArray(paletteColors) ? paletteColors : [])
    .map(color => ({
      id: color?.id,
      hex: color?.hex,
      name: color?.name || ''
    }))
    .filter(color => color.id != null && typeof color.hex === 'string' && color.hex)
}

function normalizeRequestedColorCount(colors, colorCount) {
  if (!colors.length) return 0
  const requested = Math.floor(Number(colorCount))
  if (!Number.isFinite(requested) || requested <= 0) {
    return colors.length
  }
  return Math.min(colors.length, requested)
}

function buildSelectedPaletteFromImageData({ imageData, rows, cols, colors, colorCount }) {
  const requestedCount = normalizeRequestedColorCount(colors, colorCount)
  if (!requestedCount) {
    return []
  }
  if (requestedCount >= colors.length) {
    return colors
  }

  const sampleColors = collectSampleColorsForGrid(imageData, rows, cols)
  const selected = buildPalette(
    {
      type: 'count',
      colorCount: requestedCount,
      allColors: colors
    },
    sampleColors
  )
  const backgroundInfo = estimateImageBackground(imageData)
  const normalizedSelected = normalizePaletteColors(
    ensureBackgroundFillEntry(
      selected,
      colors,
      backgroundInfo?.rgb || null,
      requestedCount
    )
  )
  return normalizedSelected.length ? normalizedSelected : colors.slice(0, requestedCount)
}

function normalizeTransparentBackgroundCells({
  gridModel,
  imageData,
  rows,
  cols,
  paletteEntries,
  minSamples = DEFAULT_MIN_SAMPLES_PER_CELL
}) {
  if (!gridModel || !imageData || !rows || !cols) return 0

  const samplingContext = buildSamplingContext(imageData, rows, cols, minSamples)
  const fillEntry = pickBlankFillEntry(
    paletteEntries,
    samplingContext?.backgroundInfo?.rgb || null
  )
  if (!fillEntry) return 0

  let changed = 0
  let emptyMaskCount = 0
  let forcedCount = 0
  const replacedFrom = new Map()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const stat = samplingContext.cellStatsGrid?.[r]?.[c]
      const inEmptyMask = !!samplingContext.emptyMask?.[r]?.[c]
      const forced = shouldForceBackgroundFillCell(stat, samplingContext?.backgroundInfo)
      if (inEmptyMask) emptyMaskCount++
      if (forced) forcedCount++
      const shouldFill = inEmptyMask || forced
      if (!shouldFill) continue

      const cell = gridModel.getCell(r, c)
      if (!cell) continue
      if (cell.color === fillEntry.hex && cell.color_id === fillEntry.id) continue
      const sourceId = cell.color_id ?? 'DEFAULT'
      replacedFrom.set(sourceId, (replacedFrom.get(sourceId) || 0) + 1)
      gridModel.setCellColor(r, c, fillEntry.hex, fillEntry.id)
      changed++
    }
  }

  return changed
}

export async function resolveImagePaletteColors({
  imageBase64,
  rows,
  cols,
  paletteColors,
  colorCount,
  imageData
}) {
  const colors = normalizePaletteColors(paletteColors)
  if (!colors.length) throw new Error('Palette colors missing')
  if (!rows || !cols) throw new Error('Grid size missing')

  const requestedCount = normalizeRequestedColorCount(colors, colorCount)
  if (!requestedCount) throw new Error('Palette colors missing')

  if (requestedCount >= colors.length) {
    return {
      selectedColors: colors,
      imageData: imageData || null
    }
  }

  const resolvedImageData = imageData || await getImageDataFromBase64(imageBase64)
  return {
    selectedColors: buildSelectedPaletteFromImageData({
      imageData: resolvedImageData,
      rows,
      cols,
      colors,
      colorCount: requestedCount
    }),
    imageData: resolvedImageData
  }
}

export async function buildImageCellsMatrix({
  imageBase64,
  imageData,
  rows,
  cols,
  paletteColors,
  colorCount,
  strategy = 'average',
  strategyParams = { softChoiceThreshold: 0.8, randomFactor: 0 },
  onProgress,
  minSamples = DEFAULT_MIN_SAMPLES_PER_CELL
}) {
  if (!imageBase64) throw new Error('Image source missing')
  if (!rows || !cols) throw new Error('Grid size missing')
  const resolvedImageData = imageData || await getImageDataFromBase64(imageBase64)
  const { selectedColors } = await resolveImagePaletteColors({
    imageBase64,
    rows,
    cols,
    paletteColors,
    colorCount,
    imageData: resolvedImageData
  })
  const gridModel = new GridModel(rows, cols, '#FFFFFF00', {
    paletteConfig: {
      type: 'group',
      colors: selectedColors,
      colorCount: selectedColors.length,
      allColors: selectedColors
    },
    strategy,
    strategyParams
  })

  await gridModel.autoColorizeWithImageAsync(resolvedImageData, {
    onProgress,
    minSamples
  })
  normalizeTransparentBackgroundCells({
    gridModel,
    imageData: resolvedImageData,
    rows,
    cols,
    paletteEntries: selectedColors,
    minSamples
  })

  return gridModel.get_cells().map(row =>
    row.map(cell => ({
      color: cell.color,
      colorId: cell.color_id
    }))
  )
}
