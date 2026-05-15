<template>
  <el-container class="diamond-canvas-wrapper" direction="vertical">
    
    <el-header class="canvas-header-section">
      <CanvasHeader
        ref="canvasHeaderRef"
        :initial-color-config="props.projectData?.colorConfig || {}"
        @opacity-change="handleOpacityChange"
        @cell-type-change="handleCellTypeChange"
        @stitch-preview-mode-change="handleStitchPreviewModeChange"
        @border-width-change="handleBorderWidthChange"
        @display-mode-change="handleDisplayModeChange"
        @rect-selection-change="handleRectSelectionChange"
        @undo="handleUndo"
        @redo="handleRedo"
        @eyedropper-toggle="handleEyedropperToggle"
        @save-project="handleSaveProject"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @fit-to-screen="fitToScreen"
        @flood-fill-active="handleFloodFillActive"
        @flood-fill-cancel="handleFloodFillCancel"
        @strategy-change="onStrategyChange"
        @strategy-param-change="onStrategyParamChange"
        @palette-config-change="onPaletteConfigChange"
      />
    </el-header>

    
    <el-container class="canvas-body-row">
      
      <el-aside class="canvas-sidebar" :width="sidebarWidth + 'px'">
        <div class="sidebar-content">
          <CanvasToolbar 
            :project-data="props.projectData"
            :get-color-data="getColorData"
            :show-color-on-canvas="showColorOnCanvas"
            :hide-color-on-canvas="hideColorOnCanvas"
            @color-selected="handleColorSelected"
            ref="canvasToolbarRef"
          />
        </div>
        <div class="resize-handle" @mousedown="startResize" />
      </el-aside>

      
      <el-main class="canvas-center">
        <div class="canvas-stage" ref="canvasStageRef">
          <div v-if="autoColorizeProgress != null" class="auto-color-overlay">
            <div class="auto-color-progress-box">
              <div class="auto-color-label">{{ t('colorStrategy.applyingProgress') }}</div>
              <el-progress :percentage="autoColorizeProgress" :striped="true" :stroke-width="12" />
            </div>
          </div>
          <div
            ref="canvasContainer"
            class="canvas-container"
            @mouseenter="handleContainerMouseEnter"
            @mouseleave="handleContainerMouseLeave"
            @mousemove="handleCanvasMouseMove"
          >
            
            <div v-if="spacerTop > 0" :style="{ height: spacerTop + 'px' }" class="scroll-spacer-top" />
            <canvas ref="canvasRef"></canvas>
            <div v-if="spacerBottom > 0" :style="{ height: spacerBottom + 'px' }" class="scroll-spacer-bottom" />
            <div
              v-if="eyedropperActive && eyedropper.visible"
              class="eyedropper-popover"
              :style="{ left: eyedropper.x + 'px', top: eyedropper.y + 'px' }"
            >
              <div class="row"><span class="label">{{ t('diamondCanvas.eyedropperPosition') }}</span><span class="value">{{ eyedropper.row }}, {{ eyedropper.col }}</span></div>
              <div class="row"><span class="label">{{ t('diamondCanvas.eyedropperColor') }}</span><span class="swatch" :style="{ background: eyedropper.finalColor }" /><span class="value">{{ eyedropper.finalColor }}</span></div>
              <template v-if="eyedropper.nearestList && eyedropper.nearestList.length">
                <div class="row" style="margin-top:6px;"><span class="label">{{ t('diamondCanvas.eyedropperNearest') }}</span></div>
                <div v-for="(item,idx) in eyedropper.nearestList" :key="idx" class="row">
                  <span class="swatch" :style="{ background: item.entry.hex }" />
                  <span class="value">[#{{ item.entry.code }} {{ item.entry.name }} {{ item.entry.hex }}]</span>
                </div>
              </template>
            </div>
          </div>
        </div>
        
        <div class="canvas-bottom-placeholder" />
      </el-main>

      
      <el-aside class="stats-fixed" width="300px">
        <ColorStatistics
          :get-color-data="getColorData"
          :show-color-on-canvas="showColorOnCanvas"
          :hide-color-on-canvas="hideColorOnCanvas"
          ref="colorStatsRef"
        />
      </el-aside>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick, computed, watch, markRaw } from 'vue'
import { DiamondCanvas } from '../../core/diamond_canvas.js'
import CanvasToolbar from './CanvasToolbar.vue'
import CanvasHeader from './CanvasHeader.vue'
import ColorPalette from './ColorPalette.vue'
import { useEyedropper } from './useEyedropper'
import { useCanvasHeader } from './useCanvasHeader'
import { useCanvasHistory } from './useCanvasHistory'
import { useCanvasResize } from './useCanvasResize'
import CanvasRulers from './CanvasRulers.vue'
import { loadSVGFromString } from 'fabric'
import ColorStatistics from './ColorStatistics.vue'
import { useColorManagement } from '../../composables/useColorManagement.js'
import { useColorGroups } from '../../composables/useColorGroups.js'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { buildProjectXml, downloadXml } from '../../utils/projectXml.js'
import { deriveXsdDisplayPreset } from '../../core/xsd/XsdDisplayParser.js'

const { t } = useI18n()

// emit
const emit = defineEmits([
  'cell-change',     // 
  'grid-change',     // 
  'background-change' // 
])

// props
const props = defineProps({
  // 
  projectData: {
    type: Object,
    default: () => ({})
  },
  // :  hex/color  color_id/code
  cellsMatrix: { type: Array, default: () => [] }
})

// color management
const { colorPalette, loadColorPalettes } = useColorManagement()
const { getGroupById } = useColorGroups()

// group  ref 
const groupColorsRef = ref([])

function clonePaletteEntries(list = []) {
  return Array.isArray(list)
    ? list.map(c => ({ id: c.id, hex: c.hex, name: c.name }))
    : []
}

/** 首次背景自动上色与「应用」上色共用；null 表示不显示 */
const autoColorizeProgress = ref(null)
function notifyAutoColorizeProgress(p) {
  if (p == null || p === '') autoColorizeProgress.value = null
  else autoColorizeProgress.value = Math.min(100, Math.max(0, Math.round(Number(p) * 100)))
}

//  DiamondCanvas  group 
async function ensureGroupColors() {
  const cfg = props.projectData?.colorConfig
  if (!cfg) return
  const groupId = cfg.colorGroupId || cfg.color_group_id
  if (Array.isArray(cfg.allColors) && cfg.allColors.length) {
    groupColorsRef.value = clonePaletteEntries(cfg.allColors)
    return
  }
  //  selectedColors  groupColorsRef
  if (Array.isArray(cfg.selectedColors) && cfg.selectedColors.length) {
    groupColorsRef.value = clonePaletteEntries(cfg.selectedColors)
    return
  }
  if (!groupId || !getGroupById) return
  try {
    const g = await getGroupById(groupId)
    if (g && Array.isArray(g.color_ids) && g.color_ids.length) {
      const fetched = clonePaletteEntries(g.color_ids)
      groupColorsRef.value = fetched
      //  projectData 
      if (!props.projectData.colorConfig) props.projectData.colorConfig = {}
      props.projectData.colorConfig.allColors = fetched
      if (cfg.type === 'group') {
        props.projectData.colorConfig.selectedColors = fetched
      }
      if (!props.projectData.colorConfig.colorCount) {
        props.projectData.colorConfig.colorCount = fetched.length
      }
    }
  } catch(e) {
    console.warn('[DiamondCanvas.vue] ensureGroupColors failed', groupId, e)
  }
}

//  groupId / selectedColors 
watch(() => {
  const cfg = props.projectData?.colorConfig || {}
  return {
    type: cfg.type,
    groupId: cfg.colorGroupId || cfg.color_group_id || null,
    selected: cfg.selectedColors,
    allColors: cfg.allColors
  }
}, async (val) => {
  if (Array.isArray(val.allColors) && val.allColors.length) {
    groupColorsRef.value = clonePaletteEntries(val.allColors)
    return
  }
  if (Array.isArray(val.selected) && val.selected.length) {
    groupColorsRef.value = clonePaletteEntries(val.selected)
    return
  }
  if (val.groupId && getGroupById) {
    try {
      const group = await getGroupById(val.groupId)
      if (group && Array.isArray(group.color_ids)) {
        groupColorsRef.value = clonePaletteEntries(group.color_ids)
      }
    } catch (e) {
      console.warn('[DiamondCanvas.vue] get group colors failed', val.groupId, e)
    }
    return
  }
  groupColorsRef.value = []
}, { immediate: false, deep: true })

// palette config
const paletteConfig = computed(() => {
  const cfg = props.projectData?.colorConfig || {}
  const scopedColors = Array.isArray(cfg.allColors) && cfg.allColors.length
    ? clonePaletteEntries(cfg.allColors)
    : (Array.isArray(cfg.selectedColors) && cfg.selectedColors.length
        ? clonePaletteEntries(cfg.selectedColors)
        : groupColorsRef.value)
  if (!cfg.type) return null
  if (cfg.type === 'group') {
    const colors = scopedColors
    if (!colors || colors.length === 0) return null
    return { type: 'group', groupId: cfg.colorGroupId || cfg.color_group_id || null, colors, colorCount: cfg.colorCount, allColors: colors }
  }
  if (cfg.type === 'count') {
    const count = cfg.colorCount
    if (!count) return null
    const allColors = scopedColors.length
      ? scopedColors
      : colorPalette.value.map(c => ({ id: c.id, hex: c.hex, name: c.name }))
    return { type: 'count', colorCount: count, allColors }
  }
  return null
})

//  base64  gridOptions 
const backgroundImageBase64 = computed(() => {
  const img = props.projectData?.image || {}
  return img.data || img.thumbnail || img.base64 || img.base64Data || img.base64_image || null
})

const isXsdProject = computed(() => !!props.projectData?.xsdParsed)

const DEFAULT_DISPLAY_PRESET = Object.freeze({
  opacity: 0.8,
  cellType: 'full',
  displayMode: 'both',
  borderWidth: 1,
  gridBackgroundVisible: true,
  fillEmptyWithWhite: false,
  renderStyle: { renderMode: 'solid', previewMode: 'real' },
  gridStyle: null,
  canvasBackgroundColor: '#ffffff'
})

function cloneDisplayPreset(preset = DEFAULT_DISPLAY_PRESET) {
  return {
    ...preset,
    renderStyle: { ...(preset.renderStyle || {}) },
    gridStyle: preset.gridStyle ? { ...preset.gridStyle } : null
  }
}

function inferCellType(cellType, renderStyle = {}) {
  if (cellType === 'mixed') return 'mixed'
  if (cellType === 'x' || cellType === 'full') return cellType
  if (renderStyle.renderMode === 'mixed') return 'mixed'
  if (renderStyle.renderMode === 'cross') return 'x'
  return 'full'
}

function mergeDisplayPresets(basePreset, overridePreset) {
  const base = cloneDisplayPreset(basePreset)
  if (!overridePreset || typeof overridePreset !== 'object') {
    base.cellType = inferCellType(base.cellType, base.renderStyle)
    return base
  }

  const merged = {
    ...base,
    ...overridePreset,
    renderStyle: {
      ...(base.renderStyle || {}),
      ...(overridePreset.renderStyle || {})
    },
    gridStyle: overridePreset.gridStyle
      ? {
          ...(base.gridStyle || {}),
          ...overridePreset.gridStyle
        }
      : base.gridStyle ? { ...base.gridStyle } : null
  }

  merged.cellType = inferCellType(overridePreset.cellType, merged.renderStyle)
  return merged
}

//  gridOptions  backgroundImageBase64
const gridOptions = computed(() => {
  const projectCellsMatrix = Array.isArray(props.projectData?.cellsMatrix) ? props.projectData.cellsMatrix : []
  const pd = props.projectData || {}
  const img = pd.image || {}
  const imgSize = img.size || {}
  const grid = pd.grid || {}
  return {
    backgroundImageBase64: backgroundImageBase64.value,
    width_cell: grid.width || grid.columns || grid.cols || grid.col || (projectCellsMatrix.length || 0),
    length_cell: grid.length || grid.rows || grid.row || (projectCellsMatrix[0]?.length || 0),
    height_cell: grid.height || grid.height_cell || grid.rows || grid.length || (projectCellsMatrix[0]?.length || 0),
    cell_size: grid.cellSize || grid.cell_size || null,
    image_width: imgSize.width || pd.image_width || 0,
    image_height: imgSize.height || pd.image_height || 0,
    canvas_width: imgSize.width || 0,
    canvas_height: imgSize.height || 0,
    defaultCellColor: '#FFFFFF00',
    selection: false,
    backgroundColor: '#ffffff',
    paletteConfig: paletteConfig.value,
    colorAlgorithm: pd.colorConfig?.algorithm || 'average',
    strategy: pd.colorConfig?.algorithm || 'average',
    strategyParams: pd.colorConfig?.algorithmParams || { softChoiceThreshold:0.8, randomFactor:0 },
    // : 
    cellsMatrix: projectCellsMatrix.length ? projectCellsMatrix : null,
    onAutoColorizeProgress: notifyAutoColorizeProgress
  }
})

// core refs
const canvasRef = ref(null)
const canvasContainer = ref(null)
const canvasToolbarRef = ref(null)
const canvasHeaderRef = ref(null)
const diamondCanvasRef = ref(null)
const canvasStageRef = ref(null)
const colorStatsRef = ref(null) // : 
let diamondCanvas // 

async function runAutoColorizeWithProgress(targetConfig) {
  if (!diamondCanvas || !targetConfig) return
  autoColorizeProgress.value = 0
  try {
    await diamondCanvas.updatePaletteAndColorize(targetConfig, {
      onProgress: (p) => {
        autoColorizeProgress.value = Math.min(100, Math.max(0, Math.round(p * 100)))
      }
    })
  } catch (e) {
    console.warn('[DiamondCanvas.vue] runAutoColorizeWithProgress', e)
  } finally {
    fillProjectEmptyWithWhite({ replaceColoredCells: true })
    autoColorizeProgress.value = null
  }
}

function getProjectDisplayPreset() {
  const savedPreset = props.projectData?.result?.display || props.projectData?.displayConfig || null
  const xsdPreset = isXsdProject.value ? deriveXsdDisplayPreset(props.projectData?.xsdParsed?.displayMeta) : null
  const basePreset = xsdPreset ? mergeDisplayPresets(DEFAULT_DISPLAY_PRESET, xsdPreset) : cloneDisplayPreset(DEFAULT_DISPLAY_PRESET)
  return savedPreset ? mergeDisplayPresets(basePreset, savedPreset) : basePreset
}

function collectProjectPaletteEntries() {
  const result = []
  const seen = new Set()
  const push = (entries) => {
    if (!Array.isArray(entries)) return
    for (const entry of entries) {
      const hex = String(entry?.hex || entry?.color || '').trim().toUpperCase()
      if (!hex) continue
      const id = entry?.id ?? entry?.code ?? entry?.number ?? entry?.name ?? hex
      const key = `${id}|${hex}`
      if (seen.has(key)) continue
      seen.add(key)
      result.push({ ...entry, id, hex })
    }
  }

  push(props.projectData?.colorConfig?.selectedColors)
  push(props.projectData?.colorConfig?.allColors)
  push(colorPalette.value)

  return result
}

function fillProjectEmptyWithWhite(options = {}) {
  if (!diamondCanvas) return []
  const replaceColoredCells = options.replaceColoredCells === true
  const paletteEntries = collectProjectPaletteEntries()
  if (paletteEntries.length) {
    diamondCanvas.fillDefaultCellsWithPaletteWhite?.({
      paletteEntries
    })
    diamondCanvas.normalizeTransparentBackgroundToPaletteWhite?.({
      paletteEntries,
      replaceColoredCells
    })
  }
  const snapshot = diamondCanvas.getCellsMatrixSnapshot?.() || []
  if (snapshot?.length && props.projectData) {
    props.projectData.cellsMatrix = markRaw(snapshot)
  }
  return snapshot
}

// scroll & mouse indicator
const scrollState = ref({ left: 0, top: 0 })
const mouseIndicatorCanvas = ref({ visible:false, canvasX:0, canvasY:0 })
function handleScroll(){
  if(!canvasContainer.value) return
  scrollState.value.left = canvasContainer.value.scrollLeft
  scrollState.value.top = canvasContainer.value.scrollTop
}
function handleCanvasMouseMove(e){
  const cvs = canvasRef.value
  if(!cvs) return
  if (pendingMouseFrame) return
  pendingMouseFrame = true
  lastMouseEvent = e
  requestAnimationFrame(()=>{
    pendingMouseFrame = false
    const rect = cvs.getBoundingClientRect()
    mouseIndicatorCanvas.value.visible = true
    mouseIndicatorCanvas.value.canvasX = lastMouseEvent.clientX - rect.left
    mouseIndicatorCanvas.value.canvasY = lastMouseEvent.clientY - rect.top
  })
}
let pendingMouseFrame = false
let lastMouseEvent = null
//  enter/leave  crosshair 
function handleContainerMouseEnter(e){
  mouseIndicatorCanvas.value.visible = true
  onContainerMouseEnter?.(e)
}
function handleContainerMouseLeave(e){
  mouseIndicatorCanvas.value.visible = false
  onContainerMouseLeave?.(e)
}
//  scroll ( scroll)
const canvasTopLeft = computed(()=>({ x: -scrollState.value.left, y: -scrollState.value.top }))

// --- MOVE these before useEyedropper to avoid TDZ ---
const { setupResizeObserver, destroyResizeObserver, zoomIn, zoomOut, resetZoom, setScale, zoomScale, canvasPixelWidth, canvasPixelHeight } = useCanvasResize(diamondCanvasRef)

// eyedropper AFTER zoomScale & canvasTopLeft defined
const { eyedropperActive, eyedropper, handleEyedropperToggle, onContainerMouseEnter, onContainerMouseLeave, destroyEyedropper, tryBindListener } = useEyedropper({ diamondCanvas: diamondCanvasRef, canvasContainer, getPaletteColors, zoomScale, canvasTopLeft })

// header controls
const {
  canvasConfig,
  handleOpacityChange,
  handleCellTypeChange,
  handleStitchPreviewModeChange,
  handleBorderWidthChange,
  handleDisplayModeChange,
  handleRectSelectionChange
} = useCanvasHeader(diamondCanvasRef)

// history controls
function refreshColorStatistics() { colorStatsRef.value?.refreshData?.() }
const { handleUndo, handleRedo, updateUndoRedoButtonState } = useCanvasHistory(diamondCanvasRef, canvasHeaderRef, refreshColorStatistics)

// palette provider
function getPaletteColors() {
  try { return canvasToolbarRef.value?.getPaletteColors?.() || [] } catch { return [] }
}

// color selection
const currentSelectedColor = ref(null)
function handleColorSelected(data) {
  const selected = data?.color || null
  currentSelectedColor.value = selected
  if (!diamondCanvas) return
  if (selected) {
    diamondCanvas.SetNowSlectedColor(selected.hex, selected.id)
  } else {
    // 
    diamondCanvas.SetNowSlectedColor(null, null)
  }
}

function getColorData() {
  if (diamondCanvas) {
    return diamondCanvas.getColorCount()
  }
  return {}
}

function showColorOnCanvas(color) {
  if (diamondCanvas && typeof diamondCanvas.showSelectColorRect === 'function') {
    diamondCanvas.showSelectColorRect(color)
  }
}

function hideColorOnCanvas() {
  if (diamondCanvas && typeof diamondCanvas.hideSelectColorRect === 'function') {
    diamondCanvas.hideSelectColorRect()
  }
}

function updateCentering() {
  const cont = canvasContainer.value
  const cvs = canvasRef.value
  if (!cont || !cvs) return
  const w = cvs.offsetWidth || cvs.width || 0
  const h = cvs.offsetHeight || cvs.height || 0
  const vw = cont.clientWidth
  const vh = cont.clientHeight
  if (!scrollMode.value && w && h && w <= vw && h <= vh) {
    cont.classList.add('centered')
  } else {
    cont.classList.remove('centered')
  }
}

const stageSize = ref({ width:0, height:0 })
//  canvasContainerSize stageSize canvasContainer   24px*2 
function updateStageSize(){
  if (canvasStageRef.value){
    stageSize.value.width = canvasStageRef.value.clientWidth
    stageSize.value.height = canvasStageRef.value.clientHeight
  }
  if (canvasContainer.value){
    scrollState.value.left = canvasContainer.value.scrollLeft
    scrollState.value.top = canvasContainer.value.scrollTop
  }
}

watch(zoomScale, () => { 
  nextTick(() => {
    updateCentering()
    updateStageSize()
    //  CanvasHeader 
    if (canvasHeaderRef.value?.updateZoomScale) {
      canvasHeaderRef.value.updateZoomScale(zoomScale.value)
    }
  })
})

// 不再 watch paletteConfig 自动上色：避免调参/色数微调时重复跑算法；仅「应用」、初始化 setTimeout、背景首次加载会触发上色。

// 
let wheelTimer = null
function debounce(func, wait) {
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(wheelTimer)
      func(...args)
    }
    clearTimeout(wheelTimer)
    wheelTimer = setTimeout(later, wait)
  }
}

function handleWheel(e) {
  if ((e.ctrlKey || e.metaKey)) { // ctrl (win) or cmd (mac)
    e.preventDefault()
    const delta = e.deltaY
    
    // 
    const debouncedZoom = debounce(() => {
      const currentScale = zoomScale.value
      let newScale
      
      if (delta > 0) {
        //  0.2  (20%)
        newScale = Math.max(0.2, currentScale - 0.1)
      } else if (delta < 0) {
        //  5.0  (500%)
        newScale = Math.min(5.0, currentScale + 0.1)
      }
      
      if (newScale !== currentScale) {
        setScale(newScale)
      }
    }, 50) // 16ms  60fps
    
    debouncedZoom()
  }
}

//  props 
// :  base64 (data ,  thumbnail)
const canInit = computed(() => {
  const w = gridOptions.value.image_width
  const h = gridOptions.value.image_height
  return !!(w && h && w > 0 && h > 0 && backgroundImageBase64.value)
})

let initTried = false
function applyProjectDisplayPreset() {
  if (!diamondCanvas) return
  const preset = getProjectDisplayPreset()
  if (!preset) return

  canvasHeaderRef.value?.setOpacity?.(preset.opacity)
  canvasHeaderRef.value?.setCellType?.(preset.cellType)
  canvasHeaderRef.value?.setStitchPreviewMode?.(preset.renderStyle?.previewMode || 'real')
  canvasHeaderRef.value?.setDisplayMode?.(preset.displayMode)
  canvasHeaderRef.value?.setBorderWidth?.(preset.borderWidth)

  diamondCanvas.setCanvasBackgroundColor?.(preset.canvasBackgroundColor)
  diamondCanvas.setGridModeBackgroundVisible?.(preset.gridBackgroundVisible)
  diamondCanvas.setOpacity?.(preset.opacity)
  diamondCanvas.setCellType?.(preset.cellType)
  diamondCanvas.setStitchStyle?.(preset.renderStyle)
  if (preset.gridStyle) diamondCanvas.setGridStyle?.(preset.gridStyle)
  diamondCanvas.setDisplayMode?.(preset.displayMode)
  diamondCanvas.setBorderWidth?.(preset.borderWidth)
  fillProjectEmptyWithWhite(preset)
}

async function initDiamondCanvas() {
  if (diamondCanvas || initTried) return
  initTried = true
  try {
    await ensureGroupColors()
    const cfg = props.projectData?.colorConfig
    if (cfg?.type === 'count' && colorPalette.value.length === 0) {
      try { await loadColorPalettes() } catch(e){ console.warn('load color palettes failed', e) }
    }
    nextTick(() => {
      if (!canvasRef.value || !canvasContainer.value) {
        return
      }
      try {
        diamondCanvas = new DiamondCanvas(canvasRef.value, gridOptions.value)
        window.diamondCanvas = diamondCanvas
        diamondCanvasRef.value = diamondCanvas
        applyProjectDisplayPreset()
        diamondCanvas.onCellChange((row, col, color, rect) => {
          emit('cell-change', { row, col, color, rect })
          refreshColorStatistics()
          updateUndoRedoButtonState()
          pendingPaintAggregate.count++
          pendingPaintAggregate.last = { row, col, color }
          if (!paintEventThrottleTimer) {
            paintEventThrottleTimer = setTimeout(() => {
              try { window.dispatchEvent(new CustomEvent('diamond-color-updated', { detail: { type: 'paint', ...pendingPaintAggregate } })) } catch(_) {}
              pendingPaintAggregate = { count: 0 }
              paintEventThrottleTimer = null
            }, 80)
          }
        })
        tryBindListener()
        //  XML  image  size 
        const imgSize = props.projectData?.image?.size || {}
        const w = imgSize.width || gridOptions.value.image_width || diamondCanvas.image_width || 0
        const h = imgSize.height || gridOptions.value.image_height || diamondCanvas.image_height || 0
        try { setupResizeObserver(w, h) } catch(e){ console.warn('setupResizeObserver failed', e) }
        const initCfg = paletteConfig.value
        const hasExistingCellsMatrix = Array.isArray(props.projectData?.cellsMatrix) && props.projectData.cellsMatrix.length > 0
        if (initCfg && !hasExistingCellsMatrix) {
          setTimeout(() => {
            if (paletteConfig.value) void runAutoColorizeWithProgress(paletteConfig.value)
          }, 0)
        }
        canvasContainer.value.addEventListener('wheel', handleWheel, { passive: false })
        canvasContainer.value.addEventListener('scroll', handleScroll, { passive: true })
        setTimeout(() => {
          refreshColorStatistics(); updateUndoRedoButtonState(); updateCentering(); updateStageSize()
          if (canvasHeaderRef.value?.updateZoomScale) canvasHeaderRef.value.updateZoomScale(zoomScale.value)
          // “”
          if (canvasHeaderRef.value?.fitToScreen) {
            canvasHeaderRef.value.fitToScreen()
          } else {
            fitToScreen()
          }
        }, 500)
        // 
        fitToScreen()
      } catch (e) {
        console.error('DiamondCanvas init (delayed) failed:', e)
      }
    })
  } catch (e) {
    console.error('initDiamondCanvas error:', e)
  }
}

//  onMounted 
onMounted(async () => {
  initDiamondCanvas()
  
  applyScrollableSize()
})

// 
watch(canInit, (v) => { if (v && !diamondCanvas) initDiamondCanvas() })

// 
const startResize = (e) => {
  e.preventDefault()
  isResizing.value = true
  startX.value = e.clientX
  startWidth.value = sidebarWidth.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'col-resize'
}
const handleResize = (e) => {
  if (!isResizing.value) return
  const deltaX = e.clientX - startX.value
  let newWidth = startWidth.value + deltaX
  newWidth = Math.max(minSidebarWidth, Math.min(maxSidebarWidth, newWidth))
  sidebarWidth.value = newWidth
}
const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

//  Windows 
function sanitizeFileName(name){
  if(!name) return 'Project'
  return name
    .replace(/[\\/:*?"<>|]/g,'_')        // Windows 
    .replace(/[\s\u3000]+/g,'_')          // 
    .replace(/[\uFF1A:]/g,'_')             // /
    .replace(/_+/g,'_')                    // 
    .replace(/^_+|_+$/g,'')                // 
    .replace(/\.+$/,'')                   // 
    .slice(0,80) || 'Project'
}

// 
async function handleSaveProject() {
  if (!diamondCanvas) return
  try {
    const snapshot = fillProjectEmptyWithWhite()
    const rawName = (props.projectData && (props.projectData.name || props.projectData.project_name)) || 'Project'
    const projectName = sanitizeFileName(rawName)
    const data = await diamondCanvas.saveProjectV2({ projectName, quality:1 })
    if (!data) { console.warn('save: no data'); ElMessage.warning(t('diamondCanvas.saveNoData')); return }
    const savedAt = new Date().toISOString()

    //  XML
    try {
      const xml = buildProjectXml({ result: data, projectData: props.projectData })
      const ts = new Date()
      const stamp = `${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}_${String(ts.getHours()).padStart(2,'0')}${String(ts.getMinutes()).padStart(2,'0')}${String(ts.getSeconds()).padStart(2,'0')}`
      downloadXml(xml, `${projectName}.xml`)
      // persist xml snapshot
      try {
        const { saveXmlSnapshot } = await import('../../database/indexeddb/xmlSnapshotStore.js')
        const rows = data?.cells?.rows || data?.grid?.rows || null
        const cols = data?.cells?.cols || data?.grid?.cols || null
        const paletteCount = Array.isArray(data?.palette) ? data.palette.length : (props.projectData?.colorConfig?.colorCount || null)
        await saveXmlSnapshot({ project_name: projectName, rows, cols, palette_count: paletteCount, xml_string: xml })
        console.log('[XML] snapshot persisted')
      } catch(dbErr){ console.warn('[XML] snapshot persist failed', dbErr) }
    } catch(xmlErr){ console.warn('XML build failed', xmlErr); ElMessage.warning(t('diamondCanvas.xmlBuildFailed')) }

    if (props.projectData) {
      props.projectData.result = data
      if (Array.isArray(snapshot) && snapshot.length) {
        props.projectData.cellsMatrix = markRaw(snapshot)
      }
      props.projectData.updatedAt = savedAt
    }
    if (props.projectData?.id) {
      try {
        const mod = await import('../../database/indexeddb/projectStore.js')
        await mod.updateProject(props.projectData.id, {
          result: data,
          cells_matrix: JSON.stringify(Array.isArray(snapshot) ? snapshot : []),
          updated_at: savedAt
        })
        console.log('[SaveXML] IndexedDB updated')
      } catch (e) { console.warn('[SaveXML] IndexedDB update failed', e) }
    }
    ElMessage.success(t('diamondCanvas.xmlSaved'))
  } catch (e) {
    console.error('save project failed', e)
    ElMessage.error(t('diamondCanvas.saveFailed', { msg: e.message || e }))
  }
}

// 
function fitToScreen() {
  const cont = canvasContainer.value
  if (!cont) return
  const baseW = props.projectData?.image?.size?.width || 0
  const baseH = props.projectData?.image?.size?.height || 0
  if (!baseW || !baseH) return
  // 
  const scaleFit = Math.min(cont.clientWidth / baseW, cont.clientHeight / baseH)
  const target = Math.min(1, scaleFit)
  setScale(target)
  nextTick(() => updateCentering())
}

//  ( = base pixel size,  grid.cellSize /)
const cellPixelWidth = computed(() => {
  const grid = props.projectData?.grid || {}
  //  grid  cellSize ,  baseWidth/
  const columns = grid.length 
  const baseW = props.projectData?.image?.size?.width || canvasPixelWidth.value || 0
  return columns ? (baseW / columns) * zoomScale.value : 10
})
const cellPixelHeight = computed(() => {
  const grid = props.projectData?.grid || {}
  const rows = grid.width 
  const baseH = props.projectData?.image?.size?.height || canvasPixelHeight.value || 0
  return rows ? (baseH / rows) * zoomScale.value : 10
})

// strategy change handlers
function onStrategyChange(v){
  console.log('[DiamondCanvas.vue] onStrategyChange', v)
  if (diamondCanvas) {
    diamondCanvas.setStrategy(v)
  }
  if (!props.projectData.colorConfig) props.projectData.colorConfig = {}
  props.projectData.colorConfig.algorithm = v
}
function onStrategyParamChange(p){
  console.log('[DiamondCanvas.vue] onStrategyParamChange', p)
  if (diamondCanvas) {
    diamondCanvas.setStrategyParams(p)
  }
  if (!props.projectData.colorConfig) props.projectData.colorConfig = {}
  props.projectData.colorConfig.algorithmParams = { ...(props.projectData.colorConfig.algorithmParams||{}), ...p }
}
function onPaletteConfigChange(cfg){
  console.log('[DiamondCanvas.vue] onPaletteConfigChange', cfg)
  if (!props.projectData.colorConfig) props.projectData.colorConfig = {}
  if (cfg.type==='count'){
    props.projectData.colorConfig.type='count'
    props.projectData.colorConfig.colorCount = cfg.colorCount
    props.projectData.colorConfig.colorGroupId = cfg.colorGroupId || null
    props.projectData.colorConfig.selectedColors = []
    props.projectData.colorConfig.allColors = Array.isArray(cfg.allColors) ? cfg.allColors : []
    groupColorsRef.value = clonePaletteEntries(props.projectData.colorConfig.allColors)
  } else if (cfg.type==='group') {
    props.projectData.colorConfig.type='group'
    props.projectData.colorConfig.colorGroupId = cfg.colorGroupId
    props.projectData.colorConfig.selectedColors = cfg.selectedColors || []
    props.projectData.colorConfig.allColors = cfg.selectedColors || []
    props.projectData.colorConfig.colorCount = cfg.colorCount || props.projectData.colorConfig.selectedColors.length
    groupColorsRef.value = clonePaletteEntries(props.projectData.colorConfig.selectedColors)
  }
  console.log('paletteConfig', paletteConfig.value)
  const shouldRun = cfg.enable === true && diamondCanvas && paletteConfig.value
  if (shouldRun) void runAutoColorizeWithProgress(paletteConfig.value)
}
function onApplyGroupPalette(){
  //  getSelectedColors 
  try {
    const list = canvasToolbarRef.value?.getSelectedColors?.() || []
    if (!props.projectData.colorConfig) props.projectData.colorConfig = {}
    props.projectData.colorConfig.type='group'
    props.projectData.colorConfig.selectedColors = list
    console.log('[DiamondCanvas.vue] apply group palette', list?.length)
    if (diamondCanvas && paletteConfig.value) void runAutoColorizeWithProgress(paletteConfig.value)
  } catch(e){ console.warn('apply group palette failed', e) }
}

// :  CanvasHeader 
const headerPaletteGroups = computed(() => {
  //  projectData.colorConfig.paletteGroups 
  return props.projectData?.colorConfig?.paletteGroups || []
})
const headerMaxAvailableColors = computed(() => {
  //  maxAvailableColors 0
  const direct = props.projectData?.colorConfig?.maxAvailableColors
  if (typeof direct === 'number' && direct > 0) return direct
  const groups = headerPaletteGroups.value
  if (groups.length) return Math.max(...groups.map(g => (g.colors?.length || 0)))
  return 0
})

// flood fill
const isFloodFillActive = ref(false)
function handleFloodFillActive(active){
  isFloodFillActive.value = active
  if (diamondCanvas) diamondCanvas.setFloodFillMode(active)
  document.body.classList.toggle('flood-fill-active', active)
}
function handleFloodFillCancel(){
  if (diamondCanvas) diamondCanvas.cancelFloodFill()
}

// : 
const isMac = computed(() => /Mac|Macintosh|Mac OS/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent))
//  () -  header 
function globalKeydown(e){
  if (((isMac.value && e.metaKey) || (!isMac.value && e.ctrlKey)) && e.key && e.key.toLowerCase()==='s') {
    const target = e.target
    const editable = target && ((target.tagName === 'INPUT') || (target.tagName === 'TEXTAREA') || target.isContentEditable)
    if (editable) return
    e.preventDefault(); handleSaveProject()
  }
}
onMounted(()=>{ window.addEventListener('keydown', globalKeydown) })
onUnmounted(()=>{ window.removeEventListener('keydown', globalKeydown) })

// ===== Scrollable Canvas Extension ( + ) =====
const baseImageWidth = computed(() => props.projectData?.image?.size?.width || 0)
const baseImageHeight = computed(() => props.projectData?.image?.size?.height || 0)
const zoomScaledWidth = computed(() => Math.round((baseImageWidth.value || 0) * (zoomScale?.value || 1)))
const zoomScaledHeight = computed(() => Math.round((baseImageHeight.value || 0) * (zoomScale?.value || 1)))
// 

const scrollMode = ref(false)
const extraTopSpace = ref(0)
const extraBottomSpace = ref(0)
const spacerTop = ref(0)
const spacerBottom = ref(0)
function applyScrollableSize(){
  const cvs = canvasRef.value
  const cont = canvasContainer.value
  if(!cvs || !cont) return
  if(zoomScaledWidth.value) cvs.style.width = zoomScaledWidth.value + 'px'
  if(zoomScaledHeight.value) cvs.style.height = zoomScaledHeight.value + 'px'
  //  ()
  const vw = cont.clientWidth
  const vh = cont.clientHeight
  scrollMode.value = true
  //  padding 
  cont.classList.toggle('scroll-margin', scrollMode.value)
  // //  spacer  spacer
  // spacerTop.value = scrollMode.value ? 0 : extraTopSpace.value
  // spacerBottom.value = scrollMode.value ? 0 : extraBottomSpace.value
  nextTick(() => updateCentering())
}
watch([zoomScale, baseImageWidth, baseImageHeight], () => { nextTick(applyScrollableSize) })
// ===== End Scrollable Canvas Extension =====

//  cellsMatrix 
watch(() => props.cellsMatrix, (m) => {
  if (diamondCanvas && Array.isArray(m) && m.length) {
    diamondCanvas.loadCellsMatrix(m)
    fillProjectEmptyWithWhite()
  }
}, { deep: true })

</script>

<style scoped>

.diamond-canvas-wrapper {
  width: 100%;
  height: 100%;
  min-height: 0;
  background: #f5f5f5;
}
.canvas-header-section {
  padding: 0;
  height: auto !important;
  min-height: 60px;
  overflow: hidden;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.canvas-body-row { flex: 1; min-height: 0; }


.canvas-sidebar { background:#fff; border-right:1px solid #e4e7ed; box-shadow:2px 0 8px rgba(0,0,0,0.08); position:relative; overflow:auto; }
.sidebar-content { padding:16px 20px 16px 16px; min-height:100%; box-sizing:border-box; }
.resize-handle { position:absolute; top:0; right:0; width:6px; height:100%; cursor:col-resize; background:transparent; transition:.2s; }
.resize-handle:hover { background:#409eff; }


.canvas-center { padding:0; position:relative; display:flex; flex-direction:column; min-width:0; }

.canvas-stage { position:relative; flex:1; display:flex; }
.auto-color-overlay {
  position:absolute; inset:0; z-index:20; display:flex; align-items:center; justify-content:center;
  background:rgba(255,255,255,0.72); pointer-events:all;
}
.auto-color-progress-box { width:min(420px,86vw); padding:20px 24px; background:#fff; border-radius:10px; box-shadow:0 8px 32px rgba(0,0,0,0.12); border:1px solid #e4e7ed; }
.auto-color-label { font-size:13px; color:#606266; margin-bottom:12px; }
.canvas-container { position:relative; flex:1; overflow:scroll; scrollbar-gutter:stable; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.1); }
.canvas-container.centered { display:flex; align-items:center; justify-content:center; }


.stats-fixed { background:#fff; border-left:1px solid #e4e7ed; box-shadow:-2px 0 8px rgba(0,0,0,0.08); padding:8px 10px 10px; display:flex; flex-direction:column; overflow:hidden; }
@media (max-width:1400px){ .stats-fixed { width:260px !important; } }
@media (max-width:1100px){ .stats-fixed { width:230px !important; } }

/* Eyedropper */
.eyedropper-popover { position:absolute; pointer-events:none; background:rgba(255,255,255,0.45); border:1px solid #e4e7ed; border-radius:6px; padding:6px 8px; font-size:12px; color:#303133; box-shadow:0 2px 8px rgba(0,0,0,0.15); max-width:360px; }
.eyedropper-popover .row { display:flex; align-items:center; gap:8px; margin:2px 0; }
.eyedropper-popover .label { color:#606266; min-width:54px; }
.eyedropper-popover .value { font-family:Menlo,Monaco,Consolas,monospace; }
.eyedropper-popover .swatch { width:14px; height:14px; border:1px solid #dcdfe6; border-radius:3px; display:inline-block; }

/* Scrollbars */
.canvas-container::-webkit-scrollbar { width:10px; height:10px; }
.canvas-container::-webkit-scrollbar-track { background:#f1f1f1; }
.canvas-container::-webkit-scrollbar-thumb { background:#c1c1c1; border-radius:4px; }
.canvas-container::-webkit-scrollbar-thumb:hover { background:#a8a8a8; }
.canvas-sidebar::-webkit-scrollbar { width:6px; }
.canvas-sidebar::-webkit-scrollbar-thumb { background:#c1c1c1; border-radius:3px; }

.scroll-spacer-top, .scroll-spacer-bottom { width:100%; pointer-events:none; }


.canvas-container.scroll-margin { padding:50px; box-sizing:border-box; }

.canvas-bottom-placeholder { flex:0 0 40px; background:#fff; }
</style>

<style>
body.flood-fill-active { cursor: crosshair; }
</style>
