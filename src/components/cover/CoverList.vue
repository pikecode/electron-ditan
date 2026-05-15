<template>
  <div class="cover-list-root">
    <div class="toolbar">
      <el-button size="small" type="primary" :disabled="busy" @click="$emit('create')">{{ t('covers.newCover') }}</el-button>
      <el-button size="small" :disabled="busy" @click="triggerBatchUpload">{{ t('covers.batchUpload') }}</el-button>
      <el-button size="small" :disabled="busy" @click="triggerImportXml">{{ t('covers.importXml') }}</el-button>
      <span v-if="selectedCount" class="selection-count">{{ t('covers.selectedCount', { count: selectedCount }) }}</span>
      <el-button v-if="selectedCount" size="small" type="success" :disabled="busy" @click="exportSelected">{{ t('covers.batchExport') }}</el-button>
      <el-button v-if="selectedCount" size="small" type="danger" :disabled="busy" @click="confirmBatchDelete">{{ t('covers.batchDelete') }}</el-button>
      <el-button v-if="selectedCount" size="small" text :disabled="busy" @click="clearSelection">{{ t('covers.clearSelection') }}</el-button>
      <el-input v-model="search" size="small" :placeholder="t('covers.searchPlaceholder')" class="search" clearable :disabled="busy" />
    </div>
    <input
      ref="batchUploadInput"
      type="file"
      :accept="coverImageAccept"
      multiple
      class="hidden-file-input"
      @change="onBatchUploadChange"
    />
    <input
      ref="importXmlInput"
      type="file"
      accept=".xml"
      multiple
      class="hidden-file-input"
      @change="onImportXmlChange"
    />
    <el-table
      ref="tableRef"
      :data="filtered"
      v-loading="tableBusy"
      size="small"
      height="calc(100vh - 170px)"
      :row-key="rowKey"
      @row-click="handleRowClick"
      @selection-change="handleSelectionChange"
      highlight-current-row
      :row-class-name="rowClass"
    >
      <el-table-column type="selection" width="48" :selectable="canSelectRow" />
      <el-table-column :label="t('covers.colThumb')" width="90">
        <template #default="{ row }">
          <div class="thumb-box"> <img v-if="row.frontThumb" :src="row.frontThumb" /> </div>
        </template>
      </el-table-column>
      <el-table-column prop="name" :label="t('covers.colName')" />
      <el-table-column prop="updated_at" :label="t('covers.colUpdated')" width="150" />
      <el-table-column :label="t('covers.colActions')" width="230">
        <template #default="{ row }">
          <el-button link type="primary" size="small" :disabled="busy" @click.stop="$emit('edit', row.id)">{{ t('covers.edit') }}</el-button>
          <el-button link type="success" size="small" :disabled="busy" @click.stop="exportXml(row.id)">{{ t('covers.export') }}</el-button>
          <el-button link type="danger" size="small" :disabled="busy" @click.stop="confirmDelete(row)">{{ t('covers.delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
<script setup>
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { listCovers, getBlob } from '@/database/indexeddb/coverStore.js'
import { ElMessage, ElMessageBox } from 'element-plus'
import { COVER_IMAGE_ACCEPT } from './coverImageFile.js'

const { t } = useI18n()
const props = defineProps({
  activeId: [Number, String],
  busy: { type: Boolean, default: false }
})
const emit = defineEmits(['create','edit','export-xml','export-many','batch-upload','import-xml','selected','delete','delete-many'])

const tableRef = ref(null)
const batchUploadInput = ref(null)
const importXmlInput = ref(null)
const rawList = ref([])
const loading = ref(false)
const search = ref('')
const selectedRows = ref([])
const selectedIds = ref([])
const thumbUrls = new Set()
const coverImageAccept = COVER_IMAGE_ACCEPT
const busy = computed(() => props.busy)
const tableBusy = computed(() => loading.value || props.busy)
let loadVersion = 0
let disposed = false

async function load(){
  const currentVersion = ++loadVersion
  const previousSelectedIds = [...selectedIds.value]
  const pendingThumbUrls = []
  loading.value=true
  try {
    const list = await listCovers()
    for(const c of list){
      if(disposed || currentVersion !== loadVersion){
        revokeUrls(pendingThumbUrls)
        return
      }
      if(c.front_blob_id){
        try {
          const rec = await getBlob(c.front_blob_id)
          if(rec?.blob){
            const url = URL.createObjectURL(rec.blob)
            pendingThumbUrls.push(url)
            c.frontThumb = url
          }
        } catch(e){
          console.warn('[cover-list] thumb load failed', c.id, e)
        }
      }
    }
    if(disposed || currentVersion !== loadVersion){
      revokeUrls(pendingThumbUrls)
      return
    }
    releaseThumbs()
    pendingThumbUrls.forEach(url => thumbUrls.add(url))
    rawList.value = list.sort((a,b)=> (b.updated_at||'').localeCompare(a.updated_at||''))
    await syncSelection(previousSelectedIds, currentVersion)
  } catch(e){
    revokeUrls(pendingThumbUrls)
    if(disposed || currentVersion !== loadVersion) return
    console.error(e)
    ElMessage.error(t('covers.loadFail'))
  } finally {
    if(!disposed && currentVersion === loadVersion){
      loading.value=false
    }
  }
}

const filtered = computed(()=>{
  const q = search.value.trim().toLowerCase()
  if(!q) return rawList.value
  return rawList.value.filter(c=> (c.name||'').toLowerCase().includes(q) || String(c.id).includes(q))
})
const selectedCount = computed(() => selectedRows.value.length)

function rowClass({row}){ return row.id === props.activeId ? 'active-row' : '' }
function rowKey(row){ return row.id }
function canSelectRow(){ return !props.busy }

function handleRowClick(row, column){
  if(props.busy) return
  if(column?.type === 'selection') return
  emit('selected', row.id)
}

function handleSelectionChange(rows){
  selectedRows.value = rows
  selectedIds.value = rows.map(row => row.id)
}

function triggerBatchUpload(){
  if(props.busy) return
  batchUploadInput.value?.click()
}

function triggerImportXml(){
  if(props.busy) return
  importXmlInput.value?.click()
}

function exportXml(id){ emit('export-xml', id) }
function onBatchUploadChange(event){
  if(props.busy){
    event.target.value = ''
    return
  }
  const files = Array.from(event.target.files || [])
  if(files.length) emit('batch-upload', files)
  event.target.value = ''
}

function onImportXmlChange(event){
  if(props.busy){
    event.target.value = ''
    return
  }
  const files = Array.from(event.target.files || [])
  if(files.length) emit('import-xml', files)
  event.target.value = ''
}

function exportSelected(){
  if(props.busy) return
  if(!selectedRows.value.length) return
  emit('export-many', selectedRows.value.map(row => row.id))
}

function confirmDelete(row){
  if(props.busy) return
  ElMessageBox.confirm(t('covers.deleteConfirm', { name: row.name || row.id }), t('covers.deleteTitle'), { type:'warning', confirmButtonText: t('covers.confirmDelete'), cancelButtonText: t('covers.cancel'), confirmButtonClass:'el-button--danger' })
    .then(()=> emit('delete', row.id))
    .catch(()=>{})
}

function confirmBatchDelete(){
  if(props.busy) return
  if(!selectedRows.value.length) return
  ElMessageBox.confirm(
    t('covers.batchDeleteConfirm', { count: selectedRows.value.length }),
    t('covers.batchDeleteTitle'),
    { type:'warning', confirmButtonText: t('covers.confirmDelete'), cancelButtonText: t('covers.cancel'), confirmButtonClass:'el-button--danger' }
  )
    .then(() => emit('delete-many', selectedRows.value.map(row => row.id)))
    .catch(() => {})
}

function clearSelection(){
  selectedIds.value = []
  tableRef.value?.clearSelection()
  selectedRows.value = []
}

async function syncSelection(ids = selectedIds.value, version = loadVersion){
  await nextTick()
  if(disposed || version !== loadVersion) return
  if(!tableRef.value){
    selectedIds.value = []
    selectedRows.value = []
    return
  }
  tableRef.value.clearSelection()
  const validIds = new Set((ids || []).filter(id => id != null))
  if(!validIds.size){
    selectedIds.value = []
    selectedRows.value = []
    return
  }
  const visibleRows = filtered.value.filter(row => validIds.has(row.id))
  visibleRows.forEach(row => tableRef.value?.toggleRowSelection(row, true))
  selectedIds.value = visibleRows.map(row => row.id)
  selectedRows.value = visibleRows
}

function revokeUrls(urls){
  urls.forEach(url => URL.revokeObjectURL(url))
}

function releaseThumbs(){
  revokeUrls(Array.from(thumbUrls))
  thumbUrls.clear()
}

function refresh(){ return load() }

onMounted(load)
onBeforeUnmount(() => {
  disposed = true
  loadVersion++
  releaseThumbs()
})

defineExpose({ refresh, clearSelection })
</script>
<style scoped>
.cover-list-root{ display:flex; flex-direction:column; height:100%; overflow:hidden; }
.toolbar{ display:flex; gap:6px; padding:10px 12px 8px; align-items:center; border-bottom:1px solid var(--cl-border,#e2e6ea); backdrop-filter:blur(4px); flex-wrap:wrap; }
.search{ flex:1; }
.selection-count{ font-size:12px; color:var(--cl-text-soft,#5c6670); padding:0 4px; white-space:nowrap; }
.hidden-file-input{ display:none; }
.el-table{ --el-table-border-color:var(--cl-border,#e2e6ea); --el-table-row-hover-bg-color:rgba(0,0,0,0.03); }
.thumb-box{ width:54px; height:72px; border:1px solid var(--cl-border,#d0d5da); background:linear-gradient(135deg,#ffffff,#f4f6f8); display:flex; align-items:center; justify-content:center; overflow:hidden; border-radius:6px; box-shadow:0 1px 2px rgba(0,0,0,0.05); }
.thumb-box img{ max-width:100%; max-height:100%; object-fit:contain; transition:transform .25s; }
.thumb-box:hover img{ transform:scale(1.04); }
.active-row>td{ background:linear-gradient(90deg,rgba(64,158,255,0.18),rgba(64,158,255,0.10))!important; }
@media (prefers-color-scheme: dark){
  .toolbar{ border-color:#30363d; }
  .selection-count{ color:#aab4be; }
  .thumb-box{ background:linear-gradient(135deg,#22282d,#1b2024); border-color:#30363d; }
}
</style>
