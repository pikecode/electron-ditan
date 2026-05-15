<template>
  <div class="project-form-container">
    <el-form
      ref="formRef"
      :model="formData"
      :rules="formRules"
      label-width="80px"
      class="project-form"
    >
      
      <el-card class="form-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon><document /></el-icon>
            <span>{{ t('projectForm.cardInfo') }}</span>
          </div>
        </template>
        <el-form-item :label="t('projectForm.projectName')" prop="name">
          <el-input
            v-model="formData.name"
            :placeholder="t('projectForm.projectNamePh')"
            clearable
            style="width: 300px;"
          />
        </el-form-item>
      </el-card>

      
      <el-card class="form-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon><document /></el-icon>
            <span>{{ t('projectForm.cardImport') }}</span>
          </div>
        </template>
        <el-form-item :label="t('projectForm.importMethod')">
          <el-radio-group v-model="importType">
            <el-radio label="image">{{ t('projectForm.importImage') }}</el-radio>
            <el-radio label="xsd">{{ t('projectForm.importXsd') }}</el-radio>
          </el-radio-group>
        </el-form-item>
        
        
        <el-form-item v-if="importType === 'image'" prop="image.path">
          <div class="upload-section">
            <div v-if="!imagePreview"
                 class="upload-area"
                 :class="{'drag-hover': dragHover}"
                 @click="triggerUpload"
                 @dragover.prevent="onDragOver"
                 @dragleave.prevent="onDragLeave"
                 @drop.prevent="onDrop">
              <el-icon class="upload-icon"><upload-filled /></el-icon>
              <div class="upload-text">{{ t('projectForm.uploadImageText') }}</div>
              <div class="upload-tip">{{ t('projectForm.uploadImageTip') }}</div>
            </div>
            <div v-else class="uploaded-image"
                 @dragover.prevent="onDragOver"
                 @dragleave.prevent="onDragLeave"
                 @drop.prevent="onDrop"
                 :class="{'drag-hover': dragHover}">
              <img :src="imagePreview" :alt="t('projectForm.previewAlt')" />
              <div class="image-actions">
                <el-button size="small" @click="triggerUpload">{{ t('projectForm.reselect') }}</el-button>
                <el-button size="small" type="danger" @click="removeImage">{{ t('projectForm.remove') }}</el-button>
              </div>
              <div class="image-info">
                <div class="info-item">
                  <span class="info-label">{{ t('projectForm.dim') }}:</span>
                  <span>{{ formData.image.size.width }} × {{ formData.image.size.height }} px</span>
                </div>
                <div class="info-item">
                  <span class="info-label">{{ t('projectForm.ratio') }}:</span>
                  <span>{{ imageRatio }}</span>
                </div>
              </div>
              <div class="drop-replace-hint" v-if="dragHover">{{ t('projectForm.dropReplaceImage') }}</div>
            </div>
            <input
              ref="fileInput"
              type="file"
              :accept="imageAcceptTypes"
              style="display: none"
              @change="handleFileSelect"
            />
          </div>
        </el-form-item>
        
        
        <el-form-item v-else-if="importType === 'xsd'" prop="xsd.path">
          <div class="upload-section">
            <div v-if="!xsdFile"
                 class="upload-area"
                 :class="{'drag-hover': xsdDragHover}"
                 @click="triggerXsdUpload"
                 @dragover.prevent="onXsdDragOver"
                 @dragleave.prevent="onXsdDragLeave"
                 @drop.prevent="onXsdDrop">
              <el-icon class="upload-icon"><upload-filled /></el-icon>
              <div class="upload-text">{{ t('projectForm.uploadXsdText') }}</div>
              <div class="upload-tip">{{ t('projectForm.uploadXsdTip') }}</div>
            </div>
            <div v-else class="uploaded-file"
                 @dragover.prevent="onXsdDragOver"
                 @dragleave.prevent="onXsdDragLeave"
                 @drop.prevent="onXsdDrop"
                 :class="{'drag-hover': xsdDragHover}">
              <div class="file-info">
                <el-icon class="file-icon"><document /></el-icon>
                <div class="file-details">
                  <div class="file-name">{{ xsdFile.name }}</div>
                  <div class="file-size">{{ formatFileSize(xsdFile.size) }}</div>
                </div>
              </div>
              <div class="image-actions">
                <el-button size="small" @click="triggerXsdUpload">{{ t('projectForm.reselect') }}</el-button>
                <el-button size="small" type="danger" @click="removeXsdFile">{{ t('projectForm.remove') }}</el-button>
              </div>
              <div class="drop-replace-hint" v-if="xsdDragHover">{{ t('projectForm.dropReplaceFile') }}</div>
            </div>
            <input
              ref="xsdFileInput"
              type="file"
              accept=".xsd"
              style="display: none"
              @change="handleXsdFileSelect"
            />
          </div>
        </el-form-item>
      </el-card>

      
      <el-card class="form-card" shadow="never">
        <template #header>
          <div class="card-header">
            <el-icon><grid /></el-icon>
            <span>{{ t('projectForm.cardGridColor') }}</span>
          </div>
        </template>
        
        
        <div class="section-divider">
          <el-icon><grid /></el-icon>
          <span>{{ t('projectForm.gridSettings') }}</span>
        </div>
        
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item :label="t('projectForm.gridLength')" prop="grid.length">
              <el-input-number
                v-model="formData.grid.length"
                :min="1"
                :max="200"
                :placeholder="t('projectForm.phLength')"
                @change="calculateGridWidth"
                style="width: 150px;"
                controls-position="right"
              />
              <span class="unit">{{ t('projectForm.cellsUnit') }}</span>
              <div class="field-hint">{{ t('projectForm.hintCols') }}</div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item :label="t('projectForm.gridWidth')">
              <el-input-number
                :model-value="formData.grid.width"
                :disabled="importType === 'image'"
                :placeholder="importType === 'image' ? t('projectForm.autoWidth') : t('projectForm.phWidth')"
                style="width: 150px;"
                controls-position="right"
              />
              <span class="unit">{{ t('projectForm.cellsUnit') }}</span>
              <div class="field-hint">{{ t('projectForm.hintRows') }}</div>
            </el-form-item>
          </el-col>
        </el-row>

        
        <div class="section-divider">
          <el-icon><brush /></el-icon>
          <span>{{ t('projectForm.colorConfig') }}</span>
        </div>
        
        
        <el-form-item :label="t('projectForm.colorGroup')" prop="colorConfig.colorGroupId">
          <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
            <el-select
              v-model="formData.colorConfig.colorGroupId"
              :placeholder="t('projectForm.selectGroupPh')"
              :loading="loadingGroups"
              :disabled="loadingGroups"
              @change="handleColorGroupSelect"
              style="width: 250px;"
            >
              <el-option
                v-for="group in extendedColorGroups"
                :key="group.id"
                :label="formatGroupLabel(group)"
                :value="group.id"
              />
            </el-select>
            <div v-if="currentGroupColors.length" style="display:flex; align-items:center; gap:8px;">
              <span style="color: var(--el-text-color-secondary); font-size:13px;">{{ t('projectForm.colorCountLabel') }}</span>
              <el-input-number
                v-model="formData.colorConfig.colorCount"
                :min="1"
                :max="groupMaxColorCount"
                :disabled="!currentGroupColors.length"
                style="width:140px;"
                controls-position="right"
              />
              <span class="unit">/{{ groupMaxColorCount }}</span>
            </div>
          </div>
        </el-form-item>
        
        
        <div class="color-preview">
          <template v-if="currentGroupColors.length">
            <div v-if="formData.colorConfig.colorCount && formData.colorConfig.colorCount < groupMaxColorCount" class="count-info" style="margin-bottom:12px;">
              <el-icon class="info-icon"><info-filled /></el-icon>
              <span>{{ t('projectForm.colorPickHint', { max: groupMaxColorCount, n: formData.colorConfig.colorCount }) }}</span>
            </div>
          </template>
          <div v-if="previewColors.length > 0" class="color-swatches full-list">
            <div
              v-for="color in previewColors"
              :key="color.id"
              class="color-swatch-container"
            >
              <div
                class="color-swatch"
                :style="{ backgroundColor: color.hex }"
                :title="`${color.name} (${color.hex})`"
              />
              <div class="color-info">
                <div class="color-id">{{ color.id }}</div>
                <div class="color-name">{{ color.name }}</div>
              </div>
            </div>
          </div>
          <div v-else class="no-colors">
            {{ t('projectForm.pickGroupFirst') }}
          </div>
        </div>
      </el-card>
    </el-form>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage } from 'element-plus'
import { 
  Document, 
  Grid, 
  Brush, 
  Picture, 
  UploadFilled, 
  InfoFilled 
} from '@element-plus/icons-vue'
import { useColorManagement } from '../../composables/useColorManagement.js'
import { useColorGroups } from '../../composables/useColorGroups.js'
import { useProjectStorage } from '../../composables/useProjectStorage.js'
import { parseXsdDisplayMetadata } from '../../core/xsd/XsdDisplayParser.js'
import { buildImageCellsMatrix, resolveImagePaletteColors } from '../../core/project/buildImageCellsMatrix.js'
import {
  CUTOUT_CELL_ID,
  TRANSPARENT_CELL_COLOR,
  isCutoutCellId,
  isDefaultCellId,
  isTransparentCellColor
} from '../../core/cellState.js'
import {
  buildPersistedXsdParsed,
  hydratePersistedXsdParsed,
  hasPersistedXsdRebuildPayload
} from '../../utils/xsdProjectPersistence.js'

export default {
  name: 'ProjectForm',
  components: {
    Document,
    Grid,
    Brush,
    Picture,
    UploadFilled,
    InfoFilled
  },
  props: {
    initialData: {
      type: Object,
      default: null
    },
    isEditMode: {
      type: Boolean,
      default: false
    }
  },
  emits: ['submit', 'cancel'],
  setup(props, { emit }) {
    const { t, locale } = useI18n()
    const formRef = ref(null)
    const fileInput = ref(null)
    const xsdFileInput = ref(null)
    
    // 
    const { generateDefaultProjectName } = useProjectStorage()
    const { 
      colorPalette, 
      loadingColors, 
      loadColorPalettes 
    } = useColorManagement()
    
    // 
    const { 
      colorGroups, 
      loadColorGroups,
      isLoading: loadingGroups 
    } = useColorGroups({ autoLoad: false })

    const createDefaultFormData = () => ({
      name: '',
      image: {
        path: null,
        name: null,
        size: { width: null, height: null },
        thumbnail: null,
        data: null
      },
      xsd: {
        path: null,
        name: null,
        size: null
      },
      grid: {
        length: null,
        width: null,
        cellSize: null
      },
      colorConfig: {
        //  group 
        type: 'group',
        colorGroupId: null,
        colorCount: null,
        selectedColors: []
      }
    })

    const buildFormDataFromInitial = (initialData) => {
      const defaults = createDefaultFormData()
      const source = initialData || {}
      return {
        ...defaults,
        ...source,
        image: {
          ...defaults.image,
          ...(source.image || {}),
          size: {
            ...defaults.image.size,
            ...(source.image?.size || {})
          }
        },
        xsd: {
          ...defaults.xsd,
          ...(source.xsd || {})
        },
        grid: {
          ...defaults.grid,
          ...(source.grid || {})
        },
        colorConfig: {
          ...defaults.colorConfig,
          ...(source.colorConfig || {}),
          selectedColors: Array.isArray(source.colorConfig?.selectedColors)
            ? source.colorConfig.selectedColors.map(color => ({ ...color }))
            : []
        }
      }
    }

    const formData = ref(createDefaultFormData())
    
    // 
    const importType = ref('image')
    
    // 
    const imagePreview = ref(null)
    const imagePreviewObjectUrl = ref(null)
    const selectedImageFile = ref(null)
    const imageAcceptTypes = '.jpg,.jpeg,.png,.bmp'
    
    // XSD
    const xsdFile = ref(null)
    const xsdParseResult = ref(null)
    const isHydratingForm = ref(false)
    
    // 
    const dragHover = ref(false)
    const xsdDragHover = ref(false)
    //  Apifox /  POST  nginx/Vite  200  body
    const XSD_PARSE_API_URL = 'https://plan007.cn/xsd-convert/api/xsd/parse'
    
    function sortColorGroupsByTimeDesc(groups) {
      return [...groups].sort((a, b) => {
        const ta = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime()
        const tb = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime()
        return tb - ta
      })
    }

    // 有自定义分组时只展示分组（按更新时间/创建时间倒序）；无分组时仅展示系统「全部颜色」
    const extendedColorGroups = computed(() => {
      locale.value
      const allGroup = { id: 'ALL', name: t('projectForm.allColorsGroup'), colors: colorPalette.value || [] }
      const raw = colorGroups.value || []
      if (raw.length > 0) return sortColorGroupsByTimeDesc(raw)
      return [allGroup]
    })

    function formatGroupLabel(group) {
      return t('projectForm.groupOption', { name: group.name, n: group.colors?.length || 0 })
    }

    // 
    const currentGroupColors = computed(() => {
      if (!formData.value.colorConfig.colorGroupId) return []
      if (formData.value.colorConfig.colorGroupId === 'ALL') return colorPalette.value || []
      const selectedGroup = extendedColorGroups.value.find(g => g.id === formData.value.colorConfig.colorGroupId)
      return selectedGroup ? (selectedGroup.colors || []) : []
    })

    //  = 
    const groupMaxColorCount = computed(() => currentGroupColors.value.length || 0)

    const resolveRequestedColorCount = (paletteColors = currentGroupColors.value, preferredCount = formData.value.colorConfig.colorCount) => {
      const max = Array.isArray(paletteColors) ? paletteColors.length : 0
      if (!max) return 0
      const requested = Math.floor(Number(preferredCount))
      if (!Number.isFinite(requested) || requested <= 0) {
        return max
      }
      return Math.min(max, requested)
    }

    //  ( colorCount )
    const previewColors = computed(() => {
      // colorCount 
      return currentGroupColors.value
    })

    // 
    const generateTimestampName = () => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      return `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`
    }
    
    const defaultProjectName = ref(generateTimestampName())
    
    //  (,  + )
    const formRules = computed(() => {
      locale.value
      return {
        name: [
          { required: true, message: t('projectForm.rules.nameRequired'), trigger: 'blur' },
          { min: 1, max: 50, message: t('projectForm.rules.nameLen'), trigger: 'blur' }
        ],
        'image.path': [
          {
            validator: (rule, value, callback) => {
              if (importType.value === 'image' && !value) {
                callback(new Error(t('projectForm.rules.needImage')))
              } else {
                callback()
              }
            },
            trigger: 'change'
          }
        ],
        'xsd.path': [
          {
            validator: (rule, value, callback) => {
              if (importType.value === 'xsd' && !value) {
                callback(new Error(t('projectForm.rules.needXsd')))
              } else {
                callback()
              }
            },
            trigger: 'change'
          }
        ],
        'grid.length': [
          { required: true, message: t('projectForm.rules.gridLenRequired'), trigger: 'blur' },
          { type: 'number', min: 1, max: 200, message: t('projectForm.rules.gridLenRange'), trigger: 'blur' }
        ],
        'grid.cellSize': [
          { required: true, message: t('projectForm.rules.cellSizeRequired'), trigger: 'blur' },
          { type: 'number', min: 0.1, max: 10, message: t('projectForm.rules.cellSizeRange'), trigger: 'blur' }
        ],
        'colorConfig.colorGroupId': [
          {
            validator: (rule, value, callback) => {
              if (!value) callback(new Error(t('projectForm.rules.pickGroup')))
              else callback()
            },
            trigger: 'change'
          }
        ],
        'colorConfig.colorCount': [
          {
            validator: (rule, value, callback) => {
              if (!formData.value.colorConfig.colorGroupId) { callback(); return }
              if (!value) { callback(new Error(t('projectForm.rules.colorCountRequired'))); return }
              if (value <= 0) { callback(new Error(t('projectForm.rules.colorCountPositive'))); return }
              if (value > groupMaxColorCount.value) {
                callback(new Error(t('projectForm.rules.colorCountMax', { max: groupMaxColorCount.value })))
                return
              }
              callback()
            },
            trigger: 'blur'
          }
        ]
      }
    })

    const imageRatio = computed(() => {
      if (!formData.value.image.size.width || !formData.value.image.size.height) {
        return ''
      }
      const gcd = (a, b) => b === 0 ? a : gcd(b, a % b)
      const divisor = gcd(formData.value.image.size.width, formData.value.image.size.height)
      const ratioW = formData.value.image.size.width / divisor
      const ratioH = formData.value.image.size.height / divisor
      return `${ratioW}:${ratioH}`
    })

    //  ()
    const clearImagePreviewObjectUrl = () => {
      if (!imagePreviewObjectUrl.value) return
      URL.revokeObjectURL(imagePreviewObjectUrl.value)
      imagePreviewObjectUrl.value = null
    }

    const setImagePreview = (src, { isObjectUrl = false } = {}) => {
      clearImagePreviewObjectUrl()
      if (isObjectUrl && src) {
        imagePreviewObjectUrl.value = src
      }
      imagePreview.value = src || null
    }

    const triggerUpload = () => { fileInput.value?.click() }
    const handleFile = async (file) => {
      if(!file) return
      const acceptList = ['image/jpeg','image/jpg','image/png','image/bmp']
      if(!acceptList.includes(file.type)) { ElMessage.error(t('projectForm.errUnsupportedImage')); return }
      if(file.size > 20 * 1024 * 1024){ ElMessage.error(t('projectForm.errFile20')); return }
      try {
        const imageData = await readImageFile(file)
        selectedImageFile.value = file
        formData.value.image = {
          path: file.path || file.name,
          name: file.name,
          size: { width: imageData.width, height: imageData.height },
          thumbnail: null,
          data: null
        }
        setImagePreview(imageData.previewUrl, { isObjectUrl: true })
        calculateGridWidth()
        formRef.value?.validateField('image.path')
      } catch (e) { console.error(e); ElMessage.error(t('projectForm.errImageLoad')) }
    }
    const handleFileSelect = (e)=> { const file = e.target.files[0]; handleFile(file) }
    const onDragOver = () => { dragHover.value = true }
    const onDragLeave = () => { dragHover.value = false }
    const onDrop = (e) => { dragHover.value = false; const files = e.dataTransfer?.files; if(files && files.length){ handleFile(files[0]) } }
    const removeImage = ({ validate = true } = {}) => {
      selectedImageFile.value = null
      formData.value.image = { path: null, name: null, size: { width: null, height: null }, thumbnail: null, data: null }
      setImagePreview(null)
      if (fileInput.value) fileInput.value.value = ''
      if (validate) {
        formRef.value?.validateField('image.path')
      }
    }
    const readImageFile = (file) => new Promise((resolve, reject) => {
      const previewUrl = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        previewUrl
      })
      img.onerror = () => {
        URL.revokeObjectURL(previewUrl)
        reject(new Error(t('projectForm.errDecodeImageFile')))
      }
      img.src = previewUrl
    })
    const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target?.result || '')
      reader.onerror = () => reject(new Error(t('projectForm.errReadFileBrowser')))
      reader.readAsDataURL(file)
    })
    const ensureCurrentImageDataUrl = async () => {
      const existing = formData.value.image?.data || formData.value.image?.thumbnail
      if (existing && typeof existing === 'string' && existing.startsWith('data:')) {
        return existing
      }
      if (!selectedImageFile.value) {
        throw new Error(t('projectForm.errImageLoad'))
      }
      const dataUrl = await readFileAsDataUrl(selectedImageFile.value)
      formData.value.image = {
        ...formData.value.image,
        thumbnail: dataUrl,
        data: dataUrl
      }
      return dataUrl
    }

    // XSD Apifox POST multipart/form-data file
    const triggerXsdUpload = () => { xsdFileInput.value?.click() }

    
    function ensureDataUriImage(b64) {
      if (b64 == null || typeof b64 !== 'string') return null
      const s = b64.trim()
      if (!s) return null
      if (s.startsWith('data:image')) return s
      if (s.startsWith('data:')) return s
      const idx = s.indexOf('base64,')
      if (idx !== -1) {
        const rest = s.slice(idx + 7).replace(/\s/g, '')
        return 'data:image/png;base64,' + rest
      }
      return 'data:image/png;base64,' + s.replace(/\s/g, '')
    }

    
    function normalizeStitch(st) {
      if (!st || typeof st !== 'object') return null
      const x = Number(st.x ?? st.gridX ?? st.grid_x ?? 0)
      const y = Number(st.y ?? st.gridY ?? st.grid_y ?? 0)
      const colorIndex = Number(
        st.colorIndex ?? st.color_index ?? st.palindex ?? st.palIndex ?? 0
      )
      return { x, y, colorIndex }
    }

    
    function normalizeXsdPayload(inner) {
      if (!inner || typeof inner !== 'object') {
        throw new Error(t('projectForm.xsdBizFail'))
      }
      const stitchesRaw = Array.isArray(inner.stitches) ? inner.stitches : []
      const stitches = stitchesRaw.map(normalizeStitch).filter(Boolean)
      return {
        ...inner,
        imageBase64: ensureDataUriImage(inner.imageBase64),
        imageWidth: Number(inner.imageWidth ?? inner.image_width ?? 0),
        imageHeight: Number(inner.imageHeight ?? inner.image_height ?? 0),
        fabricWidth: Number(inner.fabricWidth ?? inner.fabric_width ?? 0),
        fabricHeight: Number(inner.fabricHeight ?? inner.fabric_height ?? 0),
        scale: Math.max(1, Number(inner.scale ?? 1)),
        stitches
      }
    }

    const parseXsdByApi = async (file) => {
      const formData = new FormData()
      formData.append('file', file)

      const resp = await fetch(XSD_PARSE_API_URL, {
        method: 'POST',
        body: formData
      })

      let envelope = null
      try {
        envelope = await resp.json()
      } catch (e) {
        throw new Error(t('projectForm.errXsdJson'))
      }

      if (!resp.ok) {
        throw new Error(envelope?.msg || t('projectForm.errXsdHttp', { status: resp.status }))
      }
      if (!envelope || envelope.success !== true || envelope.data == null) {
        throw new Error(envelope?.msg || t('projectForm.xsdBizFail'))
      }

      return normalizeXsdPayload(envelope.data)
    }
    const rgbToHex = (r, g, b) => {
      const toHex = (n) => Number(n || 0).toString(16).padStart(2, '0')
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`
    }
    const hexToRgb = (hex) => {
      if (!hex || typeof hex !== 'string') return null
      const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/)
      if (!m) return null
      const v = m[1]
      return {
        r: parseInt(v.slice(0, 2), 16),
        g: parseInt(v.slice(2, 4), 16),
        b: parseInt(v.slice(4, 6), 16)
      }
    }
        const nearestPaletteColor = (hex, paletteColors = []) => {
      const src = hexToRgb(hex)
      if (!src || !Array.isArray(paletteColors) || !paletteColors.length) return null
      let best = null
      let bestDist = Number.POSITIVE_INFINITY
      for (const p of paletteColors) {
        const prgb = hexToRgb(p?.hex)
        if (!prgb) continue
        //  RGB Weighted Euclidean
        // : https://www.compuphase.com/cmetric.htm
        const rMean = (src.r + prgb.r) / 2
        const dr = src.r - prgb.r
        const dg = src.g - prgb.g
        const db = src.b - prgb.b
        const dist = (2 + rMean / 256) * dr * dr
                    + 4 * dg * dg
                    + (2 + (255 - rMean) / 256) * db * db
        if (dist < bestDist) {
          bestDist = dist
          best = p
        }
      }
      return best
    }
        //  +  colorIndex 
    // paletteColors: 61
    const buildColorMapByVoting = async (parsed, paletteColors) => {
      const imageBase64 = parsed?.imageBase64
      const stitches = Array.isArray(parsed?.stitches) ? parsed.stitches : []
      const scale = Math.max(1, Number(parsed?.scale || 1))
      if (!imageBase64 || !stitches.length) return new Map()

      // 坐标基准修正：XSD 有的为 0-based，有的为 1-based。
      // 后续 buildCellsMatrixFromStitches 会做 offsetX/offsetY，这里也必须一致，
      // 否则取样像素会偏一格，导致 colorIndex 映射错位（例如 20 被采样到邻格变成 8）。
      const cols = Number(parsed?.fabricWidth || 0)
      const rows = Number(parsed?.fabricHeight || 0)
      const maxX = Math.max(...stitches.map(s => Number(s?.x || 0)))
      const maxY = Math.max(...stitches.map(s => Number(s?.y || 0)))
      const minX = Math.min(...stitches.map(s => Number(s?.x || 0)))
      const minY = Math.min(...stitches.map(s => Number(s?.y || 0)))
      const offsetX = (cols && (maxX >= cols || minX >= 1)) ? 1 : 0
      const offsetY = (rows && (maxY >= rows || minY >= 1)) ? 1 : 0

      const img = await new Promise((resolve, reject) => {
        const i = new Image()
        i.onload = () => resolve(i)
        i.onerror = () => reject(new Error(t('projectForm.errDecodeApiImage')))
        i.src = imageBase64
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return new Map()
      ctx.drawImage(img, 0, 0)

      //  colorIndex  stitch
      const stitchesByIdx = new Map()
      for (const stitch of stitches) {
        const idx = Number(stitch?.colorIndex ?? 0)
        if (!stitchesByIdx.has(idx)) stitchesByIdx.set(idx, [])
        stitchesByIdx.get(idx).push(stitch)
      }

      const resultMap = new Map() // colorIndex → { color, colorId }
      const MAX_SAMPLES = 30     //  colorIndex 30

      for (const [idx, idxStitches] of stitchesByIdx) {
        // 
        const step = Math.max(1, Math.floor(idxStitches.length / MAX_SAMPLES))
        const samples = []
        for (let i = 0; i < idxStitches.length && samples.length < MAX_SAMPLES; i += step) {
          samples.push(idxStitches[i])
        }

        //  →  → 
        const voteMap = new Map() // paletteColorId → { count, color, colorId }
        for (const stitch of samples) {
          const x = Math.round(Number(stitch?.x || 0)) - offsetX
          const y = Math.round(Number(stitch?.y || 0)) - offsetY
          if (x < 0 || y < 0) continue
          const sx = Math.max(0, Math.floor(x * scale + scale / 2))
          const sy = Math.max(0, Math.floor(y * scale + scale / 2))
          const safeX = Math.min(canvas.width - 1, sx)
          const safeY = Math.min(canvas.height - 1, sy)
          // 
          const px = ctx.getImageData(safeX, safeY, 1, 1).data
          if ((px[3] || 0) === 0) continue // 
          const sampledHex = rgbToHex(px[0], px[1], px[2])
          const nearest = nearestPaletteColor(sampledHex, paletteColors)
          if (!nearest) continue
          const key = String(nearest.id)
          if (!voteMap.has(key)) {
            const finalHex = String(nearest.hex).trim()
            const normalizedHex = finalHex.startsWith('#') ? finalHex.toUpperCase() : ('#' + finalHex).toUpperCase()
            voteMap.set(key, { count: 0, color: normalizedHex, colorId: key })
          }
          voteMap.get(key).count++
        }

        // 
        let winner = null
        let maxVotes = 0
        for (const entry of voteMap.values()) {
          if (entry.count > maxVotes) { maxVotes = entry.count; winner = entry }
        }

        if (winner) {
          resultMap.set(idx, { color: winner.color, colorId: winner.colorId })
        } else {
          resultMap.set(idx, { color: '#000000', colorId: String(idx) })
        }
      }

      return resultMap
    }
    const resolveXsdDefaultCell = (paletteColors = [], displayMeta = null) => {
      if (!displayMeta?.showFabricColorsWithSymbols) {
        return { color: '#FFFFFF00', colorId: 'DEFAULT' }
      }

      const candidates = []
      const seen = new Set()
      const push = (entries) => {
        if (!Array.isArray(entries)) return
        for (const entry of entries) {
          const hex = String(entry?.hex || entry?.color || '').trim().toUpperCase()
          if (!hex) continue
          const id = entry?.id ?? entry?.code ?? entry?.number ?? entry?.name ?? hex
          const key = `${id}|${hex}`
          if (seen.has(key)) continue
          seen.add(key)
          candidates.push({ id, hex })
        }
      }

      push(paletteColors)
      push(currentGroupColors.value)
      push(colorPalette.value)

      const exactWhite = candidates.find((entry) => entry.hex === '#FFFFFF')
      if (exactWhite) {
        return { color: exactWhite.hex, colorId: exactWhite.id }
      }

      let best = null
      let bestScore = Infinity
      for (const entry of candidates) {
        const rgb = entry.hex.replace('#', '')
        if (!/^[0-9A-F]{6}$/.test(rgb)) continue
        const r = parseInt(rgb.slice(0, 2), 16)
        const g = parseInt(rgb.slice(2, 4), 16)
        const b = parseInt(rgb.slice(4, 6), 16)
        const brightnessPenalty = (255 - r) + (255 - g) + (255 - b)
        const neutralityPenalty = Math.abs(r - g) + Math.abs(r - b) + Math.abs(g - b)
        const score = brightnessPenalty * 4 + neutralityPenalty
        if (score < bestScore) {
          bestScore = score
          best = entry
        }
      }

      if (best) {
        return { color: best.hex, colorId: best.id }
      }

      return { color: '#FFFFFF', colorId: '37' }
    }

    const buildCellsMatrixFromStitches = async (parsed, paletteColors = [], opts = {}) => {
      const cols = Number(parsed?.fabricWidth || 0)
      const rows = Number(parsed?.fabricHeight || 0)
      const stitches = Array.isArray(parsed?.stitches) ? parsed.stitches : []
      if (!rows || !cols || !stitches.length) return []
      const defaultCell = opts.defaultCell || { color: '#FFFFFF00', colorId: 'DEFAULT' }

      // API  palettecolorIndex 
      //  +  colorIndex 
      const mappedIndexColorMap = await buildColorMapByVoting(parsed, paletteColors)

      const maxX = Math.max(...stitches.map(s => Number(s?.x || 0)))
      const maxY = Math.max(...stitches.map(s => Number(s?.y || 0)))
      const minX = Math.min(...stitches.map(s => Number(s?.x || 0)))
      const minY = Math.min(...stitches.map(s => Number(s?.y || 0)))
      //  0-based / 1-based 
      const offsetX = (maxX >= cols || minX >= 1) ? 1 : 0
      const offsetY = (maxY >= rows || minY >= 1) ? 1 : 0
      const matrix = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ color: defaultCell.color, colorId: defaultCell.colorId }))
      )
      for (const stitch of stitches) {
        const x = Math.round(Number(stitch?.x || 0)) - offsetX
        const y = Math.round(Number(stitch?.y || 0)) - offsetY
        if (x < 0 || y < 0 || x >= cols || y >= rows) continue
        const idx = Number(stitch?.colorIndex || 0)
        const mapped = mappedIndexColorMap.get(idx) || { color: '#000000', colorId: String(idx) }
        matrix[y][x] = {
          color: mapped.color,
          colorId: mapped.colorId
        }
      }
      return matrix
    }
    const handleXsdFile = async (file) => {
      if(!file) return
      if (!/\.xsd$/i.test(file.name || '')) { ElMessage.error(t('projectForm.errPickXsd')); return }
      if(file.size > 50 * 1024 * 1024){ ElMessage.error(t('projectForm.errFile50')); return }
      try {
        selectedImageFile.value = null
        formData.value.xsd = {
          path: file.path || file.name,
          name: file.name,
          size: file.size
        }
        xsdFile.value = file
        
        //  API  XSD 
        try {
          let displayMeta = null
          try {
            displayMeta = await parseXsdDisplayMetadata(file)
          } catch (displayMetaError) {
            console.warn('[ProjectForm] parseXsdDisplayMetadata failed', displayMetaError)
          }

          const parsedData = await parseXsdByApi(file)
          const imageBase64 = parsedData.imageBase64 || null
          const imageWidth = Number(parsedData.imageWidth || 0)
          const imageHeight = Number(parsedData.imageHeight || 0)
          const fabricWidth = Number(parsedData.fabricWidth || 0)
          const fabricHeight = Number(parsedData.fabricHeight || 0)

          xsdParseResult.value = {
            ...parsedData,
            displayMeta,
            source: {
              path: file.path || file.name,
              name: file.name,
              size: file.size
            }
          }
          formData.value.image = {
            path: file.path || file.name,
            name: `${file.name}${t('projectForm.xsdParsedNameSuffix')}`,
            size: { width: imageWidth, height: imageHeight },
            thumbnail: imageBase64,
            data: imageBase64
          }
          setImagePreview(imageBase64)
          formData.value.grid.length = fabricWidth || 100
          formData.value.grid.width = fabricHeight || 100

          ElMessage.success(t('projectForm.xsdOk'))
        } catch (parseError) {
          console.error('XSD:', parseError)
          ElMessage.warning(t('projectForm.xsdWarn', { msg: parseError.message || t('merge.step4.errUnknown') }))
          // 
          formData.value.grid.length = 100
          formData.value.grid.width = 100
          xsdParseResult.value = null
        }
        
        formRef.value?.validateField('xsd.path')
      } catch (e) { console.error(e); ElMessage.error(t('projectForm.errFileLoad')) }
    }
    const handleXsdFileSelect = (e)=> { const file = e.target.files[0]; handleXsdFile(file) }
    const onXsdDragOver = () => { xsdDragHover.value = true }
    const onXsdDragLeave = () => { xsdDragHover.value = false }
    const onXsdDrop = (e) => { xsdDragHover.value = false; const files = e.dataTransfer?.files; if(files && files.length){ handleXsdFile(files[0]) } }
    const removeXsdFile = ({ validate = true } = {}) => {
      formData.value.xsd = { path: null, name: null, size: null }
      xsdFile.value = null
      xsdParseResult.value = null
      if (xsdFileInput.value) xsdFileInput.value.value = ''
      if (validate) {
        formRef.value?.validateField('xsd.path')
      }
    }

    // 
    const formatFileSize = (bytes) => {
      if (bytes === 0) return '0 Bytes'
      const k = 1024
      const sizes = ['Bytes', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    //  ()
    const calculateGridWidth = () => {
      if (!formData.value.image.size.width || !formData.value.image.size.height || !formData.value.grid.length) {
        formData.value.grid.width = null
        return
      }
      const aspectRatio = formData.value.image.size.width / formData.value.image.size.height
      formData.value.grid.width = Math.round(formData.value.grid.length / aspectRatio)
    }

    const buildImageProjectCellsMatrix = async ({ paletteColors, colorCount }) => {
      const imageBase64 = await ensureCurrentImageDataUrl()
      const rows = Number(formData.value.grid.width || 0)
      const cols = Number(formData.value.grid.length || 0)

      if (!imageBase64) {
        throw new Error(t('projectForm.errImageLoad'))
      }
      if (!rows || !cols) {
        throw new Error(t('projectForm.errImageGridSize'))
      }

      const { selectedColors, imageData } = await resolveImagePaletteColors({
        imageBase64,
        rows,
        cols,
        paletteColors,
        colorCount
      })
      const matrix = await buildImageCellsMatrix({
        imageBase64,
        imageData,
        rows,
        cols,
        paletteColors: selectedColors,
        colorCount: selectedColors.length
      })

      if (!Array.isArray(matrix) || !matrix.length || !Array.isArray(matrix[0]) || !matrix[0].length) {
        throw new Error(t('projectForm.errImageMatrixEmpty'))
      }

      return {
        matrix,
        selectedColors,
        imageBase64
      }
    }

    const buildXsdProjectCellsMatrix = async ({ parsed, paletteColors, colorCount }) => {
      const rows = Number(parsed?.fabricHeight || 0)
      const cols = Number(parsed?.fabricWidth || 0)
      if (!parsed?.imageBase64) {
        throw new Error(t('projectForm.errDecodeApiImage'))
      }
      if (!rows || !cols) {
        throw new Error(t('projectForm.errImageGridSize'))
      }

      const { selectedColors } = await resolveImagePaletteColors({
        imageBase64: parsed.imageBase64,
        rows,
        cols,
        paletteColors,
        colorCount
      })
      const defaultCell = resolveXsdDefaultCell(paletteColors, parsed?.displayMeta)
      const matrix = await buildCellsMatrixFromStitches(parsed, selectedColors, { defaultCell })
      if (!Array.isArray(matrix) || !matrix.length || !Array.isArray(matrix[0]) || !matrix[0].length) {
        throw new Error(t('projectForm.errImageMatrixEmpty'))
      }

      return {
        matrix,
        selectedColors
      }
    }

      const buildLegacyXsdProjectCellsMatrix = ({ matrix, paletteColors, displayMeta }) => {
      if (!Array.isArray(matrix) || !matrix.length || !Array.isArray(matrix[0]) || !matrix[0].length) {
        throw new Error(t('projectForm.errImageMatrixEmpty'))
      }

      const defaultCell = resolveXsdDefaultCell(paletteColors, displayMeta)
        return matrix.map(row =>
        (Array.isArray(row) ? row : []).map(cell => {
          const color = String(cell?.hex || cell?.color || '').trim().toUpperCase()
          const colorId = cell?.colorId ?? cell?.color_id ?? 'DEFAULT'

          if (isCutoutCellId(colorId)) {
            return { color: TRANSPARENT_CELL_COLOR, colorId: CUTOUT_CELL_ID }
          }

          if (!color || isDefaultCellId(colorId) || isTransparentCellColor(color)) {
            return { color: defaultCell.color, colorId: defaultCell.colorId }
          }

          const nearest = nearestPaletteColor(color, paletteColors)
          if (!nearest) {
            return { color, colorId }
          }

          const normalizedHex = String(nearest.hex || color).trim().toUpperCase()
          return {
            color: normalizedHex.startsWith('#') ? normalizedHex : `#${normalizedHex}`,
            colorId: nearest.id
          }
        })
      )
    }

    // 
    watch(importType, (newType, oldType) => {
      if (isHydratingForm.value || newType === oldType) return
      if (newType === 'image') {
        removeXsdFile({ validate: false })
        removeImage({ validate: false })
      } else if (newType === 'xsd') {
        removeImage({ validate: false })
      }
    })

    // 
    const handleColorGroupSelect = (groupId) => {
      formData.value.colorConfig.colorGroupId = groupId
      if (groupId) {
        const colors = currentGroupColors.value
        formData.value.colorConfig.selectedColors = colors
        formData.value.colorConfig.colorCount = colors.length // 
      } else {
        formData.value.colorConfig.selectedColors = []
        formData.value.colorConfig.colorCount = null
      }
    }

    // 
    const submit = async () => {
      if (!formRef.value) return
      try {
        await formRef.value.validate()
        const groupId = formData.value.colorConfig.colorGroupId
        if (groupId) {
          const colors = currentGroupColors.value
          if (!colors.length) {
            ElMessage.error(t('projectForm.errPickGroupSubmit'))
            return
          }
          const requested = resolveRequestedColorCount(colors)
          //  <  count  requested 
          const baseColorConfig = {
            type: 'group',              //  palette_builder 
            colorGroupId: groupId,
            colorCount: requested,
            allColors: colors,          // 
            selectedColors: colors      // / count 
          }
        
          const payload = {
            ...formData.value, 
            colorConfig: baseColorConfig,
            importType: importType.value
          }
          if (importType.value === 'xsd' && hasPersistedXsdRebuildPayload(xsdParseResult.value)) {
            const buildingMessage = ElMessage({
              type: 'info',
              message: t('projectForm.imageMatrixGenerating'),
              duration: 0
            })
            try {
              await nextTick()
              await new Promise(resolve => requestAnimationFrame(resolve))
              const { matrix, selectedColors } = await buildXsdProjectCellsMatrix({
                parsed: xsdParseResult.value,
                paletteColors: colors,
                colorCount: requested
              })
              payload.colorConfig = {
                ...baseColorConfig,
                selectedColors
              }
              payload.xsdParsed = buildPersistedXsdParsed(xsdParseResult.value)
              payload.cellsMatrix = matrix
              payload.imageWidth = xsdParseResult.value.imageWidth || formData.value.image?.size?.width || 0
              payload.imageHeight = xsdParseResult.value.imageHeight || formData.value.image?.size?.height || 0
            } catch (xsdMatrixError) {
              console.error('[ProjectForm] rebuild xsd cellsMatrix failed', xsdMatrixError)
              ElMessage.error(t('projectForm.errImageMatrixBuild', { msg: xsdMatrixError.message || t('merge.step4.errUnknown') }))
              return
            } finally {
              buildingMessage.close?.()
            }
          } else if (importType.value === 'xsd' && Array.isArray(props.initialData?.cellsMatrix) && props.initialData.cellsMatrix.length) {
            try {
              payload.colorConfig = {
                ...baseColorConfig,
                selectedColors: colors
              }
              payload.xsdParsed = buildPersistedXsdParsed(props.initialData?.xsdParsed || null)
              payload.cellsMatrix = buildLegacyXsdProjectCellsMatrix({
                matrix: props.initialData.cellsMatrix,
                paletteColors: colors,
                displayMeta: xsdParseResult.value?.displayMeta || props.initialData?.xsdParsed?.displayMeta || null
              })
              payload.imageWidth = formData.value.image?.size?.width || 0
              payload.imageHeight = formData.value.image?.size?.height || 0
            } catch (legacyXsdError) {
              console.error('[ProjectForm] rebuild legacy xsd cellsMatrix failed', legacyXsdError)
              ElMessage.error(t('projectForm.errImageMatrixBuild', { msg: legacyXsdError.message || t('merge.step4.errUnknown') }))
              return
            }
          } else if (importType.value === 'xsd') {
            ElMessage.error(t('projectForm.xsdBizFail'))
            return
          }
          if (importType.value === 'image') {
            const buildingMessage = ElMessage({
              type: 'info',
              message: t('projectForm.imageMatrixGenerating'),
              duration: 0
            })
            try {
              await nextTick()
              await new Promise(resolve => requestAnimationFrame(resolve))
              const { matrix, selectedColors, imageBase64 } = await buildImageProjectCellsMatrix({
                paletteColors: colors,
                colorCount: requested
              })
              payload.colorConfig = {
                ...baseColorConfig,
                selectedColors
              }
              payload.image = {
                ...payload.image,
                thumbnail: imageBase64,
                data: imageBase64
              }
              payload.cellsMatrix = matrix
              payload.imageWidth = formData.value.image?.size?.width || 0
              payload.imageHeight = formData.value.image?.size?.height || 0
            } catch (imageMatrixError) {
              console.error('[ProjectForm] build image cellsMatrix failed', imageMatrixError)
              ElMessage.error(t('projectForm.errImageMatrixBuild', { msg: imageMatrixError.message || t('merge.step4.errUnknown') }))
              return
            } finally {
              buildingMessage.close?.()
            }
          }
          emit('submit', payload)
        } else {
          ElMessage.error(t('projectForm.errPickGroupSubmit'))
        }
      } catch (e) {
        ElMessage.error(t('projectForm.errFillRequired'))
      }
    }

    // 
    const initializeForm = () => {
      isHydratingForm.value = true
      if (props.initialData) {
        const mergedFormData = buildFormDataFromInitial(props.initialData)
        const restoredImportType = props.initialData.importType || (props.initialData.xsdParsed ? 'xsd' : 'image')
        formData.value = mergedFormData
        importType.value = restoredImportType
        selectedImageFile.value = null
        setImagePreview(mergedFormData.image.thumbnail || mergedFormData.image.data || null)

        if (restoredImportType === 'xsd') {
          const restoredXsdParsed = hydratePersistedXsdParsed(props.initialData.xsdParsed || null, {
            imageBase64: mergedFormData.image.thumbnail || mergedFormData.image.data || null,
            imageWidth: mergedFormData.image?.size?.width || 0,
            imageHeight: mergedFormData.image?.size?.height || 0,
            source: mergedFormData.xsd
          })
          const existingXsdName = mergedFormData.xsd.name || props.initialData.image?.name || props.initialData.imageName || 'existing.xsd'
          const existingXsdPath = mergedFormData.xsd.path || props.initialData.image?.path || props.initialData.imagePath || existingXsdName
          formData.value.xsd = {
            ...mergedFormData.xsd,
            ...(restoredXsdParsed?.source || {}),
            name: existingXsdName,
            path: existingXsdPath
          }
          xsdParseResult.value = restoredXsdParsed
          xsdFile.value = {
            name: existingXsdName,
            size: Number(mergedFormData.xsd.size || restoredXsdParsed?.source?.size || 0),
            path: existingXsdPath
          }
        } else {
          xsdParseResult.value = null
          xsdFile.value = null
        }

        nextTick(() => {
          if (formData.value.colorConfig.colorGroupId) {
            const colors = currentGroupColors.value
            if (colors.length) {
              formData.value.colorConfig.selectedColors = colors
              formData.value.colorConfig.colorCount = resolveRequestedColorCount(colors, formData.value.colorConfig.colorCount)
            }
          }
          isHydratingForm.value = false
        })
      } else {
        formData.value = createDefaultFormData()
        importType.value = 'image'
        selectedImageFile.value = null
        setImagePreview(null)
        xsdFile.value = null
        xsdParseResult.value = null
        nextTick(() => {
          const list = extendedColorGroups.value
          if (list.length) {
            const first = list[0]
            formData.value.colorConfig.colorGroupId = first.id
            const colors = first.colors || first.color_ids || []
            formData.value.colorConfig.selectedColors = colors
            formData.value.colorConfig.colorCount = colors.length
          }
          isHydratingForm.value = false
        })
      }
    }

    // 
    const loadColorData = async () => {
      try { await Promise.all([ loadColorPalettes(), loadColorGroups() ]) } catch(e){ console.error('load color data failed', e) }
    }

    //  grid 
    watch(() => formData.value.grid.length, calculateGridWidth)

    // 有分组后下拉不再含 ALL：旧数据若仍为 ALL，自动落到当前列表第一项
    watch(
      [extendedColorGroups, () => formData.value.colorConfig.colorGroupId],
      () => {
        const list = extendedColorGroups.value
        const id = formData.value.colorConfig.colorGroupId
        if (!list.length) return
        if (!id || !list.some((g) => g.id === id)) {
          const first = list[0]
          formData.value.colorConfig.colorGroupId = first.id
          const colors = first.colors || first.color_ids || []
          formData.value.colorConfig.selectedColors = colors
          formData.value.colorConfig.colorCount = colors.length
        }
      },
      { flush: 'post' }
    )

    onMounted(async () => {
      await loadColorData()
      initializeForm()
    })

    onUnmounted(() => {
      clearImagePreviewObjectUrl()
    })

    return {
      formRef,
      fileInput,
      xsdFileInput,
      formData,
      formRules,
      defaultProjectName,
      imagePreview,
      imageAcceptTypes,
      imageRatio,
      colorGroups,
      extendedColorGroups,
      currentGroupColors,
      loadingColors,
      loadingGroups,
      groupMaxColorCount,
      previewColors,
      triggerUpload,
      handleFileSelect,
      removeImage,
      calculateGridWidth,
      handleColorGroupSelect,
      submit,
      dragHover,
      onDragOver,
      onDragLeave,
      onDrop,
      importType,
      xsdFile,
      xsdDragHover,
      triggerXsdUpload,
      handleXsdFileSelect,
      removeXsdFile,
      onXsdDragOver,
      onXsdDragLeave,
      onXsdDrop,
      formatFileSize,
      formatGroupLabel,
      t
    }
  }
}
</script>

<style scoped>
.project-form-container {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.project-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-card {
  border: 1px solid var(--el-border-color-light);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-color-primary);
}

.section-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 20px 0 16px 0;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-weight: 500;
  color: var(--el-text-color-regular);
}

.unit {
  margin-left: 8px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.field-hint {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-top: 4px;
  text-align: center;
}

.input-with-unit {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-text {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
}

.max-hint {
  margin-left: 8px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.upload-section {
  width: 100%;
}

.upload-area {
  border: 2px dashed #d9d9d9;
  border-radius: 8px;
  padding: 40px;
  text-align: center;
  background: #fafafa;
  cursor: pointer;
  transition: all 0.3s;
}

.upload-area:hover {
  border-color: var(--el-color-primary);
  background: #f0f9ff;
}

.upload-area.drag-hover, .uploaded-image.drag-hover { border-color:#409eff; background:#f0f9ff; }

.upload-icon {
  font-size: 32px;
  color: #d9d9d9;
  margin-bottom: 12px;
}

.upload-text {
  font-size: 16px;
  color: var(--el-text-color-regular);
  margin-bottom: 8px;
}

.upload-tip {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.uploaded-image {
  text-align: center;
}

.uploaded-image img {
  max-width: 100%;
  max-height: 200px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  margin-bottom: 16px;
}

.uploaded-file {
  text-align: center;
  padding: 20px;
  border: 1px solid var(--el-border-color);
  border-radius: 8px;
  background: #fafafa;
}

.file-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 16px;
}

.file-icon {
  font-size: 48px;
  color: var(--el-color-primary);
}

.file-details {
  text-align: left;
}

.file-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.file-size {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.image-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-bottom: 16px;
}

.image-info {
  display: flex;
  gap: 24px;
  justify-content: center;
  font-size: 14px;
}

.info-item {
  display: flex;
  gap: 8px;
}

.info-label {
  color: var(--el-text-color-secondary);
  font-weight: 500;
}

.color-preview {
  margin-top: 16px;
  padding: 16px;
  background: #fafafa;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  min-height: 60px;
}

.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-start;
}

.color-swatch-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 60px;
  max-width: 80px;
}

.color-swatch {
  width: 32px;
  height: 32px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  cursor: pointer;
  flex-shrink: 0;
  margin-bottom: 4px;
}

.color-info {
  text-align: center;
  font-size: 10px;
  line-height: 1.2;
}

.color-id {
  font-weight: bold;
  color: var(--el-text-color-primary);
  margin-bottom: 2px;
}

.color-name {
  color: var(--el-text-color-regular);
  word-wrap: break-word;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70px;
}

.color-more {
  font-size: 14px;
  color: var(--el-text-color-secondary);
  margin-left: 8px;
}

.count-info {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 6px;
  color: #0066cc;
  font-size: 14px;
}

.info-icon {
  font-size: 18px;
  color: #409eff;
  flex-shrink: 0;
}

.no-colors {
  color: var(--el-text-color-placeholder);
  font-size: 14px;
  text-align: center;
  padding: 24px 0;
}

.drop-replace-hint { margin-top:8px; font-size:12px; color:#409eff; }


:deep(.el-form-item) {
  margin-bottom: 18px;
}

:deep(.el-card__header) {
  padding: 16px 20px;
  background: #f8f9fa;
}

:deep(.el-card__body) {
  padding: 20px;
}

:deep(.el-radio-group) {
  display: flex;
  gap: 16px;
}


:deep(.el-input-number) {
  width: 150px;
}


:deep(.el-input-number .el-input__inner) {
  color: #606266;
  background-color: #ffffff;
}


@media (max-width: 768px) {
  .project-form-container {
    padding: 16px;
  }
  
  .image-info {
    flex-direction: column;
    gap: 8px;
  }
  
  :deep(.el-col) {
    margin-bottom: 16px;
  }
}
.color-swatches.full-list { max-height: 240px; overflow-y: auto; padding-right:4px; }
.color-swatches.full-list::-webkit-scrollbar { width:6px; }
.color-swatches.full-list::-webkit-scrollbar-thumb { background: #d0d0d0; border-radius:3px; }
</style>
