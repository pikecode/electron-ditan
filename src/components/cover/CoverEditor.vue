<template>
  <div class="cover-editor-root">
    <div class="header">
      <el-input v-model="name" :placeholder="t('coverEditor.namePlaceholder')" size="small" class="name-input" />
      <el-radio-group v-model="activeSide" size="small">
        <el-radio-button label="front">{{ t('coverEditor.sideFront') }}</el-radio-button>
        <el-radio-button label="back">{{ t('coverEditor.sideBack') }}</el-radio-button>
      </el-radio-group>
      <el-button size="small" type="primary" :loading="saving" @click="save">{{ t('coverEditor.save') }}</el-button>
      <el-button size="small" @click="$emit('cancel')">{{ t('coverEditor.cancel') }}</el-button>
    </div>
    <div class="body">
      <div class="left-side">
        <div class="card upload-card">
          <h4>{{ t('coverEditor.frontImage') }}</h4>
          <el-upload :auto-upload="false" :show-file-list="false" :accept="coverImageAccept" @change="f=>onFileChange(f,'front')">
            <div class="img-box" :class="{has: !!frontPreview}">
              <img v-if="frontPreview" :src="frontPreview" />
              <span v-else>{{ t('coverEditor.pickImage') }}</span>
            </div>
          </el-upload>
        </div>
        <div class="card upload-card">
          <h4>{{ t('coverEditor.backImage') }}</h4>
          <el-upload :auto-upload="false" :show-file-list="false" :accept="coverImageAccept" @change="f=>onFileChange(f,'back')">
            <div class="img-box" :class="{has: !!backPreview}">
              <img v-if="backPreview" :src="backPreview" />
              <span v-else>{{ t('coverEditor.pickImage') }}</span>
            </div>
          </el-upload>
        </div>
        <div class="card legend">
          <h4>{{ t('coverEditor.legend') }}</h4>
          <div class="legend-item"><span class="lg lg-effect"></span>{{ t('coverEditor.legendEffect') }}</div>
          <div class="legend-item"><span class="lg lg-grid"></span>{{ t('coverEditor.legendGrid') }}</div>
          <div class="legend-item"><span class="lg lg-table"></span>{{ t('coverEditor.legendTable') }}</div>
        </div>
      </div>
      <div class="canvas-pane">
        <div class="canvas-stage">
          <PlacementCanvas :key="activeSide" ref="canvasRef" :zoom="1" :image-url="activeSide==='front'? frontPreview: backPreview" :placements="placements" :side="activeSide" @change="handlePlacementsChange" @immediate-save="immediateSave" />
        </div>
      </div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import PlacementCanvas from './PlacementCanvas.vue'
import { addCover, updateCover, getBlob, updatePlacements } from '@/database/indexeddb/coverStore.js'
import { ElMessage } from 'element-plus'
import { COVER_IMAGE_ACCEPT, normalizeCoverImageFile } from './coverImageFile.js'

const { t } = useI18n()
const props = defineProps({ cover: { type: Object, default: () => ({}) } })
const emit = defineEmits(['saved','cancel'])

const id = ref(props.cover.id || null)
const name = ref(props.cover.name || '')
const frontFile = ref(null)
const backFile = ref(null)
const frontPreview = ref(null)
const backPreview = ref(null)
const placements = ref((props.cover.placements||[]).map(p=>({...p})))
const activeSide = ref('front')
const saving = ref(false)
// zoom  1
const canvasRef = ref(null)
let placementsSaveTimer = null
const coverImageAccept = COVER_IMAGE_ACCEPT

function fitImage(){}
function applyZoom(){}

function getMissingBackPlacementTypes(list){
  const backTypes = new Set(
    (list || [])
      .filter(p => p?.side === 'back')
      .map(p => p.type)
  )
  return ['grid', 'table'].filter(type => !backTypes.has(type))
}

function formatBackPlacementTypes(types){
  return types.map(type => type === 'grid' ? t('coverEditor.legendGrid') : t('coverEditor.legendTable')).join(' / ')
}

function validatePlacementsBeforeSave(list){
  const hasBackImage = !!(backFile.value || backPreview.value || props.cover.back_blob_id)
  if(!hasBackImage) return true
  const missingTypes = getMissingBackPlacementTypes(list)
  if(!missingTypes.length) return true
  ElMessage.error(t('coverEditor.backPlacementsRequired', { items: formatBackPlacementTypes(missingTypes) }))
  return false
}

watch(()=>props.cover, async c=>{
  id.value = c.id || null
  name.value = c.name || ''
  placements.value = (c.placements || []).map(p=>({...p}))
  // 
  if(c.front_blob_id){
    try { const rec = await getBlob(c.front_blob_id); if(rec?.blob){ frontPreview.value = await blobToDataUrl(rec.blob) } } catch(e){}
  } else { frontPreview.value=null }
  if(c.back_blob_id){
    try { const rec = await getBlob(c.back_blob_id); if(rec?.blob){ backPreview.value = await blobToDataUrl(rec.blob) } } catch(e){}
  } else { backPreview.value=null }
}, { deep:true, immediate:true })

// 
watch(activeSide, (nv,ov)=>{
  if(canvasRef.value?.flushPending){ canvasRef.value.flushPending() }
})

async function onFileChange(file, kind){
  const raw = file.raw
  if(!raw) return
  try {
    const normalized = await normalizeCoverImageFile(raw, {
      unsupportedMessage: t('coverEditor.onlyPngJpegPsd'),
      processFailMessage: t('coverEditor.fileProcessFail')
    })
    if(kind==='front'){ frontFile.value = normalized.file; frontPreview.value = normalized.preview }
    else { backFile.value = normalized.file; backPreview.value = normalized.preview }
  } catch(e){ ElMessage.error(e.message || t('coverEditor.fileProcessFail')) }
}

function handlePlacementsChange(p){
  placements.value = p
  if(id.value){
    if(placementsSaveTimer) clearTimeout(placementsSaveTimer)
    placementsSaveTimer = setTimeout(async ()=>{
      try { await updatePlacements(id.value, p) } catch(e){ console.warn('[CoverEditor]  placements ', e) }
    }, 400)
  }
}

async function immediateSave(p){
  placements.value = p
  if(!id.value) return // 
  if(placementsSaveTimer) { clearTimeout(placementsSaveTimer); placementsSaveTimer=null }
  try { await updatePlacements(id.value, p); console.debug('[CoverEditor] immediate save placements success sideChangeLen=', p.length) } catch(e){ console.warn('[CoverEditor] immediate save failed', e) }
}

async function save(){
  if(!name.value.trim()){ ElMessage.error(t('coverEditor.nameRequired')); return }
  saving.value=true
  const started = Date.now()
  const watchdog = setTimeout(()=>{
    if(saving.value){
      console.warn('[CoverEditor]  >6s IndexedDB ')
      saving.value=false
      ElMessage.error(t('coverEditor.saveTimeout'))
    }
  }, 6000)
  console.debug('[CoverEditor] ', { id: id.value, placements: placements.value })
  try {
    let savedId = id.value
    if(!savedId){
      // 
      if(canvasRef.value?.flushPending) canvasRef.value.flushPending()
      const latest = canvasRef.value?.getPlacements ? canvasRef.value.getPlacements() : placements.value
      const plain = latest.map(p=>({ ...p }))
      if(!validatePlacementsBeforeSave(plain)) return
      savedId = await addCover({ name: name.value.trim(), frontFile: frontFile.value, backFile: backFile.value, placements: plain })
      console.debug('[CoverEditor] addCover ', savedId)
    } else {
      if(canvasRef.value?.flushPending) canvasRef.value.flushPending()
      const latest = canvasRef.value?.getPlacements ? canvasRef.value.getPlacements() : placements.value
      const plain = latest.map(p=>({ ...p }))
      if(!validatePlacementsBeforeSave(plain)) return
      await updateCover(savedId, { name: name.value.trim(), frontFile: frontFile.value, backFile: backFile.value, placements: plain })
      console.debug('[CoverEditor] updateCover ', savedId)
    }
    emit('saved', savedId)
  } catch(e){
    console.error('[CoverEditor] ', e)
    ElMessage.error(e.message || t('coverEditor.saveFail'))
  } finally {
    clearTimeout(watchdog)
    const elapsed = Date.now()-started
    console.debug('[CoverEditor] (ms):', elapsed)
    saving.value=false
  }
}

function blobToDataUrl(blob){
  return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=()=>rej(r.error); r.readAsDataURL(blob) })
}
</script>
<style scoped>
.cover-editor-root{ display:flex; flex-direction:column; height:100%; min-height:0; }
.header{ display:flex; gap:12px; align-items:center; flex-wrap:wrap; padding:10px 16px; border-bottom:1px solid var(--ce-border,#e1e5e8); background:linear-gradient(90deg,#ffffff,#f7f9fa); position:sticky; top:0; z-index:30; }
.name-input{ width:240px; }
.zoom-box{ display:none; }
.body{ flex:1; min-height:0; display:flex; overflow:hidden; position:relative; }
.left-side{ width:220px; padding:14px 14px 20px; display:flex; flex-direction:column; gap:16px; border-right:1px solid var(--ce-border,#e1e5e8); background:#fbfcfd; overflow-y:auto; }
.card{ background:#fff; border:1px solid var(--ce-border,#dde2e7); border-radius:10px; padding:12px 12px 14px; display:flex; flex-direction:column; gap:10px; box-shadow:0 2px 4px rgba(0,0,0,0.04); }
.card h4{ margin:0; font-size:13px; font-weight:600; letter-spacing:.5px; }
.img-box{ width:100%; aspect-ratio:3/4; border:1px dashed #c2c8ce; border-radius:8px; display:flex; align-items:center; justify-content:center; overflow:hidden; font-size:12px; color:#888; background:repeating-conic-gradient(#f2f4f7 0% 25%, #e8ebef 0% 50%) 50%/40px 40px; position:relative; }
.img-box.has{ border-style:solid; background:#fff; }
.img-box img{ width:100%; height:100%; object-fit:contain; transition:transform .25s; }
.img-box:hover img{ transform:scale(1.03); }
.legend-item{ font-size:12px; display:flex; align-items:center; gap:4px; color:#555; }
.lg{ display:inline-block; width:14px; height:14px; border-radius:3px; }
.lg-effect{ background:#409eff; }
.lg-grid{ background:#67c23a; }
.lg-table{ background:#e6a23c; }
.canvas-pane{ flex:1; min-width:0; min-height:0; position:relative; overflow:auto; background:repeating-conic-gradient(#eef1f4 0% 25%, #e5e9ed 0% 50%) 50%/60px 60px; display:flex; align-items:flex-start; justify-content:center; padding:24px 32px; }
.canvas-stage{ flex:0 0 auto; max-width:100%; box-shadow:0 4px 18px -6px rgba(0,0,0,0.12); border-radius:12px; background:#1a1d21; padding:18px; }
@media (prefers-color-scheme: dark){
  .header{ background:linear-gradient(90deg,#1e2429,#1a1f23); border-color:#30363d; }
  .left-side{ background:#1d2327; border-color:#30363d; }
  .card{ background:#232a30; border-color:#30363d; box-shadow:0 2px 5px rgba(0,0,0,0.5); }
  .img-box{ background:repeating-conic-gradient(#22272e 0% 25%, #1d2228 0% 50%) 50%/40px 40px; }
  .legend-item{ color:#a8b2bb; }
  .canvas-pane{ background:repeating-conic-gradient(#262c32 0% 25%, #20262c 0% 50%) 50%/60px 60px; }
  .canvas-stage{ background:#121517; }
}
</style>
