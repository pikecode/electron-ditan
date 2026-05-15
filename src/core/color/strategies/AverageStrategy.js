import { rgbToLab, deltaE00 } from '../../color/color_space.js'
import { sampleCellMeanRGB, DEFAULT_MIN_SAMPLES_PER_CELL } from '../cellSampling.js'
import { findPureWhitePaletteEntry, preferPureWhiteEntry } from './whiteBias.js'

const EMPTY_COLOR = '#FFFFFF00'
const EMPTY_COLOR_ID = 'DEFAULT'

export class AverageStrategy {
  constructor(palette, { softChoiceThreshold = 0, randomFactor = 0 } = {}) {
    this.palette = palette
    this.softChoiceThreshold = softChoiceThreshold
    this.randomFactor = randomFactor
    this.whiteEntry = findPureWhitePaletteEntry(palette)
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
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = cells[r][c]
        if (emptyMask?.[r]?.[c]) {
          cell.color = resolvedEmptyFill.hex
          cell.color_id = resolvedEmptyFill.id
          continue
        }

        const x0 = Math.floor(offsetX + c * pw)
        const y0 = Math.floor(offsetY + r * ph)
        const x1 = Math.min(Math.floor(x0 + pw), width)
        const y1 = Math.min(Math.floor(y0 + ph), height)
        if (x0 >= width || y0 >= height) {
          cell.color = resolvedEmptyFill.hex
          cell.color_id = resolvedEmptyFill.id
          continue
        }

        const avg = cellStatsGrid?.[r]?.[c] || sampleCellMeanRGB(imageData, x0, y0, x1, y1, minSamples)
        const lab = rgbToLab(avg)
        let best = null
        let second = null
        for (const entry of this.palette) {
          const d = deltaE00(lab, entry.lab)
          if (!best || d < best.d) {
            second = best
            best = { entry, d }
          } else if (!second || d < second.d) {
            second = { entry, d }
          }
        }
        let chosen = best.entry
        let chosenDist = best.d
        if (this.softChoiceThreshold > 0 && second) {
          const diff = second.d - best.d
          if (diff >= 0 && diff < this.softChoiceThreshold) {
            const p = this.randomFactor * (1 - diff / this.softChoiceThreshold)
            if (Math.random() < p) {
              chosen = second.entry
              chosenDist = second.d
            }
          }
        }
        const preferred = preferPureWhiteEntry(
          lab,
          avg,
          chosen,
          chosenDist,
          this.whiteEntry
        )
        chosen = preferred.entry
        cell.color = chosen.hex
        cell.color_id = chosen.id
      }
      onProgress?.((r + 1) / rows)
    }
  }
}
