import { ref, reactive, computed } from 'vue'

function createDefaultGridDesign() {
  return { x: 0, y: 0, w: 0, h: 0, scale: 1, rotate: 0 }
}

function createDefaultTableDesign() {
  return { x: 0, y: 0, w: 0, h: 0, scale: 1, rotate: 0, columns: 1, maxRowsPerTable: 15 }
}

function createDefaultCoverFrontDesign(coverId = null) {
  return {
    coverId,
    coverUpdatedAt: null,
    hasSnapshot: false,
    merge: { x: 0, y: 0, scale: 1, w: 0, h: 0, rotate: 0 },
    grid: createDefaultGridDesign(),
    table: createDefaultTableDesign(),
    texts: [],
    backTexts: [],
    strokes: [],
    backStrokes: []
  }
}

function cloneTextList(list) {
  return Array.isArray(list) ? list.map(item => ({ ...item })) : []
}

function cloneStrokeList(list) {
  return Array.isArray(list)
    ? list.map(stroke => ({
        ...stroke,
        points: Array.isArray(stroke?.points) ? stroke.points.map(point => ({ ...point })) : []
      }))
    : []
}

function cloneLayerState(source, defaults) {
  return { ...defaults, ...(source || {}) }
}

function normalizeCoverDesignSnapshot(source = {}) {
  const defaults = createDefaultCoverFrontDesign(source?.coverId ?? null)
  return {
    coverId: source?.coverId ?? defaults.coverId,
    coverUpdatedAt: source?.coverUpdatedAt ?? defaults.coverUpdatedAt,
    hasSnapshot: source?.hasSnapshot === true,
    merge: { ...defaults.merge, ...(source?.merge || {}) },
    grid: cloneLayerState(source?.grid, defaults.grid),
    table: cloneLayerState(source?.table, defaults.table),
    texts: cloneTextList(source?.texts),
    backTexts: cloneTextList(source?.backTexts),
    strokes: cloneStrokeList(source?.strokes),
    backStrokes: cloneStrokeList(source?.backStrokes)
  }
}

function syncReactiveList(target, items) {
  target.splice(0, target.length, ...items)
}

// 全局状态管理
const step = ref(1)
const selectedProject = ref(null)
const selectedTemplate = ref(null)
const autoSelectInfo = ref(null)
const resizePlan = ref(null)
const matchInfo = reactive({ auto: false, exact: [], nearest: null })
const displayMode = ref('full')

// 新增: cells.json 数据供后续步骤使用
const cellsData = ref(null)

// 额外状态
const mergedImage = ref('') // PNG base64 (transparent) from step 3
const effectImage = ref('') // optional effect preview

// 封面正面设计（不持久化）
const coverFrontDesign = reactive(createDefaultCoverFrontDesign())
const coverDesignSnapshots = reactive({})

// 计算属性
const pixelWidth = computed(() => {
  const cells = selectedProject.value?.result?.cells
  return cells?.image_width || cells?.cols || 0
})

const pixelHeight = computed(() => {
  const cells = selectedProject.value?.result?.cells
  return cells?.image_height || cells?.rows || 0
})
const colorCount = computed(() => selectedProject.value?.result?.palette?.length || 0)

const sizeDiff = computed(() => {
  const n = matchInfo.nearest
  if (!n || !selectedProject.value) return { w: 0, h: 0 }
  return { 
    w: Math.abs(n.width - pixelWidth.value), 
    h: Math.abs(n.height - pixelHeight.value) 
  }
})

const projectImage = computed(() => {
  if (!selectedProject.value) return ''
  const imgs = selectedProject.value.result?.images || {}
  return displayMode.value === 'full' ? imgs.full : imgs.x
})

export function useMergeStore() {
  const applyCoverDesignSnapshot = (snapshot) => {
    const normalized = normalizeCoverDesignSnapshot(snapshot)
    coverFrontDesign.coverId = normalized.coverId
    coverFrontDesign.coverUpdatedAt = normalized.coverUpdatedAt
    coverFrontDesign.hasSnapshot = normalized.hasSnapshot
    Object.assign(coverFrontDesign.merge, normalized.merge)
    Object.assign(coverFrontDesign.grid, normalized.grid)
    Object.assign(coverFrontDesign.table, normalized.table)
    syncReactiveList(coverFrontDesign.texts, normalized.texts)
    syncReactiveList(coverFrontDesign.backTexts, normalized.backTexts)
    syncReactiveList(coverFrontDesign.strokes, normalized.strokes)
    syncReactiveList(coverFrontDesign.backStrokes, normalized.backStrokes)
  }

  const persistCoverDesignSnapshot = (snapshot) => {
    if(snapshot.coverId == null) return
    coverDesignSnapshots[String(snapshot.coverId)] = normalizeCoverDesignSnapshot(snapshot)
  }

  const clearCoverDesignSnapshots = () => {
    Object.keys(coverDesignSnapshots).forEach(key => delete coverDesignSnapshots[key])
  }

  const sameTemplate = (a, b) => {
    if (a === b) return true
    if (!a || !b) return false
    if (a.id != null && b.id != null) return a.id === b.id
    return false
  }

  const clearProjectDerivedState = () => {
    selectedTemplate.value = null
    autoSelectInfo.value = null
    resizePlan.value = null
    matchInfo.auto = false
    matchInfo.exact = []
    matchInfo.nearest = null
    setMergedImages('', '')
    setCellsData(null)
    clearCoverDesignSnapshots()
    resetCoverFrontDesign()
  }

  const goStep = (s) => {
    step.value = s
  }

  const resetProject = () => {
    selectedProject.value = null
    clearProjectDerivedState()
  }

  const setProject = (project) => {
    clearProjectDerivedState()
    selectedProject.value = project
  }

  const setTemplate = (template) => {
    const changed = !sameTemplate(selectedTemplate.value, template)
    selectedTemplate.value = template
    if (changed) setMergedImages('', '')
  }

  const setAutoSelectInfo = (info) => {
    autoSelectInfo.value = info
  }

  const setResizePlan = (plan) => {
    resizePlan.value = plan
  }

  const setMatchInfo = (info) => {
    Object.assign(matchInfo, info)
  }

  const setDisplayMode = (mode) => {
    displayMode.value = mode
  }

  const setMergedImages = (merged, effect) => { mergedImage.value = merged || ''; effectImage.value = effect || '' }
  const updateCoverFrontDesign = (partial) => {
    const next = normalizeCoverDesignSnapshot({
      ...normalizeCoverDesignSnapshot(coverFrontDesign),
      ...partial,
      merge: { ...coverFrontDesign.merge, ...(partial?.merge || {}) },
      grid: { ...coverFrontDesign.grid, ...(partial?.grid || {}) },
      table: { ...coverFrontDesign.table, ...(partial?.table || {}) },
      texts: partial?.texts ?? coverFrontDesign.texts,
      backTexts: partial?.backTexts ?? coverFrontDesign.backTexts,
      strokes: partial?.strokes ?? coverFrontDesign.strokes,
      backStrokes: partial?.backStrokes ?? coverFrontDesign.backStrokes
    })
    applyCoverDesignSnapshot(next)
    persistCoverDesignSnapshot(next)
  }

  const loadCoverFrontDesign = (coverId) => {
    if(coverId == null){
      applyCoverDesignSnapshot(createDefaultCoverFrontDesign())
      return null
    }
    const existing = coverDesignSnapshots[String(coverId)]
    if(existing){
      applyCoverDesignSnapshot(existing)
      return coverFrontDesign
    }
    applyCoverDesignSnapshot(createDefaultCoverFrontDesign(coverId))
    return null
  }

  const resetCoverFrontDesign = () => {
    applyCoverDesignSnapshot(createDefaultCoverFrontDesign())
  }
  const setCellsData = (data) => { cellsData.value = data }
  const resetMergeState = () => {
    step.value = 1
    resetProject()
    displayMode.value = 'full'
    setMergedImages('', '')
    setCellsData(null)
    resetCoverFrontDesign()
  }

  return {
    // State
    step,
    selectedProject,
    selectedTemplate,
    autoSelectInfo,
    resizePlan,
    matchInfo,
    displayMode,
    mergedImage,
    effectImage,
    coverFrontDesign,
    cellsData,
    
    // Computed
    pixelWidth,
    pixelHeight,
    colorCount,
    sizeDiff,
    projectImage,
    
    // Actions
    goStep,
    resetProject,
    setProject,
    setTemplate,
    setAutoSelectInfo,
    setResizePlan,
    setMatchInfo,
    setDisplayMode,
    setMergedImages,
    updateCoverFrontDesign,
    loadCoverFrontDesign,
    resetCoverFrontDesign,
    setCellsData,
    resetMergeState
  }
}
