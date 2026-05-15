<template>
  <div class="step-card">
    <h2 class="card-title">{{ t('merge.step2.title') }}</h2>
    <div class="actions top-actions">
      <el-button @click="$emit('prev-step')">{{ t('merge.common.prev') }}</el-button>
      <el-button 
        type="primary" 
        :disabled="!canProceed" 
        @click="handleNext"
      >
        {{ t('merge.common.next') }}
      </el-button>
    </div>
    
    <div class="toolbar">
      <el-upload
        :auto-upload="false"
        multiple
        :show-file-list="false"
        accept=".png,.jpg,.jpeg,.psd"
        :on-change="onFileSelect"
      >
        <el-button type="primary" size="small" :disabled="batch.active">{{ t('merge.step2.upload') }}</el-button>
      </el-upload>
      <el-button size="small" @click="loadTemplates" :loading="tplLoading">{{ t('merge.step2.refresh') }}</el-button>
      <el-input v-model="keyword" :placeholder="t('merge.step2.searchPlaceholder')" clearable class="search-input" size="small" />
      <el-button v-if="isDev" size="small" text @click="debugDump">{{ t('merge.step2.debugDump') }}</el-button>
    </div>

    
    <div v-if="batch.active" class="upload-progress">
      <el-progress :percentage="Math.round(batch.done / batch.total * 100)" :status="batch.fail > 0 ? 'exception' : (batch.done === batch.total ? 'success' : '')" />
      <div class="progress-text">{{ t('merge.step2.progressLine', { done: batch.done, total: batch.total, ok: batch.success, fail: batch.fail }) }}</div>
    </div>
    
    <div v-if="tplLoading" class="loading">{{ t('merge.common.loading') }}</div>
    
    <div v-else-if="templates.length === 0" class="empty-state">
      <el-empty :description="t('merge.step2.emptyTemplates')" />
    </div>
    
    <div v-else class="template-selector">
      
      <div v-if="selectedTemplate" class="selected-template-info">
        <div class="info-header">
          <h4>{{ t('merge.step2.selectedTitle') }}</h4>
          <el-button size="small" text @click="clearSelection">{{ t('merge.step2.clearSelection') }}</el-button>
        </div>
        <TemplateCard 
          :template="selectedTemplate" 
          :type="getTemplateCardType()"
          :description="getTemplateDescription()"
          :originalSize="null"
        />
      </div>

      
      <div class="template-grid">
        <div class="grid-header">
          <h4>{{ t('merge.step2.pickTitle', { count: filteredTemplates.length }) }}</h4>
        </div>
        
        <div class="template-cards-scroll">
          <div class="template-cards">
            <div 
              v-for="template in filteredTemplates" 
              :key="template.id"
              class="template-item"
              :class="{ active: selectedTemplate?.id === template.id }"
              @click="selectTemplate(template)"
              @keydown.enter.prevent="selectTemplate(template)"
              @keydown.space.prevent="selectTemplate(template)"
              tabindex="0"
              role="button"
            >
              <div class="template-thumb" :style="thumbStyle(template)">
                <img v-if="template._thumbUrl" :src="template._thumbUrl" :alt="template.name" />
              </div>
              <div class="template-info">
                <div class="template-name" :title="template.name">{{ template.name }}</div>
                <div class="template-meta">{{ template.width }}×{{ template.height }}</div>
                <div class="template-format">{{ (template.format || '').toUpperCase() }}</div>
              </div>
              <div v-if="isExactMatch(template)" class="match-badge exact">{{ t('merge.step2.badgeExact') }}</div>
              <div v-else-if="isNearMatch(template)" class="match-badge near">{{ t('merge.step2.badgeNear') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { useMergeStore } from '../../composables/useMergeStore.js'
import TemplateCard from './TemplateCard.vue'
import * as templateStore from '../../database/indexeddb/templateStore.js'
import { DB_VERSION as SCHEMA_DB_VERSION } from '../../database/indexeddb/schema.js'
import { buildPsdTemplateRecord, getTemplatePreviewSource, isPsdTemplate } from '../../utils/psdTemplate.js'


const emit = defineEmits(['next-step', 'prev-step'])

const { t } = useI18n()
const mergeStore = useMergeStore()
const {
  selectedProject, 
  selectedTemplate, 
  pixelWidth,
  pixelHeight,
  setTemplate,
} = mergeStore

const templates = ref([])
const tplLoading = ref(false)
const keyword = ref('')

// 
const uploadQueue = []
const batch = reactive({ active: false, total: 0, done: 0, success: 0, fail: 0 })

const isDev = typeof import.meta !== 'undefined' ? 
  (import.meta.env?.DEV) : 
  (process.env.NODE_ENV !== 'production')

// 
const filteredTemplates = computed(() => {
  if (!keyword.value.trim()) return templates.value
  const kw = keyword.value.toLowerCase()
  return templates.value.filter(t => (t.name || '').toLowerCase().includes(kw))
})

const canProceed = computed(() => !!selectedTemplate.value)

// 
function isExactMatch(template) {
  return template.width === pixelWidth.value && template.height === pixelHeight.value
}

function isNearMatch(template) {
  if (isExactMatch(template)) return false
  const widthDiff = Math.abs(template.width - pixelWidth.value)
  const heightDiff = Math.abs(template.height - pixelHeight.value)
  const totalDiff = widthDiff + heightDiff
  return totalDiff <= Math.min(pixelWidth.value, pixelHeight.value) * 0.2 // 20% 
}

function getTemplateCardType() {
  if (!selectedTemplate.value) return 'default'
  return isExactMatch(selectedTemplate.value) ? 'exact' : 'nearest'
}

function getTemplateDescription() {
  if (!selectedTemplate.value) return ''
  const tmpl = selectedTemplate.value
  if (isExactMatch(tmpl)) return `${tmpl.width} × ${tmpl.height} (${t('merge.step2.exactSuffix')})`
  return `${tmpl.width} × ${tmpl.height}`
}

// 
async function loadTemplates() {
  if (!selectedProject.value) {
    console.warn('[merge] loadTemplates skipped: no selectedProject')
    return
  }
  
  tplLoading.value = true
  
  try {
    // 
    const allData = await getTemplateList()
    templates.value = allData.map(normalize)
    queueThumbGeneration(templates.value)
    
  } catch (error) {
    console.error('[merge] loadTemplates error', error)
    ElMessage.error(t('merge.step2.loadFailed', { msg: error.message || error }))
  } finally {
    tplLoading.value = false
  }
}

function queueThumbGeneration(templateList) {
  if (!Array.isArray(templateList) || templateList.length === 0) return
  const queue = [...templateList]
  const schedule = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function'
    ? (fn) => window.requestIdleCallback(fn)
    : (fn) => window.setTimeout(fn, 16)

  const consume = () => {
    queue.splice(0, 12).forEach(template => ensureThumb(template))
    if (queue.length > 0) {
      schedule(consume)
    }
  }

  nextTick(() => schedule(consume))
}

async function getTemplateList() {
  // 
  let listFn = templateStore.listTemplates || templateStore.listTemplatesFn
  if (typeof listFn !== 'function') {
    try {
      const dyn = await import('../../database/indexeddb/templateStore.js')
      listFn = dyn.listTemplates || 
               dyn.listTemplatesFn || 
               dyn.default?.listTemplates || 
               dyn.default?.listTemplatesFn
    } catch (e) {
      console.error('[merge] dynamic import templateStore failed', e)
    }
  }
  if (typeof listFn !== 'function') {
    return await rawListTemplates()
  }
  return await listFn()
}

// :  IndexedDB  rawListTemplates 
async function rawListTemplates(){
  const ver = SCHEMA_DB_VERSION || 7
  return new Promise((resolve,reject)=>{
    try {
      const req = indexedDB.open('easystitch_local', ver)
      req.onerror = () => reject(req.error || new Error('idb open failed'))
      req.onsuccess = () => {
        try {
          const db = req.result
          if(!db.objectStoreNames.contains('templates')){ resolve([]); return }
          const tx = db.transaction('templates','readonly')
          const st = tx.objectStore('templates')
          const r = st.getAll()
          r.onsuccess = () => resolve(r.result || [])
          r.onerror = () => reject(r.error)
        } catch(e){ reject(e) }
      }
    } catch(err){ reject(err) }
  })
}

function normalize(t){
  if(!t) return t
  if(!t.format){
    const m = /^data:(image\/[^;]+);/i.exec(t.base64||'')
    if(m) t.format = m[1].split('/')[1]
    else t.format = 'png'
  }
  return t
}

// 
function thumbStyle(template){
  if(template && template._thumbUrl) return { backgroundImage: `url(${template._thumbUrl})` }
  return { background: '#f2f2f2' }
}
function base64ToBlob(b64){
  try {
    const arr=b64.split(',');
    const mime=arr[0].match(/:(.+?);/)[1];
    const bstr=atob(arr[1]);
    const u8=new Uint8Array(bstr.length);
    for(let i=0;i<bstr.length;i++) u8[i]=bstr.charCodeAt(i);
    return new Blob([u8],{type:mime});
  } catch(e){ return null }
}
async function ensureThumb(template){
  if(!template || template._thumbUrl || template._thumbing) return
  template._thumbing = true
  try {
    let blob=null
    const previewSource = getTemplatePreviewSource(template)
    if(previewSource){
      blob = base64ToBlob(previewSource)
    }
    if(!blob && templateStore.getTemplateBlob && template.id && !isPsdTemplate(template)){
      try { const rec = await templateStore.getTemplateBlob(template.id); blob = rec?.blob } catch(_){}
    }
    if(blob){
      const url = URL.createObjectURL(blob)
      const img = new Image()
      img.onload = () => {
        try {
          const maxSide=120
          const scale=Math.min(1, maxSide/Math.max(img.width,img.height))
          const w=Math.round(img.width*scale), h=Math.round(img.height*scale)
            const c=document.createElement('canvas'); c.width=w; c.height=h
            c.getContext('2d').drawImage(img,0,0,w,h)
            template._thumbUrl = c.toDataURL('image/webp',0.8)
        } finally { template._thumbing=false; URL.revokeObjectURL(url) }
      }
      img.onerror = () => { template._thumbing=false; URL.revokeObjectURL(url) }
      img.src = url
    } else { template._thumbing=false }
  } catch(e){ template._thumbing=false }
}

// 
function selectTemplate(template) {
  setTemplate(template)
}

function clearSelection() {
  setTemplate(null)
}

// 
function debugDump() {
  console.log('[merge][debugDump] templates', templates.value)
  console.log('[merge][debugDump] selectedProject size', pixelWidth.value, pixelHeight.value)
  console.log('[merge][debugDump] selectedTemplate', selectedTemplate.value)
}

// 
onMounted(() => {
  loadTemplates()
})

// : 3
function handleNext() {
  if (!canProceed.value) return
  emit('next-step')
}

//  =============================================
function onFileSelect(file){
  uploadQueue.push(file)
  if(batch.active){ batch.total++ } else { startBatch() }
}

async function startBatch(){
  if(batch.active) return
  batch.active = true
  if(batch.total === 0) batch.total = uploadQueue.length
  while(uploadQueue.length){
    const f = uploadQueue.shift()
    const ok = await processFile(f)
    batch.done++
    if(ok) batch.success++
    else batch.fail++
  }
  const failPart = batch.fail ? t('merge.step2.uploadFailPart', { n: batch.fail }) : ''
  const summary = t('merge.step2.uploadSummary', { ok: batch.success, total: batch.total, failPart })
  if(batch.fail){
    ElMessage.warning(summary)
  } else {
    ElMessage.success(summary)
  }
  try { await loadTemplates() } catch(_) {}
  setTimeout(()=>{ Object.assign(batch,{active:false,total:0,done:0,success:0,fail:0}) }, 600)
}

function fileToBase64(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(file) }) }
function getImageSize(b64){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res({width:img.width,height:img.height}); img.onerror=()=>rej(new Error(t('merge.step2.errImageDimRead'))); img.src=b64 }) }

async function saveTemplateRecord(meta, blob){
  const ver = SCHEMA_DB_VERSION || 7
  return new Promise((resolve,reject)=>{
    let req
    try { req = indexedDB.open('easystitch_local', ver) } catch(e){ return reject(e) }
    req.onerror = () => reject(req.error||new Error(t('merge.step2.errIdbOpen')))
    req.onupgradeneeded = () => {
      try {
        const db=req.result
        if(!db.objectStoreNames.contains('templates')) db.createObjectStore('templates',{keyPath:'id'})
        if(!db.objectStoreNames.contains('template_blobs')) db.createObjectStore('template_blobs',{keyPath:'id'})
      } catch(e){ console.error('upgrade failed', e) }
    }
    req.onsuccess = () => {
      try {
        const db=req.result
        const stores = ['templates']
        if(blob) stores.push('template_blobs')
        const tx = db.transaction(stores,'readwrite')
        tx.oncomplete = () => resolve(meta)
        tx.onerror = () => reject(tx.error||new Error(t('merge.step2.errIdbWrite')))
        tx.objectStore('templates').put(meta)
        if(blob) tx.objectStore('template_blobs').put({id:meta.id, blob})
      } catch(e){ reject(e) }
    }
  })
}

async function processFile(wrapper){
  const raw = wrapper.raw || wrapper
  if(!raw) return false
  const ext = (raw.name.split('.').pop()||'').toLowerCase()
  if(!['png','jpg','jpeg','psd'].includes(ext)) { ElMessage.error(t('merge.step2.fmtUnsupported', { name: raw.name })); return false }
  try {
    let base64, width, height, format = ext==='jpg' ? 'jpeg' : ext
    let blob = raw
    let metaExtra = {}
    if(ext==='psd'){
      const psdRecord = await buildPsdTemplateRecord(raw)
      base64 = psdRecord.base64
      width = psdRecord.width
      height = psdRecord.height
      blob = psdRecord.sourceBlob
      metaExtra = psdRecord.meta
      format = 'psd'
    } else {
      base64 = await fileToBase64(raw)
      const dim = await getImageSize(base64)
      width = dim.width; height = dim.height
    }
    const id = (crypto.randomUUID && crypto.randomUUID()) || (Date.now().toString(36)+Math.random().toString(36).slice(2,8))
    const name = raw.name.replace(/\.[^.]+$/, '')
    const uploadTime = new Date().toISOString()
    const meta = normalize({ id, name, format, width, height, uploadTime, base64, meta: metaExtra })
    if(!blob && base64){
      try { const res = await fetch(base64); blob = await res.blob() } catch(_) { blob=null }
    }
    await saveTemplateRecord(meta, blob)
    templates.value.unshift(meta)
    nextTick(()=>ensureThumb(meta))
    return true
  } catch(e){ console.error(e); ElMessage.error(t('merge.step2.fmtUploadFailed', { name: raw.name || 'file', msg: e.message })); return false }
}
// ...existing code...
</script>

<style scoped>
.step-card {
  --merge-surface: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.88));
  --merge-surface-soft: rgba(255,255,255,0.72);
  --merge-border: rgba(148,163,184,0.22);
  --merge-border-strong: rgba(96,165,250,0.28);
  --merge-text: #172033;
  --merge-text-soft: #526072;
  --merge-text-muted: #7c8b9d;
  --merge-primary: #2563eb;
  --merge-control-h: 44px;
  --merge-control-radius: 12px;
  --merge-gap: 12px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--merge-border);
  border-radius: 28px;
  padding: 26px 30px 34px;
  box-shadow: 0 24px 48px -34px rgba(15, 23, 42, 0.3);
  backdrop-filter: saturate(180%) blur(30px);
  animation: cardPop 0.35s ease;
  background: var(--merge-surface);
}

.card-title {
  margin: 0 0 18px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0.01em;
  background: none;
  color: var(--merge-text);
}

.toolbar {
  display: flex;
  gap: var(--merge-gap);
  align-items: stretch;
  margin-bottom: 18px;
  flex-wrap: wrap;
  padding: 14px;
  border: 1px solid var(--merge-border);
  border-radius: 18px;
  background: rgba(248,250,252,0.84);
}

.toolbar :deep(.el-upload),
.toolbar :deep(.el-upload .el-upload) {
  display: flex;
  align-items: stretch;
}

.toolbar :deep(.el-button) {
  min-height: var(--merge-control-h);
  padding-inline: 16px;
  border-radius: var(--merge-control-radius);
  font-weight: 600;
}

.search-input {
  flex: 1 1 520px;
  min-width: 360px;
  max-width: none;
}

.search-input :deep(.el-input__wrapper) {
  min-height: var(--merge-control-h);
  border-radius: var(--merge-control-radius);
}

.search-input :deep(.el-input__inner) {
  font-size: 15px;
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: rgba(64, 158, 255, 0.08);
  border: 1px solid rgba(64, 158, 255, 0.25);
  border-radius: 16px;
  margin-bottom: 16px;
}

.progress-text {
  font-size: 12px;
  color: #1a5c92;
  white-space: nowrap;
}

.loading {
  padding: 20px 4px;
  text-align: center;
  color: #666;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.template-selector {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.selected-template-info {
  background: linear-gradient(135deg, rgba(34,197,94,0.08), rgba(255,255,255,0.72));
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: 22px;
  padding: 20px 22px;
  box-shadow: 0 18px 30px -30px rgba(34,197,94,0.5);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.info-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--merge-text);
}

.template-grid {
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid var(--merge-border);
  border-radius: 24px;
  padding: 20px 22px 22px;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.5);
}

.grid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.grid-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--merge-text);
}

.template-cards-scroll {
  max-height: min(68vh, 720px);
  overflow-y: auto;
  padding-right: 8px;
  margin-right: -8px;
  scrollbar-gutter: stable;
}

.template-cards-scroll::-webkit-scrollbar {
  width: 10px;
}

.template-cards-scroll::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.55);
  border-radius: 999px;
}

.template-cards-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.template-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}

.template-item {
  position: relative;
  display: flex;
  flex-direction: column;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid var(--merge-border);
  border-radius: 18px;
  min-height: 220px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.25s ease;
  overflow: hidden;
  box-shadow: 0 18px 30px -30px rgba(15,23,42,0.7);
}

.template-item:hover {
  transform: translateY(-2px);
  border-color: rgba(37,99,235,0.28);
  box-shadow: 0 24px 36px -28px rgba(37,99,235,0.22);
}

.template-item:focus-visible {
  outline: 2px solid rgba(37,99,235,0.3);
  outline-offset: 2px;
}

.template-item.active {
  border-color: rgba(37,99,235,0.42);
  background: rgba(239,246,255,0.92);
  box-shadow: 0 24px 38px -28px rgba(37,99,235,0.3);
}

.template-thumb {
  width: 100%;
  height: 132px;
  border-radius: 12px;
  background: #f5f7fa;
  background-size: cover;
  background-position: center;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.template-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.template-info {
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  text-align: center;
}

.template-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--merge-text);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.template-meta {
  font-size: 12px;
  color: var(--merge-text-soft);
  margin-bottom: 2px;
}

.template-format {
  font-size: 11px;
  color: var(--merge-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.match-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 8px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.match-badge.exact {
  background: #22c55e;
  color: white;
}

.match-badge.near {
  background: #f59e0b;
  color: white;
}

.actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--merge-gap);
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--merge-border);
}

.actions.top-actions {
  margin-top: 0;
  margin-bottom: 18px;
  padding-top: 0;
  padding-bottom: 16px;
  border-top: none;
  border-bottom: 1px solid var(--merge-border);
}

.actions :deep(.el-button) {
  min-height: var(--merge-control-h);
  padding-inline: 18px;
  border-radius: var(--merge-control-radius);
  font-weight: 600;
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

/* Dark mode */
@media (prefers-color-scheme: dark) {
  .step-card {
    --merge-surface: linear-gradient(180deg, rgba(17,24,39,0.94), rgba(15,23,42,0.86));
    --merge-surface-soft: rgba(30,41,59,0.7);
    --merge-border: rgba(71,85,105,0.42);
    --merge-border-strong: rgba(96,165,250,0.26);
    --merge-text: #e5edf7;
    --merge-text-soft: #c4cfdb;
    --merge-text-muted: #94a3b8;
    box-shadow: 0 28px 52px -34px rgba(2,6,23,0.86);
  }
  
  .loading {
    color: #9aacbd;
  }
  
  .upload-progress {
    background: rgba(64, 158, 255, 0.15);
    border-color: rgba(64, 158, 255, 0.35);
  }
  
  .progress-text {
    color: #c5e2ff;
  }
  
  .selected-template-info {
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.35);
  }
  
  .toolbar,
  .template-grid {
    background: rgba(15,23,42,0.54);
    border-color: var(--merge-border);
  }

  .info-header h4 {
    color: var(--merge-text);
  }
  
  .grid-header h4 {
    color: var(--merge-text);
  }
  
  .template-cards-scroll::-webkit-scrollbar-thumb {
    background: rgba(148, 163, 184, 0.42);
  }
  
  .template-item {
    background: rgba(15,23,42,0.76);
    border-color: var(--merge-border);
  }
  
  .template-item.active {
    border-color: #69b7ff;
    background: rgba(30,41,59,0.9);
    box-shadow: 0 4px 20px rgba(105, 183, 255, 0.4);
  }
  
  .template-thumb {
    background: #2f3235;
  }
  
  .template-name {
    color: var(--merge-text);
  }
  
  .template-meta {
    color: var(--merge-text-soft);
  }
  
  .template-format {
    color: var(--merge-text-muted);
  }
}


@media (max-width: 768px) {
  .template-cards {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }

  .template-cards-scroll {
    max-height: min(60vh, 640px);
  }
  
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .search-input {
    max-width: none;
    min-width: 0;
  }

  .template-item {
    min-height: 0;
  }

  .actions {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 480px) {
  .template-cards {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }

  .template-cards-scroll {
    max-height: 56vh;
  }
  
  .step-card {
    padding: 20px 16px 24px;
  }
}
</style>
