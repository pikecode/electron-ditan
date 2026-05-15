<template>
  <div class="strategy-selector-wrapper" ref="rootEl">
    <el-tooltip :content="t('colorStrategy.tooltip')" placement="bottom" popper-class="strategy-tooltip-pop">
      <div class="icon-trigger" @click="togglePanel">
        <el-icon size="16"><MagicStick /></el-icon>
      </div>
    </el-tooltip>
    <Teleport to="body">
      <transition name="fade">
        <div v-if="open" ref="panelEl" class="panel" :style="panelStyle">
          <div class="panel-header">
            <span>{{ t('colorStrategy.panelTitle') }}</span>
            <el-icon class="close-btn" @click="setOpen(false)"><Close /></el-icon>
          </div>
          <div class="section">
            <div class="section-title">{{ t('colorStrategy.sectionAlgo') }}</div>
            <el-select v-model="localAlgorithm" size="small" class="algo-select" popper-class="strategy-select-popper" @change="emitStrategyChange">
              <el-option v-for="s in strategies" :key="s.name" :label="t('colorStrategy.algo.' + s.name)" :value="s.name" />
            </el-select>
          </div>
          <div v-if="currentStrategy.params.length" class="section params">
            <div class="section-title">{{ t('colorStrategy.sectionParams') }}</div>
            <div class="param-row" v-for="p in currentStrategy.params" :key="p.key">
              <label>{{ t('colorStrategy.params.' + p.key + '.label') }}</label>
              <template v-if="p.type==='boolean'">
                <el-switch v-model="localParams[p.key]" size="small" @change="emitCurrentStrategyParams" />
              </template>
              <template v-else>
                <el-input-number v-model="localParams[p.key]" :min="p.min" :max="p.max" :step="p.step" size="small" @change="scheduleParamsEmit" />
              </template>
              <span class="inline-desc">{{ t('colorStrategy.params.' + p.key + '.short') }}</span>
            </div>
          </div>
          <div class="section">
            <div class="section-title">{{ t('colorStrategy.sectionPalette') }}</div>
            <div class="param-row palette-row">
              <el-select v-model="colorGroupId" size="small" class="palette-select" popper-class="strategy-select-popper" :placeholder="t('colorStrategy.allColors')">
                <el-option :label="t('colorStrategy.allColors')" :value="null" />
                <el-option v-for="g in colorGroups" :key="g.id" :label="g.name" :value="g.id" />
              </el-select>
              <el-input-number v-model="colorCount" :min="1" :max="currentMaxColorCount" size="small" class="palette-count" />
              <span class="hint">/ {{ currentMaxColorCount }}</span>
            </div>
            <div style="margin-top:8px;text-align:left;">
              <el-button type="primary" size="small" @click="onPaletteApply">{{ t('colorStrategy.apply') }}</el-button>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
    
    <div v-if="open && hoveredGroupColors.length" class="floating-group-preview" :style="previewStyle" @mouseenter="hoverLock=true" @mouseleave="hoverLock=false; clearHover()">
      <div class="preview-title">{{ t('colorStrategy.previewNColors', { name: hoveredGroupName, n: hoveredGroupColors.length }) }}</div>
      <div class="preview-chips">
        <div v-for="c in hoveredGroupColors.slice(0,160)" :key="c.id" class="chip" :title="c.name + ' ' + c.hex" :style="{ background:c.hex }"></div>
        <div v-if="hoveredGroupColors.length>160" class="more">{{ t('colorStrategy.more', { n: hoveredGroupColors.length - 160 }) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { MagicStick, Close } from '@element-plus/icons-vue'
import { useColorManagement } from '../../composables/useColorManagement.js'
import { useColorGroups } from '../../composables/useColorGroups.js'

const emit = defineEmits(['strategy-change','strategy-param-change','palette-config-change'])
const { t } = useI18n()

// Strategies definition (labels via i18n colorStrategy.algo.* / colorStrategy.params.*)
const strategies = [
  { name:'average', params:[
    { key:'softChoiceThreshold', min:0, max:3, step:0.1, default:0.8, desc:'' },
    { key:'randomFactor', min:0, max:1, step:0.05, default:0.3, desc:'' }
  ]},
  { name:'floyd', params:[
    { key:'diffusionStrength', min:0, max:1, step:0.05, default:1.0 },
    { key:'cleanup', type:'boolean', default:true },
    { key:'cleanupPasses', min:1, max:3, step:1, default:1 },
    { key:'majorityThreshold', min:0.5, max:1, step:0.05, default:0.75 }
  ]},
  { name:'wu_adaptive', params:[
    { key:'wuColorCount', min:4, max:64, step:1, default:24 },
    { key:'minStrength', min:0, max:1, step:0.05, default:0.2 },
    { key:'maxStrength', min:0, max:1, step:0.05, default:0.9 },
    { key:'varianceWindow', min:0, max:4, step:1, default:2 },
    { key:'varianceScale', min:10, max:200, step:5, default:60 },
    { key:'cleanup', type:'boolean', default:true },
    { key:'cleanupPasses', min:1, max:3, step:1, default:1 },
    { key:'majorityThreshold', min:0.5, max:1, step:0.05, default:0.75 }
  ]}
]

const localAlgorithm = ref('average')
const localParams = reactive({ 
  softChoiceThreshold:0.8, 
  randomFactor:0,
  diffusionStrength:1.0,
  cleanup:true,
  cleanupPasses:1,
  majorityThreshold:0.75,
  wuColorCount:24,
  minStrength:0.2,
  maxStrength:0.9,
  varianceWindow:2,
  varianceScale:60
})
const currentStrategy = computed(()=> strategies.find(s=>s.name===localAlgorithm.value) || strategies[0])

function applyDefaultsForAlgorithm(name) {
  const s = strategies.find((x) => x.name === name)
  if (!s) return
  for (const p of s.params) {
    if (p.type === 'boolean') localParams[p.key] = !!p.default
    else localParams[p.key] = p.default
  }
}

// Palette mode
const paletteMode = ref('count')
const colorCount = ref(8)
const colorGroupId = ref(null)

// Color data sources
const { colorPalette, loadColorPalettes } = useColorManagement()
const { colorGroups, loadColorGroups } = useColorGroups({ autoLoad:false })

const maxColorCount = computed(()=> colorPalette.value.length)
const selectedGroupColors = computed(()=> {
  if (paletteMode.value !== 'group') return []
  const g = colorGroups.value.find(g=>g.id===colorGroupId.value)
  return g?.colors || []
})
const currentMaxColorCount = computed(() => {
  if (paletteMode.value === 'count' && colorGroupId.value) {
    const group = colorGroups.value.find(g => g.id === colorGroupId.value)
    return group ? group.colors.length : 0
  }
  return maxColorCount.value
})

let paramsTimer = null
const userInteracted = ref(false)
function markUser(){ userInteracted.value = true }

// Override interaction trackers in handlers
function emitCurrentStrategyParams(){
  // 
  const paramObj = {}
  for (const p of currentStrategy.value.params){ paramObj[p.key] = localParams[p.key] }
  emit('strategy-param-change', { ...paramObj })
}

function scheduleParamsEmit(){
  markUser()
  if (paramsTimer) clearTimeout(paramsTimer)
  paramsTimer = setTimeout(()=>{ emitCurrentStrategyParams() },300)
}
function emitStrategyChange(){
  markUser()
  applyDefaultsForAlgorithm(localAlgorithm.value)
  emit('strategy-change', localAlgorithm.value)
  emitCurrentStrategyParams()
}
function emitPaletteCount(){
  markUser()
  if (paletteMode.value !== 'count') return
  const group = colorGroupId.value == null
    ? null
    : colorGroups.value.find(g => g.id === colorGroupId.value)
  const max = group ? group.colors.length : (maxColorCount.value || 1)
  const n = Math.min(Math.max(colorCount.value||1,1), max)
  colorCount.value = n
  const payload = { type:'count', colorCount:n }
  if (group) {
    payload.colorGroupId = colorGroupId.value
    payload.allColors = group.colors
    lastPaletteSignature.value = `count:${n}:group:${colorGroupId.value}:${group.colors.length}`
  } else {
    lastPaletteSignature.value = `count:${n}`
  }
  emit('palette-config-change', payload)
}
function emitPaletteGroup(){
  markUser()
  if (paletteMode.value !== 'group') return
  emit('palette-config-change', { type:'group', colorGroupId: colorGroupId.value, selectedColors: selectedGroupColors.value })
  lastPaletteSignature.value = `group:${colorGroupId.value}:${selectedGroupColors.value.length}`
}
function handlePaletteModeChange(){ markUser(); if (paletteMode.value==='count') emitPaletteCount(); else emitPaletteGroup() }
function onPaletteApply() {
  markUser()
  // 
  if (colorGroupId.value === null) {
    paletteMode.value = 'count'
    //  [1, ] 
    const max = maxColorCount.value || 1
    colorCount.value = Math.min(Math.max(colorCount.value || 1, 1), max)
    emit('palette-config-change', { enable:true, type: 'count', colorCount: colorCount.value })
    lastPaletteSignature.value = `count:${colorCount.value}`
  } else {
    // 
    paletteMode.value = 'count'
    const group = colorGroups.value.find(g => g.id === colorGroupId.value)
    const max = group ? group.colors.length : maxColorCount.value
    colorCount.value = Math.min(Math.max(colorCount.value || 1, 1), max)
    if (!group) return
    emit('palette-config-change', { enable:true,type: 'count', colorCount: colorCount.value, colorGroupId: colorGroupId.value , allColors:group.colors})
    lastPaletteSignature.value = `count:${colorCount.value}:group:${colorGroupId.value}`
  }

}

// Track last emitted to avoid duplicate spam
const lastPaletteSignature = ref('')

// Apply initial config (idempotent unless user interacted)
function applyInitialFromProps(cfg){
  if (!cfg) return
  if (userInteracted.value) return
  if (cfg.algorithm) localAlgorithm.value = cfg.algorithm
  if (cfg.algorithmParams) {
    Object.assign(localParams, cfg.algorithmParams)
  }
  // 
  const strat = strategies.find(s=>s.name===localAlgorithm.value)
  if (strat) for (const p of strat.params){ if (localParams[p.key] == null) localParams[p.key] = p.default }
  if (cfg.type === 'group') {
    paletteMode.value = 'group'
    colorGroupId.value = cfg.colorGroupId || cfg.color_group_id || null
  } else if (cfg.type === 'count') {
    paletteMode.value = 'count'
    colorGroupId.value = cfg.colorGroupId || cfg.color_group_id || null
    if (cfg.colorCount) colorCount.value = cfg.colorCount
  }
}

const props = defineProps({
  initialColorConfig: { type:Object, default: () => ({}) }
})

watch(()=>props.initialColorConfig, (v)=>{ applyInitialFromProps(v) }, { deep:true, immediate:true })

watch(()=>maxColorCount.value, (v)=>{
  if (paletteMode.value==='count' && v>0 && !initialEmitted.value) emitPaletteCount()
})

// When groups (async) load, re-emit group palette if needed
watch([()=>colorGroups.value.length, ()=>colorGroupId.value, selectedGroupColors],()=>{
  if (paletteMode.value!=='group') return
  if (!colorGroupId.value) return
  if (!initialEmitted.value) return
  const sig = `group:${colorGroupId.value}:${selectedGroupColors.value.length}`
  if (selectedGroupColors.value.length && sig !== lastPaletteSignature.value) {
    emit('palette-config-change', { type:'group', colorGroupId: colorGroupId.value, selectedColors: selectedGroupColors.value })
    lastPaletteSignature.value = sig
  }
})

const initialEmitted = ref(false)
function emitInitial(){
  if (initialEmitted.value) return
  emit('strategy-change', localAlgorithm.value)
  emitCurrentStrategyParams()
  if (paletteMode.value==='count') emitPaletteCount(); else emitPaletteGroup()
  initialEmitted.value = true
}

// Panel logic switched to click toggle
const open = ref(false)
const panelEl = ref(null)
const panelStyle = ref({ top: '0px', left: '0px' })

function updatePanelPosition() {
  if (!open.value || !rootEl.value) return
  const triggerRect = rootEl.value.getBoundingClientRect()
  const panelWidth = panelEl.value?.offsetWidth || 360
  const panelHeight = panelEl.value?.offsetHeight || 0
  const gap = 8
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  let left = triggerRect.left
  let top = triggerRect.bottom + gap

  if (left + panelWidth > viewportWidth - 12) {
    left = Math.max(12, viewportWidth - panelWidth - 12)
  }

  if (panelHeight && top + panelHeight > viewportHeight - 12) {
    const aboveTop = triggerRect.top - panelHeight - gap
    if (aboveTop >= 12) top = aboveTop
    else top = Math.max(12, viewportHeight - panelHeight - 12)
  }

  panelStyle.value = {
    left: `${Math.round(left)}px`,
    top: `${Math.round(top)}px`
  }
}

function setOpen(value) {
  open.value = value
  if (value) nextTick(updatePanelPosition)
}

function togglePanel(){ setOpen(!open.value) }
const rootEl = ref(null)
function isInsideStrategyPopper(path, target) {
  if (Array.isArray(path) && path.some(node => node?.classList?.contains?.('strategy-select-popper'))) return true
  return !!target?.closest?.('.strategy-select-popper')
}

function handleDocClick(e){
  const target = e.target
  const eventPath = typeof e.composedPath === 'function' ? e.composedPath() : []
  const insideTrigger = rootEl.value?.contains(target)
  const insidePanel = panelEl.value?.contains(target)
  if (!insideTrigger && !insidePanel && !isInsideStrategyPopper(eventPath, target)) setOpen(false)
}

onMounted(async () => {
  applyInitialFromProps(props.initialColorConfig)
  if (colorPalette.value.length===0) { try { await loadColorPalettes() } catch(e) { console.warn('load palettes fail', e) } }
  if (colorGroups.value.length===0) { try { await loadColorGroups() } catch(e) { console.warn('load groups fail', e) } }
  emitInitial()
  document.addEventListener('click', handleDocClick)
  window.addEventListener('resize', updatePanelPosition)
  window.addEventListener('scroll', updatePanelPosition, true)
})

watch(open, (value) => {
  if (value) nextTick(updatePanelPosition)
})

watch([currentStrategy, currentMaxColorCount], () => {
  if (open.value) nextTick(updatePanelPosition)
})

onBeforeUnmount(()=>{
  document.removeEventListener('click', handleDocClick)
  window.removeEventListener('resize', updatePanelPosition)
  window.removeEventListener('scroll', updatePanelPosition, true)
  if (paramsTimer) clearTimeout(paramsTimer)
})

// Hover preview logic (floating panel)
const hoveredGroupId = ref(null)
const hoverLock = ref(false)
const previewStyle = ref({ top:'0px', left:'0px' })
const hoveredGroupColors = computed(()=>{ if (!hoveredGroupId.value) return []; const g = colorGroups.value.find(g=>g.id===hoveredGroupId.value); return g?.colors || [] })
const hoveredGroupName = computed(()=>{ if (!hoveredGroupId.value) return ''; const g = colorGroups.value.find(g=>g.id===hoveredGroupId.value); return g?.name || '' })
function handleGroupOptionHover(g, e){
  hoveredGroupId.value = g.id
  // 
  const optEl = e?.currentTarget
  if (optEl) {
    const rect = optEl.getBoundingClientRect()
    const gap = 8
    const maxWidth = 260
    const vw = window.innerWidth
    let left = rect.right + gap
    if (left + maxWidth + 12 > vw) left = Math.max(12, rect.left - gap - maxWidth)
    let top = rect.top
    const vh = window.innerHeight
    const estHeight = 240
    if (top + estHeight > vh - 12) top = Math.max(12, vh - estHeight - 12)
    previewStyle.value = { left:left + 'px', top:top + 'px' }
  }
}
function clearHover(){ if (hoverLock.value) return; hoveredGroupId.value = null }
</script>

<style scoped>
.strategy-selector-wrapper { position:relative; }
.icon-trigger { width:28px; height:28px; border:1px solid #e0e0e0; border-radius:8px; display:flex; align-items:center; justify-content:center; cursor:pointer; background:#fafafa; }
.icon-trigger:hover { background:#fff; box-shadow:0 0 0 1px #409eff inset; }
.panel {
  position:fixed;
  z-index:99998;
  width:clamp(320px, 36vw, 460px);
  min-width:320px;
  max-width:460px;
  max-height:min(70vh, 560px);
  background:#fff;
  border:1px solid #dcdfe6;
  border-radius:8px;
  padding:10px 14px 14px;
  box-shadow:0 6px 18px rgba(0,0,0,0.15);
  font-size:12px;
  overflow:auto;
}
.panel-header { display:flex; justify-content:space-between; align-items:center; font-weight:600; color:#303133; margin-bottom:4px; }
.close-btn { cursor:pointer; }
.section { margin-top:8px; }
.section:first-of-type { margin-top:4px; }
.section-title { font-weight:600; color:#303133; margin-bottom:6px; display:flex; align-items:center; gap:4px; }
.algo-select { width:100%; }
.param-row {
  display:grid;
  grid-template-columns: 88px 160px 1fr;
  align-items:center;
  gap:8px;
  margin-bottom:6px;
}
.param-row label {
  margin-top:0;
  color:#303133;
  white-space:nowrap;
}
.inline-desc{
  color:#606266;
  line-height:1.25;
  word-break:break-all;
}
.palette-row{
  grid-template-columns: 1fr 170px auto;
  align-items:center;
}
.palette-select{ width:100%; }
.palette-count{ width:100%; }
.param-info { cursor:pointer; margin-left:4px; color:#909399; }
.param-info:hover { color:#409eff; }
.colors-preview { display:flex; flex-wrap:wrap; gap:4px; max-height:120px; overflow:auto; margin-top:6px; border:1px solid #ebeef5; padding:6px; border-radius:4px; }
.c-chip { width:16px; height:16px; border:1px solid #ccc; border-radius:3px; }
.more { font-size:11px; color:#909399; align-self:center; padding:0 4px; line-height:14px; }
.hint { color:#909399; font-size:11px; }
.fade-enter-active,.fade-leave-active { transition:opacity .18s ease; }
.fade-enter-from,.fade-leave-to { opacity:0; }
.group-option { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:2px 0; }
.group-name { font-size:12px; color:#303133; font-weight:500; }
.mini-chips { display:flex; flex-wrap:nowrap; gap:2px; }
.mini-chip { width:14px; height:14px; border:1px solid #ccc; border-radius:3px; }
.more-chip { font-size:10px; color:#909399; padding:0 2px; line-height:14px; }
.hover-preview { margin-top:6px; border:1px solid #dcdfe6; border-radius:6px; padding:6px 8px; background:#fafafa; }
.preview-title { font-size:12px; font-weight:600; color:#303133; margin-bottom:6px; }
.preview-chips { display:flex; flex-wrap:wrap; gap:4px; max-height:140px; overflow:auto; }
.preview-chips .chip { width:18px; height:18px; border:1px solid #ccc; border-radius:4px; }
.floating-group-preview { position:fixed; z-index:4000; width:260px; max-height:240px; overflow:auto; background:#fff; border:1px solid #dcdfe6; border-radius:8px; padding:8px 10px 10px; box-shadow:0 6px 18px rgba(0,0,0,0.18); }
.floating-group-preview .preview-title { font-size:12px; font-weight:600; color:#303133; margin-bottom:6px; }
.floating-group-preview .preview-chips { display:flex; flex-wrap:wrap; gap:4px; }
.floating-group-preview .preview-chips .chip { width:18px; height:18px; border:1px solid #ccc; border-radius:4px; }

:deep(.param-tooltip){ display:none; }

@media (max-width: 900px){
  .panel{
    width:min(92vw, 460px);
    max-width:92vw;
    left:auto;
    right:0;
  }
  .param-row{
    grid-template-columns: 80px 140px 1fr;
    gap:6px;
  }
  .palette-row{
    grid-template-columns: 1fr;
  }
}
</style>
<style>
.strategy-tooltip-pop { z-index: 99999 !important; }
.strategy-select-popper { z-index: 100000 !important; }
</style>
