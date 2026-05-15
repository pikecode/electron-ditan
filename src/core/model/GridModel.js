import {
  runAutoColorizePipeline,
  applyFlatColorsToCells,
  DEFAULT_MIN_SAMPLES_PER_CELL
} from '../color/autoColorizePipeline.js'
import { runAutoColorizeInWorker } from '../color/autoColorizeWorkerClient.js'

export class GridModel {
  constructor(height, length, defaultColor = '#FFFFFF00', options = {}) {
    this.height = height
    this.length = length
    this.defaultColor = defaultColor
    this.cells = []
    this.colorIndex = new Map()
    this.change_list = new Map()
    this._type = 'full'
    this._show_chart = false
    this._colorToLabel = new Map()
    this._labelDirty = true
    this._show_color_id = new Set()
    this.options = options || {}
    this.init()
  }

  get showChart() {
    return this._show_chart
  }
  set showChart(v) {
    this._show_chart = !!v
  }
  GetWidth() {
    if (this.cells.length === 0) return 0
    if (this.cells[0].length === 0) return 0
    return this.cells[0].length
  }

  GetHeight() {
    return this.cells.length
  }

  get type() {
    return this._type
  }
  setType(t) {
    this._type = t === 'x' ? 'x' : 'full'
  }

  init() {
    this.cells.length = 0
    this.colorIndex.clear()
    this.change_list.clear()
    this._colorToLabel.clear()
    this._labelDirty = true
    for (let r = 0; r < this.height; r++) {
      this.cells[r] = []
      for (let c = 0; c < this.length; c++) {
        const cell = {
          row: r,
          col: c,
          color: this.defaultColor,
          color_id: 'DEFAULT',
          show_text: false,
          text: ''
        }
        this.cells[r][c] = cell
        this.change_list.set(`${r},${c}`, cell)
        this._indexAdd(this.defaultColor, r, c)
      }
    }
  }

  get_cells() {
    return this.cells
  }

  getCell(r, c) {
    if (r < 0 || c < 0 || r >= this.height || c >= this.length) return null
    return this.cells[r][c]
  }

  setCellColor(r, c, color, color_id) {
    const cell = this.getCell(r, c)
    if (!cell) return null
    const prev = { color: cell.color, color_id: cell.color_id }
    if (prev.color === color && prev.color_id === color_id) return prev
    this._indexRemove(cell.color, r, c)
    cell.color = color
    cell.color_id = color_id
    this.change_list.set(`${r},${c}`, cell)
    this._indexAdd(color, r, c)
    return prev
  }

  setCellShowID(color) {
    if (this._show_chart) return
    const bucket = this.colorIndex.get(color)
    if (!bucket || bucket.size === 0) return
    for (const key of bucket.keys()) {
      const [rStr, cStr] = key.split(',')
      if (!rStr || !cStr) continue
      const r = Number(rStr)
      const c = Number(cStr)
      if (!Number.isInteger(r) || !Number.isInteger(c)) continue
      const cell = this.getCell(r, c)
      if (!cell) continue
      if (color === 'DEFAULT') {
        cell.show_text = false
        cell.text = ''
        continue
      }
      cell.show_text = true
      cell.text = cell.color_id || ''
      this.change_list.set(`${cell.row},${cell.col}`, cell)
    }
    this._show_color_id.add(color)
  }

  removeCellShowID() {
    if (this._show_chart) return

    for (const color of this._show_color_id || []) {
      const bucket = this.colorIndex.get(color)
      if (!bucket || bucket.size === 0) continue
      for (const key of bucket.keys()) {
        const [rStr, cStr] = key.split(',')
        if (!rStr || !cStr) continue
        const r = Number(rStr)
        const c = Number(cStr)
        if (!Number.isInteger(r) || !Number.isInteger(c)) continue
        const cell = this.getCell(r, c)
        if (!cell) continue
        cell.show_text = false
        cell.text = ''
        this.change_list.set(`${cell.row},${cell.col}`, cell)
      }
    }
    this._show_color_id && this._show_color_id.clear()
  }

  setShowChart(value) {
    this._show_chart = !!value
  }

  getChangeList() {
    return this.change_list
  }
  clearChangeList() {
    this.change_list.clear()
  }

  _indexToLabel(idx) {
    const base = idx % 26
    const cycle = Math.floor(idx / 26)
    const letter = String.fromCharCode(65 + base)
    return cycle === 0 ? letter : `${letter}${cycle}`
  }
  _markLabelsDirty() {
    this._labelDirty = true
  }
  _rebuildLabels() {
    if (!this._labelDirty) return
    const arr = []
    for (const [color, bucket] of this.colorIndex.entries()) {
      if (!color || color === this.defaultColor) continue
      arr.push({ color, count: bucket.size })
    }
    arr.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.color.localeCompare(b.color)
    })
    this._colorToLabel.clear()
    for (let i = 0; i < arr.length; i++) {
      this._colorToLabel.set(arr[i].color, this._indexToLabel(i))
    }
    this._labelDirty = false
  }
  getColorLabel(color) {
    this._rebuildLabels()
    return this._colorToLabel.get(color) || null
  }
  getAllColorLabels() {
    this._rebuildLabels()
    const out = {}
    for (const [c, l] of this._colorToLabel.entries()) out[c] = l
    return out
  }

  _indexAdd(color, r, c) {
    if (!color && color !== 0) return
    let bucket = this.colorIndex.get(color)
    if (!bucket) {
      bucket = new Map()
      this.colorIndex.set(color, bucket)
    }
    const key = `${r},${c}`
    if (!bucket.has(key)) {
      bucket.set(key, { row: r, col: c })
      this._markLabelsDirty()
    }
  }
  _indexRemove(color, r, c) {
    if (!color && color !== 0) return
    const bucket = this.colorIndex.get(color)
    if (!bucket) return
    const key = `${r},${c}`
    if (bucket.delete(key)) {
      if (bucket.size === 0) {
        this.colorIndex.delete(color)
      }
      this._markLabelsDirty()
    }
  }

  getPositionsByColor(color) {
    const bucket = this.colorIndex.get(color)
    return bucket ? Array.from(bucket.values()) : []
  }

  resize(height, length) {
    this.height = height
    this.length = length
    this.init()
  }

  /**
   * @returns {Promise<void>}
   */
  autoColorizeWithImage(imageData, options = {}) {
    return this.autoColorizeWithImageAsync(imageData, options)
  }

  async autoColorizeWithImageAsync(imageData, options = {}) {
    const {
      onProgress: onProgressArg,
      preferWorker = true,
      minSamples = DEFAULT_MIN_SAMPLES_PER_CELL
    } = options
    const onProgress = onProgressArg ?? this.options?.onAutoColorizeProgress
    if (!this.options || !this.options.paletteConfig) {
      console.warn('[GridModel] Missing paletteConfig, abort')
      return
    }
    if (!imageData || !imageData.data) {
      console.warn('[GridModel] Invalid imageData, abort')
      return
    }

    const rows = this.height
    const cols = this.length
    const strategyName = this.options.strategy || 'average'
    const strategyParams = this.options.strategyParams || {
      softChoiceThreshold: 0.8,
      randomFactor: 0
    }

    const runMainThread = () => {
      this._prepareAutoColorizeState()
      runAutoColorizePipeline({
        imageData,
        rows,
        cols,
        paletteConfig: this.options.paletteConfig,
        strategyName,
        strategyParams,
        cells: this.cells,
        onProgress,
        minSamples
      })
      this._finalizeAutoColorizeIndex()
    }

    if (preferWorker && typeof Worker !== 'undefined') {
      try {
        const clone = new Uint8Array(imageData.data.length)
        clone.set(imageData.data)
        const imageBuffer = clone.buffer
        const paletteConfig = JSON.parse(JSON.stringify(this.options.paletteConfig))
        const { colors, colorIds } = await runAutoColorizeInWorker(
          {
            imageWidth: imageData.width,
            imageHeight: imageData.height,
            imageBuffer,
            rows,
            cols,
            paletteConfig,
            strategyName,
            strategyParams: { ...strategyParams },
            minSamples
          },
          onProgress
        )
        this._prepareAutoColorizeState()
        applyFlatColorsToCells(this.cells, rows, cols, colors, colorIds)
        this._finalizeAutoColorizeIndex()
        return
      } catch (e) {
        console.warn('[GridModel] worker auto color failed, falling back to main thread', e)
      }
    }

    runMainThread()
  }

  _prepareAutoColorizeState() {
    this.colorIndex.clear()
    this.change_list.clear()
  }

  _finalizeAutoColorizeIndex() {
    const rows = this.height
    const cols = this.length
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = this.cells[r][c]
        this.change_list.set(`${r},${c}`, cell)
        this._indexAdd(cell.color, r, c)
      }
    }
  }
}
