<template>
  <div class="step-card">
    <h2 class="card-title">{{ t('merge.step1.title') }}</h2>
    <div class="actions top-actions">
      <el-button type="primary" :disabled="!hasValidProject" @click="handleNext">{{ t('merge.common.next') }}</el-button>
    </div>
    
    <div class="import-container">
      
      <div class="import-tabs">
        <button 
          type="button"
          class="tab-btn" 
          :class="{ active: importMode === 'file' }"
          @click="importMode = 'file'"
        >
          <span>{{ t('merge.step1.tabFile') }}</span>
        </button>
        <button 
          type="button"
          class="tab-btn" 
          :class="{ active: importMode === 'history' }"
          @click="importMode = 'history'"
        >
          <span>{{ t('merge.step1.tabHistory') }}</span>
        </button>
      </div>

      
      <div v-if="importMode === 'file'" class="import-mode">
        <div 
          class="xml-drop" 
          :class="{ drag: xmlDrag, loaded: !!xmlProject, error: !!xmlError }"
          tabindex="0"
          role="button"
          @dragenter.prevent="onXmlDragEnter" 
          @dragover.prevent="onXmlDragOver" 
          @dragleave.prevent="onXmlDragLeave" 
          @drop.prevent="onXmlDrop" 
          @click="onXmlAreaClick"
          @keydown.enter.prevent="onXmlAreaClick"
          @keydown.space.prevent="onXmlAreaClick"
        >
          <div class="inner">
            <div class="icon-wrap">
              <svg width="60" height="60" viewBox="0 0 48 48" fill="none">
                <rect x="6" y="6" width="36" height="36" rx="10" fill="url(#g1)"/>
                <path d="M17 20h14M17 24h14M17 28h10" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
                <defs>
                  <linearGradient id="g1" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
                    <stop stop-color="#46a6ff"/>
                    <stop offset="1" stop-color="#2a7edb"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            <div class="hint" v-if="!xmlProject">
              {{ t('merge.step1.dropHint') }}
              <div class="chips">
                <span class="chip">*.xml</span>
              </div>
              <p class="sub">{{ t('merge.step1.dropSub') }}</p>
            </div>
            
            <div class="selected-name" v-else>{{ xmlProject.name }}.xml</div>
            
            <input ref="xmlInput" type="file" accept=".xml" hidden @change="onXmlFile" />
            <div v-if="xmlError" class="error-msg">{{ xmlError }}</div>
          </div>
          
          <div v-if="xmlProject" class="xml-preview sleek">
            
            <div class="file-controls">
              <el-segmented v-model="fileDisplayMode" :options="displayModes" size="small" />
            </div>
            
            <div class="preview-img">
              <img :src="fileDisplayMode === 'grid' ? xmlProject.image : xmlProject.xImage" alt="preview" />
              <div class="badge">{{ t('merge.step1.badgeColors', { rows: xmlProject.rows, cols: xmlProject.cols, n: xmlProject.colors.length }) }}</div>
            </div>
            
            <div class="preview-meta">
              <div class="auto-selected">{{ t('merge.step1.autoSelected') }}</div>
              <el-button size="small" @click.stop="clearXml">{{ t('merge.common.remove') }}</el-button>
            </div>
          </div>
        </div>
      </div>

      
      <div v-if="importMode === 'history'" class="import-mode">
        <div class="history-container">
          <div v-if="historyLoading" class="loading">
            <el-icon class="is-loading"><Loading /></el-icon>
            {{ t('merge.common.loading') }}
          </div>
          <div v-else-if="historyList.length === 0" class="empty">
            {{ t('merge.step1.historyEmpty') }}
          </div>
          <div v-else>
            
            <div class="history-controls">
              <el-segmented v-model="displayMode" :options="displayModes" size="small" />
            </div>
            
            <div class="history-grid">
              <div 
                v-for="item in historyList" 
                :key="item.saved_at"
                class="history-item"
                :class="{ selected: xmlProject?.saved_at === item.saved_at }"
                @click="selectFromHistory(item)"
                @keydown.enter.prevent="selectFromHistory(item)"
                @keydown.space.prevent="selectFromHistory(item)"
                tabindex="0"
                role="button"
              >
                <div class="item-img">
                  <img :src="displayMode === 'grid' ? item.grid_img : item.x_img" :alt="item.project_name" />
                </div>
                <div class="item-info">
                  <div class="item-name">{{ item.project_name }}</div>
                  <div class="item-meta">{{ t('merge.step1.badgeColors', { rows: item.rows, cols: item.cols, n: item.colors_all?.length ?? 0 }) }}</div>
                  <div class="item-time">{{ formatDate(item.saved_at) }}</div>
                </div>
                <div class="item-select">
                  <el-icon v-if="xmlProject?.saved_at === item.saved_at" class="check"><Check /></el-icon>
                </div>
              </div>
            </div>
            
            <div v-if="totalHistoryCount > 0" class="history-pagination">
              <el-pagination
                v-model:current-page="historyPage"
                :page-size="historyPageSize"
                :total="totalHistoryCount"
                layout="prev, pager, next, ->, total"
                @change="handleHistoryPageChange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { Loading, Check } from '@element-plus/icons-vue'
import { useMergeStore } from '../../composables/useMergeStore.js'
import { isTransparentCellColor } from '../../core/cellState.js'
import {
  analyzeOriginalImageAgainstGrid,
  buildOriginalImageRecord,
  resolveImageIntrinsicSize
} from '../../utils/originalImageSemantics.js'

const emit = defineEmits(['next-step'])

const { t, locale } = useI18n()
const mergeStore = useMergeStore()
const { selectedProject, setProject, setCellsData } = mergeStore

// 
const importMode = ref('file')
const xmlDrag = ref(false)
const xmlInput = ref(null)
const xmlError = ref('')
const xmlProject = ref(null)
const fileDisplayMode = ref('grid')

// 
const historyList = ref([])
const historyLoading = ref(false)
const displayMode = ref('grid')
const historyPage = ref(1)
const historyPageSize = 5
const totalHistoryCount = ref(0)

const displayModes = computed(() => [
  { label: t('merge.step1.displayGrid'), value: 'grid' },
  { label: t('merge.step1.displayX'), value: 'x' }
])

const hasValidProject = computed(() => !!selectedProject.value)

// ============ XML  ============
function parseCellsObj(xml) {
  try {
    const dom = new DOMParser().parseFromString(xml, 'application/xml')
    const node = dom.querySelector('Cells')
    if (!node) return null
    const txt = node.textContent || ''
    const obj = JSON.parse(txt)
    
    const rows = obj.rows || obj.height || 0
    const cols = obj.cols || obj.width || 0
    let matrix = []
    
    if (Array.isArray(obj.data)) {
      if (rows && cols && Array.isArray(obj.data[0])) {
        matrix = obj.data
      } else if (rows && cols && obj.data.length === rows * cols) {
        for (let r = 0; r < rows; r++) {
          matrix[r] = obj.data.slice(r * cols, (r + 1) * cols)
        }
      } else {
        matrix = Array.isArray(obj.data[0]) ? obj.data : [obj.data]
      }
    }
    
    const flat = matrix.flat()
    obj._matrix = matrix
    obj._flat = flat
    obj._rows = rows
    obj._cols = cols
    return obj
  } catch {
    return null
  }
}

function extractOriginalSize(xml) {
  try {
    const dom = new DOMParser().parseFromString(xml, 'application/xml')
    const node = dom.querySelector('Images > Original')
    const meta = dom.querySelector('Meta')
    return { 
      width: Number(node?.getAttribute('width') || meta?.getAttribute('imageWidth')) || null, 
      height: Number(node?.getAttribute('height') || meta?.getAttribute('imageHeight')) || null 
    }
  } catch {
    return { width: null, height: null }
  }
}

function extractOriginalBase64(xml) {
  try {
    const dom = new DOMParser().parseFromString(xml, 'application/xml')
    const node = dom.querySelector('Images > Original')
    if (!node) return ''
    const raw = String(node.textContent || '').trim()
    if (!raw) return ''
    if (raw.startsWith('data:image')) return raw
    const mime = node.getAttribute('mime') || 'image/png'
    const payload = raw.includes('base64,')
      ? raw.slice(raw.indexOf('base64,') + 7).replace(/\s/g, '')
      : raw.replace(/\s/g, '')
    if (!payload) return ''
    return `data:${mime};base64,${payload}`
  } catch {
    return ''
  }
}

function extractFullGridBase64(xml) {
  try {
    const dom = new DOMParser().parseFromString(xml, 'application/xml')
    const node = dom.querySelector('Images > FullPNG')
    if (!node) return ''
    const mime = node.getAttribute('mime') || 'image/png'
    const data = node.textContent || ''
    if (!data) return ''
    return `data:${mime};base64,${data}`
  } catch {
    return ''
  }
}

function extractXBase64(xml) {
  try {
    const dom = new DOMParser().parseFromString(xml, 'application/xml')
    const node = dom.querySelector('Images > XPNG')
    if (!node) return ''
    const mime = node.getAttribute('mime') || 'image/png'
    const data = node.textContent || ''
    if (!data) return ''
    return `data:${mime};base64,${data}`
  } catch {
    return ''
  }
}

function extractFullFromCells(xml) {
  try {
    const obj = parseCellsObj(xml)
    if (!obj) return ''
    const rows = obj._rows || 0
    const cols = obj._cols || 0
    const dataArr = obj._flat || []
    if (!rows || !cols || !dataArr.length) return ''
    
    const cellSize = 4
    const canvas = document.createElement('canvas')
    canvas.width = cols * cellSize
    canvas.height = rows * cellSize
    const ctx = canvas.getContext('2d')
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c
        const cell = dataArr[idx]
        const hex = (cell?.hex || cell?.color || '#FFFFFF')
        ctx.fillStyle = hex
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize)
      }
    }
    return canvas.toDataURL('image/png')
  } catch {
    return ''
  }
}

function computeColorStats(xml) {
  const obj = parseCellsObj(xml)
  if (!obj) return { list: [], totalCells: 0, matrix: [], flat: [] }
  
  const rows = obj._rows || 0
  const cols = obj._cols || 0
  const flat = obj._flat || []
  const total = rows * cols || flat.length
  const map = new Map()
  
  for (const cell of flat) {
    const hex = (cell?.hex || cell?.color || '').toUpperCase()
    if (!hex || isTransparentCellColor(hex)) continue
    map.set(hex, (map.get(hex) || 0) + 1)
  }
  
  const list = Array.from(map.entries())
    .map(([hex, count]) => ({ hex, count }))
    .sort((a, b) => b.count - a.count)
  
  return { list, totalCells: total, matrix: obj._matrix, flat }
}

// ============ XML  ============
async function onXmlFile(e) {
  const file = e.target.files[0]
  if (file) await parseXmlFile(file)
}

async function parseXmlFile(file) {
  xmlError.value = ''
  xmlProject.value = null
  
  try {
    const xmlString = await file.text()
    
    //  XML
    const dom = new DOMParser().parseFromString(xmlString, 'application/xml')
    if (dom.documentElement.tagName === 'parsererror') {
      xmlError.value = t('merge.step1.errXmlFormat')
      return
    }
    
    // 
    const cellsObj = parseCellsObj(xmlString)
    if (!cellsObj) {
      xmlError.value = t('merge.step1.errCellsParse')
      return
    }
    
    // 
    const gridImage = extractFullGridBase64(xmlString) || extractFullFromCells(xmlString)
    if (!gridImage) {
      xmlError.value = t('merge.step1.errGridGen')
      return
    }
    
    // X
    const xImage = extractXBase64(xmlString)
    const originalImage = extractOriginalBase64(xmlString)
    
    // 
    const sizeInfo = extractOriginalSize(xmlString)
    let imageWidth = sizeInfo.width || (cellsObj._cols * 20)
    let imageHeight = sizeInfo.height || (cellsObj._rows * 20)
    if (originalImage) {
      const intrinsicSize = await resolveImageIntrinsicSize(originalImage, {
        width: imageWidth,
        height: imageHeight
      })
      imageWidth = intrinsicSize.width || imageWidth
      imageHeight = intrinsicSize.height || imageHeight
    }
    
    // 
    const colorStats = computeColorStats(xmlString)
    
    const originalAnalysis = originalImage
      ? await analyzeOriginalImageAgainstGrid({
          imageSrc: originalImage,
          width: imageWidth,
          height: imageHeight,
          rows: cellsObj._rows,
          cols: cellsObj._cols,
          cellsMatrix: cellsObj._matrix
        })
      : null

    // 
    xmlProject.value = {
      name: file.name.replace(/\.xml$/i, ''),
      image: gridImage,
      xImage: xImage,
      rows: cellsObj._rows,
      cols: cellsObj._cols,
      colors: colorStats.list,
      cellsMatrix: cellsObj._matrix,
      cellsFlat: cellsObj._flat,
      xmlString
    }
    
    // 
    setProject({
      id: null,
      name: xmlProject.value.name,
      original_img: originalImage || '',
      image: buildOriginalImageRecord({
        dataUrl: originalImage,
        width: imageWidth,
        height: imageHeight,
        analysis: originalAnalysis
      }),
      result: {
        cells: {
          rows: cellsObj._rows,
          cols: cellsObj._cols,
          data: cellsObj._matrix,
          image_width: imageWidth,
          image_height: imageHeight
        },
        palette: colorStats.list,
        images: { full: gridImage, x: xImage }
      }
    })
    
    setCellsData({
      rows: cellsObj._rows,
      cols: cellsObj._cols,
      data: cellsObj._matrix,
      image_width: imageWidth,
      image_height: imageHeight
    })
    
  } catch (error) {
    xmlError.value = t('merge.step1.errParse', { msg: error.message })
  }
}

// ============  ============
async function loadHistory() {
  historyLoading.value = true
  try {
    const mod = await import('../../database/indexeddb/xmlSnapshotStore.js')
    let allList = await mod.listXmlSnapshots() || []
    
    // 
    allList = allList.sort((a, b) => b.saved_at.localeCompare(a.saved_at))
    totalHistoryCount.value = allList.length
    
    // 
    const start = (historyPage.value - 1) * historyPageSize
    const end = start + historyPageSize
    const pageList = allList.slice(start, end)
    
    // 
    historyList.value = pageList.map(row => enrichHistoryRow(row))
  } catch (e) {
    console.warn('load history fail', e)
    ElMessage.error(t('merge.step1.errLoadHistory'))
  } finally {
    historyLoading.value = false
  }
}

function handleHistoryPageChange(newPage) {
  historyPage.value = newPage
  loadHistory()
}

function enrichHistoryRow(row) {
  const gridImage = extractFullGridBase64(row.xml_string) || extractFullFromCells(row.xml_string)
  const xImage = extractXBase64(row.xml_string)
  const originalImage = extractOriginalBase64(row.xml_string)
  const colorStats = computeColorStats(row.xml_string)
  const cellsObj = parseCellsObj(row.xml_string)
  const sizeInfo = extractOriginalSize(row.xml_string)
  const imageWidth = sizeInfo.width || (cellsObj?._cols || 0) * 20
  const imageHeight = sizeInfo.height || (cellsObj?._rows || 0) * 20
  
  return {
    ...row,
    grid_img: gridImage,
    x_img: xImage,
    original_img: originalImage,
    colors_all: colorStats.list,
    rows: cellsObj?._rows || 0,
    cols: cellsObj?._cols || 0,
    cellsMatrix: cellsObj?._matrix || [],
    cellsFlat: cellsObj?._flat || [],
    image_width: imageWidth,
    image_height: imageHeight
  }
}

async function selectFromHistory(item) {
  xmlProject.value = {
    name: item.project_name,
    image: item.grid_img,
    xImage: item.x_img,
    rows: item.rows,
    cols: item.cols,
    colors: item.colors_all,
    cellsMatrix: item.cellsMatrix,
    cellsFlat: item.cellsFlat,
    saved_at: item.saved_at,
    xmlString: item.xml_string
  }

  const originalAnalysis = item.original_img
    ? await analyzeOriginalImageAgainstGrid({
        imageSrc: item.original_img,
        width: item.image_width,
        height: item.image_height,
        rows: item.rows,
        cols: item.cols,
        cellsMatrix: item.cellsMatrix
      })
    : null
  
  // 
  setProject({
    id: null,
    name: item.project_name,
    original_img: item.original_img || '',
    image: buildOriginalImageRecord({
      dataUrl: item.original_img,
      width: item.image_width,
      height: item.image_height,
      analysis: originalAnalysis
    }),
    result: {
      cells: {
        rows: item.rows,
        cols: item.cols,
        data: item.cellsMatrix,
        image_width: item.image_width,
        image_height: item.image_height
      },
      palette: item.colors_all,
      images: { full: item.grid_img, x: item.x_img }
    }
  })
  
  setCellsData({
    rows: item.rows,
    cols: item.cols,
    data: item.cellsMatrix,
    image_width: item.image_width,
    image_height: item.image_height
  })
}

function formatDate(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const tag = locale.value === 'zh' ? 'zh-CN' : 'en-US'
    return d.toLocaleString(tag, { hour12: false })
  } catch {
    return iso
  }
}

// ============  ============
function onXmlDragEnter() {
  xmlDrag.value = true
}

function onXmlDragOver() {
  xmlDrag.value = true
}

function onXmlDragLeave(e) {
  if (e.relatedTarget === null || !e.currentTarget.contains(e.relatedTarget)) {
    xmlDrag.value = false
  }
}

function onXmlDrop(e) {
  const file = e.dataTransfer.files[0]
  if (file && file.name.endsWith('.xml')) parseXmlFile(file)
  xmlDrag.value = false
}

function onXmlAreaClick() {
  if (xmlProject.value) return
  xmlInput.value?.click()
}

function clearXml() {
  xmlProject.value = null
  xmlError.value = ''
  setProject(null)
}

function handleNext() {
  if (hasValidProject.value) {
    emit('next-step')
  }
}

// ============  ============
onMounted(() => {
  loadHistory()
})
</script>

<style scoped>
.step-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 28px;
  padding: 26px 30px 34px;
  box-shadow: 0 18px 46px -10px rgba(0, 0, 0, 0.18), 0 8px 22px -8px rgba(0, 0, 0, 0.12);
  backdrop-filter: saturate(180%) blur(30px);
  animation: cardPop 0.35s ease;
}

.card-title {
  margin: 0 0 18px;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: 0.6px;
  background: linear-gradient(90deg, #1d2630, #435b74);
  -webkit-background-clip: text;
  background-clip: text;
  color: #1d2630;
}

.import-container {
  margin-top: 12px;
}

.import-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #5a6a7a;
  border-bottom: 2px solid transparent;
  transition: all 0.3s;
  position: relative;
  top: 1px;
}

.tab-btn:hover {
  color: #1d2630;
}

.tab-btn.active {
  color: #409eff;
  border-bottom-color: #409eff;
}

.tab-icon {
  font-size: 16px;
}

.import-mode {
  animation: fadeIn 0.3s ease;
}


.xml-drop {
  position: relative;
  border: 2px dashed rgba(64, 158, 255, 0.35);
  border-radius: 28px;
  padding: 34px 30px 40px;
  text-align: center;
  cursor: pointer;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.55));
  backdrop-filter: saturate(180%) blur(28px);
  transition: border-color 0.3s, box-shadow 0.4s, background 0.4s;
  box-shadow: 0 8px 28px -10px rgba(0, 0, 0, 0.18), 0 8px 18px -8px rgba(0, 0, 0, 0.1);
}

.xml-drop.drag {
  border-color: #409eff;
  box-shadow: 0 6px 26px rgba(64, 158, 255, 0.45);
}

.xml-drop.loaded {
  border-style: solid;
}

.xml-drop.error {
  border-color: #ff4d4f;
}

.xml-drop .inner {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.icon-wrap {
  filter: drop-shadow(0 6px 14px rgba(64, 158, 255, 0.35));
}

.hint {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #1d2630;
}

.hint .sub {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 400;
  color: #5a6a7a;
  letter-spacing: 0.3px;
}

.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 10px;
}

.chip {
  background: rgba(64, 158, 255, 0.12);
  color: #1a5c92;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 14px;
  letter-spacing: 0.4px;
  border: 1px solid rgba(64, 158, 255, 0.25);
  backdrop-filter: blur(8px);
}

.selected-name {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: #1d2630;
}

.error-msg {
  margin-top: 4px;
  font-size: 12px;
  color: #fff;
  background: #ff4d4f;
  padding: 4px 10px;
  border-radius: 14px;
  letter-spacing: 0.5px;
}

.xml-preview {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: flex-start;
}

.xml-preview.sleek {
  animation: fadeIn 0.45s ease;
}

.file-controls {
  display: flex;
  justify-content: flex-start;
  width: 100%;
  padding: 0;
  background: transparent;
}

.preview-img {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: 30px;
  background: #eceef1;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-img .badge {
  position: absolute;
  left: 10px;
  top: 10px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 4px 10px;
  border-radius: 14px;
  letter-spacing: 0.4px;
  backdrop-filter: blur(6px);
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.auto-selected {
  font-size: 12px;
  color: #5a6a7a;
  letter-spacing: 0.3px;
}


.history-container {
  min-height: 300px;
}

.history-controls {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
  padding: 12px;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
}

.loading,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: #909399;
  font-size: 14px;
  gap: 8px;
}

.loading :deep(.is-loading) {
  animation: spin 2s linear infinite;
}

@keyframes spin {
  100% {
    transform: rotate(360deg);
  }
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.history-pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
}

.history-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 2px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.3s;
  background: #fff;
}

.history-item:hover {
  border-color: rgba(64, 158, 255, 0.3);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.15);
}

.history-item.selected {
  border-color: #409eff;
  background: rgba(64, 158, 255, 0.08);
}

.item-img {
  width: 100%;
  height: 140px;
  background: #f0f2f5;
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.item-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.item-name {
  font-size: 13px;
  font-weight: 600;
  color: #1d2630;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-meta {
  font-size: 11px;
  color: #5a6a7a;
}

.item-time {
  font-size: 10px;
  color: #909399;
}

.item-select {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.history-item {
  position: relative;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
}

.actions.top-actions {
  margin-top: 0;
  margin-bottom: 18px;
}

@keyframes cardPop {
  0% {
    transform: scale(0.95);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(12px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .step-card {
    background: rgba(34, 36, 38, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 18px 46px -12px rgba(0, 0, 0, 0.65), 0 8px 24px -10px rgba(0, 0, 0, 0.55);
  }
  
  .card-title {
    background: linear-gradient(90deg, #dfe6ed, #8aa3ba);
    -webkit-background-clip: text;
    background-clip: text;
    color: #dfe6ed;
  }
  
  .import-tabs {
    border-bottom-color: rgba(255, 255, 255, 0.1);
  }
  
  .tab-btn {
    color: #9aacbd;
  }
  
  .tab-btn:hover {
    color: #e8edf2;
  }
  
  .tab-btn.active {
    color: #64b5f6;
    border-bottom-color: #64b5f6;
  }
  
  .xml-drop {
    background: linear-gradient(145deg, rgba(46, 48, 50, 0.92), rgba(46, 48, 50, 0.6));
    border: 2px dashed rgba(64, 158, 255, 0.4);
    box-shadow: 0 8px 34px -14px rgba(0, 0, 0, 0.65), 0 8px 22px -8px rgba(0, 0, 0, 0.55);
  }
  
  .xml-drop.drag {
    box-shadow: 0 8px 32px -8px rgba(64, 158, 255, 0.6);
  }
  
  .hint {
    color: #e8edf2;
  }
  
  .hint .sub {
    color: #9aacbd;
  }
  
  .chip {
    background: rgba(64, 158, 255, 0.15);
    color: #c5e2ff;
    border: 1px solid rgba(64, 158, 255, 0.35);
  }
  
  .selected-name {
    color: #e8edf2;
  }
  
  .preview-img {
    background: #2f3235;
    box-shadow: 0 6px 24px -6px rgba(0, 0, 0, 0.7);
  }
  
  .auto-selected {
    color: #9aacbd;
  }
  
  .history-item {
    background: #2f3235;
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  .history-item:hover {
    border-color: rgba(64, 158, 255, 0.4);
  }
  
  .history-item.selected {
    border-color: #64b5f6;
    background: rgba(64, 158, 255, 0.15);
  }
  
  .item-img {
    background: #242628;
  }
  
  .item-name {
    color: #e8edf2;
  }
  
  .item-meta {
    color: #9aacbd;
  }
  
  .history-pagination {
    border-top-color: rgba(255, 255, 255, 0.1);
  }
}
</style>

<style scoped>
.step-card {
  --merge-surface: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.88));
  --merge-surface-soft: rgba(255,255,255,0.74);
  --merge-border: rgba(148,163,184,0.22);
  --merge-border-strong: rgba(96,165,250,0.28);
  --merge-text: #172033;
  --merge-text-soft: #526072;
  --merge-text-muted: #7c8b9d;
  --merge-primary: #2563eb;
  --merge-primary-soft: rgba(37,99,235,0.08);
  --merge-shadow: 0 24px 48px -34px rgba(15,23,42,0.3);
  background: var(--merge-surface);
  border: 1px solid var(--merge-border);
  box-shadow: var(--merge-shadow);
}

.card-title {
  margin-bottom: 20px;
  font-weight: 700;
  letter-spacing: 0.01em;
  background: none;
  color: var(--merge-text);
}

.import-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.import-tabs {
  margin-bottom: 0;
  padding: 6px;
  gap: 8px;
  border: 1px solid var(--merge-border);
  border-radius: 18px;
  background: rgba(241,245,249,0.76);
}

.tab-btn {
  flex: 1 1 0;
  justify-content: center;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 14px;
  border-bottom: none;
  font-weight: 600;
  color: var(--merge-text-soft);
  transition: color .18s ease, background-color .18s ease, box-shadow .18s ease, transform .18s ease;
}

.tab-btn:hover {
  color: var(--merge-text);
  background: rgba(255,255,255,0.72);
}

.tab-btn:focus-visible {
  outline: 2px solid rgba(37,99,235,0.35);
  outline-offset: 2px;
}

.tab-btn.active {
  color: var(--merge-primary);
  background: rgba(255,255,255,0.96);
  box-shadow: 0 10px 22px -18px rgba(37,99,235,0.55);
}

.xml-drop {
  padding: 38px 28px 34px;
  border-width: 1px;
  border-style: solid;
  border-color: var(--merge-border-strong);
  background:
    radial-gradient(circle at top left, rgba(59,130,246,0.1), transparent 30%),
    linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.86));
  box-shadow: 0 24px 40px -34px rgba(15,23,42,0.45);
}

.xml-drop:hover,
.xml-drop:focus-visible {
  border-color: rgba(37,99,235,0.42);
  box-shadow: 0 26px 44px -32px rgba(37,99,235,0.28);
}

.xml-drop:focus-visible {
  outline: none;
}

.xml-drop .inner {
  gap: 12px;
}

.hint {
  color: var(--merge-text);
  line-height: 1.45;
}

.hint .sub,
.auto-selected,
.item-meta,
.item-time {
  color: var(--merge-text-soft);
}

.chip {
  background: var(--merge-primary-soft);
  color: var(--merge-primary);
  border-color: rgba(37,99,235,0.18);
}

.xml-preview {
  padding: 16px;
  border: 1px solid var(--merge-border);
  border-radius: 22px;
  background: rgba(248,250,252,0.84);
}

.preview-img {
  width: min(260px, 100%);
  height: 260px;
  border-radius: 24px;
  background: #eff4f8;
  box-shadow: 0 18px 34px -28px rgba(15,23,42,0.55);
}

.preview-meta {
  align-items: flex-start;
}

.history-controls {
  justify-content: flex-start;
  margin-bottom: 18px;
  padding: 10px 12px;
  border: 1px solid var(--merge-border);
  border-radius: 16px;
  background: rgba(248,250,252,0.8);
}

.history-grid {
  gap: 14px;
}

.history-item {
  min-height: 100%;
  gap: 10px;
  padding: 14px;
  border-width: 1px;
  border-color: var(--merge-border);
  border-radius: 18px;
  background: rgba(255,255,255,0.8);
  box-shadow: 0 16px 30px -30px rgba(15,23,42,0.8);
}

.history-item:hover,
.history-item:focus-visible {
  transform: translateY(-1px);
  border-color: rgba(37,99,235,0.3);
  box-shadow: 0 22px 34px -28px rgba(37,99,235,0.25);
}

.history-item:focus-visible {
  outline: 2px solid rgba(37,99,235,0.28);
  outline-offset: 2px;
}

.history-item.selected {
  background: rgba(239,246,255,0.92);
  border-color: rgba(37,99,235,0.42);
}

.item-img {
  height: 152px;
  border-radius: 14px;
}

.item-name {
  color: var(--merge-text);
}

.actions {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--merge-border);
}

.actions :deep(.el-button) {
  min-height: 42px;
  padding-inline: 18px;
  border-radius: 12px;
  font-weight: 600;
}

@media (prefers-color-scheme: dark) {
  .step-card {
    --merge-surface: linear-gradient(180deg, rgba(17,24,39,0.94), rgba(15,23,42,0.86));
    --merge-surface-soft: rgba(30,41,59,0.72);
    --merge-border: rgba(71,85,105,0.42);
    --merge-border-strong: rgba(96,165,250,0.26);
    --merge-text: #e5edf7;
    --merge-text-soft: #c4cfdb;
    --merge-text-muted: #94a3b8;
    --merge-primary-soft: rgba(37,99,235,0.18);
    box-shadow: 0 28px 52px -34px rgba(2,6,23,0.86);
  }

  .import-tabs,
  .history-controls,
  .xml-preview {
    background: rgba(15,23,42,0.5);
    border-color: var(--merge-border);
  }

  .tab-btn:hover,
  .tab-btn.active,
  .history-item,
  .xml-drop {
    background: rgba(15,23,42,0.74);
  }

  .preview-img,
  .item-img {
    background: #243040;
  }

  .history-item.selected {
    background: rgba(30,41,59,0.9);
  }
}

@media (max-width: 768px) {
  .step-card {
    padding: 22px 18px 26px;
  }

  .import-tabs {
    flex-direction: column;
  }

  .tab-btn {
    width: 100%;
  }

  .xml-drop {
    padding: 28px 18px;
  }

  .xml-preview {
    padding: 14px;
  }

  .preview-img {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }

  .history-grid {
    grid-template-columns: 1fr;
  }
}
</style>

<style scoped>
.step-card {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 28px;
  padding: 26px 30px 34px;
  box-shadow: 0 18px 46px -10px rgba(0, 0, 0, 0.18), 0 8px 22px -8px rgba(0, 0, 0, 0.12);
  backdrop-filter: saturate(180%) blur(30px);
  animation: cardPop 0.35s ease;
}

.card-title {
  margin: 0 0 18px;
  font-size: 20px;
  font-weight: 650;
  letter-spacing: 0.6px;
  background: linear-gradient(90deg, #1d2630, #435b74);
  -webkit-background-clip: text;
  background-clip: text;
  color: #1d2630;
}

.zip-import {
  margin-top: 12px;
}

.zip-drop {
  position: relative;
  border: 2px dashed rgba(64, 158, 255, 0.35);
  border-radius: 28px;
  padding: 34px 30px 40px;
  text-align: center;
  cursor: pointer;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.55));
  backdrop-filter: saturate(180%) blur(28px);
  transition: border-color 0.3s, box-shadow 0.4s, background 0.4s;
  box-shadow: 0 8px 28px -10px rgba(0, 0, 0, 0.18), 0 8px 18px -8px rgba(0, 0, 0, 0.1);
}

.zip-drop.drag {
  border-color: #409eff;
  box-shadow: 0 6px 26px rgba(64, 158, 255, 0.45);
}

.zip-drop.loaded {
  border-style: solid;
}

.zip-drop.error {
  border-color: #ff4d4f;
}

.zip-drop .inner {
  max-width: 560px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.icon-wrap {
  filter: drop-shadow(0 6px 14px rgba(64, 158, 255, 0.35));
}

.hint {
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: #1d2630;
}

.hint .sub {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 400;
  color: #5a6a7a;
  letter-spacing: 0.3px;
}

.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  margin-top: 10px;
}

.chip {
  background: rgba(64, 158, 255, 0.12);
  color: #1a5c92;
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 14px;
  letter-spacing: 0.4px;
  border: 1px solid rgba(64, 158, 255, 0.25);
  backdrop-filter: blur(8px);
}

.selected-name {
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.4px;
  color: #1d2630;
}

.error-msg {
  margin-top: 4px;
  font-size: 12px;
  color: #fff;
  background: #ff4d4f;
  padding: 4px 10px;
  border-radius: 14px;
  letter-spacing: 0.5px;
}

.zip-preview {
  margin-top: 26px;
  display: flex;
  gap: 28px;
  align-items: flex-start;
  flex-wrap: wrap;
}

.zip-preview.sleek {
  animation: fadeIn 0.45s ease;
}

.preview-img {
  position: relative;
  width: 220px;
  height: 220px;
  border-radius: 30px;
  background: #eceef1;
  overflow: hidden;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-img .badge {
  position: absolute;
  left: 10px;
  top: 10px;
  font-size: 12px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  padding: 4px 10px;
  border-radius: 14px;
  letter-spacing: 0.4px;
  backdrop-filter: blur(6px);
}

.preview-meta {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auto-selected {
  font-size: 12px;
  color: #5a6a7a;
  letter-spacing: 0.3px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 22px;
}

@keyframes cardPop {
  0% {
    transform: scale(0.95);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(12px);
  }
  100% {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .step-card {
    background: rgba(34, 36, 38, 0.78);
    border: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 18px 46px -12px rgba(0, 0, 0, 0.65), 0 8px 24px -10px rgba(0, 0, 0, 0.55);
  }
  
  .card-title {
    background: linear-gradient(90deg, #dfe6ed, #8aa3ba);
    -webkit-background-clip: text;
    background-clip: text;
    color: #dfe6ed;
  }
  
  .zip-drop {
    background: linear-gradient(145deg, rgba(46, 48, 50, 0.92), rgba(46, 48, 50, 0.6));
    border: 2px dashed rgba(64, 158, 255, 0.4);
    box-shadow: 0 8px 34px -14px rgba(0, 0, 0, 0.65), 0 8px 22px -8px rgba(0, 0, 0, 0.55);
  }
  
  .zip-drop.drag {
    box-shadow: 0 8px 32px -8px rgba(64, 158, 255, 0.6);
  }
  
  .hint {
    color: #e8edf2;
  }
  
  .hint .sub {
    color: #9aacbd;
  }
  
  .chip {
    background: rgba(64, 158, 255, 0.15);
    color: #c5e2ff;
    border: 1px solid rgba(64, 158, 255, 0.35);
  }
  
  .selected-name {
    color: #e8edf2;
  }
  
  .preview-img {
    background: #2f3235;
    box-shadow: 0 6px 24px -6px rgba(0, 0, 0, 0.7);
  }
  
  .auto-selected {
    color: #9aacbd;
  }
}
</style>
