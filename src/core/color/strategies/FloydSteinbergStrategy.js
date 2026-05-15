import { rgbToLab, deltaE00 } from '../../color/color_space.js'
import { sampleCellMeanRGB, DEFAULT_MIN_SAMPLES_PER_CELL } from '../cellSampling.js'
import { findPureWhitePaletteEntry, preferPureWhiteEntry } from './whiteBias.js'

const EMPTY_COLOR = '#FFFFFF00'
const EMPTY_COLOR_ID = 'DEFAULT'

export class FloydSteinbergStrategy {
  constructor(palette, opts = {}) {
    this.palette = palette
    this.whiteEntry = findPureWhitePaletteEntry(palette)
    this.opts = {
      diffusionStrength: opts.diffusionStrength == null ? 1.0 : opts.diffusionStrength,
      cleanup: opts.cleanup !== false,
      cleanupPasses: opts.cleanupPasses || 1,
      majorityThreshold: opts.majorityThreshold || 0.75,
      ...opts
    }
  }
  apply({
    cells,
    rows,
    cols,
    imageData,
    cellWidthPx,
    cellHeightPx,
    offsetX,
    offsetY,
    onProgress,
    minSamples = DEFAULT_MIN_SAMPLES_PER_CELL,
    cellStatsGrid,
    emptyMask,
    emptyFill
  }) {
    const resolvedEmptyFill = emptyFill || this.whiteEntry || this.palette[0] || {
      hex: EMPTY_COLOR,
      id: EMPTY_COLOR_ID
    }
    const { width, height } = imageData
    const pw = cellWidthPx
    const ph = cellHeightPx
    const work = new Array(rows)
    const phase1Weight = 0.42
    for (let r = 0; r < rows; r++) {
      work[r] = new Array(cols)
      for (let c = 0; c < cols; c++) {
        if (emptyMask?.[r]?.[c]) {
          work[r][c] = null
          continue
        }
        const x0 = Math.floor(offsetX + c * pw)
        const y0 = Math.floor(offsetY + r * ph)
        const x1 = Math.min(Math.floor(x0 + pw), width)
        const y1 = Math.min(Math.floor(y0 + ph), height)
        if (x0 >= width || y0 >= height) {
          work[r][c] = null
          continue
        }
        const avg = cellStatsGrid?.[r]?.[c] || sampleCellMeanRGB(imageData, x0, y0, x1, y1, minSamples)
        work[r][c] = { r: avg.r, g: avg.g, b: avg.b }
      }
      onProgress?.(((r + 1) / rows) * phase1Weight)
    }
    const strength = this.opts.diffusionStrength
    for (let r = 0; r < rows; r++) {
      const dir = r % 2 === 0 ? 1 : -1
      const cStart = dir === 1 ? 0 : cols - 1
      const cEnd = dir === 1 ? cols : -1
      for (let c = cStart; c !== cEnd; c += dir) {
        if (emptyMask?.[r]?.[c] || !work[r][c]) {
          cells[r][c].color = resolvedEmptyFill.hex
          cells[r][c].color_id = resolvedEmptyFill.id
          continue
        }
        const col = work[r][c]
        const lab = rgbToLab(col)
        let best = null
        let bestDist = Infinity
        for (const entry of this.palette) {
          const d = deltaE00(lab, entry.lab)
          if (d < bestDist) {
            bestDist = d
            best = entry
          }
        }
        const preferred = preferPureWhiteEntry(
          lab,
          cellStatsGrid?.[r]?.[c] || col,
          best,
          bestDist,
          this.whiteEntry
        )
        best = preferred.entry
        cells[r][c].color = best.hex
        cells[r][c].color_id = best.id
        const err = {
          r: (col.r - best.rgb.r) * strength,
          g: (col.g - best.rgb.g) * strength,
          b: (col.b - best.rgb.b) * strength
        }
        if (dir === 1) {
          spread(work, r, c + 1, err, 7 / 16)
          spread(work, r + 1, c - 1, err, 3 / 16)
          spread(work, r + 1, c, err, 5 / 16)
          spread(work, r + 1, c + 1, err, 1 / 16)
        } else {
          spread(work, r, c - 1, err, 7 / 16)
          spread(work, r + 1, c + 1, err, 3 / 16)
          spread(work, r + 1, c, err, 5 / 16)
          spread(work, r + 1, c - 1, err, 1 / 16)
        }
      }
      onProgress?.(phase1Weight + ((r + 1) / rows) * (1 - phase1Weight))
    }
    if (this.opts.cleanup) this.postCleanup(cells, rows, cols)
  }
  postCleanup(cells, rows, cols) {
    for (let pass = 0; pass < this.opts.cleanupPasses; pass++) {
      let changed = false
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (cells[r][c].color_id === EMPTY_COLOR_ID) continue
          const cur = cells[r][c].color
          const neighbors = []
          if (r > 0 && cells[r - 1][c].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r - 1][c].color)
          if (r < rows - 1 && cells[r + 1][c].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r + 1][c].color)
          if (c > 0 && cells[r][c - 1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r][c - 1].color)
          if (c < cols - 1 && cells[r][c + 1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r][c + 1].color)
          if (neighbors.length === 0) continue
          const freq = new Map()
          for (const n of neighbors) freq.set(n, (freq.get(n) || 0) + 1)
          const sorted = Array.from(freq.entries()).sort((a, b) => b[1] - a[1])
          const [topColor, topCount] = sorted[0]
          if (topColor !== cur && topCount / neighbors.length >= this.opts.majorityThreshold) {
            cells[r][c].color = topColor
            const entry = this.palette.find((p) => p.hex === topColor)
            if (entry) cells[r][c].color_id = entry.id
            changed = true
          }
        }
      }
      if (!changed) break
    }
  }
}
function spread(work, r, c, err, factor) {
  if (r < 0 || c < 0 || r >= work.length || c >= work[0].length) return
  const px = work[r][c]
  if (!px) return
  px.r = clamp(px.r + err.r * factor)
  px.g = clamp(px.g + err.g * factor)
  px.b = clamp(px.b + err.b * factor)
}
function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v)
}
