import { Canvas, Rect, FabricImage } from 'fabric'
import { h } from 'vue'
import { RectInfo } from './rect_info'
import { GridModel } from './model/GridModel'
import { FabricRenderer } from './renderer/FabricRenderer'
import { CommandStack, PaintCellsCommand } from './commands/CommandStack'
import { buildSamplingContext, DEFAULT_MIN_SAMPLES_PER_CELL } from './color/autoColorizePipeline.js'
import { shouldForceBackgroundFillCell } from './color/strategies/whiteBias.js'
import {
  CUTOUT_CELL_ID,
  TRANSPARENT_CELL_COLOR,
  isCutoutCellId,
  isDefaultCellId,
  isTransparentCellColor
} from './cellState.js'
import { useColorManagement } from '../composables/useColorManagement.js'
import { useColorGroups } from '../composables/useColorGroups.js'

function debounceRun(func, delay = 30) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => func(...args), delay)
  }
}

export const CellShowMethod = Object.freeze({
  FULL: 'full'
})

export class DiamondCanvas {
  constructor(canvasElement, options = {}) {
    // 合并配置
    if (options == null || typeof options !== 'object') {
      throw new Error('Invalid options')
    }
    this.options = options
    // 新增: 预置矩阵（二维数组）用于直接初始化格子颜色，跳过自动取样与配色
    if (options.cellsMatrix === null) {
      this._initialCellsMatrix = null
    } else {
      this._initialCellsMatrix = Array.isArray(options.cellsMatrix) ? options.cellsMatrix : null
    }
    if (this._initialCellsMatrix && this._initialCellsMatrix.length) {
      // 根据矩阵尺寸覆盖传入的行列值（GridModel 构造顺序为 height(rows), length(cols)）
      options.width_cell = this._initialCellsMatrix.length
      options.height_cell = this._initialCellsMatrix[0] ? this._initialCellsMatrix[0].length : 0
    }
    /** 项目载入时已有格子颜色矩阵：仅用于跳过「首次从背景图自动上色」，不误伤用户手动「应用」配色。 */
    this._hasInitialMatrix = !!(this._initialCellsMatrix && this._initialCellsMatrix.length)
    // 初始化属性
    this.canvasElement = canvasElement
    this.fabricCanvas = null
    this.defaultBackgroundColor = '#ffffff' // 默认背景色
    this.backgroundImageBase64 = this.options.backgroundImageBase64
    // 列数（宽方向）与行数（高方向）
    this.width_cell = this.options.width_cell || this.options.columns || this.options.width || 0
    this.length_cell = this.options.length_cell || this.options.rows || this.options.length || 0 // 兼容旧命名（行数）
    this.height_cell = this.options.length_cell || this.options.height_cell || this.options.rows || this.options.length || 0
    this.cell_size = this.options.cell_size // cm
    this.cellShowMethod = this.options.cellShowMethod || CellShowMethod.FULL // 默认显示方式
    this.image_height =  this.options.image_height || 0 // 图片高度
    this.origin_image_height = this.image_height
    this.image_width = this.options.image_width || 0 // 图片宽度
    this.origin_image_width = this.image_width
    this.canvas_width = this.options.canvas_width
    this.canvas_height = this.options.canvas_height
    this.now_selectedColor = null // 当前选中颜色
    this.onCellChangeCallback = null // 单元格变化回调函数
    this.draw = false // 标记是否已经绘制过
    this.now_selectedColorId = null // 当前选中颜色ID
    this.start_x = null
    this.start_y = null
    this.mouse_down = false,
        this.right_mouse_down = false, // 右键按下状态
        this.rect_selection = false
    this.rect_selection_start_x = null
    this.rect_selection_start_y = null
    this.rect_selection_end_x = null
    this.rect_selection_end_y = null
    this.rect_selection_obj = null

    // 右键事件回调
    this.onRightClickCallback = null
    this.onRightMouseDownCallback = null
    this.onRightMouseUpCallback = null
    // 新增: 鼠标离开画布回调
    this.onMouseLeaveCallback = null

    this._selectionFrame = null
    this._lastSelectionBounds = null
    this._selectionBounds = null // 覆盖层绘制用的边界缓存

    this._hoverRow = null
    this._hoverCol = null
    this._hoverColor = null
    this.hoverHighlightEnabled = true // 默认开启

    // 新增：颜色索引（color => [{row,col}, ...]）与撤销/重做栈
    this._colorIndex = new Map()
    this._history = []
    this._redoStack = []
    this._maxHistory = 50

    // 新增：模型/渲染器/命令栈
    this._gridModel = null
    this._renderer = null
    this._cmdStack = new CommandStack(100)
    this._tmp_color = null // 临时颜色，用于 hover 高亮
    this._tmp_color_id = null // 临时颜色ID，用于 hover 高亮

    // 取色笔
    this._eyedropperEnabled = false
    this._bgOffscreen = null
    this._bgOffscreenCtx = null
    this._bgCacheVersion = 0
    this.cellWidth = this.options.cellWidth || 100 // 默认单元格宽度
    this.cellHeight = this.options.cellHeight || 100 // 默认单元格高度
    this.last_hide_color = null
    this._hoverDelayTimer = null
    this._hoverDisplayColor = null
    this._autoColored = false
    this._displayMode = 'both'
    this._gridModeBackgroundVisible = true

    this._floodFillMode = false
    this._floodFilling = false
    this._floodFillCancel = false

    /** 右键消色：mousedown 已处理时，contextmenu 不再重复 SetColor，避免多次 onCellChange */
    this._rightEraseArmed = false
    this._rightEraseFromPointerDown = false
    this._boundMouseLeave = this._handleMouseLeave.bind(this)
    this._mouseLeaveOnGridAttached = false

    this.init()
  }

  SetNowSlectedColor(color, color_id) {
    this.now_selectedColor = color
    this.now_selectedColorId = color_id // 设置颜色ID
  }

  init() {
    // 用抽出来的渲染器替代直接 new Canvas
    this._renderer = new FabricRenderer(this.canvasElement, {
      selection: this.options.selection,
      backgroundColor: this.options.backgroundColor,
      backgroundAlignMode: this.options.backgroundAlignMode || 'grid-origin'
    })

    // 颜色算法配置
    const paletteConfig = this.options.paletteConfig || null
    const strategy = this.options.colorAlgorithm || 'average'

    this._gridModel = new GridModel(this.width_cell, this.height_cell, this.options.defaultCellColor, {
      autoColor: false,
      paletteConfig: this.options.paletteConfig || null,
      strategy,
      strategyParams: { softChoiceThreshold: 0.8, randomFactor: 0 },
      getImageData: () => this._renderer.getImageData(),
      onAutoColorizeProgress: this.options.onAutoColorizeProgress
    })
    this._renderer.bindGrid(this._gridModel)

    // 绑定事件（复用现有逻辑，事件来源换为 renderer.canvas）
    const canvas = this._renderer.getCanvas()
    this.fabricCanvas = canvas // 兼容旧代码
    canvas.on('mouse:down', this._handleMouseDown.bind(this))
    canvas.on('mouse:move', this._handleMouseMove.bind(this))
    canvas.on('mouse:up', this._handleMouseUp.bind(this))

    // 右键消色：必须在捕获阶段监听，否则 Fabric 内部对非左键的处理会先执行并可能影响事件链；
    // contextmenu 再补一刀，兼容部分环境下 mousedown 未触达业务逻辑的情况。
    this._boundCtxMenu = this._handleRightClick.bind(this)
    this._boundRawDown = this._handleRawMouseDown.bind(this)
    this._boundRawUp = this._handleRawMouseUp.bind(this)
    if (canvas.upperCanvasEl) {
      canvas.upperCanvasEl.addEventListener('contextmenu', this._boundCtxMenu)
      canvas.upperCanvasEl.addEventListener('mousedown', this._boundRawDown, true)
      canvas.upperCanvasEl.addEventListener('mouseup', this._boundRawUp, true)
    }

    // 先调整尺寸
    this.resizeCanvas()

    // 如果有背景图片，先加载背景图片，然后在回调中绘制网格
    if (this.backgroundImageBase64) {
      this._renderer.setBackgroundImageBase64(this.backgroundImageBase64, async () => {
        // 背景加载后：若有初始矩阵则直接应用，否则尝试自动配色
        if (this._hasInitialMatrix) {
          this._applyCellsMatrix(this._initialCellsMatrix)
          this.normalizeTransparentBackgroundToPaletteWhite()
        } else if (this.options.paletteConfig) {
          const imgData = this._renderer.getImageData()
          if (imgData) {
            this._gridModel.options.autoColor = true
            const notify = this.options.onAutoColorizeProgress
            try {
              notify?.(0)
              await this._gridModel.autoColorizeWithImageAsync(imgData, {
                onProgress: (p) => notify?.(p)
              })
              this.normalizeTransparentBackgroundToPaletteWhite({ replaceColoredCells: true })
              this._renderer.markFullRedraw()
              this._renderer.getCanvas().requestRenderAll()
              this._autoColored = true
            } catch (e) {
              console.warn('[DiamondCanvas] initial auto color failed', e)
            } finally {
              notify?.(null)
            }
          } else {
            console.warn('[DiamondCanvas] imageData missing, skip autoColor (will retry when available)')
          }
        } else {
          console.warn('[DiamondCanvas] no paletteConfig at image load, waiting for watcher')
        }
        this.drawGrid()
        // 勿在异步回调里 setCellType('full')：会覆盖用户已选的「交叉」格形
        this._renderer.markFullRedraw()
        this._renderer.getCanvas().requestRenderAll()
      })
    } else {
      // 无背景：仅应用初始矩阵或空白网格
      if (this._hasInitialMatrix) {
        this._applyCellsMatrix(this._initialCellsMatrix)
      }
      this.drawGrid()
      this._renderer.markFullRedraw()
      this._renderer.getCanvas().requestRenderAll()
    }
  }

  // 设置取色笔开关
  setEyedropperEnabled(enabled) {
    this._eyedropperEnabled = !!enabled
    if (!this._eyedropperEnabled)
      this._renderer.hideColorHover(null)
  }

  // 公开：给定原生事件，返回采样信息
  getColorInfoForPointerEvent(event) {
    if (!this.fabricCanvas || !this.fabricCanvas.getPointer) return null
    const e = event && event.e ? event.e : event
    if (!e) return null
    const pointer = this.fabricCanvas.getPointer(e)
    if (!pointer || typeof pointer.x !== 'number' || typeof pointer.y !== 'number') return null
    const { row, col} = this._getCellAtPointer(pointer)
    if (row == null || col == null) return null
    // DEBUG: pointer logical position
    // cell 颜色
    const cell = this._gridModel?.getCell?.(row, col)
    let cellHex = cell?.color || null
    if (cellHex && (cellHex === 'transparent' || cellHex === 'rgba(0,0,0,0)' || (/^#?[0-9a-fA-F]{8}$/.test(cellHex) && cellHex.endsWith('00')))) {
      cellHex = null
    }

    // 如果 cell 是透明，则尝试采样背景图像像素
    let bgHex = null
    if (!cellHex) {
      bgHex = this._sampleBackgroundColorAt(pointer)
    }

    const finalColor = cellHex || bgHex || null
    // 返回逻辑坐标供取色弹窗滚动重定位
    return { row, col, finalColor, canvasX: pointer.x, canvasY: pointer.y }
  }

  // 内部：从背景图采样像素（映射 pointer 到背景图原始像素）
  _sampleBackgroundColorAt(pointer) {
    if (!pointer || typeof pointer.x !== 'number' || typeof pointer.y !== 'number') return null
    const bg = this._renderer?.bgImageObj
    const canvas = this._renderer?.getCanvas?.()
    if (!bg || !canvas) return null
    if (typeof bg.left !== 'number' || typeof bg.top !== 'number' || !bg.scaleX || !bg.scaleY) return null

    // 反推 pointer 在 bg 原图上的像素坐标
    const xOnBg = (pointer.x - bg.left) / bg.scaleX
    const yOnBg = (pointer.y - bg.top) / bg.scaleY

    // 越界则为空
    const iw = bg.width || bg._originalElement?.width
    const ih = bg.height || bg._originalElement?.height
    if (!iw || !ih) return null
    if (xOnBg < 0 || yOnBg < 0 || xOnBg >= iw || yOnBg >= ih) return null

    try {
      const el = bg._originalElement
      if (!el) return null

      // 懒创建并缓存离屏画布
      if (!this._bgOffscreen || this._bgOffscreen.width !== iw || this._bgOffscreen.height !== ih || this._bgCacheVersion !== (el._easystitch_version || 0)) {
        this._bgOffscreen = document.createElement('canvas')
        this._bgOffscreen.width = iw
        this._bgOffscreen.height = ih
        this._bgOffscreenCtx = this._bgOffscreen.getContext('2d')
        this._bgOffscreenCtx.drawImage(el, 0, 0)
        this._bgCacheVersion = el._easystitch_version || 0
      }

      const imgData = this._bgOffscreenCtx.getImageData(Math.floor(xOnBg), Math.floor(yOnBg), 1, 1).data
      const [r,g,b,a] = imgData
      if (a === 0) return null
      const toHex = (n) => n.toString(16).padStart(2, '0')
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    } catch (e) {
      console.warn('采样背景像素失败:', e)
      return null
    }
  }

  drawGrid() {
    // 计算单元格像素尺寸
    const canvas = this._renderer.getCanvas()
    // 首次挂载时可能为 0×0，跳过并在下一帧重试
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => this.drawGrid())
      }
      return
    }
    const cols =  this.height_cell || 1
    const rows = this.width_cell || this.length_cell || 1
    // Use the resized image bounds as the shared coordinate system for both
    // the background image and the stitch grid so overlay stays pixel-aligned.
    const cw = canvas.width / cols
    const ch = canvas.height / rows
    this.cellWidth = cw
    this.cellHeight = ch

    // 使用模型当前数据在渲染器绘制
    this._renderer.drawGrid(cw, ch)

    // 保持原有的数据结构引用（兼容原 API）：构造 cellGrid 为 RectInfo 的二维数组

    this.draw = true
    const upperCanvasEl = canvas.upperCanvasEl
    if (upperCanvasEl && !this._mouseLeaveOnGridAttached) {
      upperCanvasEl.addEventListener('mouseleave', this._boundMouseLeave)
      this._mouseLeaveOnGridAttached = true
    }
    canvas.requestRenderAll()
  }

  _handleMouseLeave() {
    this.mouse_down = false
    this.start_x = null
    this.start_y = null
    this._renderer.hideColorHover(null)
    this.last_hide_color = null

    if (this.onMouseLeaveCallback) {
      try { this.onMouseLeaveCallback() } catch(_) {}
    }
  }

  // 将 pointer 坐标映射为网格 row/col 与 RectInfo
  _getCellAtPointer(pointer) {
    const canvas = this._renderer?.getCanvas?.()
    let cellW = this.cellWidth
    let cellH = this.cellHeight

    const col = Math.floor(pointer.x / cellW)
    const row = Math.floor(pointer.y / cellH)
    const cols = this.height_cell || 1
    const rows =  this.width_cell || this.length_cell || 1
    if (row < 0 || col < 0 || row >= rows || col >= cols) {
      return { row: null, col: null, cell: null }
    }
    let cell = this._gridModel.getCell(row, col)

    return { row, col, cell}
  }

  _handleMouseDown(opt) {
    const pointer = this.fabricCanvas.getPointer(opt.e)
    const { row, col, cell} = this._getCellAtPointer(pointer)
    if (row == null || col == null) return
    this.mouse_down = true
    if (this.rect_selection) {
      this.rect_selection_start_x = row
      this.rect_selection_start_y = col
      this.rect_selection_end_x = null
      this.rect_selection_end_y = null
      this._lastSelectionBounds = null
      this._selectionBounds = null
      this._renderer.clearSelectionBounds()
      this.fabricCanvas.requestRenderAll()
    } else {
      this.start_x = row
      this.start_y = col
      if (this._floodFillMode) {
        // 触发连片填色
        this.floodFill(row, col, this.now_selectedColor, this.now_selectedColorId)
      } else {
        this.SetColor(row, col)
      }
    }
  }

  _handleMouseMove(opt) {
    if (!this.mouse_down) {
      const pointer = this.fabricCanvas.getPointer(opt.e)
      const { row, col, cell } = this._getCellAtPointer(pointer)
      if (cell) {
        this._updateHover(cell.color)

      }
    }
    if (!this.mouse_down) return
    const pointer = this.fabricCanvas.getPointer(opt.e)
    const { row, col } = this._getCellAtPointer(pointer)
    if (row == null || col == null) return
    if (this.rect_selection) {
      this.rect_selection_end_x = row
      this.rect_selection_end_y = col
      this.showRectSelection()
    } else {
      this.SetColor(row, col)
    }
  }

  _handleMouseUp(opt) {
    this.mouse_down = false
    // （已移除 mouse-up 事件派发，改用统计组件轮询）
    if (this.rect_selection) {
      if (this.rect_selection_start_x != null && this.rect_selection_start_y != null) {
        if (this.rect_selection_end_x == null) this.rect_selection_end_x = this.rect_selection_start_x
        if (this.rect_selection_end_y == null) this.rect_selection_end_y = this.rect_selection_start_y
        this.clearSelectRect()
      }
    } else {
      this.start_x = null
      this.start_y = null
    }
  }

  // 右键菜单：阻止系统菜单；仅在 mousedown 捕获未消色时补一次（兼容部分环境）
  _handleRightClick(event) {
    event.preventDefault()

    const alreadyErased = this._rightEraseFromPointerDown
    this._rightEraseFromPointerDown = false

    const pointer = this.fabricCanvas.getPointer(event)
    const { row, col } = this._getCellAtPointer(pointer)

    if (!alreadyErased && row != null && col != null && !this.rect_selection && !this._floodFillMode) {
      const prevC = this.now_selectedColor
      const prevId = this.now_selectedColorId
      this.SetNowSlectedColor(TRANSPARENT_CELL_COLOR, CUTOUT_CELL_ID)
      this.SetColor(row, col)
      this.SetNowSlectedColor(prevC, prevId)
    }

    if (this.onRightClickCallback) {
      try { this.onRightClickCallback({ row, col, pointer, originalEvent: event }) } catch (_) {}
    }
    return false
  }

  // 原始鼠标按下事件（捕获阶段：右键消色 + 避免误改笔色）
  _handleRawMouseDown(event) {
    if (event.button !== 2) return

    const pointer = this.fabricCanvas.getPointer(event)
    const { row, col } = this._getCellAtPointer(pointer)
    const inGrid = row != null && col != null
    const canErase = inGrid && !this.rect_selection && !this._floodFillMode

    if (!canErase) {
      return
    }

    this.right_mouse_down = true
    this._rightEraseArmed = true
    this._rightEraseFromPointerDown = true
    this._tmp_color = this.now_selectedColor
    this._tmp_color_id = this.now_selectedColorId
    this.SetNowSlectedColor(TRANSPARENT_CELL_COLOR, CUTOUT_CELL_ID)
    this._handleMouseDown({ e: event })
    event.stopPropagation()
  }

  // 原始鼠标松开：仅在本轮右键消色已武装时恢复笔色并交还 Fabric
  _handleRawMouseUp(event) {
    if (event.button !== 2) return

    this.right_mouse_down = false
    if (this._rightEraseArmed) {
      this._rightEraseArmed = false
      this._handleMouseUp({ e: event })
      this.SetNowSlectedColor(this._tmp_color, this._tmp_color_id)
    }
    // 极个别环境不派发 contextmenu 时，避免 _rightEraseFromPointerDown 悬挂
    setTimeout(() => {
      if (this._rightEraseFromPointerDown) this._rightEraseFromPointerDown = false
    }, 0)
  }

  // 悬停同色高亮（颜色变化时才更新）
  _updateHover(color) {
    // If same color already displayed, do nothing
    if (color === this.last_hide_color) return
    // Cancel pending timer if color changed

    // Hide previous displayed highlight immediately if new color incoming
    if (this.last_hide_color !== null && color !== this.last_hide_color) {
      // console.log('隐藏之前的颜色高亮:', this.last_hide_color)
      this._renderer.hideColorHover(null)
    }
    if (!this._eyedropperEnabled) return
    this._renderer.showColorHover(color)

    this.last_hide_color = color
  }

  setHoverHighlightEnabled(enabled) {
    const prev = this.hoverHighlightEnabled
    this.hoverHighlightEnabled = !!enabled
    if (!this.hoverHighlightEnabled && prev && this._hoverColor != null) {
      this._renderer.hideColorHover(this._hoverColor)
      this._hoverRow = this._hoverCol = null
      this._hoverColor = null
    }
  }

  // 选择模式开关
  setRectSelection(enabled) {
    if (!enabled) {
      this.clearSelectRect()
      this.rect_selection = false
      this._renderer.clearSelectionBounds()
    } else {
      this.rect_selection = true
      if (this._hoverColor != null) {
        this._renderer.hideColorHover(this._hoverColor)
        this._hoverRow = this._hoverCol = null
        this._hoverColor = null
      }
    }
  }

  // 调整画布大小
  resizeCanvas(width, height) {
    const canvas = this._renderer.getCanvas()
    if (width && height) {
      const currentWidth = canvas.width
      const currentHeight = canvas.height

      // 只有在尺寸真的变化时才调整
      if (currentWidth !== width || currentHeight !== height) {
        this.image_width =  width
        this.image_height =  height
        this._renderer.setSize(width, height)

        // 只有在网格已经绘制过时才重新绘制
        if (this.draw) {
          this.drawGrid()
        }
      }
    }
  }

  // 显示矩形选择 overlay
  showRectSelection() {
    if (!this.rect_selection) return
    if (this.rect_selection_start_x === null || this.rect_selection_start_y === null) return
    const endX = (this.rect_selection_end_x == null) ? this.rect_selection_start_x : this.rect_selection_end_x
    const endY = (this.rect_selection_end_y == null) ? this.rect_selection_start_y : this.rect_selection_end_y
    const sx = Math.min(this.rect_selection_start_x, endX)
    const sy = Math.min(this.rect_selection_start_y, endY)
    const ex = Math.max(this.rect_selection_start_x, endX)
    const ey = Math.max(this.rect_selection_start_y, endY)
    if (sx >= this._gridModel.GetHeight() || sy >= this._gridModel.GetWidth()) return
    if (ex >= this._gridModel.GetHeight() || ey >= this._gridModel.GetWidth()) return
    const cell = this._gridModel.cells[sx][sy]
    const left = cell.col * this.cellWidth
    const top = cell.row * this.cellHeight
    const width = Math.abs(ey - sy + 1) * this.cellWidth
    const height = Math.abs(ex - sx + 1) * this.cellHeight
    this._lastSelectionBounds = { left, top, width, height }
    this._selectionBounds = this._lastSelectionBounds
    this._renderer.setSelectionBounds({ left, top, width, height, color: this.now_selectedColor })
  }

  // 应用矩形选择颜色
  clearSelectRect() {
    if (!this.rect_selection) return
    if (this.rect_selection_start_x === null || this.rect_selection_start_y === null || this.rect_selection_end_x === null || this.rect_selection_end_y === null) return

    const start_x = Math.min(this.rect_selection_start_x, this.rect_selection_end_x)
    const start_y = Math.min(this.rect_selection_start_y, this.rect_selection_end_y)
    const end_x = Math.max(this.rect_selection_start_x, this.rect_selection_end_x)
    const end_y = Math.max(this.rect_selection_start_y, this.rect_selection_end_y)

    if (this.now_selectedColor == null) return
    const next = { color: this.now_selectedColor, color_id: this.now_selectedColorId }

    const changes = []
    for (let r = start_x; r <= end_x; r++) {
      for (let c = start_y; c <= end_y; c++) {
        const cell = this._gridModel.getCell(r, c)
        if (!cell) continue
        const prev = { color: cell.color, color_id: cell.color_id }
        if (prev.color === next.color && prev.color_id === next.color_id) continue
        changes.push({ row: r, col: c, prev, next })
      }
    }
    if (changes.length) {
      const cmd = new PaintCellsCommand(this._gridModel, this._renderer, changes, (row, col, color, color_id) => {
        if (this.onCellChangeCallback) {
          try { this.onCellChangeCallback(row, col, color, null) } catch (_) {}
        }
      })
      this._cmdStack.push(cmd)
      cmd.redo()
    }

    this.rect_selection_start_x = this.rect_selection_start_y = this.rect_selection_end_x = this.rect_selection_end_y = null
    this._lastSelectionBounds = null
    this._selectionBounds = null
    this._renderer.clearSelectionBounds()
  }

  // 设置单元格颜色（单点/拖拽涂色）
  SetColor(row, col, render_all = true, record_history = true) {
    if (this.now_selectedColor == null) return
    const prev = this._gridModel.getCell(row, col)
    if (!prev) return
    const prevColor = prev.color, prevColorId = prev.color_id
    const nextColor = this.now_selectedColor, nextColorId = this.now_selectedColorId
    if (record_history && (prevColor !== nextColor || prevColorId !== nextColorId)) {
      const cmd = new PaintCellsCommand(this._gridModel, this._renderer, [
        { row, col, prev: { color: prevColor, color_id: prevColorId }, next: { color: nextColor, color_id: nextColorId } }
      ], (r, c, color, color_id) => {
        if (this.onCellChangeCallback) {
          try { this.onCellChangeCallback(r, c, color, null) } catch (_) {}
        }
      })
      this._cmdStack.push(cmd)
      cmd.redo()
    } else {
      this._gridModel.setCellColor(row, col, nextColor, nextColorId)
      this._renderer.updateCellColor(row, col, nextColor, nextColorId)
      if (this.onCellChangeCallback) {
        try { this.onCellChangeCallback(row, col, nextColor, null) } catch (_) {}
      }
      if (render_all) this._renderer.getCanvas().requestRenderAll()
    }
  }

  // 撤销/重做
  undo() { return this._cmdStack.undo() }
  redo() { return this._cmdStack.redo() }

  // 对外：设置单元格变化回调
  onCellChange(callback) {
    this.onCellChangeCallback = callback
  }

  // 对外：设置右键点击回调
  onRightClick(callback) {
    this.onRightClickCallback = callback
  }

  // 对外：设置右键按下回调
  onRightMouseDown(callback) {
    this.onRightMouseDownCallback = callback
  }

  // 对外：设置右键松开回调
  onRightMouseUp(callback) {
    this.onRightMouseUpCallback = callback
  }

  // 对外：设置鼠标离开画布回调
  onMouseLeave(callback) { this.onMouseLeaveCallback = callback }

  // 对外：获取 Fabric 画布实例
  getFabricCanvas() {
    return this._renderer?.getCanvas?.() || this.fabricCanvas
  }

  // ===== 兼容旧 API（被 Vue 组件调用）=====
  // 颜色统计
  getColorCount() {
    const result = {}
    if (!this._gridModel) return result
    for (const [color, bucket] of this._gridModel.colorIndex.entries()) {
      if (!bucket || bucket.size === 0) continue
      const first = bucket.values().next().value // {row,col}
      if (!first) continue
      const cell = this._gridModel.getCell(first.row, first.col)
      const id = cell?.color_id
      if (!cell) continue
      if (isDefaultCellId(id) || isCutoutCellId(id)) continue
      if (isTransparentCellColor(color)) continue
      result[color] = { count: bucket.size, color_id: id }
    }
    return result
  }

  _isTransparentCellColor(color) {
    return isTransparentCellColor(color)
  }

  _pickPaletteWhiteEntry(extraEntries = []) {
    const candidates = []
    const seen = new Set()
    const pushEntries = (entries) => {
      if (!Array.isArray(entries)) return
      for (const entry of entries) {
        const hex = String(entry?.hex || entry?.color || '').trim().toUpperCase()
        if (!hex) continue
        const id = entry?.id ?? entry?.code ?? entry?.number ?? entry?.name ?? hex
        const key = `${id}|${hex}`
        if (seen.has(key)) continue
        seen.add(key)
        candidates.push({
          id,
          name: entry?.name || entry?.number || String(id),
          hex,
        })
      }
    }

    pushEntries(extraEntries)
    pushEntries(this.options?.paletteConfig?.colors)
    pushEntries(this.options?.paletteConfig?.allColors)

    if (!candidates.length) return null

    const exactWhite = candidates.find((entry) => entry.hex === '#FFFFFF')
    if (exactWhite) return exactWhite

    let best = null
    let bestScore = Infinity
    for (const entry of candidates) {
      const rgb = entry.hex.replace('#', '')
      if (!/^[0-9A-F]{6}$/.test(rgb)) continue
      const r = parseInt(rgb.slice(0, 2), 16)
      const g = parseInt(rgb.slice(2, 4), 16)
      const b = parseInt(rgb.slice(4, 6), 16)
      const brightnessPenalty = (255 - r) + (255 - g) + (255 - b)
      const neutralityPenalty = Math.abs(r - g) + Math.abs(r - b) + Math.abs(g - b)
      const score = brightnessPenalty * 4 + neutralityPenalty
      if (score < bestScore) {
        bestScore = score
        best = entry
      }
    }

    return best
  }

  fillDefaultCellsWithPaletteWhite({ paletteEntries = [] } = {}) {
    if (!this._gridModel) return { changed: 0, white: null }

    const whiteEntry = this._pickPaletteWhiteEntry(paletteEntries)
    if (!whiteEntry) return { changed: 0, white: null }

    const rows = this._gridModel.GetHeight()
    const cols = this._gridModel.GetWidth()
    let changed = 0

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cell = this._gridModel.getCell(row, col)
        if (!cell) continue
        const isDefault = isDefaultCellId(cell.color_id)
        const isCutout = isCutoutCellId(cell.color_id)
        const isTransparent = this._isTransparentCellColor(cell.color)
        if (isCutout || (!isDefault && !isTransparent)) continue
        if (cell.color === whiteEntry.hex && cell.color_id === whiteEntry.id) continue
        this._gridModel.setCellColor(row, col, whiteEntry.hex, whiteEntry.id)
        changed++
      }
    }

    if (changed > 0) {
      this._renderer?.markFullRedraw?.()
      this._renderer?.getCanvas?.().requestRenderAll()
    }

    return { changed, white: whiteEntry }
  }

  _syncInitialMatrixCell(row, col, colorEntry) {
    if (!Array.isArray(this._initialCellsMatrix) || !this._initialCellsMatrix[row]) return
    const prev = this._initialCellsMatrix[row][col]
    const next = prev && typeof prev === 'object' ? { ...prev } : {}
    next.color = colorEntry.hex
    next.hex = colorEntry.hex
    next.colorId = colorEntry.id
    next.color_id = colorEntry.id
    this._initialCellsMatrix[row][col] = next
  }

  normalizeTransparentBackgroundToPaletteWhite({ paletteEntries = [], minSamples = DEFAULT_MIN_SAMPLES_PER_CELL, replaceColoredCells = false } = {}) {
    if (!this._gridModel || !this._renderer) return { changed: 0, white: null, skipped: 'grid-missing' }

    const imageData = this._renderer.getImageData?.()
    if (!imageData?.data) return { changed: 0, white: null, skipped: 'image-missing' }

    const whiteEntry = this._pickPaletteWhiteEntry(paletteEntries)
    if (!whiteEntry) return { changed: 0, white: null, skipped: 'white-missing' }

    const rows = this._gridModel.GetHeight()
    const cols = this._gridModel.GetWidth()
    const samplingContext = buildSamplingContext(imageData, rows, cols, minSamples)
    let changed = 0
    let emptyMaskCount = 0
    let forcedCount = 0
    const replacedFrom = new Map()

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const stat = samplingContext.cellStatsGrid?.[row]?.[col]
        const inEmptyMask = !!samplingContext.emptyMask?.[row]?.[col]
        const forced = shouldForceBackgroundFillCell(stat, samplingContext?.backgroundInfo)
        if (inEmptyMask) emptyMaskCount++
        if (forced) forcedCount++
        const shouldFill = inEmptyMask || forced
        if (!shouldFill) continue

        const cell = this._gridModel.getCell(row, col)
        if (!cell) continue
        const isDefault = isDefaultCellId(cell.color_id)
        const isCutout = isCutoutCellId(cell.color_id)
        const isTransparent = this._isTransparentCellColor(cell.color)
        if (isCutout) continue
        if (!replaceColoredCells && !isDefault && !isTransparent) continue
        if (cell.color === whiteEntry.hex && cell.color_id === whiteEntry.id) continue
        const sourceId = cell.color_id ?? 'DEFAULT'
        replacedFrom.set(sourceId, (replacedFrom.get(sourceId) || 0) + 1)
        this._gridModel.setCellColor(row, col, whiteEntry.hex, whiteEntry.id)
        this._syncInitialMatrixCell(row, col, whiteEntry)
        changed++
      }
    }

    if (changed > 0) {
      this._renderer?.markFullRedraw?.()
      this._renderer?.getCanvas?.().requestRenderAll()
    }

    return { changed, white: whiteEntry }
  }

  getCellsMatrixSnapshot() {
    if (!this._gridModel) return []

    const rows = this._gridModel.GetHeight()
    const cols = this._gridModel.GetWidth()
    const matrix = []
    for (let row = 0; row < rows; row++) {
      const rowArr = []
      for (let col = 0; col < cols; col++) {
        const cell = this._gridModel.getCell(row, col)
        rowArr.push({
          color: cell?.color ?? '#FFFFFF00',
          hex: cell?.color ?? '#FFFFFF00',
          colorId: cell?.color_id ?? 'DEFAULT',
          color_id: cell?.color_id ?? 'DEFAULT'
        })
      }
      matrix.push(rowArr)
    }
    return matrix
  }

  // 原图透明度
  setOpacity(opacity) {
    this._renderer?.setBackgroundOpacity?.(opacity)
  }

  // 格子类型（full/x）
  setCellType(type) {
    const normalizedType = type === 'mixed' ? 'x' : (type === 'x' ? 'x' : 'full')
    const renderMode = type === 'mixed' ? 'mixed' : (normalizedType === 'x' ? 'cross' : 'solid')
    this._gridModel?.setType?.(normalizedType)
    this._renderer?.setStitchStyle?.({ renderMode })
    // 切换格形时必须整板重画离屏栅格，否则仅依赖 last_type 可能与增量路径不同步
    this._renderer?.markFullRedraw?.()
    this._renderer?.getCanvas?.().requestRenderAll()
  }

  // 显示边框
  setBorderVisible(visible) {
    const infos = this._renderer?.rectInfos || []
    for (let r = 0; r < infos.length; r++) {
      for (let c = 0; c < (infos[r]?.length || 0); c++) {
        const info = infos[r][c]
        info?.set_border_visible?.(!!visible)
      }
    }
    this._renderer?.getCanvas?.().requestRenderAll()
  }

  // 设置边框粗细（px）
  setBorderWidth(px) {
    const w = Math.max(0, Math.min(5, Number(px) || 0))
    const minorColor = this._renderer?.gridLineColor || '#ddd'
    const majorColor = this._renderer?.gridMajorLineColor || minorColor
    const majorStep = this._renderer?.gridMajorLineStep || 10
    const layer = this._renderer?.gridLineLayer || 'overlay'

    // 当 w 为 0 时相当于隐藏边框
    if (w <= 0) {
      this._renderer?.setGridLineStyle({
        color: '#ffffff00',
        width: w,
        opacity: 0,
        majorColor: '#ffffff00',
        majorWidth: 0,
        majorStep,
        layer,
      })

    } else {
      this._renderer?.setGridLineStyle({
        color: minorColor,
        width: w,
        opacity: 1,
        majorColor,
        majorWidth: Math.max(w + 1, 2),
        majorStep,
        layer,
      })
    }
    this._renderer?.getCanvas?.().requestRenderAll()
  }

  // 显示模式（original/grid/both）
  setDisplayMode(mode) {
    if (!this._renderer) return
    this._displayMode = mode
    if (mode === 'original') {
      this._renderer.setBackgroundVisible(true)
      this._renderer.setGridVisibility(false)
    } else if (mode === 'grid') {
      // 常规项目保留底图，XSD/PM 类项目允许按源文件配置隐藏底图，仅显示针迹与布色。
      this._renderer.setBackgroundVisible(this._gridModeBackgroundVisible)
      this._renderer.setGridVisibility(true)
    } else {
      this._renderer.setBackgroundVisible(true)
      this._renderer.setGridVisibility(true)
    }
  }

  setGridModeBackgroundVisible(visible) {
    this._gridModeBackgroundVisible = !!visible
    if (this._displayMode === 'grid') {
      this._renderer?.setBackgroundVisible(this._gridModeBackgroundVisible)
    }
  }

  setStitchStyle(style = {}) {
    this._renderer?.setStitchStyle?.(style)
  }

  setStitchPreviewMode(mode) {
    this._renderer?.setStitchStyle?.({ previewMode: mode })
  }

  setGridStyle(style = {}) {
    this._renderer?.setGridLineStyle?.(style)
  }

  setCanvasBackgroundColor(color) {
    this._renderer?.setCanvasBackgroundColor?.(color)
  }

  // 在画布上高亮/取消高亮选中颜色
  showSelectColorRect(color) {
    this._renderer?.showColorHover?.(color)
  }
  hideSelectColorRect() {
    this._renderer?.hideColorHover?.(null)
  }

  // ========= 新增：项目保存 =========
  async buildSavePayload(options = {}) {
    const { prepareProjectPackage } = await import('./export/project_exporter.js')
    return prepareProjectPackage(this, options)
  }

  async saveProject(options = {}) {
    const { requestZipWrite } = await import('./export/project_exporter.js')
    const payload = await this.buildSavePayload(options)
    return requestZipWrite({
      name: payload.projectName,
      manifest: payload.manifest,
      meta: payload.meta,
      images: payload.images,
      timestamp: Date.now()
    })
  }

  async buildProjectSaveDataV2(options = {}) {
    const { saveProjectV2 } = await import('./export/project_saver_v2.js')
    return saveProjectV2(this, options) // 返回 data（含 images）
  }

  async saveProjectV2(options = {}) {
    const data = await this.buildProjectSaveDataV2(options)
    return data
  }

  replaceColor(oldColorId, newColorObj) {
    if (!oldColorId || !newColorObj) return { success: false, message: '参数无效' }
    const { id: newId, hex } = newColorObj
    if (!newId || !hex) return { success: false, message: '新颜色数据不完整' }
    if (!this._gridModel || !this._renderer) return { success: false, message: '画布未初始化' }
    let changed = 0
    const h = this._gridModel.GetHeight()
    const w = this._gridModel.GetWidth()
    const changes = []
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const cell = this._gridModel.getCell(r, c)
        if (!cell) continue
        if (cell.color_id === oldColorId) {
          const cell = this._gridModel.getCell(r, c)
          if (!cell) continue
          const prev = { color: cell.color, color_id: cell.color_id }
          if (prev.color === newColorObj.color && prev.color_id === newColorObj.id) continue
          changes.push({ row: r, col: c, prev:prev, next:{ color:newColorObj.hex, color_id:newColorObj.id } })
        }
      }
    }
    if (changes.length) {
      const cmd = new PaintCellsCommand(this._gridModel, this._renderer, changes, null)
      this._cmdStack.push(cmd)
      cmd.redo()
    }
    return { success: true, changed }
  }

  /**
   * @param {object} paletteConfig
   * @param {{ onProgress?: (p:number)=>void }} [opts] p in 0..1
   */
  async updatePaletteAndColorize(paletteConfig, opts = {}) {
    const notify = this.options.onAutoColorizeProgress
    try {
      if (!paletteConfig) return
      this.options.paletteConfig = paletteConfig
      if (!this._gridModel) return
      this._gridModel.options.paletteConfig = paletteConfig
      const imgData = this._renderer?.getImageData?.()
      if (!imgData) {
        console.warn('[DiamondCanvas] updatePaletteAndColorize no imageData yet')
        return
      }
      await this._gridModel.autoColorizeWithImageAsync(imgData, { onProgress: opts.onProgress })
      this.normalizeTransparentBackgroundToPaletteWhite({ replaceColoredCells: true })
      this._renderer.markFullRedraw()
      this._renderer.getCanvas().requestRenderAll()
      this._autoColored = true
    } catch (e) {
      console.warn('[DiamondCanvas] updatePaletteAndColorize failed', e)
    } finally {
      notify?.(null)
    }
  }



  // === Exposed parameter controls ===
  getStrategy() { return this._gridModel?.options.strategy }
  setStrategy(name) {
    if (!this._gridModel) return
    this._gridModel.options.strategy = name
  }
  getStrategyParams() { return this._gridModel?.options.strategyParams || {} }
  setStrategyParams(params) {
    if (!this._gridModel) return
    this._gridModel.options.strategyParams = { ...this._gridModel.options.strategyParams, ...params }
  }
  /** 仅在用户显式「应用」等场景调用；不随参数微调自动触发 */
  async _recolorIfPossible() {
    if (!this._gridModel || !this._renderer) return
    const imgData = this._renderer.getImageData?.()
    if (!imgData) return
    if (!this._gridModel.options.paletteConfig) return
    const notify = this.options.onAutoColorizeProgress
    notify?.(0)
    try {
      await this._gridModel.autoColorizeWithImageAsync(imgData, {
        onProgress: (p) => notify?.(p)
      })
      this.normalizeTransparentBackgroundToPaletteWhite({ replaceColoredCells: true })
    } catch (e) {
      console.warn('[DiamondCanvas] _recolorIfPossible failed', e)
    } finally {
      notify?.(null)
    }
    this._renderer.markFullRedraw()
    this._renderer.getCanvas().requestRenderAll()
  }

  // ===== 连片填色 (Flood Fill) 支持 =====
  setFloodFillMode(enabled) { this._floodFillMode = !!enabled }
  cancelFloodFill() { this._floodFillCancel = true }
  floodFill(row, col, newColor, newColorId, options = {}) {
    if (this._floodFilling) return
    if (!this._gridModel || !this._renderer) return
    if (row == null || col == null) return
    if (!newColor) return
    const { largeThreshold = 5000, chunkSize = 2000, onDone, onCancel } = options
    const startCell = this._gridModel.getCell(row, col)
    if (!startCell) return
    const origColor = startCell.color
    const origColorId = startCell.color_id
    if (origColor === newColor && origColorId === newColorId) return
    const h = this._gridModel.GetHeight()
    const w = this._gridModel.GetWidth()
    const total = h * w
    const visited = new Uint8Array(total)
    const indexOf = (r,c)=> r*w + c
    const queue = new Uint32Array(total)
    let head = 0, tail = 0
    queue[tail++] = indexOf(row,col)
    visited[indexOf(row,col)] = 1
    const changes = []
    this._floodFilling = true
    this._floodFillCancel = false
    const pushNeighbor = (r,c) => {
      if (r<0||c<0||r>=h||c>=w) return
      const id = indexOf(r,c)
      if (visited[id]) return
      const cell = this._gridModel.getCell(r,c)
      if (!cell) return
      if (cell.color === origColor && cell.color_id === origColorId) {
        visited[id] = 1
        queue[tail++] = id
      }
    }
    const finalize = () => {
      if (this._floodFillCancel) {
        this._floodFilling = false
        if (onCancel) { try { onCancel() } catch(_) {} }
        return
      }
      if (!changes.length) { this._floodFilling = false; return }
      const cmd = new PaintCellsCommand(this._gridModel, this._renderer, changes, (r,c,color,color_id) => {
        if (this.onCellChangeCallback) {
          try { this.onCellChangeCallback(r,c,color,null) } catch(_) {}
        }
      })
      this._cmdStack.push(cmd)
      cmd.redo()
      this._renderer.getCanvas().requestRenderAll()
      this._floodFilling = false
      if (onDone) { try { onDone({ count: changes.length, originalColor: origColor, newColor }) } catch(_) {} }
    }
    const processAll = () => {
      while (head < tail) {
        const id = queue[head++]
        const r = Math.floor(id / w)
        const c = id % w
        const cell = this._gridModel.getCell(r,c)
        if (cell) {
          changes.push({ row: r, col: c, prev: { color: cell.color, color_id: cell.color_id }, next: { color: newColor, color_id: newColorId } })
        }
        pushNeighbor(r+1,c); pushNeighbor(r-1,c); pushNeighbor(r,c+1); pushNeighbor(r,c-1)
      }
      finalize()
    }
    if (tail < largeThreshold) {
      processAll();
      return
    }
    const step = () => {
      if (this._floodFillCancel) { finalize(); return }
      let processed = 0
      while (head < tail && processed < chunkSize) {
        const id = queue[head++]
        const r = Math.floor(id / w)
        const c = id % w
        const cell = this._gridModel.getCell(r,c)
        if (cell) {
          changes.push({ row: r, col: c, prev: { color: cell.color, color_id: cell.color_id }, next: { color: newColor, color_id: newColorId } })
        }
        pushNeighbor(r+1,c); pushNeighbor(r-1,c); pushNeighbor(r,c+1); pushNeighbor(r,c-1)
        processed++
      }
      if (head < tail && !this._floodFillCancel) {
        requestAnimationFrame(step)
      } else {
        finalize()
      }
    }
    requestAnimationFrame(step)
  }

  // 新增: 应用预置颜色矩阵到网格（跳过自动配色）
  _applyCellsMatrix(matrix) {
    if (!this._gridModel || !Array.isArray(matrix) || !matrix.length) {
      console.warn('[DiamondCanvas]_applyCellsMatrix invalid matrix')
      return
    }
    const rows = matrix.length
    const cols = matrix[0] ? matrix[0].length : 0
    if (!cols) { console.warn('[DiamondCanvas]_applyCellsMatrix empty first row'); return }
    if (rows !== this._gridModel.GetHeight() || cols !== this._gridModel.GetWidth()) {
      this._gridModel.resize(rows, cols)
      this.width_cell = rows
      this.height_cell = cols
    }
    this._gridModel.init()
    for (let r=0; r<rows; r++) {
      const rowArr = matrix[r] || []
      for (let c=0; c<cols; c++) {
        const cellData = rowArr[c]
        if (!cellData) continue
        const color = cellData.hex || cellData.color || '#FFFFFF00'
        const colorId = cellData.colorId ?? cellData.color_id ?? 'DEFAULT'
        this._gridModel.setCellColor(r, c, color, colorId)
      }
    }
    this._renderer.markFullRedraw()
    this._renderer.getCanvas()?.requestRenderAll()
    this._autoColored = true
  }
  loadCellsMatrix(matrix) {
    if (!Array.isArray(matrix) || !matrix.length) {
      console.warn('[DiamondCanvas] loadCellsMatrix skip invalid matrix')
      return
    }
    this._initialCellsMatrix = matrix
    this._applyCellsMatrix(matrix)
    this.normalizeTransparentBackgroundToPaletteWhite()
  }
}
