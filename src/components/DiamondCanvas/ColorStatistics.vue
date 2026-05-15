<template>
  <div class="color-statistics">
    
    <div class="statistics-header">
      <span class="section-title">{{ t('colorStats.title', { nColors: filteredColorTypes, nCells: totalCells }) }}</span>
      <div class="header-actions">
        <el-tooltip :content="t('colorStats.hintReplace')" placement="left" effect="dark">
          <el-icon class="hint-icon"><i class="el-icon-info" /></el-icon>
        </el-tooltip>
      </div>
    </div>
    <div class="toolbar">
      <el-input
        v-model="searchQuery"
        size="small"
        :placeholder="t('colorStats.searchUsed')"
        clearable
        class="search-box"
      >
        <template #prefix>
          <i class="el-icon-search" />
        </template>
      </el-input>
      <el-button 
        size="small" 
        type="text" 
        @click="refreshData"
        :loading="isLoading"
      >{{ t('colorStats.refresh') }}</el-button>
      <el-button 
        size="small" 
        type="text" 
        @click="handleTableButtonClick"
        :disabled="!colorData || !Object.keys(colorData||{}).length"
      >{{ tableVisible ? t('colorStats.hideTable') : (tableGenerated ? t('colorStats.showTable') : t('colorStats.genTable')) }}</el-button>
    </div>
    
    <div class="statistics-content">
      <div class="split-panels">
        <div class="panel colors-panel">
          <div v-if="colorData && filteredColorTypes > 0" class="color-list">
            <div class="color-grid">
              <div 
                v-for="(meta, color) in filteredColorData" 
                :key="color"
                class="color-card"
                @contextmenu.prevent="openReplaceDialog(color, meta)"
                :class="{ 'replace-from': replaceFrom && replaceFrom.oldColor === color }"
              >
                <el-tooltip :content="t('colorStats.tipRightClick')" placement="top" effect="dark" :show-after="1000" :hide-after="100" popper-class="replace-tip-popper">
                  <div class="color-block" :style="{ backgroundColor: color }" @mouseenter="handleColorHover(color)" @mouseleave="handleColorLeave(color)">
                    <div class="color-overlay">
                      <div class="color-id">{{ meta.color_id || 'N/A' }}</div>
                      <div class="color-hex">{{ color }}</div>
                      <div class="color-count">{{ meta.count }}</div>
                      
                    </div>
                  </div>
                </el-tooltip>
              </div>
            </div>
            <div v-if="replaceFrom" class="replace-tip">
              {{ t('colorStats.pickLine') }} <span :style="{background:replaceFrom.oldColor}" class="color-chip"></span>
              {{ t('colorStats.pickHint') }}
              <el-button size="mini" type="text" @click="cancelReplace">{{ t('colorStats.cancel') }}</el-button>
            </div>
          </div>

          <div v-else class="empty-state">
            <el-empty :image-size="60" :description="t('colorStats.emptyData')">
              <el-button type="primary" size="small" @click="refreshData">{{ t('colorStats.fetchData') }}</el-button>
            </el-empty>
          </div>
        </div>
        <div class="panel table-panel">
          <div class="color-table-wrapper" v-show="tableVisible">
            <div class="color-table-scroll">
              <canvas ref="colorTableCanvas" v-show="tableGenerated"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>

    
    <el-dialog
      v-model="showReplaceDialog"
      width="640px"
      :title="replaceFrom ? t('colorStats.replaceTitleWith', { id: replaceFrom.oldMeta?.color_id || replaceFrom.oldColor }) : t('colorStats.replaceTitle')"
      @closed="onDialogClosed"
    >
      <div class="replace-dialog-body">
        <div class="replace-source">
          <div class="label">{{ t('colorStats.labelPending') }}</div>
          <div v-if="replaceFrom" class="source-color">
            <div class="chip" :style="{background:replaceFrom.oldColor}"></div>
            <span class="meta">{{ replaceFrom.oldMeta?.color_id || 'N/A' }} ({{ replaceFrom.oldColor }})</span>
            <el-button
              v-if="!isDefaultCellId(replaceFrom.oldMeta?.color_id)"
              size="small"
              type="danger"
              plain
              @click="removeColor(replaceFrom.oldMeta.color_id)"
              class="remove-in-dialog"
            >{{ t('colorStats.removeToEmpty') }}</el-button>
          </div>
        </div>
        <div class="palette-search-row">
          <el-input
            v-model="paletteSearch"
            size="small"
            :placeholder="t('colorStats.searchAllPalette')"
            clearable
            class="palette-search"
          />
          <el-button size="small" @click="reloadFullPalette" :loading="loadingFullPalette" type="primary">{{ t('colorStats.reloadPalette') }}</el-button>
        </div>
        <div class="full-palette-grid">
          <div
            v-for="p in filteredFullPalette"
            :key="p.id"
            class="full-color-item"
            :class="{ disabled: p.id === replaceFrom?.oldMeta?.color_id }"
            @click="handleReplaceSelect(p)"
          >
            <div class="swatch" :style="{ background: p.hex }"></div>
            <div class="info">
              <div class="id">#{{ p.code }}</div>
              <div class="name" :title="p.name">{{ p.name || '—' }}</div>
              <div class="hex">{{ p.hex }}</div>
            </div>
            <div v-if="p.id === replaceFrom?.oldMeta?.color_id" class="current-tag">{{ t('colorStats.current') }}</div>
          </div>
          <div v-if="!filteredFullPalette.length" class="empty-small">{{ t('colorStats.noPaletteMatch') }}</div>
        </div>
      </div>
      <template #footer>
        <el-button size="small" @click="showReplaceDialog=false">{{ t('colorStats.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { buildCutoutCell, isDefaultCellId } from '../../core/cellState.js'
import { useColorManagement } from '../../composables/useColorManagement.js'

const { t, locale } = useI18n()

const props = defineProps({
  getColorData: { type: Function, required: true },
  showColorOnCanvas: { type: Function, required: false },
  hideColorOnCanvas: { type: Function, required: false },
  // 
  allColors: { type: Array, required: false },
  // 
  getAllColors: { type: Function, required: false }
})

// 
const colorData = ref(null)
const isLoading = ref(false)
const searchQuery = ref('')
const pollTimer = ref(null) // : 

// 
const replaceFrom = ref(null) // { oldColor, oldMeta }
const showReplaceDialog = ref(false)
const paletteSearch = ref('')
const loadingFullPalette = ref(false)
const fullPalette = ref([]) // 

//  colorManagement
const { colorPalette, loadColorPalettes } = useColorManagement()

const filteredColorData = computed(() => {
  if (!colorData.value) return {}
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return colorData.value
  const out = {}
  for (const [hex, meta] of Object.entries(colorData.value)) {
    const id = (meta.color_id || '').toLowerCase()
    if (hex.toLowerCase().includes(q) || id.includes(q)) out[hex] = meta
  }
  return out
})
const filteredColorTypes = computed(() => Object.keys(filteredColorData.value || {}).length)
const totalCells = computed(() => {
  if (!colorData.value) return 0
  return Object.values(colorData.value).reduce((total, item) => total + item.count, 0)
})
const totalBags = computed(() => {
  if (!colorData.value) return 0
  return Object.values(colorData.value).reduce((sum, item) => {
    const count = Number(item?.count || 0)
    return sum + (count <= 0 ? 0 : Math.ceil(count / 200))
  }, 0)
})

// 
const filteredFullPalette = computed(() => {
  const q = paletteSearch.value.trim().toLowerCase()
  if (!q) return fullPalette.value
  return fullPalette.value.filter(p =>
    (p.code && p.code.toLowerCase().includes(q)) ||
    (p.name && p.name.toLowerCase().includes(q)) ||
    (p.hex && p.hex.toLowerCase().includes(q))
  )
})

const refreshData = async () => {
  if (!props.getColorData) return
  isLoading.value = true
  try {
    colorData.value = props.getColorData()
  } catch (error) {
    console.error('Failed to get color data:', error)
    colorData.value = null
  } finally {
    isLoading.value = false
  }
  await nextTick()
  drawColorTable()
}

const handleColorHover = (color) => { if (props.showColorOnCanvas) props.showColorOnCanvas(color) }
const handleColorLeave = (color) => { if (props.hideColorOnCanvas) props.hideColorOnCanvas(color) }

const openReplaceDialog = (color, meta) => {
  replaceFrom.value = { oldColor: color, oldMeta: meta }
  // 
  prepareFullPalette().then(() => { showReplaceDialog.value = true })
}

const prepareFullPalette = async () => {
  loadingFullPalette.value = true
  try {
    if (Array.isArray(props.allColors) && props.allColors.length) {
      fullPalette.value = props.allColors
    } else if (typeof props.getAllColors === 'function') {
      fullPalette.value = props.getAllColors() || []
    } else {
      if (!colorPalette.value.length) {
        await loadColorPalettes()
      }
      fullPalette.value = colorPalette.value
    }
  } catch (e) {
    console.error('load full palette failed', e)
    fullPalette.value = []
  } finally {
    loadingFullPalette.value = false
  }
}

const reloadFullPalette = () => prepareFullPalette()

const handleReplaceSelect = (paletteColor) => {
  if (!replaceFrom.value) return
  if (paletteColor.id === replaceFrom.value.oldMeta?.color_id) return // 
  doReplace(replaceFrom.value.oldMeta.color_id, paletteColor)
}

const doReplace = (oldColorId, newColor) => {
  try {
    const canvas = (globalThis && (globalThis.diamondCanvas || window.diamondCanvas))
    if (!canvas || typeof canvas.replaceColor !== 'function') {
      ElMessage.warning(t('colorStats.canvasNoReplace'))
      return
    }
    const result = canvas.replaceColor(oldColorId, { id: newColor.id, hex: newColor.hex })
    console.log('replace result', result)
    if (result.success) {
      ElMessage.success(t('colorStats.replaceOk'))
      refreshData()
      showReplaceDialog.value = false
      replaceFrom.value = null
    } else {
      ElMessage.error(result.message || t('colorStats.replaceFail'))
    }
  } catch (e) {
    console.error('replaceColor failed', e)
    ElMessage.error(t('colorStats.replaceFail') + ': ' + e.message)
  }
}

const CUTOUT_COLOR = buildCutoutCell()

function removeColor(colorId){
  if(!colorId || isDefaultCellId(colorId)) return
  try {
    const canvas = (globalThis && (globalThis.diamondCanvas || window.diamondCanvas))
    if (!canvas || typeof canvas.replaceColor !== 'function') {
      ElMessage.warning(t('colorStats.canvasNoReplace'))
      return
    }
    const result = canvas.replaceColor(colorId, CUTOUT_COLOR)
    if (result.success) {
      ElMessage.success(t('colorStats.cleared'))
      refreshData()
      // 
      if (showReplaceDialog.value) {
        showReplaceDialog.value = false
        replaceFrom.value = null
      }
    } else {
      ElMessage.error(result.message || t('colorStats.clearFail'))
    }
  } catch(e){
    console.error('removeColor failed', e)
    ElMessage.error(t('colorStats.clearErr', { msg: e.message }))
  }
}

const cancelReplace = () => { replaceFrom.value = null }
const onDialogClosed = () => { paletteSearch.value=''; fullPalette.value = [] }

const showHintBubble = ref(true)
onMounted(()=>{ setTimeout(()=>{ showHintBubble.value=false }, 6000) })

onMounted(() => { 
  refreshData()
  //  200ms 
  pollTimer.value = setInterval(() => {
    try { refreshData() } catch(_) {}
  }, 1000)
})

onBeforeUnmount(()=>{ 
  if (pollTimer.value) { clearInterval(pollTimer.value); pollTimer.value = null }
})

// 
// function handleGlobalColorUpdate(){ refreshData() }
// onMounted(()=>{ window.addEventListener('diamond-color-updated', handleGlobalColorUpdate) })
// onBeforeUnmount(()=>{ window.removeEventListener('diamond-color-updated', handleGlobalColorUpdate) })

defineExpose({ refreshData })

// ======  (Canvas) ======
const colorTableCanvas = ref(null)
const tableGenerated = ref(true) // 
const tableVisible = ref(true)   // /

function getRankCode(index){
  if(index < 26) return String.fromCharCode(65 + index) // A-Z
  return 'A' + (index - 25) // A1, A2, ...
}

function buildTableSource(){
  if(!colorData.value) return []
  const arr = Object.entries(colorData.value).map(([hex, meta])=>({
    //  #RRGGBB
    hex: hex.length === 9 ? hex.slice(0,7) : hex,
    id: meta?.color_id == null ? 'N/A' : String(meta.color_id),
    count: meta?.count || 0
  }))
  //  count 
  arr.sort((a,b)=> b.count - a.count)
  return arr.map((item, idx)=>({
    rankCode: getRankCode(idx),
    hex: item.hex,
    id: item.id,
    count: item.count,
    bag: item.count === 0 ? 0 : Math.ceil(item.count / 200)
  }))
}

function drawColorTable(){
  const rows = buildTableSource()
  if(!rows.length) return
  const canvas = colorTableCanvas.value
  if(!canvas) return
  // 
  const colWidths = [80, 90, 90] // Code, No., Bag.
  const rowHeight = 40
  const headerHeight = 42
  const paddingX = 10
  const totalWidth = colWidths.reduce((a,b)=>a+b,0)
  const totalHeight = headerHeight + (rows.length + 1) * rowHeight // +1: total 
  canvas.width = totalWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0,0,totalWidth,totalHeight)
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0,0,totalWidth,totalHeight)
  const headers = [t('colorStats.colCode'), t('colorStats.colNo'), t('colorStats.colBag')]
  ctx.lineWidth = 1
  // 
  let x = 0
  headers.forEach((h,i)=>{
    const w = colWidths[i]
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(x,0,w,headerHeight)
    ctx.strokeStyle = '#bbb'
    ctx.strokeRect(x,0,w,headerHeight)
    ctx.fillStyle = '#222'
    ctx.font = 'bold 15px sans-serif'
    ctx.fillText(h, x + paddingX, headerHeight/2)
    x += w
  })
//
  ctx.font = '13px sans-serif'
  rows.forEach((row, idx)=>{
    const top = headerHeight + idx * rowHeight
    let left = 0
    // Code
    //  hexhex 
    let baseHex = row.hex
    if(baseHex.length === 9) baseHex = baseHex.slice(0,7) // 
    baseHex = baseHex.toUpperCase()
    ctx.fillStyle = baseHex || '#FFFFFF'
    ctx.fillRect(left, top, colWidths[0], rowHeight)
    ctx.strokeStyle = '#ddd'
    ctx.strokeRect(left, top, colWidths[0], rowHeight)
    // 
    function getLuminance(hex) {
      // hex: #RRGGBB
      const r = parseInt(hex.slice(1,3),16)
      const g = parseInt(hex.slice(3,5),16)
      const b = parseInt(hex.slice(5,7),16)
      // 
      return 0.299*r + 0.587*g + 0.114*b
    }
    const luminance = getLuminance(baseHex)
    ctx.fillStyle = luminance < 160 ? '#fff' : '#222' // 
    ctx.font = 'bold 16px sans-serif'
    ctx.fillText(row.rankCode, left + paddingX, top + rowHeight/2)
    // No.
    left += colWidths[0]
    ctx.fillStyle = '#fff'
    ctx.fillRect(left, top, colWidths[1], rowHeight)
    ctx.strokeStyle = '#eee'
    ctx.strokeRect(left, top, colWidths[1], rowHeight)
    ctx.fillStyle = '#222'
    ctx.font = '13px sans-serif'
    ctx.fillText(row.id, left + paddingX, top + rowHeight/2)
    // Bag.
    left += colWidths[1]
    ctx.fillStyle = '#fff'
    ctx.fillRect(left, top, colWidths[2], rowHeight)
    ctx.strokeStyle = '#eee'
    ctx.strokeRect(left, top, colWidths[2], rowHeight)
    ctx.fillStyle = '#222'
    ctx.font = '13px sans-serif'
    ctx.fillText(String(row.bag), left + paddingX, top + rowHeight/2)
  })

  // total  + 
  const totalTop = headerHeight + rows.length * rowHeight
  const bagsTotal = rows.reduce((sum, r) => sum + (Number(r.bag) || 0), 0)
  let left = 0
  // Code 
  ctx.fillStyle = '#e0e0e0'
  ctx.fillRect(left, totalTop, colWidths[0], rowHeight)
  ctx.strokeStyle = '#ddd'
  ctx.strokeRect(left, totalTop, colWidths[0], rowHeight)
  // Code 
  ctx.fillStyle = '#000'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(t('statistics.sum'), left + paddingX, totalTop + rowHeight/2)
  // No. 
  left += colWidths[0]
  ctx.fillStyle = '#e0e0e0'
  ctx.fillRect(left, totalTop, colWidths[1], rowHeight)
  ctx.strokeStyle = '#ddd'
  ctx.strokeRect(left, totalTop, colWidths[1], rowHeight)
  // Bag.  + 
  left += colWidths[1]
  ctx.fillStyle = '#e0e0e0'
  ctx.fillRect(left, totalTop, colWidths[2], rowHeight)
  ctx.strokeStyle = '#ddd'
  ctx.strokeRect(left, totalTop, colWidths[2], rowHeight)
  ctx.fillStyle = '#fc0303ff'
  ctx.font = 'bold 14px sans-serif'
  ctx.fillText(String(bagsTotal), left + paddingX, totalTop + rowHeight/2)
}

function generateColorTable(){ nextTick(()=> drawColorTable()) }

function handleTableButtonClick(){
  if(!tableGenerated.value){
    generateColorTable()
    tableVisible.value = true
    return
  }
  tableVisible.value = !tableVisible.value
  if(tableVisible.value){
    // 
    nextTick(()=> drawColorTable())
  }
}

watch(colorData, ()=>{ if(tableGenerated.value && tableVisible.value) nextTick(()=> drawColorTable()) })
watch(locale, ()=>{ if(tableGenerated.value && tableVisible.value) nextTick(()=> drawColorTable()) })
</script>

<style scoped>
.color-statistics {
  margin-top: 5px;
  height: 100%;
  flex: 1;
  min-height: 0; 
  display: flex;
  flex-direction: column;
}


.statistics-header {
  padding: 5px 0;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 5px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
}

.statistics-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}


.toolbar { display:flex; gap:6px; align-items:center; margin:4px 0; }
.search-box { flex:1; }
.replace-tip { margin-top:4px; font-size:12px; color:#666; display:flex; align-items:center; gap:6px; }
.color-chip { display:inline-block; width:14px; height:14px; border:1px solid #ccc; border-radius:3px; }
.color-card.replace-from .color-block { outline:2px dashed #f90; outline-offset:0; }

.replace-dialog-body { display:flex; flex-direction:column; gap:10px; }
.replace-source { display:flex; align-items:center; gap:8px; font-size:12px; }
.replace-source .chip { width:24px; height:24px; border:1px solid #ccc; border-radius:4px; }
.palette-search-row { display:flex; gap:8px; }
.full-palette-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px,1fr)); gap:8px; max-height:300px; overflow-y:auto; }
.full-color-item { display:flex; gap:6px; padding:6px; border:1px solid #eee; border-radius:6px; background:#fff; cursor:pointer; position:relative; transition:.15s; }
.full-color-item:hover { border-color:#409eff; box-shadow:0 2px 6px rgba(64,158,255,.15); }
.full-color-item.disabled { opacity:.35; cursor:not-allowed; }
.full-color-item .swatch { width:36px; height:36px; border:1px solid #ddd; border-radius:4px; }
.full-color-item .info { display:flex; flex-direction:column; justify-content:center; min-width:0; }
.full-color-item .id { font-size:12px; font-weight:600; }
.full-color-item .name { font-size:11px; color:#555; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.full-color-item .hex { font-size:10px; color:#888; font-family:monospace; }
.current-tag { position:absolute; top:4px; right:4px; background:#f56c6c; color:#fff; font-size:10px; padding:2px 4px; border-radius:3px; }
.empty-small { grid-column:1 / -1; text-align:center; padding:20px 0; font-size:12px; color:#888; }


.color-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 60px);
  row-gap: 3px;
  column-gap: 5px;
  justify-content: space-between;
  align-content: start;
  overflow-y: auto;
  padding: 5px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #fff;
  flex: 1;
}

.color-card {
  width: 60px;
  height: 60px;
  position: relative;
}

.color-block {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.color-block:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}


.color-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0); 
  color: white;
  opacity: 1;
  transition: background 0.2s, opacity 0.2s;
  border-radius: 3px;
}

.color-block:hover .color-overlay {
  background: rgba(0, 0, 0, 0.5); 
  opacity: 0.9;
}

.color-id {
  font-size: 9px;
  font-weight: bold;
  line-height: 1;
  margin-bottom: 1px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.color-hex {
  font-size: 7px;
  line-height: 1;
  font-family: 'Monaco', 'Consolas', monospace;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  margin-bottom: 1px;
}

.color-count {
  font-size: 8px;
  font-weight: bold;
  line-height: 1;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}


.replace-tip {
  margin-top: 4px;
  font-size: 12px;
  color: #666;
  display: flex;
  align-items: center;
  gap: 6px;
}

.color-chip {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 1px solid #ccc;
  border-radius: 3px;
}


.empty-state {
  padding: 20px;
  text-align: center;
}


.color-grid::-webkit-scrollbar {
  width: 6px;
}

.color-grid::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.color-grid::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.color-grid::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

.usage-hint { margin:2px 0 6px; font-size:11px; color:#909399; line-height:1.2; padding-left:2px; }

.hint-bubble { background:#409eff; color:#fff; padding:6px 10px; border-radius:6px; font-size:12px; margin:4px 0 6px; box-shadow:0 2px 8px rgba(64,158,255,0.35); cursor:pointer; position:relative; }
.fade-enter-active,.fade-leave-active { transition: opacity .35s; }
.fade-enter-from,.fade-leave-to { opacity:0; }
.header-actions { margin-left:auto; display:flex; align-items:center; gap:6px; }
.hint-icon { cursor:pointer; color:#909399; font-size:16px; }
.hint-icon:hover { color:#409eff; }


.replace-hover-bubble { display:none; }

:deep(.replace-tip-popper) { padding:4px 8px; font-size:12px; }
.color-card { position:relative; }
.color-card .remove-color-btn { display:none; }
.remove-in-dialog { margin-left:8px; }


.color-table-wrapper { margin-top:0; border:1px solid #e4e7ed; padding:6px; border-radius:6px; background:#fff; flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden; }
.color-table-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-bottom: 20px; 
}
.color-table-wrapper canvas { image-rendering:crisp-edges; border:1px solid #ddd; max-width:100%; }
/* .color-table-wrapper canvas { image-rendering:crisp-edges; border:1px solid #ddd; max-width:100%; height:auto; } */
.table-container { flex:1; display:flex; flex-direction:column; min-height:0; }
.split-panels {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow: hidden;
}
.panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.color-table-wrapper {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.table-placeholder { display:flex; align-items:center; justify-content:center; height:100%; color:#999; font-size:12px; }
</style>
