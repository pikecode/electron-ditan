<template>
  <div class="cover-manager-layout">
    <div class="list-pane">
      <div class="pane-header">
        <h3>{{ t('covers.listTitle') }}</h3>
      </div>
      <CoverList
        @create="startCreate"
        @edit="startEdit"
        @export-xml="handleExportXml"
        @export-many="handleExportMany"
        @batch-upload="handleBatchUpload"
        @import-xml="handleImportXml"
        @delete="handleDelete"
        @delete-many="handleDeleteMany"
        @selected="onSelectCover"
        :active-id="editingId"
        :busy="listBusy"
        ref="listRef"
      />
    </div>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="82%" top="4vh" destroy-on-close class="cover-editor-dialog" append-to-body>
      <CoverEditor v-if="dialogVisible" :key="editingId || 'new'" :cover="currentEditing" @cancel="closeDialog" @saved="onSaved" />
    </el-dialog>
  </div>
</template>
<script setup>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import CoverList from './CoverList.vue'
import CoverEditor from './CoverEditor.vue'
import { addCover, getCover, exportCoverToXml, importCoverFromXml, deleteCover } from '@/database/indexeddb/coverStore.js'
import { coverToXml, xmlToCover } from '@/database/indexeddb/coverXml.js'
import { ElMessage } from 'element-plus'
import { normalizeCoverImageFile } from './coverImageFile.js'

const { t } = useI18n()
const listRef = ref(null)
const editingId = ref(null)
const currentEditing = ref(null)
const dialogVisible = ref(false)
const activeJob = ref('')
let editLoadVersion = 0
const dialogTitle = computed(() => (editingId.value != null ? t('covers.dialogEdit', { id: editingId.value }) : t('covers.dialogNew')))
const listBusy = computed(() => activeJob.value !== '')

async function loadEditingCover(id){
  const currentVersion = ++editLoadVersion
  if(id == null){
    currentEditing.value = null
    return null
  }
  const cover = await getCover(id)
  if(currentVersion !== editLoadVersion || editingId.value !== id){
    return null
  }
  currentEditing.value = cover
  return cover
}

function openCreateDialog(){
  editLoadVersion++
  editingId.value = null
  currentEditing.value = { id:null, name:'', placements:[], front_blob_id:null, back_blob_id:null }
  dialogVisible.value = true
}

async function openEditDialog(id){
  editingId.value = id
  const cover = await loadEditingCover(id)
  if(!cover) return
  dialogVisible.value = true
}

function startCreate(){
  if(listBusy.value) return
  openCreateDialog()
}

async function startEdit(id){
  if(listBusy.value) return
  await openEditDialog(id)
}

function closeDialog(){
  editLoadVersion++
  dialogVisible.value = false
}

async function onSaved(id){
  editingId.value = id
  await loadEditingCover(id)
  await listRef.value?.refresh?.()
  ElMessage.success(t('covers.saved'))
  dialogVisible.value = false
}

function onSelectCover(id){
  void startEdit(id)
}

async function withBusy(job, task){
  if(listBusy.value) return
  activeJob.value = job
  try {
    return await task()
  } finally {
    activeJob.value = ''
  }
}

async function exportCoverXmlFile(id){
  const cover = await getCover(id)
  const baseName = cover?.name ? cover.name : `cover_${id}`
  const safeName = sanitizeFileName(baseName)
  const xml = await exportCoverToXml(id, coverToXml)
  const blob = new Blob([xml], { type:'application/xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName + '.xml'
  a.click()
  setTimeout(()=>URL.revokeObjectURL(url),500)
}

async function handleExportXml(id){
  await withBusy('export', async () => {
    try{
      await exportCoverXmlFile(id)
    }catch(e){ console.error(e); ElMessage.error(t('covers.exportFail')) }
  })
}

async function handleExportMany(ids){
  await withBusy('export', async () => {
    const picked = Array.isArray(ids) ? ids.filter(Boolean) : []
    if(!picked.length) return
    if(picked.length === 1){
      try {
        await exportCoverXmlFile(picked[0])
      } catch(e){
        console.error(e)
        ElMessage.error(t('covers.exportFail'))
      }
      return
    }
    try {
      const { default: JSZip } = await import('jszip')
      const zip = new JSZip()
      const usedNames = new Set()
      for(const id of picked){
        const cover = await getCover(id)
        const baseName = sanitizeFileName(cover?.name ? cover.name : `cover_${id}`)
        const fileName = getUniqueZipEntryName(`${baseName}.xml`, usedNames)
        const xml = await exportCoverToXml(id, coverToXml)
        zip.file(fileName, xml)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = t('covers.batchExportZipName')
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 500)
    } catch(e){
      console.error(e)
      ElMessage.error(t('covers.exportFail'))
    }
  })
}

async function handleImportXml(files){
  await withBusy('import', async () => {
    const queue = Array.isArray(files) ? files : [files]
    const validFiles = queue.filter(Boolean)
    if(!validFiles.length) return
    let ok = 0
    let fail = 0
    const ids = []
    for(const file of validFiles){
      try {
        const text = await file.text()
        const newId = await importCoverFromXml(text, xmlToCover)
        ids.push(newId)
        ok++
      } catch(e){
        fail++
        console.error('[covers] import xml failed', file?.name, e)
      }
    }
    await listRef.value?.refresh?.()
    listRef.value?.clearSelection?.()
    if(ok === 1 && fail === 0 && ids[0] != null){
      await openEditDialog(ids[0])
    }
    if(fail){
      ElMessage.warning(t('covers.batchImportSummary', { ok, fail }))
    } else {
      ElMessage.success(t('covers.batchImportSummary', { ok, fail }))
    }
  })
}

async function handleDelete(id){
  await withBusy('delete', async () => {
    try {
      await deleteCover(id)
      if(editingId.value === id){ dialogVisible.value=false; editingId.value=null; currentEditing.value=null }
      await listRef.value?.refresh?.()
      listRef.value?.clearSelection?.()
      ElMessage.success(t('covers.deleted'))
    } catch(e){ console.error(e); ElMessage.error(t('covers.deleteFail')) }
  })
}

async function handleDeleteMany(ids){
  await withBusy('delete', async () => {
    const picked = Array.isArray(ids) ? ids.filter(Boolean) : []
    if(!picked.length) return
    let ok = 0
    let fail = 0
    for(const id of picked){
      try {
        await deleteCover(id)
        ok++
      } catch(e){
        fail++
        console.error('[covers] delete failed', id, e)
      }
    }
    if(picked.includes(editingId.value)){
      dialogVisible.value = false
      editingId.value = null
      currentEditing.value = null
    }
    await listRef.value?.refresh?.()
    listRef.value?.clearSelection?.()
    if(fail){
      ElMessage.warning(t('covers.batchDeleteSummary', { ok, fail }))
    } else {
      ElMessage.success(t('covers.batchDeleteSummary', { ok, fail }))
    }
  })
}

async function handleBatchUpload(files){
  await withBusy('upload', async () => {
    const queue = Array.isArray(files) ? files : [files]
    const validFiles = queue.filter(Boolean)
    if(!validFiles.length) return
    let ok = 0
    let fail = 0
    const ids = []
    for(const file of validFiles){
      try {
        const normalized = await normalizeCoverImageFile(file, {
          unsupportedMessage: t('coverEditor.onlyPngJpegPsd'),
          processFailMessage: t('coverEditor.fileProcessFail')
        })
        const name = buildCoverName(file.name)
        const newId = await addCover({ name, frontFile: normalized.file, placements: [] })
        ids.push(newId)
        ok++
      } catch(e){
        fail++
        console.error('[covers] batch upload failed', file?.name, e)
      }
    }
    await listRef.value?.refresh?.()
    listRef.value?.clearSelection?.()
    if(ok === 1 && fail === 0 && ids[0] != null){
      await openEditDialog(ids[0])
    }
    if(fail){
      ElMessage.warning(t('covers.batchUploadSummary', { ok, fail }))
    } else {
      ElMessage.success(t('covers.batchUploadSummary', { ok, fail }))
    }
  })
}

// Windows / macOS / Linux 
function sanitizeFileName(name){
  if(!name) return 'cover'
  // 
  let s = name.replace(/[\x00-\x1f\x7f]/g,'')
  //  Windows 
  s = s.replace(/[<>:"/\\|?*]/g,'_')
  // 
  s = s.replace(/\s+/g,' ').trim()
  // Windows 
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
  if(reserved.test(s)) s = s + '_'
  //  120
  if(s.length>120) s = s.slice(0,120)
  return s || 'cover'
}

function buildCoverName(name){
  if(!name) return t('covers.defaultUploadName')
  const baseName = name.replace(/\.[^.]+$/, '').trim()
  return baseName || t('covers.defaultUploadName')
}

function getUniqueZipEntryName(name, usedNames){
  if(!usedNames.has(name)){
    usedNames.add(name)
    return name
  }
  const dotIndex = name.lastIndexOf('.')
  const base = dotIndex >= 0 ? name.slice(0, dotIndex) : name
  const ext = dotIndex >= 0 ? name.slice(dotIndex) : ''
  let index = 2
  let candidate = `${base}-${index}${ext}`
  while(usedNames.has(candidate)){
    index++
    candidate = `${base}-${index}${ext}`
  }
  usedNames.add(candidate)
  return candidate
}
</script>
<style scoped>
:root{ --cm-bg:#f5f7fa; --cm-border:#dde2e7; --cm-pane-bg:#ffffff; --cm-shadow:0 4px 16px -4px rgba(0,0,0,0.08); }
@media (prefers-color-scheme: dark){
  :root{ --cm-bg:#14181c; --cm-border:#30363d; --cm-pane-bg:#1d2328; --cm-shadow:0 4px 18px -4px rgba(0,0,0,0.6); }
}
.cover-manager-layout{ display:flex; height:100%; background:var(--cm-bg); overflow:hidden; }
.list-pane{ flex:1; width:100%; display:flex; flex-direction:column; border-right:0; background:var(--cm-pane-bg); backdrop-filter:blur(6px); position:relative; }
.pane-header{ padding:10px 14px 4px; border-bottom:1px solid var(--cm-border); }
.pane-header h3{ margin:0; font-size:14px; font-weight:600; letter-spacing:.5px; }
.cover-editor-dialog :deep(.el-dialog){ margin:0 auto; max-height:92vh; display:flex; flex-direction:column; }
.cover-editor-dialog :deep(.el-dialog__body){ padding:0 0 12px; flex:1 1 auto; min-height:0; overflow:hidden; display:flex; }
.cover-editor-dialog :deep(.el-dialog__body) > *{ flex:1 1 auto; min-height:0; }
.cover-editor-dialog :deep(.el-dialog__header){ border-bottom:1px solid var(--cm-border); margin-right:0; }
</style>
