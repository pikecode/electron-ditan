<template>
  <div class="canvas-header">
    <div class="header-content">
      
      <div class="group group-view">
        <div class="control-group compact">
          <label class="control-label">{{ t('canvasHeader.displayMode') }}</label>
          <select v-model="displayMode" @change="handleDisplayModeChange" class="native-select small-select">
            <option value="original">{{ t('canvasHeader.modeOriginal') }}</option>
            <option value="grid">{{ t('canvasHeader.modeGrid') }}</option>
            <option value="both">{{ t('canvasHeader.modeBoth') }}</option>
          </select>
        </div>
      </div>
      <div class="group-divider"></div>
      
      <div class="group group-grid">
        <div class="control-group slider-group">
          <label class="control-label">{{ t('canvasHeader.opacity') }}</label>
          <el-slider v-model="opacity" :min="0" :max="1" :step="0.1" @change="handleOpacityChange" class="mini-slider" />
          <span class="mini-value">{{ (opacity*100).toFixed(0) }}%</span>
        </div>
        <div class="control-group compact">
          <label class="control-label">{{ t('canvasHeader.cellShape') }}</label>
          
          <el-tooltip :content="t('canvasHeader.cellShapeTip')" placement="bottom" :show-after="200">
            <el-select v-model="cellType" size="small" class="cell-type-select icon-select" @change="handleCellTypeChange" popper-class="cell-type-popper">
              <el-option value="full" :label="t('canvasHeader.cellSquare')">
                <div class="option-content"><span class="option-icon square"></span><span>{{ t('canvasHeader.cellSquare') }}</span></div>
              </el-option>
              <el-option value="x" :label="t('canvasHeader.cellCross')">
                <div class="option-content"><span class="option-icon cross"></span><span>{{ t('canvasHeader.cellCross') }}</span></div>
              </el-option>
              <el-option value="mixed" :label="t('canvasHeader.cellMixed')">
                <div class="option-content"><span class="option-icon mixed"></span><span>{{ t('canvasHeader.cellMixed') }}</span></div>
              </el-option>
            </el-select>
          </el-tooltip>
        </div>
        <div class="control-group compact">
          <label class="control-label">{{ t('canvasHeader.stitchPreview') }}</label>
          <select v-model="stitchPreviewMode" @change="handleStitchPreviewModeChange" class="native-select small-select">
            <option value="real">{{ t('canvasHeader.previewReal') }}</option>
            <option value="contrast">{{ t('canvasHeader.previewContrast') }}</option>
            <option value="texture">{{ t('canvasHeader.previewTexture') }}</option>
          </select>
        </div>
        <div class="control-group slider-group">
          <label class="control-label">{{ t('canvasHeader.border') }}</label>
          <el-slider v-model="borderWidth" :min="0" :max="5" :step="1" @change="handleBorderWidthChange" class="mini-slider" />
          <span class="mini-value">{{ borderWidth }}</span>
        </div>
      </div>
      <div class="group-divider"></div>
      
      <div class="group group-zoom">
        <div class="control-group">
          <el-tooltip :content="t('canvasHeader.zoomOut')" placement="bottom">
            <el-button :disabled="zoomScale <= 0.05" class="icon-btn" @click="handleZoomOut" circle>
              <el-icon size="16"><ZoomOut /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div class="zoom-readout">{{ (zoomScale*100).toFixed(0) }}%</div>
        <div class="control-group">
          <el-tooltip :content="t('canvasHeader.zoomIn')" placement="bottom">
            <el-button :disabled="zoomScale >= 6.0" class="icon-btn" @click="handleZoomIn" circle>
              <el-icon size="16"><ZoomIn /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div class="control-group">
          <el-tooltip :content="t('canvasHeader.fitScreen')" placement="bottom">
            <el-button class="icon-btn" @click="handleFitToScreen" circle>
              <el-icon size="16"><FullScreen /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
      <div class="group-divider"></div>
      
      <div class="group group-tools">
        <div class="control-group">
          <el-tooltip :content="eyedropperTooltip" placement="bottom">
            <el-button :type="eyedropperActive ? 'primary':'default'" class="icon-btn" @click="toggleEyedropper" circle>
              <el-icon size="16"><Aim /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div class="control-group">
          <el-tooltip :content="tooltipText" placement="bottom">
            <el-button :type="effectiveSelection ? 'primary':'default'" class="icon-btn" @click="toggleRectSelection" circle>
              <el-icon size="16"><Crop /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        
        <div class="control-group">
          <el-tooltip :content="floodFillTooltip" placement="bottom">
            <el-button :type="floodFillActive ? 'primary':'default'" class="icon-btn" @click="toggleFloodFillButton" circle>
              <el-icon size="16"><Brush /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
      <div class="group-divider"></div>
      
      <div class="group group-history">
        <div class="control-group">
          <el-tooltip :content="undoTooltip" placement="bottom">
            <el-button :disabled="!canUndo" class="icon-btn" @click="handleUndo" circle>
              <el-icon size="16"><RefreshLeft /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div class="control-group">
          <el-tooltip :content="redoTooltip" placement="bottom">
            <el-button :disabled="!canRedo" class="icon-btn" @click="handleRedo" circle>
              <el-icon size="16"><RefreshRight /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </div>
      <div class="group-divider"></div>
      
      <div class="group group-strategy">
        <ColorStrategySelector
          :initial-color-config="props.initialColorConfig"
          @strategy-change="$emit('strategy-change', $event)"
          @strategy-param-change="$emit('strategy-param-change', $event)"
          @palette-config-change="$emit('palette-config-change', $event)"
        />
      </div>
      
      <div class="group group-file">
        <div class="control-group">
          <el-tooltip :content="saveTooltip" placement="bottom" effect="dark" :show-after="150" popper-class="save-tooltip-pop">
            <el-button class="icon-btn" @click="handleSaveProject" circle :aria-label="saveTooltip">
              <el-icon size="16"><Download /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
        <div class="control-group">
          <el-tooltip :content="t('canvasHeader.rightClickErase')" placement="bottom" popper-class="info-tooltip-pop">
            <div class="icon-btn info-static">
              <el-icon size="16"><InfoFilled /></el-icon>
            </div>
          </el-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { Crop, RefreshLeft, RefreshRight, InfoFilled, Aim, Download, ZoomIn, ZoomOut, FullScreen, Brush } from '@element-plus/icons-vue'
import ColorStrategySelector from './ColorStrategySelector.vue'

// 
const emit = defineEmits([
  'opacity-change',
  'cell-type-change',
  'stitch-preview-mode-change',
  'border-width-change',
  'display-mode-change',
  'rect-selection-change',
  'undo',
  'redo',
  'eyedropper-toggle',
  'save-project',
  'zoom-in',
  'zoom-out',
  'fit-to-screen',
  'flood-fill-active',
  'flood-fill-cancel',
  'strategy-change',
  'strategy-param-change',
  'palette-config-change'
])
//  prop
const props = defineProps({
  initialColorConfig: { type:Object, default: () => ({}) }
})

const { t, locale } = useI18n()

// 
const opacity = ref(0.8)
const cellType = ref('full')
const stitchPreviewMode = ref('real')
const borderWidth = ref(1)
const displayMode = ref('both')

// 
const rectSelectionToggle = ref(false)
const modifierPressed = ref(false)

// 
const canUndo = ref(false)
const canRedo = ref(false)

// 
const isMac = computed(() => /Mac|Macintosh|Mac OS/.test(navigator.platform) || /Mac OS/.test(navigator.userAgent))
const modifierKeyLabel = computed(() => isMac.value ? '⌘' : 'Ctrl')
const tooltipText = computed(() => {
  locale.value
  return t('canvasHeader.rectSelectTip', { mod: modifierKeyLabel.value })
})
const saveTooltip = computed(() => {
  locale.value
  return t('canvasHeader.saveTip', { mod: modifierKeyLabel.value })
})

const undoTooltip = computed(() => {
  locale.value
  return t('canvasHeader.undoTip', { mod: isMac.value ? '⌘' : 'Ctrl' })
})
const redoTooltip = computed(() => {
  locale.value
  return t('canvasHeader.redoTip', { mod: isMac.value ? '⌘' : 'Ctrl' })
})

// 
const effectiveSelection = computed(() => rectSelectionToggle.value || modifierPressed.value)

// 
const eyedropperToggle = ref(false)
const eyedropperKeyPressed = ref(false)
const eyedropperActive = computed(() => eyedropperToggle.value || eyedropperKeyPressed.value)
const eyedropperTooltip = computed(() => { locale.value; return t('canvasHeader.eyedropperTip') })

// 
const floodFillKeyPressed = ref(false)
const floodFillButtonToggle = ref(false)
const floodFillActive = computed(() => floodFillKeyPressed.value || floodFillButtonToggle.value)
const floodFillTooltip = computed(() => { locale.value; return t('canvasHeader.floodFillTip') })
const toggleFloodFillButton = () => {
  floodFillButtonToggle.value = !floodFillButtonToggle.value
  emit('flood-fill-active', floodFillActive.value)
  if (!floodFillActive.value) emit('flood-fill-cancel')
}

// 
const zoomScale = ref(1.0)

// 
const handleOpacityChange = (value) => { emit('opacity-change', value) }
const handleCellTypeChange = (event) => { const value = event.target ? event.target.value : event; emit('cell-type-change', value) }
const handleStitchPreviewModeChange = (event) => { const value = event.target ? event.target.value : event; emit('stitch-preview-mode-change', value) }
const handleBorderWidthChange = (value) => { const v = typeof value === 'number' ? value : Number(value); borderWidth.value = isNaN(v) ? 1 : v; emit('border-width-change', borderWidth.value) }
const handleDisplayModeChange = (event) => { const value = event.target ? event.target.value : event; emit('display-mode-change', value) }
const toggleRectSelection = () => { rectSelectionToggle.value = !rectSelectionToggle.value; emit('rect-selection-change', effectiveSelection.value) }
const handleUndo = () => { if (canUndo.value) emit('undo') }
const handleRedo = () => { if (canRedo.value) emit('redo') }
const toggleEyedropper = () => { eyedropperToggle.value = !eyedropperToggle.value; emit('eyedropper-toggle', eyedropperActive.value) }
const handleSaveProject = () => { emit('save-project') }
const handleZoomIn = () => { emit('zoom-in') }
const handleZoomOut = () => { emit('zoom-out') }
const handleFitToScreen = () => { emit('fit-to-screen') }
const updateUndoRedoState = (undoAvailable, redoAvailable) => { canUndo.value = undoAvailable; canRedo.value = redoAvailable }

let fKeyDown = false
const keydownHandler = (e) => {
  const target = e.target
  const editable = target && ((target.tagName === 'INPUT') || (target.tagName === 'TEXTAREA') || target.isContentEditable)
  if (editable) return
  //  (Cmd/Ctrl + S)
  if (((isMac.value && e.metaKey) || (!isMac.value && e.ctrlKey)) && e.key && e.key.toLowerCase() === 's') {
    e.preventDefault()
    handleSaveProject()
    return
  }
  if (e.key && e.key.toLowerCase() === 'f') {
    if (!fKeyDown) {
      fKeyDown = true
      eyedropperKeyPressed.value = true
      eyedropperToggle.value  = true
      if (floodFillKeyPressed.value || floodFillButtonToggle.value) {
        floodFillKeyPressed.value = false
        floodFillButtonToggle.value = false
        emit('flood-fill-active', false)
        emit('flood-fill-cancel')
      }
      emit('eyedropper-toggle', eyedropperActive.value)
    }
    e.preventDefault(); return
  }
  if (e.key && e.key.toLowerCase() === 'g') {
    if (!floodFillKeyPressed.value && !eyedropperActive.value) {
      floodFillKeyPressed.value = true
      emit('flood-fill-active', true)
    }
    e.preventDefault(); return
  }
  // + - 
  if (e.key === '+' || e.key === '=' || e.code === 'NumpadAdd') {
    e.preventDefault()
    handleZoomIn()
    return
  }
  if (e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract') {
    e.preventDefault()
    handleZoomOut()
    return
  }
  // D  <-> 
  if (e.key && e.key.toLowerCase() === 'd') {
    cellType.value = cellType.value === 'x' ? 'full' : 'x'
    handleCellTypeChange(cellType.value)
    e.preventDefault(); return
  }
  if (e.key === 'Escape') {
    if (floodFillKeyPressed.value || floodFillButtonToggle.value) {
      floodFillKeyPressed.value = false
      floodFillButtonToggle.value = false
      emit('flood-fill-active', false)
      emit('flood-fill-cancel')
    }
    return
  }
  if ((isMac.value && e.metaKey) || (!isMac.value && e.ctrlKey)) {
    if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return } else if (e.key === 'y') { e.preventDefault(); handleRedo(); return }
  }
  if ((isMac.value && e.metaKey) || (!isMac.value && e.ctrlKey)) {
    // Ctrl/Cmd“”
    if (!modifierPressed.value) {
      modifierPressed.value = true
      emit('rect-selection-change', effectiveSelection.value)
    }
  }
}

const keyupHandler = (e) => {
  if (e.key && e.key.toLowerCase() === 'f') {
    fKeyDown = false
    eyedropperKeyPressed.value = false
    eyedropperToggle.value = false
    emit('eyedropper-toggle', eyedropperActive.value)
  }
  if (e.key && e.key.toLowerCase() === 'g') {
    if (floodFillKeyPressed.value) {
      floodFillKeyPressed.value = false
      if (!floodFillButtonToggle.value) emit('flood-fill-active', false)
    }
  }
  if (isMac.value && !e.metaKey) {
    modifierPressed.value = false
    emit('rect-selection-change', effectiveSelection.value)
  }
  if (!isMac.value && !e.ctrlKey) {
    modifierPressed.value = false
    emit('rect-selection-change', effectiveSelection.value)
  }
}

onMounted(() => {
  window.addEventListener('keydown', keydownHandler)
  window.addEventListener('keyup', keyupHandler)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', keydownHandler)
  window.removeEventListener('keyup', keyupHandler)
})

defineExpose({
  setOpacity: (val) => { opacity.value = val },
  setCellType: (val) => { cellType.value = val },
  setStitchPreviewMode: (val) => { stitchPreviewMode.value = val || 'real' },
  setBorderWidth: (val) => {
    const v = typeof val === 'number' ? val : Number(val)
    borderWidth.value = Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : 1
  },
  setShowBorders: (val) => { borderWidth.value = val ? 1 : 0 },
  setDisplayMode: (val) => { displayMode.value = val },
  updateUndoRedoState,
  updateZoomScale: (scale) => { zoomScale.value = scale },
  isFloodFillActive: floodFillActive,
  deactivateFloodFill: () => { 
    if (floodFillKeyPressed.value || floodFillButtonToggle.value) { 
      floodFillKeyPressed.value = false; floodFillButtonToggle.value = false; 
      emit('flood-fill-active', false); emit('flood-fill-cancel') 
    } 
  }
})
</script>

<style scoped>
.canvas-header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: nowrap;
  padding: 12px 24px;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 0 0 auto;
}


.header-divider {
  width: 1px;
  height: 24px;
  background-color: #ebeef5;
  margin: 0 8px;
}

@media (max-width: 1199px) {
  .header-divider { display: none; }
}

.control-label {
  font-size: 13px;
  color: #606266;
  font-weight: 500;
  white-space: nowrap;
  min-width: 60px;
}


.opacity-slider { width: 90px; }
.opacity-value { font-size: 12px; color: #909399; min-width: 35px; text-align: right; }


.cell-type-select { width: 150px; }
.option-content { display: flex; align-items: center; gap: 8px; }
.option-icon { font-size: 14px; color: #409eff; font-weight: bold; }


.display-mode-select { width: 100%; z-index: 9999; }


.native-select {
  width: 100%;
  height: 32px;
  font-size: 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 0 8px;
  background-color: #fff;
  color: #606266;
  cursor: pointer;
  outline: none;
  transition: border-color 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.native-select:focus { border-color: #409eff; box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2); }
.native-select:hover { border-color: #c0c4cc; }


.cell-type-select { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif; }
.select-with-icons { position: relative; }
.cell-type-select option { padding: 4px 8px; font-size: 12px; }

:deep(.display-mode-select .el-input__wrapper) { height: 32px; }
:deep(.display-mode-select .el-input__inner) { font-size: 12px; height: 32px; line-height: 32px; }
:deep(.display-mode-select .el-select__placeholder) { font-size: 12px; color: #a8abb2; }
:deep(.el-select-dropdown) { z-index: 9999 !important; }
:deep(.el-popper) { z-index: 9999 !important; }


.group { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
.group-divider { width:1px; height:28px; background:#ebeef5; margin:0 10px; flex:0 0 auto; }
.icon-btn { width:28px; height:28px; padding:0; display:flex; align-items:center; justify-content:center; border-radius:8px; }
.icon-btn.info-static { cursor:default; border:1px solid #e0e0e0; background:#fafafa; }
.zoom-readout { width:54px; text-align:center; font-size:12px; font-weight:500; color:#606266; }
.mini-slider { width:80px; --el-slider-height:4px; }
.mini-value { font-size:11px; color:#909399; width:36px; text-align:right; }
.small-select { height:28px; font-size:12px; padding:0 6px; }
.slider-group { align-items:center; }
.control-label { font-size:12px; min-width:auto; padding-right:4px; }
@media (max-width: 1100px){ .group-divider { display:none; } }


@media (max-width: 1200px) {
  .header-content { gap: 16px; padding: 10px 16px; }
  .opacity-slider { width: 100px; }
  .cell-type-select { width: 130px; }
}

@media (max-width: 768px) {
  .header-content { gap: 10px; padding: 10px 12px; }
  .control-group { flex: 0 0 auto; min-width: 0; }
}


:deep(.el-slider__runway) { height: 6px; }
:deep(.el-slider__button) { width: 16px; height: 16px; }
:deep(.el-select .el-input__inner) { font-size: 13px; }
:deep(.el-button--warning) { --el-button-text-color: #fff; --el-button-bg-color: #e6a23c; --el-button-border-color: #e6a23c; }
:deep(.el-button--warning:hover) { --el-button-bg-color: #eeb563; --el-button-border-color: #eeb563; }

.rect-select-btn { display: inline-flex; align-items: center; gap: 6px; }
.btn-icon { display: inline-flex; }

.btn-text { font-size: 12px; display: none; }


.zoom-controls { 
  display: flex; 
  align-items: center; 
  gap: 4px; 
}
.zoom-label { 
  font-size: 12px; 
  width: 46px; 
  text-align: center; 
  color: #606266;
  font-weight: 500;
}


.icon-select { width: 120px; }
.header-content::-webkit-scrollbar { height: 6px; }
.header-content::-webkit-scrollbar-thumb { background: #d4d7de; border-radius: 999px; }
.header-content::-webkit-scrollbar-track { background: transparent; }
.cell-type-popper .option-content { display:flex; align-items:center; gap:6px; }
.option-icon { display:inline-block; width:14px; height:14px; position:relative; }
.option-icon.square { background:#409eff; border-radius:2px; box-shadow:0 0 0 1px #fff inset, 0 0 0 1px rgba(0,0,0,0.05); }
.option-icon.cross:before, .option-icon.cross:after { content:''; position:absolute; left:50%; top:50%; width:14px; height:2px; background:#409eff; transform-origin:center; border-radius:1px; }
.option-icon.cross:before { transform:translate(-50%, -50%) rotate(45deg); }
.option-icon.cross:after { transform:translate(-50%, -50%) rotate(-45deg); }
.option-icon.mixed {
  background:#409eff33;
  border-radius:2px;
  box-shadow:0 0 0 1px rgba(64,158,255,0.45) inset;
}
.option-icon.mixed:before, .option-icon.mixed:after { content:''; position:absolute; left:50%; top:50%; width:12px; height:2px; background:#409eff; transform-origin:center; border-radius:1px; }
.option-icon.mixed:before { transform:translate(-50%, -50%) rotate(45deg); }
.option-icon.mixed:after { transform:translate(-50%, -50%) rotate(-45deg); }
</style>
<style>
.save-tooltip-pop { z-index: 99999 !important; }
.info-tooltip-pop { z-index: 99999 !important; }
</style>
