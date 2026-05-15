// 动态导入 Fabric.js 以避免构建问题
const fabricPromise = import('fabric').then(async module => {
  const fabric = module.fabric || module.default || module
  // 强制使用浏览器模式，避免 Electron (nodeIntegration) 下走 node-canvas 分支
  if (fabric && fabric.isLikelyNode) {
    console.log('⚙️ Forcing Fabric into browser mode in Electron renderer')
    fabric.isLikelyNode = false
    fabric.nodeCanvas = undefined
    fabric.window = window
    fabric.document = document
  }
  return fabric
})

/**
 * 专业图像编辑器类 - 基于Fabric.js
 * 支持双图层编辑、工具切换、属性控制等功能
 */
export class ImageEditor {
  constructor(canvasElement, options = {}) {
    this.canvasElement = canvasElement
    this.options = {
      width: options.width || 800,
      height: options.height || 600,
      backgroundColor: '#ffffff',
      ...options
    }
    
    this.fabric = null
    this.canvas = null
    this.isInitialized = false
    
    // 图层管理
    this.layers = {
      template: null, // 模板图层 (底层)
      grid: null      // 格子图层 (上层)
    }
    
    // 状态管理
    this.state = {
      activeTool: 'select',
      selectedLayer: null,
      activeColorTool: 'brush',
      selectedColor: '#ff0000',
      brushSize: 10,
      zoom: 1,
      isDrawing: false
    }
    
    // 事件回调
    this.callbacks = {
      onLayerSelect: null,
      onLayerUpdate: null,
      onToolChange: null
    }
    
    // 历史记录
    this.history = []
    this.historyIndex = -1
    
    this.initializeFabric()
  }
  
  /**
   * 初始化 Fabric.js
   */
  async initializeFabric() {
    console.log('🔧 ImageEditor: Starting Fabric.js initialization...')
    try {
      console.log('📦 ImageEditor: Loading Fabric.js module...')
      this.fabric = await fabricPromise
      console.log('✅ ImageEditor: Fabric.js module loaded:', !!this.fabric)
      
      console.log('🎨 ImageEditor: Creating Fabric Canvas...')
      console.log('🎨 ImageEditor: Canvas element:', this.canvasElement)
      console.log('🎨 ImageEditor: Canvas options:', this.options)
      
      // 初始化Fabric画布
      this.canvas = new this.fabric.Canvas(this.canvasElement, {
        width: this.options.width,
        height: this.options.height,
        backgroundColor: this.options.backgroundColor,
        preserveObjectStacking: true,
        selection: true,
        renderOnAddRemove: true
      })
      
      console.log('✅ ImageEditor: Fabric Canvas created:', !!this.canvas)
      console.log('🎯 ImageEditor: Canvas size:', this.canvas.getWidth(), 'x', this.canvas.getHeight())
      
      this.isInitialized = true
      console.log('🎯 ImageEditor: Initialization flag set to true')
      
      this.initializeEventListeners()
      console.log('🔗 ImageEditor: Event listeners initialized')
      
      // 触发初始化完成回调
      if (this.callbacks.onInitialized) {
        this.callbacks.onInitialized()
      }
      
      console.log('🎉 ImageEditor: Fabric.js initialization completed!')
    } catch (error) {
      console.error('💥 ImageEditor: Failed to initialize Fabric.js:', error)
      console.error('💥 ImageEditor: Error stack:', error.stack)
    }
  }
  
  /**
   * 等待初始化完成
   */
  async waitForInitialization() {
    console.log('⏳ ImageEditor: Waiting for initialization...')
    console.log('⏳ ImageEditor: Current state:', this.isInitialized)
    
    if (this.isInitialized) {
      console.log('✅ ImageEditor: Already initialized')
      return
    }
    
    return new Promise((resolve) => {
      const checkInit = () => {
        console.log('🔍 ImageEditor: Checking initialization status:', this.isInitialized)
        if (this.isInitialized) {
          console.log('✅ ImageEditor: Initialization completed')
          resolve()
        } else {
          setTimeout(checkInit, 100)
        }
      }
      checkInit()
    })
  }
  
  /**
   * (替代原来的同名方法) 查询是否已初始化
   */
  isReady() { return this.isInitialized === true }
  
  /**
   * 初始化事件监听器
   */
  initializeEventListeners() {
    // 对象选择事件
    this.canvas.on('selection:created', (e) => {
      this.handleObjectSelection(e.selected[0])
    })
    
    this.canvas.on('selection:updated', (e) => {
      this.handleObjectSelection(e.selected[0])
    })
    
    this.canvas.on('selection:cleared', () => {
      this.state.selectedLayer = null
      this.triggerCallback('onLayerSelect', null)
    })
    
    // 对象修改事件
    this.canvas.on('object:modified', (e) => {
      this.handleObjectModified(e.target)
      this.saveState()
    })
    
    // 鼠标事件 - 用于绘画工具
    this.canvas.on('mouse:down', (e) => {
      this.handleMouseDown(e)
    })
    
    this.canvas.on('mouse:move', (e) => {
      this.handleMouseMove(e)
    })
    
    this.canvas.on('mouse:up', (e) => {
      this.handleMouseUp(e)
    })
    
    // 滚轮缩放
    this.canvas.on('mouse:wheel', (e) => {
      this.handleMouseWheel(e)
    })
  }
  
  /**
   * 添加图像图层
   */
  async addImageLayer(layerId, imageUrl, options = {}) {
    console.log(`🖼️ ImageEditor: Adding image layer "${layerId}"`)
    console.log(`🖼️ ImageEditor: Image URL length:`, imageUrl?.length)
    console.log(`🖼️ ImageEditor: Options:`, options)
    await this.waitForInitialization()
    console.log(`✅ ImageEditor: Initialization confirmed for layer "${layerId}"`)

    return new Promise((resolve, reject) => {
      console.log(`📸 ImageEditor: Creating Fabric.Image from URL for "${layerId}"`)
      const startedAt = Date.now()
      const timeoutId = setTimeout(() => {
        console.error(`⏰ ImageEditor: Image loading timeout for "${layerId}" (fallback to manual Image)`) 
        manualLoad()
      }, 20000)

      const done = (img) => {
        clearTimeout(timeoutId)
        if (!img) { reject(new Error('Null image')); return }
        try {
          img.set({
            layerId,
            left: options.x || 0,
            top: options.y || 0,
            scaleX: options.scaleX || 1,
            scaleY: options.scaleY || 1,
            opacity: (options.opacity || 100) / 100,
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            transparentCorners: false,
            cornerColor: '#0066cc',
            cornerSize: 8,
            borderColor: '#0066cc',
            borderDashArray: [5, 5]
          })
          if (options.blendMode && options.blendMode !== 'normal') {
            img.set('globalCompositeOperation', this.convertBlendMode(options.blendMode))
          }
          this.canvas.add(img)
          if (layerId === 'template') { img.sendToBack(); this.layers.template = img } else if (layerId === 'grid') { img.bringToFront(); this.layers.grid = img }
          this.layers[layerId] = img
          this.canvas.renderAll()
          this.saveState()
          console.log(`✅ ImageEditor: Layer "${layerId}" added in ${(Date.now()-startedAt)}ms, total objects:`, this.canvas.getObjects().length)
          resolve(img)
        } catch (e) {
          reject(e)
        }
      }

      const manualLoad = () => {
        console.log(`🧪 ImageEditor: Manual HTMLImageElement load for "${layerId}"`)
        const imgEl = new Image()
        imgEl.crossOrigin = 'anonymous'
        imgEl.onload = () => {
          console.log(`🧪 ImageEditor: Manual image onload for "${layerId}":`, imgEl.width, 'x', imgEl.height)
          try {
            const fabricImg = new this.fabric.Image(imgEl)
            done(fabricImg)
          } catch (err) {
            console.error('💥 ImageEditor: Manual fabric.Image creation failed:', err)
            reject(err)
          }
        }
        imgEl.onerror = (err) => {
          console.error(`💥 ImageEditor: Manual image onerror for "${layerId}"`, err)
          reject(new Error('Manual image load failed'))
        }
        imgEl.src = imageUrl
      }

      try {
        // 优先使用 fabric 内置 fromURL
        this.fabric.Image.fromURL(imageUrl, (img) => {
          if (!img) {
            console.warn('⚠️ ImageEditor: fromURL returned null, switching to manual load')
            manualLoad()
            return
          }
          console.log(`📸 ImageEditor: fromURL callback for "${layerId}" dim:`, img.width, 'x', img.height)
          done(img)
        }, { crossOrigin: 'anonymous' })
      } catch (err) {
        console.error('💥 ImageEditor: fromURL threw synchronously, fallback to manual load:', err)
        manualLoad()
      }
    })
  }
  
  /**
   * 选择图层
   */
  selectLayer(layerId) {
    const layer = this.layers[layerId]
    if (layer) {
      this.canvas.setActiveObject(layer)
      this.state.selectedLayer = layerId
      this.triggerCallback('onLayerSelect', layerId)
      this.canvas.renderAll()
    }
  }
  
  /**
   * 切换图层可见性
   */
  toggleLayerVisibility(layerId) {
    const layer = this.layers[layerId]
    if (layer) {
      layer.set('visible', !layer.visible)
      this.canvas.renderAll()
      this.triggerCallback('onLayerUpdate', layerId)
    }
  }
  
  /**
   * 设置活动工具
   */
  setActiveTool(toolId) {
    this.state.activeTool = toolId
    
    // 根据工具类型设置画布状态
    switch (toolId) {
      case 'select':
        this.canvas.isDrawingMode = false
        this.canvas.selection = true
        this.setObjectsSelectable(true)
        break
        
      case 'move':
        this.canvas.isDrawingMode = false
        this.canvas.selection = true
        this.setObjectsSelectable(true)
        break
        
      case 'color':
        this.setupDrawingTool()
        break
        
      default:
        this.canvas.isDrawingMode = false
        this.canvas.selection = true
    }
    
    this.triggerCallback('onToolChange', toolId)
  }
  
  /**
   * 设置绘画工具
   */
  setupDrawingTool() {
    if (!this.isInitialized) return
    
    this.canvas.isDrawingMode = true
    this.canvas.selection = false
    this.setObjectsSelectable(false)
    
    // 配置画笔
    this.canvas.freeDrawingBrush = new this.fabric.PencilBrush(this.canvas)
    this.canvas.freeDrawingBrush.width = this.state.brushSize
    this.canvas.freeDrawingBrush.color = this.state.selectedColor
  }
  
  /**
   * 设置对象可选择性
   */
  setObjectsSelectable(selectable) {
    this.canvas.forEachObject((obj) => {
      obj.selectable = selectable
      obj.evented = selectable
    })
  }
  
  /**
   * 更新图层属性
   */
  updateLayerProperty(layerId, property, value) {
    const layer = this.layers[layerId]
    if (!layer) return
    
    switch (property) {
      case 'x':
        layer.set('left', Number(value))
        break
      case 'y':
        layer.set('top', Number(value))
        break
      case 'width':
        const currentWidth = layer.getScaledWidth()
        const scaleX = Number(value) / layer.width
        layer.set('scaleX', scaleX)
        break
      case 'height':
        const currentHeight = layer.getScaledHeight()
        const scaleY = Number(value) / layer.height
        layer.set('scaleY', scaleY)
        break
      case 'opacity':
        layer.set('opacity', Number(value) / 100)
        break
      case 'blendMode':
        layer.set('globalCompositeOperation', this.convertBlendMode(value))
        break
    }
    
    this.canvas.renderAll()
    this.triggerCallback('onLayerUpdate', layerId)
    this.saveState()
  }
  
  /**
   * 获取图层属性
   */
  getLayerProperty(layerId) {
    const layer = this.layers[layerId]
    if (!layer) return null
    
    return {
      x: Math.round(layer.left || 0),
      y: Math.round(layer.top || 0),
      width: Math.round(layer.getScaledWidth()),
      height: Math.round(layer.getScaledHeight()),
      opacity: Math.round((layer.opacity || 1) * 100),
      visible: layer.visible !== false,
      blendMode: this.convertBlendModeBack(layer.globalCompositeOperation || 'source-over')
    }
  }
  
  /**
   * 缩放画布
   */
  setZoom(zoomLevel) {
    if (!this.isInitialized) return
    
    const zoom = zoomLevel / 100
    this.state.zoom = zoom
    
    // 获取画布中心点
    const center = this.canvas.getCenter()
    
    this.canvas.zoomToPoint(
      new this.fabric.Point(center.left, center.top),
      zoom
    )
    
    this.canvas.renderAll()
  }
  
  /**
   * 放大
   */
  zoomIn() {
    const currentZoom = this.canvas.getZoom()
    const newZoom = Math.min(currentZoom * 1.25, 5)
    this.setZoom(newZoom * 100)
  }
  
  /**
   * 缩小
   */
  zoomOut() {
    const currentZoom = this.canvas.getZoom()
    const newZoom = Math.max(currentZoom * 0.8, 0.1)
    this.setZoom(newZoom * 100)
  }
  
  /**
   * 适应视图
   */
  fitToView() {
    const canvasWidth = this.canvas.getWidth()
    const canvasHeight = this.canvas.getHeight()
    
    // 获取所有对象的边界
    const allObjects = this.canvas.getObjects()
    if (allObjects.length === 0) return
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    
    allObjects.forEach(obj => {
      const bound = obj.getBoundingRect()
      minX = Math.min(minX, bound.left)
      minY = Math.min(minY, bound.top)
      maxX = Math.max(maxX, bound.left + bound.width)
      maxY = Math.max(maxY, bound.top + bound.height)
    })
    
    const objectWidth = maxX - minX
    const objectHeight = maxY - minY
    
    const scaleX = (canvasWidth * 0.8) / objectWidth
    const scaleY = (canvasHeight * 0.8) / objectHeight
    const scale = Math.min(scaleX, scaleY)
    
    this.setZoom(scale * 100)
    this.centerLayers()
  }
  
  /**
   * 居中图层
   */
  centerLayers() {
    const center = this.canvas.getCenter()
    
    Object.values(this.layers).forEach(layer => {
      if (layer) {
        layer.center()
        layer.setCoords()
      }
    })
    
    this.canvas.renderAll()
  }
  
  /**
   * 重置并居中
   */
  resetAndCenter() {
    // 重置缩放
    this.setZoom(100)
    
    // 居中所有图层
    this.centerLayers()
    
    // 重置透明度
    if (this.layers.template) {
      this.layers.template.set('opacity', 0.8)
    }
    if (this.layers.grid) {
      this.layers.grid.set('opacity', 1)
    }
    
    this.canvas.renderAll()
    this.saveState()
  }
  
  /**
   * 设置绘画颜色
   */
  setDrawingColor(color) {
    this.state.selectedColor = color
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.color = color
    }
  }
  
  /**
   * 设置画笔大小
   */
  setBrushSize(size) {
    this.state.brushSize = size
    if (this.canvas.freeDrawingBrush) {
      this.canvas.freeDrawingBrush.width = size
    }
  }
  
  /**
   * 导出为图像
   */
  exportToImage(format = 'png', quality = 1) {
    return this.canvas.toDataURL({
      format: format,
      quality: quality
    })
  }
  
  /**
   * 获取配置数据
   */
  getConfiguration() {
    return {
      layers: {
        template: this.getLayerProperty('template'),
        grid: this.getLayerProperty('grid')
      },
      zoom: this.state.zoom * 100,
      activeTool: this.state.activeTool
    }
  }
  
  /**
   * 保存状态到历史记录
   */
  saveState() {
    const state = JSON.stringify(this.canvas.toJSON(['layerId']))
    this.history = this.history.slice(0, this.historyIndex + 1)
    this.history.push(state)
    this.historyIndex++
    
    // 限制历史记录数量
    if (this.history.length > 50) {
      this.history.shift()
      this.historyIndex--
    }
  }
  
  /**
   * 撤销
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--
      this.loadState(this.history[this.historyIndex])
    }
  }
  
  /**
   * 重做
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      this.loadState(this.history[this.historyIndex])
    }
  }
  
  /**
   * 加载状态
   */
  loadState(state) {
    this.canvas.loadFromJSON(state, () => {
      this.canvas.renderAll()
      this.updateLayerReferences()
    })
  }
  
  /**
   * 更新图层引用
   */
  updateLayerReferences() {
    this.layers.template = this.canvas.getObjects().find(obj => obj.layerId === 'template')
    this.layers.grid = this.canvas.getObjects().find(obj => obj.layerId === 'grid')
  }
  
  /**
   * 事件处理方法
   */
  handleObjectSelection(obj) {
    if (obj && obj.layerId) {
      this.state.selectedLayer = obj.layerId
      this.triggerCallback('onLayerSelect', obj.layerId)
    }
  }
  
  handleObjectModified(obj) {
    if (obj && obj.layerId) {
      this.triggerCallback('onLayerUpdate', obj.layerId)
    }
  }
  
  handleMouseDown(e) {
    if (this.state.activeTool === 'color') {
      this.state.isDrawing = true
    }
  }
  
  handleMouseMove(e) {
    // 处理绘画工具的鼠标移动
  }
  
  handleMouseUp(e) {
    if (this.state.isDrawing) {
      this.state.isDrawing = false
      this.saveState()
    }
  }
  
  /**
   * 销毁编辑器实例
   */
  destroy() {
    if (this.canvas) {
      this.canvas.dispose()
      this.canvas = null
    }
    this.layers = {}
    this.history = []
  }
}
