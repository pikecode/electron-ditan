<template>
  <div class="placement-canvas-root">
    <div class="toolbar">
      <el-radio-group v-model="currentType" size="small">
        <el-radio-button v-for="t in types" :key="t" :label="t">{{ typeLabel(t) }}</el-radio-button>
      </el-radio-group>
      
      <div v-if="activeRect" class="rect-config">
        <div class="coord-group">
          <span class="coord-label">{{ tr('placement.coordX') }}</span>
          <el-input-number
            v-model="activeRectCoordX"
            :min="activeRectCoordMinX"
            :max="activeRectCoordMaxX"
            :precision="0"
            size="small"
          />
        </div>
        <div class="coord-group">
          <span class="coord-label">{{ tr('placement.coordY') }}</span>
          <el-input-number
            v-model="activeRectCoordY"
            :min="activeRectCoordMinY"
            :max="activeRectCoordMaxY"
            :precision="0"
            size="small"
          />
        </div>
        <div class="coord-group angle-group">
          <span class="coord-label">{{ tr('placement.angleLabel', { deg: Math.round(activeRectRotation || 0) }) }}</span>
          <el-input-number
            v-model="activeRectRotation"
            :min="0"
            :max="360"
            :precision="0"
            size="small"
          />
          <el-button size="small" @click="rotateActiveRect90">{{ tr('placement.rotate90') }}</el-button>
        </div>
        <template v-if="activeText">
          <el-input
            v-model="activeText.text"
            size="small"
            class="text-input"
            :placeholder="tr('placement.textPlaceholder')"
            @change="emitChange"
          />
          <el-input-number
            v-model="activeText.fontSize"
            :min="8"
            :max="200"
            size="small"
            @change="emitChange"
          />
          <el-color-picker
            v-model="activeText.color"
            size="small"
            @change="emitChange"
          />
        </template>
      </div>
    </div>
    <div class="canvas-wrapper" ref="wrapRef" @mousedown="onDown" @mousemove="onMove" @mouseup="onUp" @mouseleave="onUp">
      <img v-if="imageUrl" :src="imageUrl" ref="imgRef" @load="onImgLoad" class="base-img" draggable="false" @dragstart.prevent />
      <div
        class="rect"
        v-for="r in localRects"
        :key="r.id"
        :class="['type-'+r.type,{active:r.id===activeRectId}]"
        :style="rectStyle(r)"
        @mousedown.stop="startDragRect(r,$event)"
        :title="typeLabel(r.type)+' — '+r.width+'×'+r.height"
      >
        <span class="tag">{{ typeLabel(r.type) }}</span>
        <button class="rect-del" @click.stop="removeRect(r.id)" :title="tr('placement.deleteRect')">×</button>
        
        <canvas
          v-if="r.type==='text'"
          class="text-preview-canvas"
          :ref="el => setTextPreviewCanvas(r.id, el)"
          aria-hidden="true"
        ></canvas>
        <div class="resize-handle br" @mousedown.stop.prevent="startResize(r.id,'br',$event)"></div>
      </div>
      <div v-if="drawing" class="draft" :style="draftStyle"></div>
    </div>
  </div>
</template>
<script setup>
import { ref, watch, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { nanoid } from 'nanoid'
import { computeRectTextLayout, drawTextRun, ensureCoverTextFontReady, getTextMeasureContext, resolveTextFontFamily } from '@/core/textLayout.js'

const { t: tr } = useI18n()

const props = defineProps({
  imageUrl: String,
  placements: { type: Array, default: () => [] }, //  side  placements
  side: { type: String, required: true }, // 'front' | 'back'
  //  /  /  / 
  types: { type: Array, default: () => ['effect','grid','table','text'] },
  zoom: { type: Number, default: 1 }
})
const emit = defineEmits(['change','immediate-save'])

const imgRef = ref(null)
const wrapRef = ref(null)
const natural = ref({ w:0,h:0 })
const baseScale = ref(1) // 
const scale = computed(()=> baseScale.value * props.zoom )
const offset = ref({ x:0,y:0 })
const currentType = ref('effect')
const localRects = ref([]) // {id,type,x,y,width,height}
const drawing = ref(false)
const draft = ref({ x:0,y:0,w:0,h:0 })
const activeRectId = ref(null)
const resizing = ref(null) // {id, corner}
const draggingRect = ref(null) // { id, startX, startY, origX, origY }
const currentTypeRect = computed(()=> localRects.value.find(r=> r.type === currentType.value) )
const activeRect = computed(()=> localRects.value.find(r=> r.id === activeRectId.value) || null)
const activeText = computed(()=> localRects.value.find(r=> r.id===activeRectId.value && r.type==='text'))
const textFontReadyVersion = ref(0)
const textPreviewCanvases = new Map()
let textPreviewRaf = 0

function resolveTextAlign(value){
  const align = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['left', 'center', 'right'].includes(align) ? align : 'left'
}

function normalizeRotation(value){
  const angle = Number(value)
  if(!Number.isFinite(angle)) return 0
  return ((angle % 360) + 360) % 360
}

function getRotatedBoundingSize(width, height, rotation = 0){
  const w = Math.max(1, Number.isFinite(+width) ? +width : 1)
  const h = Math.max(1, Number.isFinite(+height) ? +height : 1)
  const radians = normalizeRotation(rotation) * Math.PI / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  return {
    width: (w * cos) + (h * sin),
    height: (w * sin) + (h * cos)
  }
}
function clampNumber(value, min, max){
  let next = Number.isFinite(+value) ? +value : 0
  if(Number.isFinite(+min)) next = Math.max(+min, next)
  if(Number.isFinite(+max)) next = Math.min(next, +max)
  return next
}
function getRectCoordinateBounds(r){
  if(!r || !natural.value.w || !natural.value.h){
    return { minX: 0, maxX: undefined, minY: 0, maxY: undefined }
  }
  const width = Math.max(1, Number.isFinite(+r.width) ? +r.width : 1)
  const height = Math.max(1, Number.isFinite(+r.height) ? +r.height : 1)
  const rotatedBounds = getRotatedBoundingSize(width, height, r.rotation)
  const resolveCenterRange = (boundsSize, naturalSize) => {
    if(boundsSize >= naturalSize){
      const center = naturalSize / 2
      return { min: center, max: center }
    }
    const half = boundsSize / 2
    return { min: half, max: naturalSize - half }
  }
  const xCenter = resolveCenterRange(rotatedBounds.width, natural.value.w)
  const yCenter = resolveCenterRange(rotatedBounds.height, natural.value.h)
  return {
    minX: xCenter.min - (width / 2),
    maxX: xCenter.max - (width / 2),
    minY: yCenter.min - (height / 2),
    maxY: yCenter.max - (height / 2)
  }
}
function rotateVector(x, y, radians){
  return {
    x: (x * Math.cos(radians)) - (y * Math.sin(radians)),
    y: (x * Math.sin(radians)) + (y * Math.cos(radians))
  }
}
function getRectCenter(r){
  return {
    x: (Number.isFinite(+r?.x) ? +r.x : 0) + (Math.max(1, Number.isFinite(+r?.width) ? +r.width : 1) / 2),
    y: (Number.isFinite(+r?.y) ? +r.y : 0) + (Math.max(1, Number.isFinite(+r?.height) ? +r.height : 1) / 2)
  }
}
function getRectCornerPosition(r, localX, localY){
  const width = Math.max(1, Number.isFinite(+r?.width) ? +r.width : 1)
  const height = Math.max(1, Number.isFinite(+r?.height) ? +r.height : 1)
  const center = getRectCenter(r)
  const radians = normalizeRotation(r?.rotation) * Math.PI / 180
  const rotated = rotateVector(localX - (width / 2), localY - (height / 2), radians)
  return {
    x: center.x + rotated.x,
    y: center.y + rotated.y
  }
}
function buildRectFromFixedCorner(anchor, width, height, rotation = 0){
  const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1)
  const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1)
  const safeRotation = normalizeRotation(rotation)
  const diagonal = rotateVector(safeWidth, safeHeight, safeRotation * Math.PI / 180)
  const opposite = {
    x: anchor.x + diagonal.x,
    y: anchor.y + diagonal.y
  }
  const centerX = (anchor.x + opposite.x) / 2
  const centerY = (anchor.y + opposite.y) / 2
  return {
    x: centerX - (safeWidth / 2),
    y: centerY - (safeHeight / 2),
    width: safeWidth,
    height: safeHeight,
    rotation: safeRotation
  }
}
function resolveResizedRect(pointer, resizeState){
  if(!resizeState || resizeState.corner !== 'br') return null
  const radians = normalizeRotation(resizeState.rotation) * Math.PI / 180
  const local = rotateVector(pointer.x - resizeState.anchorX, pointer.y - resizeState.anchorY, -radians)
  return buildRectFromFixedCorner(
    { x: resizeState.anchorX, y: resizeState.anchorY },
    Math.max(1, local.x),
    Math.max(1, local.y),
    resizeState.rotation
  )
}

watch(()=>props.placements, ()=>{ syncFromProps() }, { immediate:true, deep:true })
// side 
watch(()=>props.side, ()=>{
  syncFromProps()
  activeRectId.value=null
  drawing.value=false
  resizing.value=null
  draggingRect.value=null
})
watch(scale, ()=>{ queueTextPreviewRender() })
watch(textFontReadyVersion, ()=>{ queueTextPreviewRender() })
watch(localRects, ()=>{ queueTextPreviewRender() }, { deep:true })

function syncFromProps(){
  localRects.value = (props.placements||[])
    .filter(p=>p.side===props.side)
    .map(p=> p?.type === 'text'
      ? { ...p, rotation: normalizeRotation(p.rotation), fontFamily: resolveTextFontFamily(p.fontFamily), align: resolveTextAlign(p.align) }
      : { ...p, rotation: normalizeRotation(p.rotation) })
  queueTextPreviewRender()
}

function updateActiveRectCoordinate(axis, rawValue){
  const rect = activeRect.value
  if(!rect) return
  const value = Number(rawValue)
  if(!Number.isFinite(value)) return
  if(axis === 'x') rect.x = value
  else rect.y = value
  clampRect(rect)
  emitChange()
}

const activeRectCoordX = computed({
  get(){
    return Math.round(Number(activeRect.value?.x || 0))
  },
  set(value){
    updateActiveRectCoordinate('x', value)
  }
})
const activeRectCoordBounds = computed(()=> getRectCoordinateBounds(activeRect.value))
const activeRectCoordMinX = computed(()=> Math.floor(activeRectCoordBounds.value.minX ?? 0))
const activeRectCoordMaxX = computed(()=> Number.isFinite(+activeRectCoordBounds.value.maxX) ? Math.ceil(activeRectCoordBounds.value.maxX) : undefined)
const activeRectCoordMinY = computed(()=> Math.floor(activeRectCoordBounds.value.minY ?? 0))
const activeRectCoordMaxY = computed(()=> Number.isFinite(+activeRectCoordBounds.value.maxY) ? Math.ceil(activeRectCoordBounds.value.maxY) : undefined)

const activeRectCoordY = computed({
  get(){
    return Math.round(Number(activeRect.value?.y || 0))
  },
  set(value){
    updateActiveRectCoordinate('y', value)
  }
})

function updateActiveRectRotation(rawValue){
  const rect = activeRect.value
  if(!rect) return
  rect.rotation = normalizeRotation(rawValue)
  clampRect(rect)
  emitChange()
}

const activeRectRotation = computed({
  get(){
    return Math.round(normalizeRotation(activeRect.value?.rotation))
  },
  set(value){
    updateActiveRectRotation(value)
  }
})

function rotateActiveRect90(){
  if(!activeRect.value) return
  updateActiveRectRotation((activeRect.value.rotation || 0) + 90)
}

function typeLabel(type){
  if(type==='effect') return tr('placement.typeEffect')
  if(type==='grid') return tr('placement.typeGrid')
  if(type==='table') return tr('placement.typeTable')
  if(type==='text') return tr('placement.typeText')
  return type
}

function computeLayout(){
  const img = imgRef.value
  const wrap = wrapRef.value
  if(!img || !wrap || !natural.value.w) return
  const bw = wrap.clientWidth
  const ratio = bw / natural.value.w
  baseScale.value = ratio
}

function onImgLoad(){
  const img = imgRef.value
  natural.value.w = img.naturalWidth
  natural.value.h = img.naturalHeight
  computeLayout()
  queueTextPreviewRender()
}

function rectStyle(r){
  const s = scale.value
  return {
    left: r.x*s+'px',
    top: r.y*s+'px',
    width: r.width*s+'px',
    height: r.height*s+'px',
    transform: `rotate(${normalizeRotation(r.rotation)}deg)`,
    transformOrigin: 'center center'
  }
}

let previewMeasureCtx = null
function getPreviewMeasureCtx(){
  if(previewMeasureCtx) return previewMeasureCtx
  previewMeasureCtx = getTextMeasureContext()
  return previewMeasureCtx
}

function setTextPreviewCanvas(id, el){
  if(el) textPreviewCanvases.set(id, el)
  else textPreviewCanvases.delete(id)
  queueTextPreviewRender()
}

function queueTextPreviewRender(){
  if(typeof window === 'undefined') return
  if(textPreviewRaf) cancelAnimationFrame(textPreviewRaf)
  textPreviewRaf = requestAnimationFrame(() => {
    textPreviewRaf = 0
    renderTextPreviews()
  })
}

function renderTextPreviews(){
  textFontReadyVersion.value
  const s = scale.value
  const dpr = Math.max(1, window.devicePixelRatio || 1)
  localRects.value.forEach(r => {
    if(r?.type !== 'text') return
    const canvas = textPreviewCanvases.get(r.id)
    if(!canvas) return
    const width = Math.max(1, r.width * s)
    const height = Math.max(1, r.height * s)
    canvas.width = Math.max(1, Math.round(width * dpr))
    canvas.height = Math.max(1, Math.round(height * dpr))
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    const ctx = canvas.getContext('2d')
    if(!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    const fontSize = (r.fontSize || 32) * s
    const layout = computeRectTextLayout(
      { x: 0, y: 0, width, height },
      r.text ?? '',
      { fontSize, fontFamily: r.fontFamily, weight: 'normal', align: resolveTextAlign(r.align) },
      getPreviewMeasureCtx()
    )
    drawTextRun(ctx, r.text ?? '', layout.left, layout.baselineY, {
      fontSize,
      fontFamily: r.fontFamily,
      weight: 'normal',
      color: r.color || '#000000',
      baseline: 'alphabetic',
      shadowColor: 'rgba(0,0,0,0.4)',
      shadowBlur: 3
    })
  })
}

onMounted(()=>{
  ensureCoverTextFontReady().then(()=>{
    textFontReadyVersion.value += 1
    queueTextPreviewRender()
  })
  nextTick(() => queueTextPreviewRender())
})

const draftStyle = computed(()=>{ const s=scale.value; return { left: draft.value.x*s+'px', top: draft.value.y*s+'px', width: draft.value.w*s+'px', height: draft.value.h*s+'px' } })

function clampRect(r){
  if(!r) return
  r.width = Math.max(1, Number.isFinite(+r.width) ? +r.width : 1)
  r.height = Math.max(1, Number.isFinite(+r.height) ? +r.height : 1)
  r.rotation = normalizeRotation(r.rotation)
  if(!natural.value.w || !natural.value.h){
    r.x = Math.max(0, Number.isFinite(+r.x) ? +r.x : 0)
    r.y = Math.max(0, Number.isFinite(+r.y) ? +r.y : 0)
    return
  }
  const bounds = getRectCoordinateBounds(r)
  r.x = clampNumber(r.x, bounds.minX, bounds.maxX)
  r.y = clampNumber(r.y, bounds.minY, bounds.maxY)
}

let startPoint = null
function canvasPoint(e){
  const rect = wrapRef.value.getBoundingClientRect()
  const s = scale.value
  const x = (e.clientX - rect.left) / s
  const y = (e.clientY - rect.top) / s
  return { x: Math.max(0, Math.min(x, natural.value.w)), y: Math.max(0, Math.min(y, natural.value.h)) }
}
function onDown(e){
  if(resizing.value) return
  if(!currentType.value) return
  drawing.value = true
  const pt = canvasPoint(e)
  startPoint = pt
  draft.value = { x: pt.x, y: pt.y, w:0,h:0 }
}
function onMove(e){
  if(resizing.value){
    const pt = canvasPoint(e)
    const r = localRects.value.find(r=>r.id===resizing.value.id)
    if(r && resizing.value.corner==='br'){
      const nextRect = resolveResizedRect(pt, resizing.value)
      if(!nextRect) return
      r.x = nextRect.x
      r.y = nextRect.y
      r.width = nextRect.width
      r.height = nextRect.height
      r.rotation = nextRect.rotation
      clampRect(r)
      emitChange()
    }
    return
  }
  if(draggingRect.value){
    const pt = canvasPoint(e)
    const dx = pt.x - draggingRect.value.startX
    const dy = pt.y - draggingRect.value.startY
    const r = localRects.value.find(r=> r.id === draggingRect.value.id)
    if(r){
      r.x = draggingRect.value.origX + dx
      r.y = draggingRect.value.origY + dy
      clampRect(r)
      emitChange()
    }
    return
  }
  if(!drawing.value) return
  const pt = canvasPoint(e)
  draft.value.w = pt.x - startPoint.x
  draft.value.h = pt.y - startPoint.y
  if(draft.value.w < 0){ draft.value.x = pt.x; draft.value.w = Math.abs(draft.value.w) }
  if(draft.value.h < 0){ draft.value.y = pt.y; draft.value.h = Math.abs(draft.value.h) }
}
function onUp(){
  if(resizing.value){ resizing.value=null; return }
  if(draggingRect.value){ draggingRect.value=null; return }
  if(!drawing.value){ return }
  drawing.value=false
  if(draft.value.w < 5 || draft.value.h < 5) return
  const rect = { id: nanoid(8), side: props.side, type: currentType.value, x: draft.value.x, y: draft.value.y, width: draft.value.w, height: draft.value.h, rotation: 0 }
  //  /  / 
  if(rect.type === 'text'){
    rect.text = rect.text || tr('placement.sampleText')
    rect.fontSize = rect.fontSize || 42
    rect.color = rect.color || '#F44F46'
    rect.fontFamily = resolveTextFontFamily(rect.fontFamily)
    rect.align = resolveTextAlign(rect.align)
  }
  clampRect(rect)
  // 
  const idx = localRects.value.findIndex(r=> r.type===rect.type)
  if(idx>-1) { localRects.value.splice(idx,1,rect) } else { localRects.value.push(rect) }
  activeRectId.value = rect.id
  emitChange()
}
function emitChange(){
  const merged = mergeWithOtherSide()
  emit('change', merged)
  queueTextPreviewRender()
}
function mergeWithOtherSide(){
  //  side  placements
  const others = (props.placements||[]).filter(p=>p.side!==props.side)
  return [...others, ...localRects.value.map(r=> ({...r}))]
}
function selectRect(id){ activeRectId.value = id }
function startResize(id, corner){
  const rect = localRects.value.find(r => r.id === id)
  if(!rect) return
  activeRectId.value = id
  if(corner === 'br'){
    const anchor = getRectCornerPosition(rect, 0, 0)
    resizing.value = {
      id,
      corner,
      anchorX: anchor.x,
      anchorY: anchor.y,
      rotation: normalizeRotation(rect.rotation)
    }
    return
  }
  resizing.value = { id, corner }
}
function startDragRect(r, e){
  activeRectId.value = r.id
  draggingRect.value = { id: r.id, startX: canvasPoint(e).x, startY: canvasPoint(e).y, origX: r.x, origY: r.y }
}
function clearCurrentType(){
  // 
  syncFromProps()
  const before = localRects.value.length
  const idx = localRects.value.findIndex(r=>r.type===currentType.value)
  if(idx>-1){
    const removed = localRects.value.splice(idx,1)
    console.debug('[PlacementCanvas] clear type', currentType.value, 'side', props.side, 'removed', removed)
    emitChange(); activeRectId.value=null
    emit('immediate-save', mergeWithOtherSide())
  } else {
    console.info('[PlacementCanvas]  side=', props.side, 'beforeLen=', before)
  }
}
function removeRect(id){
  const i = localRects.value.findIndex(r=>r.id===id)
  if(i>-1){
    const removed = localRects.value.splice(i,1)
    console.debug('[PlacementCanvas] remove rect id', id, 'side', props.side, removed)
    emitChange(); if(activeRectId.value===id) activeRectId.value=null; emit('immediate-save', mergeWithOtherSide())
  }
}

// === Expose API for parent ===
function getPlacements(){
  return mergeWithOtherSide()
}
function flushPending(){
  //  onUp
  if(drawing.value){
    drawing.value=false
    if(draft.value.w >=5 && draft.value.h>=5){
      const rect = { id: nanoid(8), side: props.side, type: currentType.value, x: draft.value.x, y: draft.value.y, width: draft.value.w, height: draft.value.h, rotation: 0 }
      if(rect.type === 'text'){
        rect.text = rect.text || tr('placement.sampleText')
        rect.fontSize = rect.fontSize || 32
        rect.color = rect.color || '#000000'
        rect.fontFamily = resolveTextFontFamily(rect.fontFamily)
        rect.align = resolveTextAlign(rect.align)
      }
      clampRect(rect)
      const idx = localRects.value.findIndex(r=> r.type===rect.type)
      if(idx>-1){ localRects.value.splice(idx,1,rect) } else { localRects.value.push(rect) }
      activeRectId.value = rect.id
      emitChange()
    }
  }
  // 
  if(resizing.value){ resizing.value=null; emitChange() }
  if(draggingRect.value){ draggingRect.value=null; emitChange() }
}
onBeforeUnmount(()=>{
  flushPending()
  if(textPreviewRaf) cancelAnimationFrame(textPreviewRaf)
})
defineExpose({ getPlacements, flushPending })

</script>
<style scoped>
.placement-canvas-root{ display:flex; flex-direction:column; gap:6px; position:relative; }
.toolbar{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; position:sticky; top:0; z-index:25; padding:0 0 8px; background:#1a1d21; }
.rect-config{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.text-input{ width:min(560px, 42vw); min-width:220px; }
.coord-group{ display:flex; align-items:center; gap:6px; }
.angle-group :deep(.el-input-number){ width:110px; }
.coord-label{ font-size:12px; color:#606266; white-space:nowrap; }
.canvas-wrapper{ position:relative; user-select:none; border:1px solid #d0d5da; background:#fff; padding:0; overflow:hidden; max-width:100%; }
.base-img{ display:block; max-width:100%; height:auto; }
.rect{ position:absolute; border:2px solid; box-sizing:border-box; font-size:10px; color:#fff; font-weight:600; backdrop-filter:blur(2px); background:rgba(0,0,0,0.08); box-shadow:0 0 0 1px rgba(255,255,255,0.15),0 2px 6px -2px rgba(0,0,0,0.4); transition:box-shadow .18s, background .18s; }
.rect .tag{ position:absolute; left:0; top:0; background:rgba(0,0,0,0.45); padding:2px 4px; border-bottom-right-radius:6px; letter-spacing:.5px; }
.rect-del{ position:absolute; right:2px; top:2px; background:rgba(0,0,0,0.45); color:#fff; border:0; padding:0 4px; line-height:1; border-radius:4px; cursor:pointer; font-size:12px; }
.rect-del:hover{ background:#ff4d4f; }
.rect.active{ outline:2px dashed #fff; background:rgba(255,255,255,0.04); box-shadow:0 0 0 2px rgba(255,255,255,0.35),0 4px 10px -2px rgba(0,0,0,0.6); }
.rect .text-preview-canvas{ position:absolute; inset:0; width:100%; height:100%; pointer-events:none; display:block; }
.rect.type-effect{ border-color:#409eff; }
.rect.type-grid{ border-color:#67c23a; }
.rect.type-table{ border-color:#e6a23c; }
.draft{ position:absolute; border:1px dashed #409eff; background:rgba(64,158,255,0.15); pointer-events:none; }
.resize-handle{ position:absolute; width:10px; height:10px; background:#fff; border:1px solid #333; }
.resize-handle.br{ right:-6px; bottom:-6px; cursor:nwse-resize; }
@media (prefers-color-scheme: dark){
  .canvas-wrapper{ background:#1c1f23; border-color:#30363d; }
  .rect .tag{ background:rgba(0,0,0,0.55); }
  .coord-label{ color:#c7ccd2; }
  .toolbar{ background:#121517; }
}
</style>
