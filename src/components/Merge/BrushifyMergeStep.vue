<template>
  <div class="step-card merge-step">
    <h2 class="card-title">{{ t('merge.step3.title') }}</h2>

    <div v-if="!environmentReady" class="env-wait">
      <div class="spinner" />
      <div class="msg">{{ t('merge.step3.envLoading') }}</div>
    </div>

    <div v-else class="controls">
      
      <!-- 客户指定参数：暂时隐藏前端可调项，避免后期误改需求（仍保留内部默认值） -->
      <div v-if="SHOW_STEP3_TUNING" class="blend-control">
        <label class="ctrl-label">{{ t('merge.step3.overlayOpacity') }} : {{ (textureOpacity * 100).toFixed(0) }}%</label>
        <el-slider
          v-model="textureOpacity"
          :min="0"
          :max="1"
          :step="0.01"
          :disabled="isGenerating"
          :show-tooltip="false"
        />
      </div>

      <div v-if="SHOW_STEP3_TUNING" class="blend-control">
        <label class="ctrl-label">{{ t('merge.step3.postLift') }} : {{ postLift }}</label>
        <el-slider
          v-model="postLift"
          :min="0"
          :max="18"
          :step="1"
          :disabled="isGenerating"
          :show-tooltip="false"
        />
      </div>
      <div v-if="SHOW_STEP3_TUNING" class="blend-control">
        <label class="ctrl-label">{{ t('merge.step3.textureRelief') }} : {{ textureReliefPct }}%</label>
        <el-slider
          v-model="textureReliefPct"
          :min="0"
          :max="100"
          :step="1"
          :disabled="isGenerating"
          :show-tooltip="false"
        />
      </div>
      
      <!-- 尺寸策略保留给客户操作 -->
      <div class="option-line dual">
        <el-checkbox v-model="resizeGridToTemplate" :disabled="isGenerating">{{ t('merge.step3.fitTemplate') }}</el-checkbox>
        <el-checkbox v-model="resizeTemplateToGrid" :disabled="isGenerating">{{ t('merge.step3.fitGrid') }}</el-checkbox>
      </div>
      <div class="actions">
        <el-button @click="handlePrev" :disabled="isGenerating">{{ t('merge.common.prev') }}</el-button>
        <el-button type="primary" @click="generate" :loading="isGenerating" :disabled="!canGenerate || isGenerating">{{ isGenerating ? t('merge.step3.generatingWait') : t('merge.step3.generate') }}</el-button>
        <el-button v-if="hasResult" type="success" @click="goStep(4)">{{ t('merge.step3.nextCover') }}</el-button>
        <el-button type="warning" plain @click="resetStep3Memory">{{ t('merge.step3.reset') }}</el-button>
      </div>
      <div v-if="statusMessage" class="status" :class="{ error: statusError }">{{ statusMessage }}</div>
      <div v-if="bakedPreviewWarning" class="status warn">{{ bakedPreviewWarning }}</div>
    </div>

    <div v-if="hasResult" class="result-panels">
      <div class="result-box">
        <h4 class="box-title">{{ t('merge.step3.mergedTitle') }}</h4>
        <div class="zoom-bar" v-if="mergedPreview || mergedFullData">
          <div class="zoom-left">
            <span class="zoom-label">{{ t('merge.step3.zoomLabel', { pct: Math.round(mergedZoom * 100) }) }}</span>
          </div>
          <div class="zoom-mid">
            <el-slider
              v-model="mergedZoom"
              :min="0.2"
              :max="2.5"
              :step="0.05"
              :disabled="isGenerating"
              :show-tooltip="false"
            />
          </div>
          <div class="zoom-right">
            <el-button size="small" @click="setZoom(0.6)" :disabled="isGenerating">{{ t('merge.step3.zoomDefault') }}</el-button>
            <el-button size="small" @click="setZoom(1.0)" :disabled="isGenerating">{{ t('merge.step3.zoom100') }}</el-button>
            <el-button size="small" @click="setZoom(Math.max(0.2, +(mergedZoom - 0.1).toFixed(2)))" :disabled="isGenerating">-</el-button>
            <el-button size="small" @click="setZoom(Math.min(2.5, +(mergedZoom + 0.1).toFixed(2)))" :disabled="isGenerating">+</el-button>
          </div>
        </div>
        <div class="image-wrapper">
          
          <img
            v-if="mergedImgSrc"
            :src="mergedImgSrc"
            alt="merged"
            class="zoom-img"
            :style="mergedImgStyle"
            @wheel.passive="onWheelZoom"
          />
        </div>
        <div class="download-actions">
            <!-- 导出锐度/倍率：客户指定为后台默认，暂时隐藏前端可调 -->
            <div v-if="SHOW_EXPORT_TUNING" class="export-tuning">
              <span class="tuning-label">{{ t('merge.step3.exportSharpness') }}</span>
              <el-slider
                v-model="exportSharpness"
                :min="0"
                :max="100"
                :step="1"
                :show-tooltip="false"
                class="sharpness-slider"
              />
              <span class="tuning-value">{{ exportSharpness }}</span>
            </div>
            <div v-if="SHOW_EXPORT_TUNING" class="export-tuning scale-line">
              <span class="tuning-label">{{ t('merge.step3.exportScale') }}</span>
              <el-select v-model="exportScale" size="small" style="width: 90px;">
                <el-option :value="1" label="1x" />
                <el-option :value="2" label="2x" />
              </el-select>
            </div>
            <el-button size="small" @click="download('merged','png')">{{ t('merge.step3.downloadPng') }}</el-button>
            <el-button size="small" @click="download('merged','jpeg')">{{ t('merge.step3.downloadJpeg') }}</el-button>
        </div>
      </div>
      
    </div>

    
    <div class="work-canvas-holder">
      <canvas ref="gridCanvas" class="hidden-canvas"></canvas>
      <canvas ref="templateCanvas" class="hidden-canvas"></canvas>
      <canvas ref="mergedCanvas" class="hidden-canvas"></canvas>
      <canvas ref="effectCanvas" class="hidden-canvas"></canvas>
      <canvas ref="maskCanvas" class="hidden-canvas"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMergeStore } from '../../composables/useMergeStore.js'
import * as templateStore from '../../database/indexeddb/templateStore.js'
import { getTemplatePreviewSource, isPsdTemplate, normalizeTemplateName } from '../../utils/psdTemplate.js'
import { isMarkedBakedGridPreview } from '../../utils/originalImageSemantics.js'
import {
  canUsePhotopeaRenderer,
  canUsePsdNativeRenderer,
  findLocalPsdEffectTemplateCandidate,
  inspectTemplateBlob,
  renderPsdEffectTemplateWithPhotopea,
  renderPsdEffectTemplateWithPython
} from '../../utils/psdNativeRenderer.js'

const { t } = useI18n()

const emit = defineEmits(['prev-step'])

const mergeStore = useMergeStore()
const { selectedProject, selectedTemplate, projectImage, goStep, setMergedImages } = mergeStore

// ===== 客户指定：固化 step3 叠加参数（隐藏可调 UI）=====
const SHOW_STEP3_TUNING = false
const SHOW_EXPORT_TUNING = false
const LOCKED_STEP3 = Object.freeze({
  textureOpacity: 0.55,   // 55%
  postLift: 3,            // 轻微提亮，避免线性光后整体偏闷
  textureReliefPct: 8     // 轻量回灌模板高频，让纹理更贴合但不过度浮起
})
const LOCKED_EXPORT = Object.freeze({
  exportSharpness: 0,
  exportScale: 1
})

//  PS linearLight
// brushify.js  linearLight  mergeImagesPure  PS 
const textureOpacity = ref(LOCKED_STEP3.textureOpacity)
/** 线性光合成后每通道加亮 0–18，高饱和区会自动减弱 */
const postLift = ref(LOCKED_STEP3.postLift)
/** 模板纹理还原 0–100% → brushify linearLightTextureRelief */
const textureReliefPct = ref(LOCKED_STEP3.textureReliefPct)
const isGenerating = ref(false)
const environmentReady = ref(false)
const statusMessage = ref('')
const statusError = ref(false)

// refs
const gridCanvas = ref(null)
const templateCanvas = ref(null)
const mergedCanvas = ref(null)
const effectCanvas = ref(null)
const maskCanvas = ref(null)

// result preview
const mergedPreview = ref('') // 
const mergedFullData = ref('') // 
const effectPreview = ref('')

const hasResult = computed(() => !!mergedPreview.value || !!mergedFullData.value)
const canGenerate = computed(() => {
  if (!selectedProject.value || !selectedTemplate.value) return false
  return environmentReady.value || shouldPreferNativePsdRender(selectedTemplate.value)
})
const bakedPreviewWarning = computed(() => {
  const project = selectedProject.value
  if (!shouldTreatProjectAsBakedGridPreview(project)) return ''
  const scale = getEffectiveProjectGridScale(project)
  return t('merge.step3.sourceBakedGridWarning', {
    scale: scale > 0 ? scale : '?'
  })
})

let brushifyInstance = null
const imageMetricsCache = new Map()
const cellsRebuildSourceCache = new Map()
const nativePsdRenderResult = ref(null)
const linkedPsdTemplateCache = new Map()
const psdBaseMaskSourceCache = new Map()

// 尺寸策略：保留给客户操作（默认按模板尺寸）
const resizeGridToTemplate = ref(true)
const resizeTemplateToGrid = ref(false)

watch(resizeGridToTemplate, v => { if(v) resizeTemplateToGrid.value = false; })
watch(resizeTemplateToGrid, v => { if(v) resizeGridToTemplate.value = false; })

function enforceLockedStep3Params(){
  textureOpacity.value = LOCKED_STEP3.textureOpacity
  postLift.value = LOCKED_STEP3.postLift
  textureReliefPct.value = LOCKED_STEP3.textureReliefPct
}

async function waitForEnvironment(maxMs = 30000) {
  const start = Date.now()
  return new Promise((resolve) => {
    const tick = () => {
      if (window.cv && window.cv.Mat && window.cv.imread && window.BrushifyJS) return resolve(true)
      if (Date.now() - start > maxMs) return resolve(false)
      setTimeout(tick, 150)
    }
    tick()
  })
}

async function ensureEnv() {
  if (environmentReady.value) return true
  const ok = await waitForEnvironment()
  if (ok) {
    try {
      brushifyInstance = new window.BrushifyJS()
      applyBrushifyMergeParams()
    } catch(e) { console.warn(e) }
  }
  environmentReady.value = ok
  return ok
}

onMounted(async () => {
  await ensureEnv()
})

watch([selectedTemplate, selectedProject], () => { // ; 
  mergedPreview.value = ''
  effectPreview.value = ''
  mergedFullData.value = ''
  nativePsdRenderResult.value = null
  linkedPsdTemplateCache.clear()
})

function handlePrev() { goStep(2) }

function clearStatus() { statusMessage.value = ''; statusError.value = false }

function normalizeImageSource(src) {
  if (typeof src !== 'string') return ''
  const value = src.trim()
  if (!value) return ''
  if (/^(data:|blob:|https?:|file:)/i.test(value)) return value
  return `data:image/png;base64,${value}`
}

async function getImageMetrics(src) {
  if (!src) return null
  const cached = imageMetricsCache.get(src)
  if (cached) return cached
  const img = await loadImageElement(src)
  const metrics = {
    width: Number(img.naturalWidth || img.width || 0),
    height: Number(img.naturalHeight || img.height || 0)
  }
  imageMetricsCache.set(src, metrics)
  return metrics
}

function parseCellColor(value) {
  const input = String(value || '').trim()
  if (!input || input === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }
  if (input.startsWith('#')) {
    const hex = input.slice(1)
    if (hex.length === 3 || hex.length === 4) {
      const r = Number.parseInt(hex[0] + hex[0], 16)
      const g = Number.parseInt(hex[1] + hex[1], 16)
      const b = Number.parseInt(hex[2] + hex[2], 16)
      const a = hex.length === 4 ? Number.parseInt(hex[3] + hex[3], 16) : 255
      return { r, g, b, a }
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = Number.parseInt(hex.slice(0, 2), 16)
      const g = Number.parseInt(hex.slice(2, 4), 16)
      const b = Number.parseInt(hex.slice(4, 6), 16)
      const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255
      return { r, g, b, a }
    }
  }
  const rgbMatch = input.match(/^rgba?\(([^)]+)\)$/i)
  if (!rgbMatch) return { r: 0, g: 0, b: 0, a: 255 }
  const parts = rgbMatch[1].split(',').map(part => Number(part.trim()))
  if (parts.length < 3 || parts.some(num => !Number.isFinite(num))) {
    return { r: 0, g: 0, b: 0, a: 255 }
  }
  const alphaValue = parts.length >= 4 && Number.isFinite(parts[3]) ? parts[3] : 1
  return {
    r: Math.max(0, Math.min(255, Math.round(parts[0]))),
    g: Math.max(0, Math.min(255, Math.round(parts[1]))),
    b: Math.max(0, Math.min(255, Math.round(parts[2]))),
    a: Math.max(0, Math.min(255, Math.round(alphaValue <= 1 ? alphaValue * 255 : alphaValue)))
  }
}

function getLargestPositiveNumber(...values) {
  return values.reduce((maxValue, value) => {
    const num = Number(value || 0)
    if (!Number.isFinite(num) || num <= 0) return maxValue
    return Math.max(maxValue, num)
  }, 0)
}

function resolveIntegerGridScale(width, height, rows, cols) {
  const safeWidth = Number(width || 0)
  const safeHeight = Number(height || 0)
  const safeRows = Number(rows || 0)
  const safeCols = Number(cols || 0)
  if (!(safeWidth > 0 && safeHeight > 0 && safeRows > 0 && safeCols > 0)) return 0
  const scaleX = safeWidth / safeCols
  const scaleY = safeHeight / safeRows
  const roundedScaleX = Math.round(scaleX)
  const roundedScaleY = Math.round(scaleY)
  const sameIntegerScale =
    roundedScaleX >= 4 &&
    roundedScaleX === roundedScaleY &&
    Math.abs(scaleX - roundedScaleX) <= 0.08 &&
    Math.abs(scaleY - roundedScaleY) <= 0.08
  return sameIntegerScale ? roundedScaleX : 0
}

function getProjectCellsPayload(project = selectedProject.value) {
  const cells = project?.result?.cells || {}
  const matrix = Array.isArray(cells?.data)
    ? cells.data
    : Array.isArray(project?.cellsMatrix)
      ? project.cellsMatrix
      : []
  const rows = Number(cells?.rows || project?.rows || matrix.length || 0)
  const cols = Number(cells?.cols || project?.cols || (Array.isArray(matrix[0]) ? matrix[0].length : 0))
  const imageWidth = getLargestPositiveNumber(
    project?.image?.size?.width,
    project?.image_width,
    project?.imageWidth,
    project?.xmlSnapshot?.pixel_width,
    project?.xmlSnapshot?.image_width,
    cells?.image_width,
    cells?.imageWidth
  )
  const imageHeight = getLargestPositiveNumber(
    project?.image?.size?.height,
    project?.image_height,
    project?.imageHeight,
    project?.xmlSnapshot?.pixel_height,
    project?.xmlSnapshot?.image_height,
    cells?.image_height,
    cells?.imageHeight
  )
  return { matrix, rows, cols, imageWidth, imageHeight }
}

function getEffectiveProjectGridScale(project = selectedProject.value) {
  const image = project?.image || null
  const markedScale = Number(image?.gridScale || 0) || 0
  if (isMarkedBakedGridPreview(image) && markedScale > 0) return markedScale
  const { rows, cols, imageWidth, imageHeight } = getProjectCellsPayload(project)
  return resolveIntegerGridScale(imageWidth, imageHeight, rows, cols)
}

function shouldTreatProjectAsBakedGridPreview(project = selectedProject.value) {
  const image = project?.image || null
  return isMarkedBakedGridPreview(image) || getEffectiveProjectGridScale(project) > 0
}

async function buildContinuousSourceFromCells(project = selectedProject.value) {
  if (!shouldTreatProjectAsBakedGridPreview(project)) return null

  const { matrix, rows, cols, imageWidth, imageHeight } = getProjectCellsPayload(project)
  if (!rows || !cols || !Array.isArray(matrix) || !matrix.length) return null

  const targetWidth = Math.max(cols, Math.round(imageWidth || image?.size?.width || cols * 16 || 0))
  const targetHeight = Math.max(rows, Math.round(imageHeight || image?.size?.height || rows * 16 || 0))
  const cacheKey = [
    rows,
    cols,
    targetWidth,
    targetHeight,
    matrix[0]?.[0]?.hex || matrix[0]?.[0]?.color || '',
    matrix[Math.max(0, rows - 1)]?.[Math.max(0, cols - 1)]?.hex || matrix[Math.max(0, rows - 1)]?.[Math.max(0, cols - 1)]?.color || ''
  ].join('|')
  if (cellsRebuildSourceCache.has(cacheKey)) return cellsRebuildSourceCache.get(cacheKey)

  const smallCanvas = document.createElement('canvas')
  smallCanvas.width = cols
  smallCanvas.height = rows
  const smallCtx = smallCanvas.getContext('2d', { willReadFrequently: true })
  if (!smallCtx) return null
  const imageData = smallCtx.createImageData(cols, rows)
  const pixels = imageData.data
  let offset = 0
  for (let row = 0; row < rows; row += 1) {
    const rowCells = Array.isArray(matrix[row]) ? matrix[row] : []
    for (let col = 0; col < cols; col += 1) {
      const color = parseCellColor(rowCells[col]?.hex || rowCells[col]?.color || '#000000')
      pixels[offset] = color.r
      pixels[offset + 1] = color.g
      pixels[offset + 2] = color.b
      pixels[offset + 3] = color.a
      offset += 4
    }
  }
  smallCtx.putImageData(imageData, 0, 0)

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = targetWidth
  outputCanvas.height = targetHeight
  const outputCtx = outputCanvas.getContext('2d', { willReadFrequently: true })
  if (!outputCtx) return null
  outputCtx.clearRect(0, 0, targetWidth, targetHeight)
  outputCtx.imageSmoothingEnabled = true
  outputCtx.imageSmoothingQuality = 'high'
  outputCtx.drawImage(smallCanvas, 0, 0, targetWidth, targetHeight)

  const rebuilt = {
    src: outputCanvas.toDataURL('image/png'),
    width: targetWidth,
    height: targetHeight
  }
  cellsRebuildSourceCache.set(cacheKey, rebuilt)
  return rebuilt
}

async function resolveProjectMergeSource(options = {}) {
  const project = selectedProject.value
  if (!project) return { src: '', sourceMode: 'missing' }
  const preferOriginal = !!options?.preferOriginal
  const image = project.image || {}
  const rawCandidates = [
    { src: image.data, role: 'image.data' },
    { src: image.base64, role: 'image.base64' },
    { src: image.original, role: 'image.original' },
    { src: project.original_img, role: 'project.original_img' },
    { src: project.image_data, role: 'project.image_data' },
    { src: image.thumbnail, role: 'image.thumbnail' },
    { src: project.image_thumbnail, role: 'project.image_thumbnail' },
    { src: projectImage.value, role: 'projectImage' }
  ]
  const normalizedCandidates = []
  for (const candidate of rawCandidates) {
    const normalized = normalizeImageSource(candidate.src)
    if (!normalized || normalizedCandidates.some(entry => entry.src === normalized)) continue
    normalizedCandidates.push({
      src: normalized,
      role: candidate.role
    })
  }
  if (!normalizedCandidates.length) return { src: '', sourceMode: 'missing' }

  const expectedWidth = Number(image?.size?.width || project.image_width || project.result?.cells?.image_width || 0)
  const expectedHeight = Number(image?.size?.height || project.image_height || project.result?.cells?.image_height || 0)
  const gridCols = Number(project.result?.cells?.cols || project.cols || 0)
  const gridRows = Number(project.result?.cells?.rows || project.rows || 0)
  const expectedArea = expectedWidth > 0 && expectedHeight > 0 ? expectedWidth * expectedHeight : 0
  const expectedAspect = expectedWidth > 0 && expectedHeight > 0 ? expectedWidth / expectedHeight : 0

  const entries = []
  for (let index = 0; index < normalizedCandidates.length; index += 1) {
    const candidate = normalizedCandidates[index]
    let metrics = null
    try {
      metrics = await getImageMetrics(candidate.src)
    } catch (_) {}
    const width = Number(metrics?.width || 0)
    const height = Number(metrics?.height || 0)
    entries.push({
      ...candidate,
      index,
      width,
      height,
      area: width > 0 && height > 0 ? width * height : 0,
      aspect: width > 0 && height > 0 ? width / height : 0
    })
  }

  const largerAspectMatchedCandidateExists =
    expectedArea > 0 &&
    entries.some(entry => {
      if (entry.area < expectedArea * 1.5) return false
      if (!(entry.width > 0 && entry.height > 0)) return false
      if (!(expectedAspect > 0)) return true
      return Math.abs(entry.aspect - expectedAspect) / expectedAspect <= 0.04
    })

  let bestSource = normalizedCandidates[0].src
  let bestEntry = null
  let bestScore = Number.NEGATIVE_INFINITY

  for (const entry of entries) {
    const { src, width, height, area, index } = entry
    let score = area

    if (expectedWidth > 0 && expectedHeight > 0 && width > 0 && height > 0) {
      const exactMatch = width === expectedWidth && height === expectedHeight
      const nearMatch = Math.abs(width - expectedWidth) <= 2 && Math.abs(height - expectedHeight) <= 2
      if (!largerAspectMatchedCandidateExists) {
        if (exactMatch) score += 1e12
        else if (nearMatch) score += 8e11
        else score -= (Math.abs(width - expectedWidth) + Math.abs(height - expectedHeight)) * 1000
      } else {
        if (expectedAspect > 0) {
          const aspectDelta = Math.abs((width / height) - expectedAspect) / expectedAspect
          score -= aspectDelta * 5e6
        }
        if (exactMatch) score += 5e7
        else if (nearMatch) score += 2e7
      }
    }

    if (gridCols > 0 && gridRows > 0 && width > 0 && height > 0) {
      const looksLikeCellScale = width <= gridCols * 2.2 && height <= gridRows * 2.2
      if (looksLikeCellScale) score -= 6e11
    }

    if (largerAspectMatchedCandidateExists) {
      const isPreferredOriginalRole =
        entry.role === 'image.data' ||
        entry.role === 'image.base64' ||
        entry.role === 'image.original' ||
        entry.role === 'project.original_img' ||
        entry.role === 'project.image_data'
      if (isPreferredOriginalRole) score += 2e7
    }

    score += Math.max(0, 16 - index) * 1e5

    if (score > bestScore) {
      bestScore = score
      bestSource = src
      bestEntry = entry
    }
  }

  if (preferOriginal && bestSource) {
    return {
      src: bestSource,
      sourceMode: shouldTreatProjectAsBakedGridPreview(project) ? 'baked-preview-original' : 'project-original',
      sourceInfo: bestEntry
        ? {
            width: bestEntry.width,
            height: bestEntry.height,
            role: bestEntry.role
          }
        : null
    }
  }

  if (shouldTreatProjectAsBakedGridPreview(project)) {
    const rebuiltFromCells = await buildContinuousSourceFromCells(project)
    if (rebuiltFromCells?.src) {
      return {
        src: rebuiltFromCells.src,
        sourceMode: 'cells-rebuild',
        sourceInfo: {
          width: rebuiltFromCells.width,
          height: rebuiltFromCells.height
        }
      }
    }
  }

  return {
    src: bestSource,
    sourceMode: shouldTreatProjectAsBakedGridPreview(project) ? 'baked-preview-original' : 'project-original',
    sourceInfo: bestEntry
      ? {
          width: bestEntry.width,
          height: bestEntry.height,
          role: bestEntry.role
        }
      : null
  }
}

function normalizeOpacity(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  if (num <= 0) return 0
  if (num >= 1) return 1
  return num
}

function clamp01(value) {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

function applyNativeBakedToneFinish(targetCanvas, { sourceMode = 'missing', project = null } = {}) {
  if (!targetCanvas) return false
  if (!shouldTreatProjectAsBakedGridPreview(project)) return false
  if (sourceMode !== 'cells-rebuild') return false

  const width = Number(targetCanvas.width || 0) || 0
  const height = Number(targetCanvas.height || 0) || 0
  if (width <= 0 || height <= 0) return false

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue

    const r = data[i] / 255
    const g = data[i + 1] / 255
    const b = data[i + 2] / 255

    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)

    const midWeight =
      clamp01((luma - 0.12) / 0.20) *
      clamp01((0.84 - luma) / 0.34)
    const shadowWeight = clamp01(1 - luma / 0.34)
    const satWeight = midWeight * clamp01(chroma / 0.18)
    const shadowSatWeight = shadowWeight * clamp01(chroma / 0.16)
    const saturation = 1 + satWeight * 0.006 + shadowSatWeight * 0.01
    const density = 1 - shadowWeight * 0.008

    const nextR = clamp01((luma + (r - luma) * saturation) * density)
    const nextG = clamp01((luma + (g - luma) * saturation) * density)
    const nextB = clamp01((luma + (b - luma) * saturation) * density)

    data[i] = Math.round(nextR * 255)
    data[i + 1] = Math.round(nextG * 255)
    data[i + 2] = Math.round(nextB * 255)
  }

  ctx.putImageData(imageData, 0, 0)
  return true
}

function cleanupPeripheralColorHalo(targetCanvas, options = {}) {
  if (!targetCanvas) return false
  const width = Number(targetCanvas.width || 0) || 0
  const height = Number(targetCanvas.height || 0) || 0
  if (width <= 0 || height <= 0) return false

  const borderWidth = Math.max(
    0,
    Math.min(
      Number.isFinite(Number(options.borderWidth)) ? Math.round(Number(options.borderWidth)) : 10,
      Math.max(0, Math.floor(Math.min(width, height) * 0.03))
    )
  )
  const clearAlpha = Math.max(
    0,
    Math.min(255, Number.isFinite(Number(options.clearAlpha)) ? Math.round(Number(options.clearAlpha)) : 64)
  )
  const fadeAlpha = Math.max(
    clearAlpha + 1,
    Math.min(255, Number.isFinite(Number(options.fadeAlpha)) ? Math.round(Number(options.fadeAlpha)) : 176)
  )
  const exponent = Number.isFinite(Number(options.exponent)) ? Math.max(0.8, Number(options.exponent)) : 1.35
  if (borderWidth <= 0) return false

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  let changed = false

  for (let y = 0; y < height; y += 1) {
    const dy = Math.min(y, height - 1 - y)
    if (dy > borderWidth) continue
    for (let x = 0; x < width; x += 1) {
      const dist = Math.min(x, y, width - 1 - x, height - 1 - y)
      if (dist > borderWidth) continue
      const idx = (y * width + x) * 4
      const alpha = data[idx + 3]
      if (alpha === 0) continue

      if (alpha <= clearAlpha) {
        data[idx] = 0
        data[idx + 1] = 0
        data[idx + 2] = 0
        data[idx + 3] = 0
        changed = true
        continue
      }

      if (alpha >= fadeAlpha) continue

      const t = Math.max(0, Math.min(1, (alpha - clearAlpha) / (fadeAlpha - clearAlpha)))
      const newAlpha = Math.max(0, Math.min(255, Math.round(alpha * Math.pow(t, exponent))))
      if (newAlpha === alpha) continue

      const scale = alpha > 0 ? newAlpha / alpha : 0
      data[idx] = Math.max(0, Math.min(255, Math.round(data[idx] * scale)))
      data[idx + 1] = Math.max(0, Math.min(255, Math.round(data[idx + 1] * scale)))
      data[idx + 2] = Math.max(0, Math.min(255, Math.round(data[idx + 2] * scale)))
      data[idx + 3] = newAlpha
      changed = true
    }
  }

  if (!changed) return false
  ctx.putImageData(imageData, 0, 0)
  return true
}

function getPrimaryPatternOverlay(template = selectedTemplate.value) {
  return template?.meta?.primaryPatternOverlay || null
}

function getPsdTemplateRole(template = selectedTemplate.value) {
  return String(template?.meta?.psdRole || '').trim().toLowerCase()
}

function isExplicitPatternSourcePsd(template = selectedTemplate.value) {
  return isPsdTemplate(template) && getPsdTemplateRole(template) === 'pattern-source'
}

function isEffectTemplatePsd(template = selectedTemplate.value) {
  const overlay = getPrimaryPatternOverlay(template)
  return isPsdTemplate(template) &&
    !isExplicitPatternSourcePsd(template) &&
    (
      getPsdTemplateRole(template) === 'effect-template' ||
      !!overlay?.pattern?.name ||
      String(template?.format || '').toLowerCase() === 'psd'
    )
}

function shouldPreferNativePsdRender(template = selectedTemplate.value) {
  return isPsdTemplate(template) && canUsePsdNativeRenderer()
}

function shouldPreferPhotopeaRender(template = selectedTemplate.value) {
  return isPsdTemplate(template) && canUsePhotopeaRenderer()
}

function formatNativePreprocessStatus(sourcePreprocess) {
  if (!sourcePreprocess?.applied) return ''
  if (sourcePreprocess.mode === 'baked-grid-preview') {
    const scale = Number(sourcePreprocess.cell_scale || sourcePreprocess.cellScale || 0) || 0
    return scale > 0 ? ` · 去块喷溅 ${scale}px` : ' · 去块喷溅'
  }
  return ` · ${sourcePreprocess.mode || 'preprocess'}`
}

function formatNativeSourceStatus(sourceMode, sourceInfo) {
  if (sourceMode === 'cells-rebuild') {
    const width = Number(sourceInfo?.width || 0) || 0
    const height = Number(sourceInfo?.height || 0) || 0
    return width > 0 && height > 0
      ? ` · 格子重建 ${width}x${height}`
      : ' · 格子重建'
  }
  return ''
}

function formatLinkedPsdStatus(linkedPsd = null) {
  const template = linkedPsd?.template || null
  if (!template) return ''
  const name = String(template?.name || '').trim() || 'unnamed.psd'
  const origin = template?.meta?.autoDiscovered ? '本地自动匹配' : '模板库'
  const reason = String(linkedPsd?.reason || template?.meta?.localMatchReason || '').trim()
  return reason ? `${name} (${origin} / ${reason})` : `${name} (${origin})`
}

function formatTemplateStrategyStatus(renderConfig = null) {
  const strategy = String(renderConfig?.templateStrategy || '').trim()
  if (!strategy) return ''
  if (strategy === 'selected-preview-direct') return ' · 模板直出'
  if (strategy === 'pattern-source-with-psd-mask') return ' · 纹理+PSD造型'
  if (strategy === 'pattern-source-with-mask') return ' · 纹理+遮罩'
  if (strategy === 'pattern-source-direct') return ' · 纹理直出'
  return ` · ${strategy}`
}

function formatNativeRenderStatus(result) {
  const strategy = result?.metrics?.replacement_strategy || 'native'
  const alpha = result?.metrics?.replacement_layer_alpha_reused ? ' + alpha' : ''
  const sourceSuffix = formatNativeSourceStatus(result?.sourceMode, result?.sourceInfo)
  const preprocessSuffix = formatNativePreprocessStatus(result?.metrics?.source_preprocess)
  const engine = result?.runner?.photopeaBundleRoot ? 'Photopea' : 'PSD-native'
  const linkedStatus = formatLinkedPsdStatus(result?.linkedPsdTemplate || null)
  const selectedName = String(result?.selectedTemplate?.name || '').trim()
  const linkSuffix =
    linkedStatus && !linkedStatus.startsWith(selectedName)
      ? ` · PSD匹配 ${linkedStatus}`
      : linkedStatus
        ? ` · PSD ${linkedStatus}`
        : ''
  return `${t('merge.step3.statusDone')} · ${engine} · ${strategy}${alpha}${sourceSuffix}${preprocessSuffix}${linkSuffix}`
}

function formatNativeFallbackReason(error) {
  const message = String(error?.message || error || '').trim()
  if (!message) return 'PSD原生渲染失败'
  if (message.startsWith('psd-native-template-invalid-signature:')) {
    const signature = message.split(':').slice(1).join(':') || 'unknown'
    return `PSD模板blob不是原始PSD文件（signature=${signature}），请重新导入PSD模板`
  }
  if (message.startsWith('photopea-template-invalid-signature:')) {
    const signature = message.split(':').slice(1).join(':') || 'unknown'
    return `Photopea模板blob不是原始PSD文件（signature=${signature}），请重新导入PSD模板`
  }
  if (message === 'psd-native-template-blob-missing') {
    return 'PSD模板缺少原始PSD二进制，请重新导入PSD模板'
  }
  if (message === 'photopea-bundle-missing') {
    return '未找到本地 Photopea 包，已回退到 PSD-native'
  }
  if (message === 'photopea-bridge-page-missing') {
    return 'Photopea bridge 页面缺失，已回退到 PSD-native'
  }
  return message
}

function formatBrushifyRenderStatus({ fallbackNotice = '', linkedPsd = null, renderConfig = null } = {}) {
  const templateStrategySuffix = formatTemplateStrategyStatus(renderConfig)
  const linkedStatus = formatLinkedPsdStatus(linkedPsd)
  const linkedSuffix = linkedStatus ? ` · PSD ${linkedStatus}` : ''
  if (fallbackNotice) {
    return `${t('merge.step3.statusDone')} · Brushify fallback${templateStrategySuffix}${linkedSuffix} · ${fallbackNotice}`
  }
  if (!linkedPsd) {
    return `${t('merge.step3.statusDone')} · BrushifyJS${templateStrategySuffix} · 未匹配PSD模板`
  }
  return `${t('merge.step3.statusDone')} · BrushifyJS${templateStrategySuffix}${linkedSuffix}`
}

async function listStoredTemplates() {
  const listFn = templateStore.listTemplates || templateStore.listTemplatesFn
  if (typeof listFn !== 'function') return []
  try {
    const list = await listFn()
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.warn('[merge.step3] list templates failed', e)
    return []
  }
}

function getProjectTemplateLookupName(project = selectedProject.value) {
  return String(
    project?.name ||
    project?.xmlSnapshot?.project_name ||
    project?.xmlSnapshot?.name ||
    ''
  ).trim()
}

function getExpectedPsdLookupSize(template = selectedTemplate.value, project = selectedProject.value) {
  const templateWidth = Number(template?.width || 0) || 0
  const templateHeight = Number(template?.height || 0) || 0
  const templateArea = templateWidth > 0 && templateHeight > 0 ? templateWidth * templateHeight : 0
  const templateAspect = getTemplateAspectRatio(template)

  const { imageWidth, imageHeight } = getProjectCellsPayload(project)
  const projectWidth = Number(imageWidth || 0) || 0
  const projectHeight = Number(imageHeight || 0) || 0
  const projectArea = projectWidth > 0 && projectHeight > 0 ? projectWidth * projectHeight : 0
  const projectAspect = projectWidth > 0 && projectHeight > 0 ? projectWidth / projectHeight : 0

  if (projectWidth > 0 && projectHeight > 0) {
    if (!(templateWidth > 0 && templateHeight > 0)) {
      return { width: projectWidth, height: projectHeight, source: 'project' }
    }
    const aspectCompatible =
      templateAspect > 0 &&
      projectAspect > 0 &&
      Math.abs(templateAspect - projectAspect) / projectAspect <= 0.08
    const projectMuchLarger =
      projectWidth >= templateWidth * 2 ||
      projectHeight >= templateHeight * 2 ||
      projectArea >= templateArea * 2
    if (aspectCompatible && projectMuchLarger) {
      return { width: projectWidth, height: projectHeight, source: 'project' }
    }
  }

  return { width: templateWidth, height: templateHeight, source: 'template' }
}

function buildTemplateLookupKey(template = selectedTemplate.value) {
  if (!template) return ''
  return [
    String(template.id || ''),
    String(template.name || ''),
    Number(template.width || 0) || 0,
    Number(template.height || 0) || 0,
    String(template.format || '')
  ].join('|')
}

function extractTemplateNameTokens(value) {
  const normalized = normalizeTemplateName(value)
  if (!normalized) return []
  const matches = normalized.match(/[0-9]+x[0-9]+|[a-z0-9]+/g) || []
  const output = []
  for (const token of matches) {
    if (token.length < 2) continue
    if (!output.includes(token)) output.push(token)
  }
  return output
}

function countSharedTokens(leftTokens, rightTokens) {
  if (!leftTokens.length || !rightTokens.length) return 0
  let count = 0
  for (const token of leftTokens) {
    if (rightTokens.includes(token)) count += 1
  }
  return count
}

function buildPsdLookupTokens(template = selectedTemplate.value, project = selectedProject.value) {
  const tokens = []
  const appendTokens = (items = []) => {
    for (const item of items) {
      const token = String(item || '').trim().toLowerCase()
      if (!token || token.length < 2 || tokens.includes(token)) continue
      tokens.push(token)
    }
  }

  appendTokens(extractTemplateNameTokens(template?.name))
  appendTokens(extractTemplateNameTokens(getProjectTemplateLookupName(project)))

  const templateWidth = Number(template?.width || 0) || 0
  const templateHeight = Number(template?.height || 0) || 0
  if (templateWidth > 0 && templateHeight > 0 && templateWidth <= 512 && templateHeight <= 512) {
    appendTokens([`${templateWidth}x${templateHeight}`, `${templateHeight}x${templateWidth}`])
  }

  const { rows, cols } = getProjectCellsPayload(project)
  if (rows > 0 && cols > 0) {
    appendTokens([`${cols}x${rows}`, `${rows}x${cols}`])
  }

  return tokens
}

function getTemplateAspectRatio(template) {
  const width = Number(template?.width || 0) || 0
  const height = Number(template?.height || 0) || 0
  if (!(width > 0 && height > 0)) return 0
  return width / height
}

function scoreLinkedPsdTemplateCandidate(candidate, targetTemplate) {
  if (!candidate || candidate.id === targetTemplate?.id) {
    return { score: Number.NEGATIVE_INFINITY, reason: '' }
  }
  if (!isPsdTemplate(candidate) || isExplicitPatternSourcePsd(candidate)) {
    return { score: Number.NEGATIVE_INFINITY, reason: '' }
  }

  let score = 0
  const reasons = []
  const expectedSize = getExpectedPsdLookupSize(targetTemplate)
  const targetWidth = Number(expectedSize.width || 0) || 0
  const targetHeight = Number(expectedSize.height || 0) || 0
  const candidateWidth = Number(candidate?.width || 0) || 0
  const candidateHeight = Number(candidate?.height || 0) || 0
  const targetAspect = getTemplateAspectRatio(targetTemplate)
  const candidateAspect = getTemplateAspectRatio(candidate)
  const targetTokens = extractTemplateNameTokens(targetTemplate?.name)
  const lookupTokens = buildPsdLookupTokens(targetTemplate)
  const candidateTokens = extractTemplateNameTokens(candidate?.name)
  const sharedTokenCount = countSharedTokens(targetTokens, candidateTokens)
  const sharedLookupTokenCount = countSharedTokens(lookupTokens, candidateTokens)
  const candidateRole = getPsdTemplateRole(candidate)

  if (sharedTokenCount > 0) {
    score += sharedTokenCount * 120
    reasons.push(`token:${sharedTokenCount}`)
  }
  if (sharedLookupTokenCount > 0) {
    score += sharedLookupTokenCount * 132
    reasons.push(`lookup:${sharedLookupTokenCount}`)
  }

  if (candidateRole === 'effect-template') {
    score += 96
    reasons.push('role:effect')
  } else if (candidate?.meta?.primaryPatternOverlay?.pattern?.name) {
    score += 56
    reasons.push('pattern-meta')
  } else {
    score -= 12
    reasons.push('role:legacy')
  }

  if (targetWidth > 0 && targetHeight > 0 && candidateWidth > 0 && candidateHeight > 0) {
    if (candidateWidth === targetWidth && candidateHeight === targetHeight) {
      score += 220
      reasons.push('size:exact')
    } else {
      const delta = Math.abs(candidateWidth - targetWidth) + Math.abs(candidateHeight - targetHeight)
      if (delta <= 6) {
        score += 160
        reasons.push('size:near')
      } else {
        score -= delta * 0.08
      }
    }
  }

  if (targetAspect > 0 && candidateAspect > 0) {
    const aspectDelta = Math.abs(candidateAspect - targetAspect) / targetAspect
    if (aspectDelta <= 0.002) {
      score += 80
      reasons.push('aspect:exact')
    } else if (aspectDelta <= 0.02) {
      score += 32
      reasons.push('aspect:near')
    } else {
      score -= aspectDelta * 400
    }
  }

  if (candidate?.meta?.primaryPatternOverlay?.pattern?.name) {
    score += 24
    reasons.push('pattern')
  }

  const uploadTime = Date.parse(candidate?.uploadTime || '') || 0
  if (uploadTime > 0) {
    score += uploadTime / 1e13
  }

  return {
    score,
    reason: reasons.join(',')
  }
}

async function resolveLinkedPsdEffectTemplate(template = selectedTemplate.value) {
  if (!template) return null
  if (isEffectTemplatePsd(template)) {
    return {
      template,
      reason: getPsdTemplateRole(template) === 'effect-template'
        ? 'selected-effect-template'
        : 'selected-legacy-psd'
    }
  }

  const cacheKey = buildTemplateLookupKey(template)
  if (cacheKey && linkedPsdTemplateCache.has(cacheKey)) {
    return linkedPsdTemplateCache.get(cacheKey) || null
  }

  const templates = await listStoredTemplates()
  let best = null
  for (const candidate of templates) {
    const ranked = scoreLinkedPsdTemplateCandidate(candidate, template)
    if (!Number.isFinite(ranked.score)) continue
    if (!best || ranked.score > best.score) {
      best = {
        template: candidate,
        score: ranked.score,
        reason: ranked.reason
      }
    }
  }

  let resolved = best && best.score >= 120 ? best : null
  if (!resolved) {
    try {
      const candidate = await findLocalPsdEffectTemplateCandidate({
        templateName: template?.name || '',
        width: Number(getExpectedPsdLookupSize(template).width || 0) || 0,
        height: Number(getExpectedPsdLookupSize(template).height || 0) || 0,
        projectName: getProjectTemplateLookupName(),
        lookupTokens: buildPsdLookupTokens(template)
      })
      if (candidate?.filePath) {
        resolved = {
          template: {
            id: `local-psd:${candidate.filePath}`,
            name: candidate.name || 'local-effect-template',
            format: 'psd',
            width: Number(candidate.width || 0) || 0,
            height: Number(candidate.height || 0) || 0,
            uploadTime: candidate.mtimeMs ? new Date(candidate.mtimeMs).toISOString() : '',
            meta: {
              sourceFormat: 'psd',
              renderMode: 'psd-layered',
              psdRole: 'effect-template',
              sourcePath: candidate.filePath,
              sourceFileUrl: candidate.fileUrl || '',
              autoDiscovered: true,
              localMatchReason: candidate.reason || '',
              localMatchScore: Number(candidate.score || 0) || 0
            }
          },
          score: Number(candidate.score || 0) || 0,
          reason: `local:${candidate.reason || 'filesystem'}`
        }
      }
    } catch (error) {
      console.warn('[merge.step3] local PSD discovery failed', error)
    }
  }

  if (cacheKey) linkedPsdTemplateCache.set(cacheKey, resolved || null)
  return resolved
}

// Preview zoom (default small; supports zoom in/out)
const mergedZoom = ref(0.6)
const exportSharpness = ref(LOCKED_EXPORT.exportSharpness) // 0-100
const exportScale = ref(LOCKED_EXPORT.exportScale) // 1x/2x

// ====== 3 ======
const STEP3_MEM_KEY = 'easystitch.merge.step3.memory.v2'
const STEP3_DEFAULTS = Object.freeze({
  mergedZoom: 0.6,
  exportSharpness: LOCKED_EXPORT.exportSharpness,
  exportScale: LOCKED_EXPORT.exportScale,
  textureOpacity: LOCKED_STEP3.textureOpacity,
  postLift: LOCKED_STEP3.postLift,
  textureReliefPct: LOCKED_STEP3.textureReliefPct
})
function loadStep3Memory(){
  try {
    const raw = localStorage.getItem(STEP3_MEM_KEY)
    if(!raw) return
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return
    if (Number.isFinite(Number(obj.mergedZoom))) mergedZoom.value = Math.max(0.2, Math.min(2.5, Number(obj.mergedZoom)))
    // 导出锐度/倍率已锁定：忽略本地记忆
    // 叠加参数已锁定：忽略本地记忆
    // 仅保留尺寸策略的记忆（避免用户每次都要点）
    if (obj.resizeGridToTemplate === true || obj.resizeGridToTemplate === false) resizeGridToTemplate.value = !!obj.resizeGridToTemplate
    if (obj.resizeTemplateToGrid === true || obj.resizeTemplateToGrid === false) resizeTemplateToGrid.value = !!obj.resizeTemplateToGrid
    // 互斥修正：确保至少一个为 true
    if (!resizeGridToTemplate.value && !resizeTemplateToGrid.value) resizeGridToTemplate.value = true
    if (resizeGridToTemplate.value) resizeTemplateToGrid.value = false
    else if (resizeTemplateToGrid.value) resizeGridToTemplate.value = false
    applyBrushifyMergeParams()
  } catch(_) {}
}
function saveStep3Memory(){
  try {
    localStorage.setItem(STEP3_MEM_KEY, JSON.stringify({
      mergedZoom: Number(mergedZoom.value),
      // 导出锐度/倍率为锁定参数：不保存，避免被“记忆值”污染
      // 锁定参数不保存，避免后续又被“记忆值”污染
      resizeGridToTemplate: !!resizeGridToTemplate.value,
      resizeTemplateToGrid: !!resizeTemplateToGrid.value
    }))
  } catch(_) {}
}

function resetStep3Memory(){
  try { localStorage.removeItem(STEP3_MEM_KEY) } catch(_) {}
  mergedZoom.value = STEP3_DEFAULTS.mergedZoom
  enforceLockedExportParams()
  enforceLockedStep3Params()
  // 重置时尺寸策略回到默认：按模板尺寸
  resizeGridToTemplate.value = true
  resizeTemplateToGrid.value = false
}

/** PS 风格合成参数：压低暗部提亮/纹理回灌，尽量贴近 PS 的沉暗区表现 */
function applyMergeNeutralParams(instance) {
  if (!instance?.params) return
  const useAtnPsdFlow = isPsdTemplate(selectedTemplate.value)
  const usePsdEffectTemplate = isEffectTemplatePsd(selectedTemplate.value)
  instance.params.linearLightBlendInEncodedSpace = true
  instance.params.linearLightGridPresoftenEnabled = usePsdEffectTemplate || !useAtnPsdFlow
  instance.params.linearLightGridPresoftenSigma = usePsdEffectTemplate ? 0.68 : (useAtnPsdFlow ? 0 : 1.05)
  instance.params.linearLightColorBlockSmoothEnabled = usePsdEffectTemplate || !useAtnPsdFlow
  instance.params.linearLightColorBlockSmoothSigma = usePsdEffectTemplate ? 1.6 : (useAtnPsdFlow ? 0 : 3.4)
  instance.params.linearLightColorBlockSmoothMix = usePsdEffectTemplate ? 0.24 : (useAtnPsdFlow ? 0 : 0.68)
  instance.params.linearLightColorBlockLightnessMix = usePsdEffectTemplate ? 0.06 : (useAtnPsdFlow ? 0 : 0.12)
  instance.params.linearLightColorBlockEdgeProtect = usePsdEffectTemplate ? 0.82 : 0.58
  instance.params.linearLightColorBlockBoundaryBoost = usePsdEffectTemplate ? 0.12 : (useAtnPsdFlow ? 0 : 0.38)
  instance.params.linearLightPixelArtDeblockEnabled = true
  instance.params.linearLightPixelArtDeblockMinScale = usePsdEffectTemplate ? 2.5 : 1.35
  instance.params.linearLightShadowDeblockEnabled = usePsdEffectTemplate || !useAtnPsdFlow
  instance.params.linearLightShadowDeblockSigma = usePsdEffectTemplate ? 1.15 : 1.25
  instance.params.linearLightShadowDeblockStart = 0.14
  instance.params.linearLightShadowDeblockEnd = usePsdEffectTemplate ? 0.44 : 0.46
  instance.params.linearLightShadowDeblockMix = usePsdEffectTemplate ? 0.56 : 0.52
  // PSD effect-template 更接近“硬块底图 + 纹理叠加”，放大时保留色块边界，
  // 否则先被 cubic 抹软后再 linearLight，视觉上会发灰、发淡。
  instance.params.linearLightGridUpscaleSmooth = usePsdEffectTemplate ? false : true
  instance.params.linearLightSprayedStrokesEnabled = useAtnPsdFlow
  instance.params.linearLightSprayedStrokeLength = 20
  instance.params.linearLightSprayedSprayRadius = 7
  instance.params.linearLightSprayedDirection = 'rightDiagonal'
  // .atn 里只有滤镜参数，没有“mix”；这里保留实现内的近似强度
  instance.params.linearLightSprayedMix = usePsdEffectTemplate ? 0.48 : (useAtnPsdFlow ? 0.28 : 0)
  instance.params.linearLightPostLift = Number(postLift.value || 0)
  instance.params.linearLightTextureRelief = Math.max(0, Math.min(0.42, Number(textureReliefPct.value || 0) / 100 * 0.42))
  instance.params.mergePureMicroContrast = 0
}

function applyBrushifyMergeParams() {
  try {
    if (brushifyInstance) {
      applyMergeNeutralParams(brushifyInstance)
    }
  } catch (_) {}
}

function enforceLockedExportParams(){
  exportSharpness.value = LOCKED_EXPORT.exportSharpness
  exportScale.value = LOCKED_EXPORT.exportScale
}

onMounted(() => { enforceLockedStep3Params(); enforceLockedExportParams(); loadStep3Memory() })
watch([mergedZoom, resizeGridToTemplate, resizeTemplateToGrid], () => {
  applyBrushifyMergeParams()
  saveStep3Memory()
})

// 3 mergeStore.mergedImage 
onMounted(() => {
  try {
    const last = mergeStore.mergedImage?.value
    if (last && !mergedFullData.value) {
      mergedFullData.value = last
      // mergedImgSrc  fullData
      mergedPreview.value = ''
    }
  } catch(_) {}
})

function setZoom(v){
  const n = Number(v)
  if(Number.isFinite(n)) mergedZoom.value = Math.max(0.2, Math.min(2.5, n))
}
const mergedImgSrc = computed(() => {
  if (!mergedPreview.value && !mergedFullData.value) return ''
  // Keep the initial viewer behavior:
  // below 100% zoom, show a pre-downscaled preview instead of letting the browser
  // resample the full transparent PNG with CSS transform. That resampling is what
  // makes the outer semi-transparent edge look like an extra blurry halo.
  return mergedZoom.value > 1.01
    ? (mergedFullData.value || mergedPreview.value)
    : (mergedPreview.value || mergedFullData.value)
})
const mergedImgStyle = computed(() => ({
  transform: `scale(${mergedZoom.value})`,
  transformOrigin: 'top left'
}))
function onWheelZoom(e){
  // Ctrl/Cmd+wheel to zoom (common UX); otherwise keep normal scroll
  if(!(e.ctrlKey || e.metaKey)) return
  const delta = e.deltaY > 0 ? -0.06 : 0.06
  setZoom(+(mergedZoom.value + delta).toFixed(2))
}

async function generate() {
  clearStatus()
  if (!canGenerate.value) return
  if (isGenerating.value) return
  isGenerating.value = true
  statusMessage.value = t('merge.step3.statusGenerating')
  statusError.value = false

  let gridMat = null, templMat = null, merged = null, effect = null
  let fallbackNotice = ''
  try {
    const linkedPsd = await resolveLinkedPsdEffectTemplate(selectedTemplate.value)
    let prepared = await resolveCompositeRenderConfig(
      linkedPsd
        ? {
            includeEdgeSource: true,
            projectSourceOptions: {
              preferOriginal: true
            },
            templateOptions: {
              effectTemplate: linkedPsd.template
            }
          }
        : {}
    )
    if (!prepared.gridSrc) throw new Error(t('merge.step3.errMissingImg'))

    if (linkedPsd && canUsePsdNativeRenderer()) {
      if (canUsePhotopeaRenderer()) {
        try {
          const photopeaResult = await renderViaPhotopeaPsd(prepared, linkedPsd)
          statusMessage.value = formatNativeRenderStatus(photopeaResult)
          return
        } catch (photopeaError) {
          nativePsdRenderResult.value = null
          console.warn('[merge.step3] Photopea render failed, fallback to PSD-native', photopeaError)
          fallbackNotice = formatNativeFallbackReason(photopeaError)
        }
      }
      try {
        const nativeResult = await renderViaNativePsd(prepared, linkedPsd)
        statusMessage.value = formatNativeRenderStatus(nativeResult)
        return
      } catch (nativeError) {
        nativePsdRenderResult.value = null
        console.warn('[merge.step3] native PSD render failed, fallback to BrushifyJS', nativeError)
        fallbackNotice = formatNativeFallbackReason(nativeError)
      }
      prepared = await resolveCompositeRenderConfig(
        linkedPsd
          ? {
              templateOptions: {
                effectTemplate: linkedPsd.template
              }
            }
          : {}
      )
    }

    if (!prepared.renderConfig.textureSource) throw new Error(t('merge.step3.errMissingImg'))

    const ok = await ensureEnv()
    if (!ok) throw new Error(t('merge.step3.errEnv'))
    applyBrushifyMergeParams()

    await drawToCanvas(prepared.gridSrc, gridCanvas)
    await drawToCanvas(prepared.renderConfig.textureSource, templateCanvas)

    const cv = window.cv
    if(!cv || !cv.imread) throw new Error(t('merge.step3.errCv'))

    gridMat = cv.imread(gridCanvas.value)
    templMat = cv.imread(templateCanvas.value)

    // 
    console.log('gridMat size:', gridMat.rows, gridMat.cols)
    console.log('templMat size:', templMat.rows, templMat.cols)
    const pair = brushifyInstance.psPatternOverlayComposite(
      gridMat,
      templMat,
      resizeTemplateToGrid.value ? false : true,
      prepared.renderConfig.overlayOpacity
    )
    if (!pair || !pair.merged || !pair.effect || pair.merged.empty()) {
      throw new Error(t('merge.step3.errPair') + ': ' + JSON.stringify(pair))
    }
    merged = pair.merged
    effect = pair.effect

    //  canvas
    adjustCanvasSize(mergedCanvas.value, merged.cols, merged.rows)
    adjustCanvasSize(effectCanvas.value, effect.cols, effect.rows)
    cv.imshow(mergedCanvas.value, merged)
    cv.imshow(effectCanvas.value, effect)
    await applyResolvedMask(mergedCanvas.value, prepared.renderConfig)
    await applyResolvedMask(effectCanvas.value, prepared.renderConfig)

    // 
    const fullData = mergedCanvas.value.toDataURL('image/png')
    let finalFullData = fullData
    let finalPreview = createScaledPreview(mergedCanvas.value, 1400, 800)

    try {
      const exportCanvas = await renderMergedForExport(prepared)
      finalFullData = exportCanvas.toDataURL('image/png')
      finalPreview = createScaledPreview(exportCanvas, 1400, 800)
    } catch (e) {
      console.warn('[generate] high-quality merged image fallback:', e)
    }

    mergedFullData.value = finalFullData

    //  1400,  800
    mergedPreview.value = finalPreview
    effectPreview.value = effectCanvas.value.toDataURL('image/png')
    // “”

    // 
    setMergedImages(finalFullData, effectPreview.value)

    statusMessage.value = formatBrushifyRenderStatus({
      fallbackNotice,
      linkedPsd,
      renderConfig: prepared?.renderConfig || null
    })
  } catch (err) {
    console.error(err)
    statusMessage.value = t('merge.step3.statusFail') + ': ' + (err && err.message ? err.message : JSON.stringify(err))
    statusError.value = true
  } finally {
    try {
      if (gridMat) gridMat.delete()
      if (templMat) templMat.delete()
      if (merged) merged.delete()
      if (effect) effect.delete()
    } catch(_) {}
    isGenerating.value = false
  }
}

async function resolveTemplateDataUrl(template) {
  if (!template) return ''
  const previewSource = getTemplatePreviewSource(template)
  if (previewSource) return previewSource
  try {
    if (templateStore.getTemplateBlob && template.id) {
      const blobRec = await templateStore.getTemplateBlob(template.id)
      if (blobRec?.blob) {
        return await blobToDataUrl(blobRec.blob)
      }
    }
  } catch (e) { console.warn('template image load failed', e) }
  return ''
}

async function readLocalTemplateBlob(sourcePath, mime = 'image/vnd.adobe.photoshop') {
  const normalizedPath = String(sourcePath || '').trim()
  if (!normalizedPath) return null
  try {
    const nodeRequire =
      (typeof window !== 'undefined' && typeof window.require === 'function' && window.require) ||
      (typeof require === 'function' && require) ||
      null
    if (!nodeRequire) return null
    const fs = nodeRequire('fs')
    const buffer = await fs.promises.readFile(normalizedPath)
    return new Blob([buffer], { type: mime })
  } catch (error) {
    console.warn('[merge.step3] local template read failed', normalizedPath, error)
    return null
  }
}

async function resolveTemplateBlob(template = selectedTemplate.value) {
  if (!template) return null
  if (template?.id && typeof templateStore.getTemplateBlob === 'function') {
    try {
      const blobRec = await templateStore.getTemplateBlob(template.id)
      if (blobRec?.blob) return blobRec.blob
    } catch (e) {
      console.warn('[merge.step3] template blob load failed', e)
    }
  }

  const sourcePath = String(template?.meta?.sourcePath || '').trim()
  if (sourcePath) {
    const localBlob = await readLocalTemplateBlob(
      sourcePath,
      String(template?.format || '').toLowerCase() === 'psd'
        ? 'image/vnd.adobe.photoshop'
        : 'application/octet-stream'
    )
    if (localBlob) return localBlob
  }

  return null
}

async function resolvePsdBaseMaskSource(template) {
  if (!template || !isPsdTemplate(template)) return ''
  const cacheKey = buildTemplateLookupKey(template)
  if (cacheKey && psdBaseMaskSourceCache.has(cacheKey)) {
    return psdBaseMaskSourceCache.get(cacheKey) || ''
  }

  let output = ''
  try {
    const templateBlob = await resolveTemplateBlob(template)
    if (!(templateBlob instanceof Blob)) {
      if (cacheKey) psdBaseMaskSourceCache.set(cacheKey, '')
      return ''
    }

    const mod = await import('ag-psd')
    const readPsd = mod.readPsd || mod.default?.readPsd
    if (typeof readPsd !== 'function') {
      if (cacheKey) psdBaseMaskSourceCache.set(cacheKey, '')
      return ''
    }

    const psd = readPsd(new Uint8Array(await templateBlob.arrayBuffer()))
    const layers = Array.isArray(psd?.children) ? psd.children : []
    const isRenderableLayer = (layer) => !!layer && layer.hidden !== true && !!layer.canvas

    let effectLayerIndex = -1
    for (let index = 0; index < layers.length; index += 1) {
      const patternOverlay = layers[index]?.effects?.patternOverlay
      if (patternOverlay && patternOverlay.enabled !== false) {
        effectLayerIndex = index
        break
      }
    }

    let baseLayer = null
    if (effectLayerIndex > 0) {
      for (let index = effectLayerIndex - 1; index >= 0; index -= 1) {
        if (isRenderableLayer(layers[index])) {
          baseLayer = layers[index]
          break
        }
      }
    }
    if (!baseLayer) {
      baseLayer = layers.find(isRenderableLayer) || null
    }
    if (!baseLayer?.canvas) {
      if (cacheKey) psdBaseMaskSourceCache.set(cacheKey, '')
      return ''
    }

    const canvas = document.createElement('canvas')
    canvas.width = Number(psd?.width || baseLayer.canvas.width || 1) || 1
    canvas.height = Number(psd?.height || baseLayer.canvas.height || 1) || 1
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      if (cacheKey) psdBaseMaskSourceCache.set(cacheKey, '')
      return ''
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(
      baseLayer.canvas,
      Math.round(Number(baseLayer.left || 0) || 0),
      Math.round(Number(baseLayer.top || 0) || 0)
    )

    const maskImageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const { data } = maskImageData
    const alphaCutoff = 224
    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3]
      data[index] = 255
      data[index + 1] = 255
      data[index + 2] = 255
      data[index + 3] = alpha >= alphaCutoff ? 255 : 0
    }
    ctx.putImageData(maskImageData, 0, 0)
    output = canvas.toDataURL('image/png')
  } catch (error) {
    console.warn('[merge.step3] extract PSD base mask failed', {
      templateName: template?.name,
      error
    })
  }

  if (cacheKey) psdBaseMaskSourceCache.set(cacheKey, output)
  return output
}

async function findReferencedPatternTemplate(primaryPatternOverlay, excludeTemplateId = selectedTemplate.value?.id) {
  const targetName = normalizeTemplateName(
    primaryPatternOverlay?.pattern?.normalizedName || primaryPatternOverlay?.pattern?.name
  )
  if (!targetName) return null

  const templates = await listStoredTemplates()
  const candidates = templates.filter(template => {
    if (!template || template.id === excludeTemplateId) return false
    return normalizeTemplateName(template.name) === targetName
  })
  if (!candidates.length) return null

  const rankTemplate = (template) => {
    let score = 0
    if (isPsdTemplate(template)) score += 2
    if (template?.meta?.psdRole === 'pattern-source') score += 2
    return score
  }

  candidates.sort((a, b) => {
    const scoreDiff = rankTemplate(b) - rankTemplate(a)
    if (scoreDiff !== 0) return scoreDiff
    return String(b?.uploadTime || '').localeCompare(String(a?.uploadTime || ''))
  })
  return candidates[0]
}

async function resolveTemplateRenderConfig(options = {}) {
  const template = selectedTemplate.value
  const effectTemplate = options?.effectTemplate || template
  const forceSelectedPreview = !!options?.forceSelectedPreview
  if (!template && !effectTemplate) {
    return {
      textureSource: '',
      maskSource: '',
      overlayOpacity: normalizeOpacity(textureOpacity.value) ?? LOCKED_STEP3.textureOpacity,
      usesSeparateMask: false,
      resolvedPatternTemplate: null,
      templateStrategy: 'missing',
      maskProcessing: null
    }
  }

  const selectedSource = await resolveTemplateDataUrl(template || effectTemplate)
  const effectSelectedSource =
    effectTemplate && effectTemplate !== template
      ? await resolveTemplateDataUrl(effectTemplate)
      : selectedSource
  let textureSource = selectedSource
  let maskSource = selectedSource
  let usesSeparateMask = false
  let resolvedPatternTemplate = null
  let templateStrategy = 'selected-preview-direct'
  let maskProcessing = null

  const primaryPatternOverlay = getPrimaryPatternOverlay(effectTemplate)
  const overlayOpacity =
    normalizeOpacity(primaryPatternOverlay?.opacity) ??
    normalizeOpacity(textureOpacity.value) ??
    LOCKED_STEP3.textureOpacity

  if (!forceSelectedPreview && isEffectTemplatePsd(effectTemplate)) {
    resolvedPatternTemplate = await findReferencedPatternTemplate(primaryPatternOverlay, effectTemplate.id)
    const referencedSource = await resolveTemplateDataUrl(resolvedPatternTemplate)
    if (referencedSource) {
      textureSource = referencedSource
      const psdBaseMaskSource = await resolvePsdBaseMaskSource(effectTemplate)
      maskSource = psdBaseMaskSource || effectSelectedSource || selectedSource || referencedSource
      usesSeparateMask = !!maskSource && maskSource !== referencedSource
      templateStrategy = psdBaseMaskSource
        ? 'pattern-source-with-psd-mask'
        : (usesSeparateMask ? 'pattern-source-with-mask' : 'pattern-source-direct')
      if (usesSeparateMask && !psdBaseMaskSource) {
        maskProcessing = {
          mode: 'alpha-harden',
          clearAlpha: 112,
          solidAlpha: 224,
          exponent: 1.05
        }
      }
    } else {
      console.warn('[merge.step3] referenced PSD pattern not found, fallback to selected template preview', {
        templateName: effectTemplate?.name,
        patternName: primaryPatternOverlay?.pattern?.name
      })
    }
  }

  // 纯预览图直出时，如果没有匹配到 PSD 蒙版，最终轮廓仍应服从模板预览自身 alpha，
  // 不能回退为 original/grid 的边缘，否则会出现“没按模板出图”的模糊外沿。
  if (templateStrategy === 'selected-preview-direct' && maskSource && maskSource === textureSource) {
    usesSeparateMask = true
  }

  return {
    textureSource,
    maskSource: maskSource || textureSource,
    overlayOpacity,
    usesSeparateMask,
    resolvedPatternTemplate,
    templateStrategy,
    maskProcessing
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

async function resolveCompositeRenderConfig(options = {}) {
  const projectSource = await resolveProjectMergeSource(options?.projectSourceOptions || {})
  const includeEdgeSource = !!options?.includeEdgeSource
  let edgeProjectSource = null
  if (
    includeEdgeSource &&
    projectSource?.sourceMode === 'baked-preview-original' &&
    shouldTreatProjectAsBakedGridPreview(selectedProject.value)
  ) {
    const rebuiltFromCells = await buildContinuousSourceFromCells(selectedProject.value)
    if (rebuiltFromCells?.src) {
      edgeProjectSource = {
        src: rebuiltFromCells.src,
        sourceMode: 'cells-rebuild',
        sourceInfo: {
          width: rebuiltFromCells.width,
          height: rebuiltFromCells.height
        }
      }
    }
  }
  const renderConfig = await resolveTemplateRenderConfig(options?.templateOptions || {})
  return {
    gridSrc: projectSource?.src || '',
    sourceMode: projectSource?.sourceMode || 'missing',
    sourceInfo: projectSource?.sourceInfo || null,
    edgeGridSrc: edgeProjectSource?.src || '',
    edgeSourceMode: edgeProjectSource?.sourceMode || 'missing',
    edgeSourceInfo: edgeProjectSource?.sourceInfo || null,
    renderConfig
  }
}

async function renderViaPhotopeaPsd(prepared, linkedPsd = null) {
  const selected = selectedTemplate.value
  const template = linkedPsd?.template || selected
  const project = selectedProject.value || null
  const templateBlob = await resolveTemplateBlob(template)
  if (!(templateBlob instanceof Blob)) {
    throw new Error('photopea-template-blob-missing')
  }
  const blobInfo = await inspectTemplateBlob(templateBlob)
  if (blobInfo.ok && !blobInfo.isPsd) {
    throw new Error(`photopea-template-invalid-signature:${blobInfo.signature || 'unknown'}`)
  }
  if (!prepared?.gridSrc) {
    throw new Error(t('merge.step3.errMissingImg'))
  }

  const shouldDeblockGridSource =
    shouldTreatProjectAsBakedGridPreview(project) &&
    prepared?.sourceMode === 'cells-rebuild'
  const safeGridScale = getEffectiveProjectGridScale(project)
  const edgeSource = prepared?.edgeGridSrc || ''
  const result = await renderPsdEffectTemplateWithPhotopea({
    templateBlob,
    source: prepared.gridSrc,
    edgeSource,
    fit: 'stretch',
    templateName: template?.name || 'template.psd',
    sourceName: selectedProject.value?.name || 'project',
    edgeSourceName: edgeSource ? `${selectedProject.value?.name || 'project'}-edge` : '',
    sourcePreprocess: shouldDeblockGridSource && safeGridScale > 0
      ? {
          mode: 'baked-grid-preview',
          cellScale: safeGridScale
        }
      : null
  })

  if (!result?.outputDataUrl) {
    throw new Error('photopea-output-missing')
  }

  nativePsdRenderResult.value = result
  nativePsdRenderResult.value.linkedPsdTemplate = linkedPsd || null
  nativePsdRenderResult.value.selectedTemplate = {
    id: selected?.id || '',
    name: selected?.name || '',
    format: selected?.format || ''
  }
  nativePsdRenderResult.value.sourceMode = prepared?.sourceMode || 'missing'
  nativePsdRenderResult.value.sourceInfo = prepared?.sourceInfo || null
  await drawImageSourceToCanvas(result.outputDataUrl, mergedCanvas.value)
  cleanupPeripheralColorHalo(mergedCanvas.value)
  clearCanvas(effectCanvas.value)

  const finalFullData = mergedCanvas.value.toDataURL('image/png')
  nativePsdRenderResult.value.outputDataUrl = finalFullData
  const finalPreview = createScaledPreview(mergedCanvas.value, 1400, 800)
  mergedFullData.value = finalFullData
  mergedPreview.value = finalPreview
  effectPreview.value = ''
  setMergedImages(finalFullData, '')

  try {
    console.info('[merge.step3] Photopea render metrics', result.metrics || {})
    console.info('[merge.step3] Photopea render runner', result.runner || {})
  } catch (_) {}

  return result
}

async function renderViaNativePsd(prepared, linkedPsd = null) {
  const selected = selectedTemplate.value
  const template = linkedPsd?.template || selected
  const project = selectedProject.value || null
  const templateBlob = await resolveTemplateBlob(template)
  if (!(templateBlob instanceof Blob)) {
    throw new Error('psd-template-blob-missing')
  }
  const blobInfo = await inspectTemplateBlob(templateBlob)
  if (blobInfo.ok && !blobInfo.isPsd) {
    throw new Error(`psd-native-template-invalid-signature:${blobInfo.signature || 'unknown'}`)
  }
  if (!prepared?.gridSrc) {
    throw new Error(t('merge.step3.errMissingImg'))
  }

  const shouldDeblockGridSource =
    shouldTreatProjectAsBakedGridPreview(project) &&
    prepared?.sourceMode === 'cells-rebuild'
  const safeGridScale = getEffectiveProjectGridScale(project)
  const edgeSource = prepared?.edgeGridSrc || ''
  const result = await renderPsdEffectTemplateWithPython({
    templateBlob,
    source: prepared.gridSrc,
    edgeSource,
    fit: 'stretch',
    templateName: template?.name || 'template.psd',
    sourceName: selectedProject.value?.name || 'project',
    edgeSourceName: edgeSource ? `${selectedProject.value?.name || 'project'}-edge` : '',
    sourcePreprocess: shouldDeblockGridSource && safeGridScale > 0
      ? {
          mode: 'baked-grid-preview',
          cellScale: safeGridScale
        }
      : null
  })

  if (!result?.outputDataUrl) {
    throw new Error('psd-native-output-missing')
  }

  nativePsdRenderResult.value = result
  nativePsdRenderResult.value.linkedPsdTemplate = linkedPsd || null
  nativePsdRenderResult.value.selectedTemplate = {
    id: selected?.id || '',
    name: selected?.name || '',
    format: selected?.format || ''
  }
  nativePsdRenderResult.value.sourceMode = prepared?.sourceMode || 'missing'
  nativePsdRenderResult.value.sourceInfo = prepared?.sourceInfo || null
  await drawImageSourceToCanvas(result.outputDataUrl, mergedCanvas.value)
  applyNativeBakedToneFinish(mergedCanvas.value, {
    sourceMode: prepared?.sourceMode || 'missing',
    project
  })
  cleanupPeripheralColorHalo(mergedCanvas.value)
  clearCanvas(effectCanvas.value)

  const finalFullData = mergedCanvas.value.toDataURL('image/png')
  nativePsdRenderResult.value.outputDataUrl = finalFullData
  const finalPreview = createScaledPreview(mergedCanvas.value, 1400, 800)
  mergedFullData.value = finalFullData
  mergedPreview.value = finalPreview
  effectPreview.value = ''
  setMergedImages(finalFullData, '')

  try {
    console.info('[merge.step3] native PSD render metrics', result.metrics || {})
    console.info('[merge.step3] native PSD template blob', {
      templateName: template?.name,
      blobType: templateBlob.type,
      blobSignature: blobInfo.signature
    })
  } catch (_) {}

  return result
}

function loadImageElement(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(t('merge.step3.errImgLoad')))
    img.src = src
  })
}

function drawToCanvas(src, canvasRef) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = canvasRef.value
      if (!canvas) return reject(new Error(t('merge.step3.errNoCanvas')))
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      ctx.clearRect(0,0,canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(img, 0, 0)
      resolve()
    }
    img.onerror = () => reject(new Error(t('merge.step3.errImgLoad')))
    img.src = src
  })
}

async function drawImageSourceToCanvas(src, canvas) {
  if (!canvas) throw new Error(t('merge.step3.errNoCanvas'))
  const img = await loadImageElement(src)
  canvas.width = img.naturalWidth || img.width || 1
  canvas.height = img.naturalHeight || img.height || 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error(t('merge.step3.errNoCanvas'))
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0)
}

function clearCanvas(canvas) {
  if (!canvas) return
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (ctx) ctx.clearRect(0, 0, 1, 1)
}

function hardenMaskAlpha(imageData, processing = null) {
  if (!imageData?.data || !processing || processing.mode !== 'alpha-harden') return false
  const clearAlpha = Math.max(0, Math.min(254, Number(processing.clearAlpha || 0) || 0))
  const solidAlpha = Math.max(clearAlpha + 1, Math.min(255, Number(processing.solidAlpha || 255) || 255))
  const exponent = Math.max(0.5, Number(processing.exponent || 1) || 1)
  const data = imageData.data
  let changed = false

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3]
    let nextAlpha = alpha
    if (alpha <= clearAlpha) {
      nextAlpha = 0
    } else if (alpha >= solidAlpha) {
      nextAlpha = 255
    } else {
      const t = (alpha - clearAlpha) / (solidAlpha - clearAlpha)
      nextAlpha = Math.max(0, Math.min(255, Math.round(Math.pow(t, exponent) * 255)))
    }
    if (nextAlpha !== alpha) {
      data[i + 3] = nextAlpha
      changed = true
    }
  }

  return changed
}

function neutralizeTransparentEdgeRgb(targetCanvas) {
  if (!targetCanvas) return false
  const width = Number(targetCanvas.width || 0) || 0
  const height = Number(targetCanvas.height || 0) || 0
  if (width <= 0 || height <= 0) return false

  const ctx = targetCanvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  let changed = false

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3]
    if (alpha === 255) continue
    if (alpha === 0) {
      if (data[index] !== 0 || data[index + 1] !== 0 || data[index + 2] !== 0) {
        data[index] = 0
        data[index + 1] = 0
        data[index + 2] = 0
        changed = true
      }
      continue
    }

    const scale = alpha / 255
    const nextR = Math.max(0, Math.min(255, Math.round(data[index] * scale)))
    const nextG = Math.max(0, Math.min(255, Math.round(data[index + 1] * scale)))
    const nextB = Math.max(0, Math.min(255, Math.round(data[index + 2] * scale)))
    if (nextR !== data[index] || nextG !== data[index + 1] || nextB !== data[index + 2]) {
      data[index] = nextR
      data[index + 1] = nextG
      data[index + 2] = nextB
      changed = true
    }
  }

  if (!changed) return false
  ctx.putImageData(imageData, 0, 0)
  return true
}

async function applyCanvasAlphaMask(targetCanvas, maskSource, maskProcessing = null) {
  if (!targetCanvas || !maskSource) return
  const maskTarget = maskCanvas.value || document.createElement('canvas')
  const maskImage = await loadImageElement(maskSource)
  maskTarget.width = targetCanvas.width
  maskTarget.height = targetCanvas.height
  const maskCtx = maskTarget.getContext('2d', { willReadFrequently: true })
  if (!maskCtx) throw new Error(t('merge.step3.errNoCanvas'))
  maskCtx.clearRect(0, 0, maskTarget.width, maskTarget.height)
  const sameSize =
    Number(maskImage.naturalWidth || maskImage.width || 0) === maskTarget.width &&
    Number(maskImage.naturalHeight || maskImage.height || 0) === maskTarget.height
  maskCtx.imageSmoothingEnabled = !sameSize
  maskCtx.imageSmoothingQuality = 'high'
  maskCtx.drawImage(maskImage, 0, 0, maskTarget.width, maskTarget.height)
  if (maskProcessing) {
    const maskImageData = maskCtx.getImageData(0, 0, maskTarget.width, maskTarget.height)
    if (hardenMaskAlpha(maskImageData, maskProcessing)) {
      maskCtx.putImageData(maskImageData, 0, 0)
    }
  }

  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true })
  if (!targetCtx) throw new Error(t('merge.step3.errNoCanvas'))
  targetCtx.save()
  targetCtx.globalCompositeOperation = 'destination-in'
  targetCtx.drawImage(maskTarget, 0, 0)
  targetCtx.restore()
}

async function applyResolvedMask(targetCanvas, renderConfig) {
  if (!renderConfig?.usesSeparateMask || !renderConfig.maskSource) return
  await applyCanvasAlphaMask(targetCanvas, renderConfig.maskSource, renderConfig.maskProcessing || null)
  neutralizeTransparentEdgeRgb(targetCanvas)
}

function adjustCanvasSize(canvas, w, h) { if (canvas) { canvas.width = w; canvas.height = h } }

async function renderMergedForExport(prepared = null) {
  const nativeReadyData =
    nativePsdRenderResult.value?.outputDataUrl ||
    (shouldPreferNativePsdRender(selectedTemplate.value) ? mergedFullData.value : '')
  if (nativeReadyData) {
    await drawImageSourceToCanvas(nativeReadyData, mergedCanvas.value)
    return mergedCanvas.value
  }

  const ok = await ensureEnv()
  if (!ok) throw new Error(t('merge.step3.errEnv'))
  const linkedPsd = await resolveLinkedPsdEffectTemplate(selectedTemplate.value)
  const activePrepared = prepared || await resolveCompositeRenderConfig(
    linkedPsd
      ? {
          templateOptions: {
            effectTemplate: linkedPsd.template
          }
        }
      : {}
  )
  if (!activePrepared.gridSrc || !activePrepared.renderConfig.textureSource) {
    throw new Error(t('merge.step3.errMissingImg'))
  }

  let gridMat = null
  let templMat = null
  let merged = null
  try {
    await drawToCanvas(activePrepared.gridSrc, gridCanvas)
    await drawToCanvas(activePrepared.renderConfig.textureSource, templateCanvas)
    const cv = window.cv
    gridMat = cv.imread(gridCanvas.value)
    templMat = cv.imread(templateCanvas.value)

    // Use a dedicated high-quality instance for export.
    const exportBrushify = new window.BrushifyJS()
    applyMergeNeutralParams(exportBrushify)
    // Export-only quality profile: keep more detail, reduce over-smoothing.
    exportBrushify.params.compositeMaxPixels = 36000000 // up to ~36MP before downsample
    // 线性光路径再抬高上限（与 composite 取 max），尽量在全分辨率上做网页型叠加，逼近 PS
    exportBrushify.params.linearLightCompositeMaxPixels = 72000000
    exportBrushify.params.pixelArtSmoothPasses = 1
    exportBrushify.params.pixelArtBlurSigma = 2.2
    exportBrushify.params.pixelArtEdgeSoften = 0.86
    exportBrushify.params.pixelArtSharpenAmount = 1.25
    exportBrushify.params.pixelArtSharpenSigma = 0.8
    exportBrushify.params.pixelArtEdgeSharpenMix = 1.0
    //  generate() 
    const pair = exportBrushify.psPatternOverlayComposite(
      gridMat,
      templMat,
      resizeTemplateToGrid.value ? false : true,
      activePrepared.renderConfig.overlayOpacity
    )
    if (!pair || !pair.merged || pair.merged.empty()) {
      throw new Error(t('merge.step3.errExport'))
    }
    merged = pair.merged
    // Optional 2x upscale for export-only supersampling.
    if (Number(exportScale.value || 1) > 1) {
      const up = new cv.Mat()
      const fx = Number(exportScale.value || 1)
      cv.resize(
        merged,
        up,
        new cv.Size(Math.round(merged.cols * fx), Math.round(merged.rows * fx)),
        0,
        0,
        cv.INTER_CUBIC
      )
      merged.delete()
      merged = up
    }

    const sharpness = Math.max(0, Math.min(100, Number(exportSharpness.value || 0))) / 100
    if (sharpness > 0) {
      const amount = 0.12 + 0.78 * sharpness
      const sigma = Math.max(0.6, 1.0 - 0.35 * sharpness)
      const blur = new cv.Mat()
      const sharp = new cv.Mat()
      cv.GaussianBlur(merged, blur, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT)
      cv.addWeighted(merged, 1.0 + amount, blur, -amount, 0, sharp)
      merged.delete()
      merged = sharp
      blur.delete()
    }

    adjustCanvasSize(mergedCanvas.value, merged.cols, merged.rows)
    cv.imshow(mergedCanvas.value, merged)
    await applyResolvedMask(mergedCanvas.value, activePrepared.renderConfig)
    if (pair.effect) pair.effect.delete()
    return mergedCanvas.value
  } finally {
    try {
      if (gridMat) gridMat.delete()
      if (templMat) templMat.delete()
      if (merged) merged.delete()
    } catch(_) {}
  }
}

async function download(which, format) {
  let src = which === 'merged' ? mergedCanvas.value : effectCanvas.value
  if (!src) return
  try {
    if (which === 'merged') {
      statusMessage.value = t('merge.step3.exportBusy')
      statusError.value = false
      src = await renderMergedForExport()
    }
  } catch (e) {
    console.warn('[download] high-quality export fallback:', e)
    src = which === 'merged' ? mergedCanvas.value : effectCanvas.value
  } finally {
    if (!isGenerating.value) statusMessage.value = ''
  }
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpeg' ? 1.0 : 1.0
  const dataUrl = src.toDataURL(mime, quality)
  const a = document.createElement('a')
  const ts = new Date().toISOString().replace(/[-:T]/g,'').slice(0,14)
  const proj = selectedProject.value?.name || 'project'
  const tmpl = selectedTemplate.value?.name || 'template'
  a.download = `${proj}_${tmpl}_${which}_${ts}.${format}`
  a.href = dataUrl
  a.click()
}

function createScaledPreview(canvas, maxW=1400, maxH=800){
  const w = canvas.width, h = canvas.height
  const ratio = Math.min(1, maxW / w, maxH / h)
  if(ratio >= 1) return canvas.toDataURL('image/png')
  const c = document.createElement('canvas')
  c.width = Math.round(w * ratio)
  c.height = Math.round(h * ratio)
  const g = c.getContext('2d')
  // keep preview crisp when downscaling
  if(g){
    g.imageSmoothingEnabled = true
    g.imageSmoothingQuality = 'high'
  }
  g.drawImage(canvas, 0,0, c.width, c.height)
  return c.toDataURL('image/png')
}
</script>

<style scoped>
.step-card.merge-step {
  --merge-surface: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(248,250,252,0.88));
  --merge-surface-soft: rgba(255,255,255,0.7);
  --merge-border: rgba(148,163,184,0.22);
  --merge-text: #172033;
  --merge-text-soft: #526072;
  --merge-text-muted: #7c8b9d;
  --merge-control-h: 42px;
  --merge-control-radius: 12px;
  --merge-gap: 12px;
  background: var(--merge-surface);
  border: 1px solid var(--merge-border);
  border-radius: 28px;
  padding:26px 30px 34px;
  box-shadow:0 24px 48px -34px rgba(15,23,42,0.3);
  backdrop-filter:saturate(180%) blur(30px);
}
.card-title { margin:0 0 18px; font-size:20px; font-weight:700; color: var(--merge-text); }
.env-wait { display:flex; flex-direction:column; align-items:center; gap:12px; padding:40px 0; }
.spinner { width:40px; height:40px; border:4px solid #d0d5dc; border-top-color:#409eff; border-radius:50%; animation:spin 1s linear infinite; }
.controls {
  display:flex;
  flex-direction:column;
  gap:14px;
  margin-bottom:24px;
  padding: 18px;
  border: 1px solid var(--merge-border);
  border-radius: 22px;
  background: rgba(248,250,252,0.82);
}
.brightness-control { max-width:420px; }
.blend-control { max-width:420px; display:flex; align-items:center; gap:10px; }
.blend-control .ctrl-label { font-size:13px; color:var(--merge-text-soft); white-space:nowrap; min-width:100px; }
.blend-control.math-line { flex-direction:column; align-items:flex-start; gap:8px; }
.blend-control.math-line .el-radio-group { display:flex; flex-wrap:wrap; gap:4px 12px; }
.blend-control .el-slider { flex:1; }
.option-line { max-width:520px; font-size:13px; color:var(--merge-text-soft); }
.option-line.dual {
  display:flex;
  flex-direction:column;
  gap:10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(255,255,255,0.78);
  border: 1px solid var(--merge-border);
}
.actions {
  display:flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--merge-gap);
}
.actions :deep(.el-button) {
  min-height: var(--merge-control-h);
  padding-inline: 18px;
  border-radius: var(--merge-control-radius);
  font-weight: 600;
}
.status {
  align-self: flex-start;
  padding: 8px 12px;
  border-radius: 999px;
  font-size:13px;
  color:#409eff;
  background: rgba(37,99,235,0.08);
  border: 1px solid rgba(37,99,235,0.16);
}
.status.error { color:#ff4d4f; }
.status.warn {
  color: #b26b00;
  background: rgba(245, 158, 11, 0.12);
  border-color: rgba(245, 158, 11, 0.24);
}
.result-panels { display:flex; flex-wrap:wrap; gap:20px; }
.result-box {
  flex:1 1 380px;
  min-width:320px;
  background:rgba(255,255,255,0.72);
  border:1px solid var(--merge-border);
  border-radius:22px;
  padding:20px;
  box-shadow: 0 20px 34px -30px rgba(15,23,42,0.65);
}
.box-title { margin:0 0 12px; font-size:16px; font-weight:700; color: var(--merge-text); }
.zoom-bar { display:flex; align-items:center; gap:12px; margin:6px 0 10px; }
.zoom-left { min-width:88px; font-size:12px; color:var(--merge-text-soft); }
.zoom-label { font-variant-numeric: tabular-nums; }
.zoom-mid { flex:1 1 auto; min-width:140px; }
.zoom-right { display:flex; flex-wrap: wrap; align-items: stretch; gap:8px; }
.zoom-right :deep(.el-button) {
  min-height: 36px;
  padding-inline: 14px;
  border-radius: 10px;
  font-weight: 600;
}
.image-wrapper {
  position:relative;
  width:100%;
  height:520px;
  overflow:auto;
  background:#f5f7fa;
  border-radius:16px;
  border: 1px solid rgba(203,213,225,0.82);
}
.zoom-img { display:block; max-width:none; max-height:none; width:auto; height:auto; }
.hidden-canvas { display:none; }
.download-actions {
  margin-top:14px;
  display:flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: var(--merge-gap);
  padding-top: 14px;
  border-top: 1px solid var(--merge-border);
}
.download-actions :deep(.el-button) {
  min-height: var(--merge-control-h);
  padding-inline: 16px;
  border-radius: var(--merge-control-radius);
  font-weight: 600;
}
.export-tuning { display:flex; align-items:center; gap:8px; min-width: 220px; }
.export-tuning.scale-line { min-width: 150px; }
.tuning-label { font-size: 12px; color:var(--merge-text-soft); white-space: nowrap; }
.tuning-value { font-size: 12px; color:#409eff; min-width: 24px; text-align: right; }
.sharpness-slider { width: 120px; }
.work-canvas-holder { position:absolute; left:-10000px; top:-10000px; }
@keyframes spin { to { transform:rotate(360deg); } }
@media (prefers-color-scheme: dark) {
  .step-card.merge-step {
    --merge-surface: linear-gradient(180deg, rgba(17,24,39,0.94), rgba(15,23,42,0.86));
    --merge-surface-soft: rgba(30,41,59,0.72);
    --merge-border: rgba(71,85,105,0.42);
    --merge-text: #e5edf7;
    --merge-text-soft: #c4cfdb;
    --merge-text-muted: #94a3b8;
    background: var(--merge-surface);
    border:1px solid var(--merge-border);
  }
  .controls,
  .option-line.dual,
  .result-box {
    background:rgba(15,23,42,0.6);
    border:1px solid var(--merge-border);
  }
  .image-wrapper { background:#2f3235; }
  .option-line { color:var(--merge-text-soft); }
  .status {
    background: rgba(37,99,235,0.14);
    border-color: rgba(96,165,250,0.2);
  }
}

@media (max-width: 768px) {
  .step-card.merge-step {
    padding: 22px 18px 26px;
  }

  .controls {
    padding: 14px;
  }

  .zoom-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .zoom-left,
  .zoom-mid,
  .zoom-right {
    width: 100%;
    min-width: 0;
  }

  .actions,
  .download-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .result-box {
    min-width: 0;
  }

  .image-wrapper {
    height: 420px;
  }
}
</style>
