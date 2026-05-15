<template>
  <div class="template-manager-page">
    <div class="tm-header">
      <h2 class="tm-title">{{ t('templateManager.title') }}</h2>
      <div class="tm-actions">
        <el-upload
          :auto-upload="false"
          multiple
          :show-file-list="false"
          accept=".png,.jpg,.jpeg,.psd"
          :on-change="onFileSelect"
        >
          <el-button class="pill primary" type="primary" :disabled="batch.active">{{ t('templateManager.upload') }}</el-button>
        </el-upload>
        <el-button class="pill" @click="refresh" :loading="loading" :disabled="batch.active">{{ t('templateManager.refresh') }}</el-button>
        <el-input v-model="keyword" :placeholder="t('templateManager.searchPh')" clearable class="search-input" />
        <el-button class="pill" @click="loadMore" :disabled="loading || noMore || idbBroken" v-if="templates.length">{{ t('templateManager.loadMore') }}</el-button>
        <el-button v-if="idbBroken" class="pill danger" @click="rebuildDB">{{ t('templateManager.rebuild') }}</el-button>
      </div>
      <div v-if="batch.active" class="upload-progress">
        <el-progress :percentage="Math.round(batch.done / batch.total * 100)" :status="batch.fail>0?'exception':(batch.done===batch.total?'success':'')" style="flex:1" />
        <div class="progress-text">{{ t('merge.step2.progressLine', { done: batch.done, total: batch.total, ok: batch.success, fail: batch.fail }) }}</div>
      </div>
    </div>
    <div class="divider" />
    <el-row :gutter="12" class="content-wrap" v-if="!idbBroken">
      <el-col :span="10" class="list-col">
        <el-empty v-if="!loading && filtered.length===0" :description="t('templateManager.emptyList')" />
        <el-scrollbar v-else class="list-scroll" @scroll="onScroll">
          <div class="tpl-card" v-for="tpl in filtered" :key="tpl.id" :class="{active: selected && selected.id===tpl.id}" @click="selectTemplate(tpl)">
            <div class="thumb" :style="thumbStyle(tpl)"></div>
            <div class="info">
              <div class="line name" :title="tpl.name">{{ tpl.name }}</div>
              <div class="line meta">{{ tpl.width }}x{{ tpl.height }} · {{ (tpl.format||'').toUpperCase() }}</div>
              <div class="line time">{{ shortTime(tpl.uploadTime) }}</div>
            </div>
            <el-button text type="danger" size="small" class="del-btn" @click.stop="removeTemplate(tpl.id)">{{ t('templateManager.delete') }}</el-button>
          </div>
        </el-scrollbar>
      </el-col>
      <el-col :span="14" class="preview-col">
        <div v-if="selected" class="preview-panel">
          <h3 class="title">{{ selected.name }}</h3>
            <div class="preview-box"><img v-if="previewUrl" :src="previewUrl" :alt="selected.name" /></div>
          <div class="meta-grid">
            <div class="item"><span>{{ t('templateManager.size') }}</span><b>{{ selected.width }} × {{ selected.height }}</b></div>
            <div class="item"><span>{{ t('templateManager.format') }}</span><b>{{ (selected.format||'').toUpperCase() }}</b></div>
            <div class="item"><span>{{ t('templateManager.time') }}</span><b>{{ fullTime(selected.uploadTime) }}</b></div>
            <div class="item" v-if="selected.meta && Object.keys(selected.meta).length"><span>{{ t('templateManager.meta') }}</span><b>{{ JSON.stringify(selected.meta) }}</b></div>
          </div>
        </div>
        <el-empty v-else :description="t('templateManager.pickToPreview')" />
      </el-col>
    </el-row>
    <div v-else class="idb-error">
      <p>{{ t('templateManager.idbErr1') }}</p>
      <p>{{ t('templateManager.idbErr2') }}</p>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import * as tplStore from '../../database/indexeddb/templateStore.js'
import { DB_VERSION as SCHEMA_DB_VERSION } from '../../database/indexeddb/schema.js'
import { buildPsdTemplateRecord, getTemplatePreviewSource, isPsdTemplate } from '../../utils/psdTemplate.js'

const { t } = useI18n()
const store = tplStore
function resolveAPI(){
  return {
    add: store.addTemplate,
    list: store.listTemplates || store.listTemplatesFn,
    del: store.deleteTemplate
  }
}

// FallbackIndexedDB =============================================
const DB_NAME = 'easystitch_local'; const DB_VER = SCHEMA_DB_VERSION || 7; const STORE_NAME = 'templates'
const idbBroken = ref(false)
const memoryStore = [] // 
function markBroken(e){
  if(!idbBroken.value){
    idbBroken.value=true; console.error('IndexedDB broken:', e)
    scheduleAutoRecover()
  }
}
let recoveryScheduled=false
function scheduleAutoRecover(){
  if(recoveryScheduled) return; recoveryScheduled=true
  setTimeout(autoRecover,120) // 
}
function rawOpen(version){
  return new Promise((res,rej)=>{
    let req
    try { req = indexedDB.open(DB_NAME, version) } catch(err){ return rej(err) }
    req.onerror = ()=>rej(req.error||new Error('raw open error'))
    req.onupgradeneeded = ()=>{
      try {
        const db=req.result
        if(!db.objectStoreNames.contains(STORE_NAME)){
          const st=db.createObjectStore(STORE_NAME,{keyPath:'id'})
          if(!st.indexNames.contains('uploadTime')) st.createIndex('uploadTime','uploadTime',{unique:false})
        }
      } catch(err){ console.error('raw upgrade fail',err) }
    }
    req.onsuccess = ()=>res(req.result)
  })
}
async function autoRecover(){
  try {
    const dbList = await rawOpen(DB_VER)
    if(!dbList.objectStoreNames.contains(STORE_NAME)){
      dbList.close()
      await rawOpen(DB_VER+1) // 
    }
    idbBroken.value=false
    recoveryScheduled=false
    console.info('IndexedDB auto recovery success')
    if(!templates.value.length) refresh()
  } catch(e){
    //  broken “”
    recoveryScheduled=false
    console.warn('auto recover failed', e)
  }
}
function openIDB(){
  return new Promise((res,rej)=>{
    if(idbBroken.value){ rej(new Error('idb broken')); return }
    let req
    try { req = indexedDB.open(DB_NAME, DB_VER) } catch(e){ markBroken(e); rej(e); return }
    req.onerror = ()=>{ markBroken(req.error); rej(req.error||new Error('open error')) }
    req.onupgradeneeded = () => {
      try {
        const db = req.result
        if(!db.objectStoreNames.contains(STORE_NAME)){
          const st = db.createObjectStore(STORE_NAME,{ keyPath:'id' })
          // 
          if(!st.indexNames.contains('uploadTime')){
            st.createIndex('uploadTime','uploadTime',{ unique:false })
          }
        }
      } catch(err){ console.error('upgrade(create store) failed', err) }
    }
    req.onsuccess = ()=> res(req.result)
  })
}
async function ensureStore(db){
  if(db.objectStoreNames.contains(STORE_NAME)) return db
  //  store
  try { db.close() } catch(_){}
  const req = indexedDB.open(DB_NAME, db.version + 1)
  return new Promise((resolve,reject)=>{
    req.onerror = ()=>reject(req.error||new Error('upgrade error'))
    req.onupgradeneeded = () => {
      try {
        const udb = req.result
        if(!udb.objectStoreNames.contains(STORE_NAME)){
          const st = udb.createObjectStore(STORE_NAME,{ keyPath:'id' })
          if(!st.indexNames.contains('uploadTime')) st.createIndex('uploadTime','uploadTime',{ unique:false })
        }
      } catch(err){ console.error('ensureStore upgrade failed', err) }
    }
    req.onsuccess = ()=>resolve(req.result)
  })
}
async function safeIDB(fn){ try { return await fn() } catch(e){ if(String(e&&e.message).includes('backing store')|| e.name==='InvalidStateError'){ markBroken(e) } throw e } }
async function fallbackList(){ if(idbBroken.value) return [...memoryStore]; return safeIDB(async()=>{ let db = await openIDB(); if(!db.objectStoreNames.contains(STORE_NAME)) db = await ensureStore(db); return await new Promise((res,rej)=>{ const tx=db.transaction(STORE_NAME,'readonly'); const st=tx.objectStore(STORE_NAME); const r=st.getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error) }) }) }
async function fallbackAdd(rec){ if(idbBroken.value){ memoryStore.unshift(rec); return rec } return safeIDB(async()=>{ let db = await openIDB(); if(!db.objectStoreNames.contains(STORE_NAME)) db = await ensureStore(db); return await new Promise((res,rej)=>{ const tx=db.transaction(STORE_NAME,'readwrite'); const st=tx.objectStore(STORE_NAME); const r=st.add(rec); r.onsuccess=()=>res(rec); r.onerror=()=>rej(r.error) }) }) }
async function fallbackDelete(id){ if(idbBroken.value){ const idx = memoryStore.findIndex(t=>t.id===id); if(idx>-1) memoryStore.splice(idx,1); return true } return safeIDB(async()=>{ const db = await openIDB(); if(!db.objectStoreNames.contains(STORE_NAME)) return false; return await new Promise((res,rej)=>{ const tx=db.transaction(STORE_NAME,'readwrite'); const st=tx.objectStore(STORE_NAME); const r=st.delete(id); r.onsuccess=()=>res(true); r.onerror=()=>rej(r.error) }) }) }
async function fallbackListPaged(limit, offset){ const all = await fallbackList(); return all.slice(offset, offset+limit) }

async function rebuildDB(){
  try {
    const delReq = indexedDB.deleteDatabase(DB_NAME)
    await new Promise((res,rej)=>{ delReq.onsuccess=()=>res(); delReq.onerror=()=>rej(delReq.error); delReq.onblocked=()=>setTimeout(res,300) })
    idbBroken.value=false; templates.value=[]; memoryStore.length=0; await refresh(); ElMessage.success(t('templateManager.rebuildOk'))
  } catch(e){ ElMessage.error(t('templateManager.rebuildFail', { msg: e.message || e })) }
}

const pageSize = 60
const templates = ref([])
const loading = ref(false)
const selected = ref(null)
const keyword = ref('')
const loaded = ref(0)
const noMore = ref(false)
const previewUrl = ref('')

function shortTime(t){ if(!t) return ''; return new Date(t).toLocaleTimeString() }
function fullTime(t){ if(!t) return ''; return new Date(t).toLocaleString() }
function normalize(t){ if(!t) return t; if(!t.format){ const m = /^data:(image\/[^;]+);/i.exec(t.base64||''); if(m) t.format = m[1].split('/')[1]; else t.format='png' } return t }

const filtered = computed(()=>{ if(!keyword.value.trim()) return templates.value; const kw = keyword.value.toLowerCase(); return templates.value.filter(t => (t.name||'').toLowerCase().includes(kw)) })

function thumbStyle(t){ if (t._thumbUrl) return { backgroundImage: `url(${t._thumbUrl})` }; return { background: '#f2f2f2' } }

function base64ToBlob(b64){ try { const arr = b64.split(','); const mime = arr[0].match(/:(.*?);/)[1]; const bstr = atob(arr[1]); const u8=new Uint8Array(bstr.length); for(let i=0;i<bstr.length;i++) u8[i]=bstr.charCodeAt(i); return new Blob([u8],{type:mime}) } catch(e){ return null } }

async function ensureThumb(t){ if (t._thumbUrl || t._thumbing) return; t._thumbing = true; try { let blob=null; const previewSource = getTemplatePreviewSource(t); if (previewSource) blob = base64ToBlob(previewSource); else if(store.getTemplateBlob && !isPsdTemplate(t)){ const blobRec = await store.getTemplateBlob(t.id); blob = blobRec?.blob } if (blob){ const url = URL.createObjectURL(blob); const img = new Image(); img.onload=()=>{ const maxSide=72; const scale=Math.min(1,maxSide/Math.max(img.width,img.height)); const w=Math.round(img.width*scale), h=Math.round(img.height*scale); const canvas=document.createElement('canvas'); canvas.width=w; canvas.height=h; const ctx=canvas.getContext('2d'); ctx.drawImage(img,0,0,w,h); t._thumbUrl=canvas.toDataURL('image/webp',0.8); URL.revokeObjectURL(url); t._thumbing=false }; img.onerror=()=>{ URL.revokeObjectURL(url); t._thumbing=false }; img.src=url } else { t._thumbing=false } } catch(e){ t._thumbing=false; console.warn('thumb fail', e) } }

async function ensurePreview(t){ previewUrl.value=''; if(!t) return; const previewSource = getTemplatePreviewSource(t); if (previewSource) { previewUrl.value = previewSource; return } let blob=null; if(store.getTemplateBlob && !isPsdTemplate(t)){ const blobRec=await store.getTemplateBlob(t.id); blob=blobRec?.blob } if(blob) previewUrl.value = URL.createObjectURL(blob) }

async function loadMore(){ if (idbBroken.value){ noMore.value=true; return } if (noMore.value || loading.value) return; loading.value=true; try { let slice=[]; if (typeof store.listTemplatesPaged==='function'){ const list = await store.listTemplatesPaged(pageSize); slice = list.slice(loaded.value, loaded.value+pageSize) } else { slice = await fallbackListPaged(pageSize, loaded.value) } slice.forEach(r=>templates.value.push(r)); loaded.value += slice.length; if (slice.length < pageSize) noMore.value = true; (window.requestIdleCallback||((f)=>setTimeout(f,32)))(()=>{ slice.slice(0,30).forEach(ensureThumb) }) } catch(e){ console.error(e); ElMessage.error(t('templateManager.loadMoreFail', { msg: e.message || e })) } finally { loading.value=false } }

async function refresh(){ templates.value=[]; loaded.value=0; noMore.value=false; previewUrl.value=''; selected.value=null; await loadMore() }

function onScroll(e){ const el=e.target; if (el.scrollTop + el.clientHeight + 200 >= el.scrollHeight) loadMore(); }

function selectTemplate(t){ selected.value = t; ensurePreview(t); ensureThumb(t) }
async function deleteCurrent(){ if(!selected.value) return; await removeTemplate(selected.value.id) }

async function removeTemplate(id){
  try {
    await ElMessageBox.confirm(t('templateManager.confirmDelete'), t('common.tip'), { type: 'warning' })
    const api = resolveAPI()
    if(typeof api.del==='function') await api.del(id); else await fallbackDelete(id)
    templates.value = templates.value.filter(t=>t.id!==id)
    if(selected.value?.id===id) selected.value=null
    ElMessage.success(t('templateManager.deleted'))
  } catch(e){ if(e!=='cancel') ElMessage.error(t('templateManager.deleteFail', { msg: e.message || e })) }
}

const uploadQueue = []
const batch = reactive({ active:false, total:0, done:0, success:0, fail:0 })

function onFileSelect(file){
  // Element Plus  on-change
  uploadQueue.push(file)
  if(batch.active){
    batch.total++
  } else {
    startBatch()
  }
}

async function startBatch(){
  batch.active = true
  if(batch.total === 0) batch.total = uploadQueue.length
  while(uploadQueue.length){
    const file = uploadQueue.shift()
    const ok = await processFile(file)
    batch.done++
    if(ok) batch.success++
    else batch.fail++
  }
  const summary = t('templateManager.uploadSummary', { ok: batch.success, total: batch.total, failPart: batch.fail ? t('templateManager.uploadFailPart', { n: batch.fail }) : '' })
  if(batch.fail) ElMessage.warning(summary)
  else ElMessage.success(summary)
  //  100%
  setTimeout(()=>{ Object.assign(batch,{active:false,total:0,done:0,success:0,fail:0}) }, 800)
}

async function processFile(file){
  const raw = file.raw; if(!raw) return false
  const ext = (raw.name.split('.').pop()||'').toLowerCase()
  if(!['png','jpg','jpeg','psd'].includes(ext)){ ElMessage.error(t('templateManager.fmtUnsupported', { name: raw.name })); return false }
  try {
    let base64, width, height, format = ext==='jpg'?'jpeg':ext
    let sourceBlob = raw
    let metaExtra = {}
    if(ext==='psd'){
      const psdRecord = await buildPsdTemplateRecord(raw)
      base64 = psdRecord.base64
      width = psdRecord.width
      height = psdRecord.height
      format = 'psd'
      sourceBlob = psdRecord.sourceBlob
      metaExtra = psdRecord.meta
    } else {
      base64 = await fileToBase64(raw)
      const dim = await getSize(base64); width=dim.width; height=dim.height
    }
    const name = raw.name.replace(/\.[^.]+$/, '')
    const uploadTime = new Date().toISOString()
    const recordObj = { id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36), name, format, base64, width, height, uploadTime, meta: metaExtra, blob: sourceBlob }
    const api = resolveAPI()
    const rec = normalize( typeof api.add==='function' ? await api.add(recordObj) : await fallbackAdd(recordObj) )
    templates.value.unshift(rec)
    if(!selected.value) selected.value = rec
    return true
  } catch(e){ console.error(e); ElMessage.error(t('templateManager.uploadFail', { name: raw?.name || t('templateManager.fileFallback'), msg: e.message })); return false }
}

function fileToBase64(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(file) }) }
function getSize(b64){ return new Promise((res,rej)=>{ const img=new Image(); img.onload=()=>res({width:img.width,height:img.height}); img.onerror=()=>rej(new Error(t('templateManager.imageLoadFail'))); img.src=b64 }) }

onMounted(refresh)
</script>
<style scoped>
.template-manager-page { display:flex; flex-direction:column; height:100vh; }
.tm-header { display:flex; flex-direction:column; padding:16px; background:#fff; border-bottom:1px solid #e4e7ed; }
.tm-title { margin:0; font-size:18px; font-weight:500; color:#333; }
.tm-actions { display:flex; align-items:center; gap:8px; margin-top:8px; }
.pill { padding:6px 12px; border-radius:12px; font-size:14px; }
.primary { background-color:#409eff; color:#fff; }
.danger { background-color:#f56c6c; color:#fff; }
.upload-progress { display:flex; align-items:center; gap:12px; padding:4px 6px 0; }
.upload-progress .progress-text { font-size:12px; color:#555; white-space:nowrap; }
@media (prefers-color-scheme: dark){
  .upload-progress .progress-text { color:#ccc; }
}
.divider { height:1px; background:#f0f0f0; margin:0 16px; }
.content-wrap { flex:1; display:flex; padding:16px; overflow:hidden; }
.list-col { flex:0 0 250px; max-width:250px; padding-right:16px; border-right:1px solid #e4e7ed; }
.list-scroll { max-height:calc(100vh - 200px); overflow-y:auto; }
.tpl-card { display:flex; flex-direction:column; padding:12px; border:1px solid #e4e7ed; border-radius:8px; margin-bottom:12px; cursor:pointer; transition:transform 0.2s; }
.tpl-card:hover { transform:scale(1.02); }
.tpl-card.active { border-color:#409eff; }
.thumb { width:100%; height:72px; background:#f2f2f2; border-radius:4px; margin-bottom:8px; background-size:cover; background-position:center; }
.info { flex:1; }
.line { font-size:14px; color:#666; margin-bottom:4px; }
.line.name { font-weight:500; color:#333; }
.meta-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin-top:8px; }
.meta-grid .item { padding:8px; background:#f9f9f9; border-radius:4px; }
.preview-col { flex:1; padding-left:16px; }
.preview-panel { display:flex; flex-direction:column; height:100%; }
.preview-box { flex:1; display:flex; align-items:center; justify-content:center; margin-bottom:16px; }
.preview-box img { max-width:100%; max-height:100%; border-radius:4px; }
.idb-error { padding:16px; text-align:center; color:#f56c6c; }
</style>
