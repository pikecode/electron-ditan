<template>
  <div class="color-palette">
    
    <div
      class="selected-banner"
      :class="{
        empty: !selectedColor,
        'light-banner': selectedColor && isLightColor(selectedColor.hex)
      }"
      :style="selectedColor ? { backgroundColor: selectedColor.hex } : {}"
    >
      <div
        v-if="selectedColor"
        class="banner-overlay"
        :class="{ 'light-banner-overlay': isLightColor(selectedColor.hex) }"
      >
        <span class="banner-code">#{{ selectedColor.code }}</span>
        <span class="banner-name">{{ selectedColor.name }}</span>
        <span class="banner-hex">{{ selectedColor.hex }}</span>
      </div>
      <div v-else class="banner-placeholder">{{ t('palettePanel.noneSelected') }}</div>
    </div>

    
    <div class="palette-header">
      <el-row :gutter="12" align="middle">
        <el-col :span="18">
          <el-input
            v-model="searchQuery"
            :placeholder="t('palettePanel.searchPh')"
            :prefix-icon="Search"
            clearable
            size="small"
          />
        </el-col>
        <el-col :span="6">
          <el-button
            type="primary"
            size="small"
            :icon="Refresh"
            :loading="loadingColors"
            @click="handleRefresh"
            style="width: 100%;"
          >
            {{ t('palettePanel.refresh') }}
          </el-button>
        </el-col>
      </el-row>
    </div>

    
    <div class="palette-content">
      <div v-if="loadingColors" class="loading-container">
        <el-skeleton :rows="3" animated />
      </div>
      
      <div v-else-if="colorLoadError" class="error-container">
        <el-alert
          :title="colorLoadError"
          type="error"
          show-icon
          :closable="false"
        />
      </div>
      
      <div v-else class="color-grid">
        <div
          v-for="(color, index) in filteredColors"
          :key="color.id"
          class="color-item"
          :class="{ 'selected': selectedColorIndex === getOriginalIndex(color) }"
          @click="handleColorSelect(color, getOriginalIndex(color))"
        >
          <el-card
            :shadow="selectedColorIndex === getOriginalIndex(color) ? 'always' : 'hover'"
            :class="{ 'selected-card': selectedColorIndex === getOriginalIndex(color) }"
            body-style="padding: 2px;"
          >
            
            <div 
              class="color-block"
              :style="{ backgroundColor: color.hex }"
            >
              
              <div
                class="color-overlay"
                :class="{ 'light-overlay': isLightColor(color.hex) }"
              >
                <div class="color-id">{{ color.code }}</div>
                <div class="color-hex">{{ color.hex }}</div>
              </div>
            </div>
            
            
            <div v-if="color.usage > 0" class="usage-count">
              <el-tag size="small" type="info">{{ color.usage }}</el-tag>
            </div>
          </el-card>
        </div>
        
        
        <div v-if="filteredColors.length === 0" class="empty-state">
          <el-empty
            :description="t('palettePanel.emptyMatch')"
            image-size="80"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Search, Refresh } from '@element-plus/icons-vue'
import { useColorManagement } from '../../composables/useColorManagement.js'
import { ElMessage } from 'element-plus'

// 
const props = defineProps({
  // 
  initialSelectedIndex: {
    type: Number,
    default: -1
  }
})

// 
const emit = defineEmits(['color-selected', 'color-changed'])
const { t } = useI18n()

// 
const {
  colorPalette,
  loadingColors,
  colorLoadError,
  selectedColorIndex,
  loadColorPalettes
} = useColorManagement()

// 
const searchQuery = ref('')

// 
const filteredColors = computed(() => {
  if (!searchQuery.value.trim()) {
    return colorPalette.value
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  return colorPalette.value.filter(color => {
    return (
      color.code.toLowerCase().includes(query) ||
      color.name.toLowerCase().includes(query) ||
      color.hex.toLowerCase().includes(query)
    )
  })
})

const selectedColor = computed(() => {
  if (selectedColorIndex.value >= 0 && selectedColorIndex.value < colorPalette.value.length) {
    return colorPalette.value[selectedColorIndex.value]
  }
  return null
})

function parseHexColor(hex) {
  if (!hex || typeof hex !== 'string') return null
  let value = hex.trim()
  if (!value.startsWith('#')) return null
  value = value.slice(1)
  if (value.length === 3) value = value.split('').map((part) => part + part).join('')
  if (value.length !== 6) return null
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  if ([r, g, b].some((item) => Number.isNaN(item))) return null
  return { r, g, b }
}

function isLightColor(hex) {
  const rgb = parseHexColor(hex)
  if (!rgb) return false
  const luminance = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b
  return luminance >= 185
}

// 
const getOriginalIndex = (color) => {
  return colorPalette.value.findIndex(c => c.id === color.id)
}

// 
const handleColorSelect = (color, originalIndex) => {
  console.log('=== COLOR PALETTE SELECT ===')
  console.log('Selected color:', color)
  console.log('Original index:', originalIndex)
  
  // 
  selectedColorIndex.value = selectedColorIndex.value === originalIndex ? -1 : originalIndex
  
  // 
  const selectedData = selectedColorIndex.value >= 0 ? {
    color: color,
    index: originalIndex,
    isSelected: true
  } : {
    color: null,
    index: -1,
    isSelected: false
  }
  
  emit('color-selected', selectedData)
  emit('color-changed', selectedData)
  
  console.log('Emitted color selection:', selectedData)
}

// 
const handleRefresh = async () => {
  console.log('=== REFRESH COLOR PALETTE ===')
  
  try {
    const result = await loadColorPalettes()
    
    if (result.success) {
      ElMessage.success(result.message || t('palettePanel.refreshOk'))
    } else {
      ElMessage.error(result.message || t('palettePanel.refreshFail'))
    }
  } catch (error) {
    console.error('Refresh failed:', error)
    ElMessage.error(t('palettePanel.refreshErr', { msg: error.message }))
  }
}

//  eyedropper 
const pendingEyedropperSelection = ref(null)
function applyEyedropperSelection(detail){
  if(!detail) return
  const { code, hex } = detail
  const idx = colorPalette.value.findIndex(c => (code && c.code===code) || (hex && c.hex===hex))
  if (idx !== -1) {
    const color = colorPalette.value[idx]
    selectedColorIndex.value = idx
    const payload = { color, index: idx, isSelected: true }
    emit('color-selected', payload)
    emit('color-changed', payload)
    console.log('[ColorPalette] Eyedropper selection applied', payload)
    pendingEyedropperSelection.value = null
  } else {
    // 
    pendingEyedropperSelection.value = detail
    console.log('[ColorPalette] Eyedropper selection pending (palette not ready)', detail)
  }
}
function handleEyedropperGlobal(e){ applyEyedropperSelection(e.detail) }
watch(colorPalette, () => { if(pendingEyedropperSelection.value) applyEyedropperSelection(pendingEyedropperSelection.value) })
onMounted(()=>{ window.addEventListener('eyedropper-color-selected', handleEyedropperGlobal) })
onUnmounted(()=>{ window.removeEventListener('eyedropper-color-selected', handleEyedropperGlobal) })

// 
watch(() => props.initialSelectedIndex, (newIndex) => {
  if (newIndex >= 0 && newIndex < colorPalette.value.length) {
    selectedColorIndex.value = newIndex
  }
}, { immediate: true })

// 
onMounted(async () => {
  console.log('=== COLOR PALETTE MOUNTED ===')
  
  if (colorPalette.value.length === 0) {
    await handleRefresh()
  }
  
  // 
  if (props.initialSelectedIndex >= 0) {
    selectedColorIndex.value = props.initialSelectedIndex
  }
})

// 
defineExpose({
  refreshColors: handleRefresh,
  clearSelection: () => {
    selectedColorIndex.value = -1
    emit('color-selected', { color: null, index: -1, isSelected: false })
  },
  selectColorByIndex: (index) => {
    if (index >= 0 && index < colorPalette.value.length) {
      const color = colorPalette.value[index]
      handleColorSelect(color, index)
    }
  },
  getSelectedColor: () => selectedColor.value,
  // 
  getAllColors: () => Array.isArray(colorPalette.value) ? colorPalette.value : []
})
</script>

<style scoped>
.color-palette {
  display: flex;
  flex-direction: column;
  height: 80vh; 
  max-height: 80vh; 
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  width: 100%;
  min-height: 0; 
}


.selected-banner {
  height: 72px;
  min-height: 72px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  border-bottom: 1px solid #e9ecef;
  transition: background-color 0.25s;
}

.selected-banner.light-banner {
  box-shadow: inset 0 0 0 1px rgba(203, 213, 225, 0.9);
}

.selected-banner.empty {
  background: repeating-conic-gradient(#f2f3f5 0% 25%, #e9eaec 0% 50%) 50%/16px 16px;
  color: #999;
}

.banner-overlay {
  display: flex;
  gap: 20px;
  padding: 8px 20px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(4px);
  color: #fff;
  font-weight: 600;
  font-size: 14px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.banner-overlay.light-banner-overlay {
  background: rgba(255, 255, 255, 0.82);
  color: #334155;
  text-shadow: none;
  box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.45);
}

.banner-code {
  letter-spacing: 0.5px;
}

.banner-name {
  font-weight: 500;
}

.banner-hex {
  font-family: Monaco, Consolas, monospace;
  font-size: 13px;
}

.banner-placeholder {
  font-size: 13px;
  color: #666;
}


.palette-header {
  padding: 12px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}


.palette-content {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  overflow-x: hidden;
  
  min-height: 0;
}

.loading-container,
.error-container {
  padding: 20px;
}


.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 50px);
  width: 100%;
  min-width: 0;
  justify-content: space-between;
  row-gap: 12px;
}

.color-item {
  cursor: pointer;
  transition: all 0.2s ease;
  width: 50px;
  height: 50px;
}

.color-item:hover {
  transform: translateY(-2px);
}

.color-item.selected {
  transform: translateY(-2px);
}

.selected-card {
  border: 2px solid #409eff !important;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3) !important;
}


.color-block {
  width: 100%;
  height: 46px;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.color-block:hover {
  border-color: #409eff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}


.color-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: #fff;
  opacity: 1;
  transition: background 0.2s ease, color 0.2s ease, opacity 0.2s ease;
  border-radius: 3px;
}

.color-overlay.light-overlay {
  color: #334155;
}

.color-overlay.light-overlay .color-id,
.color-overlay.light-overlay .color-hex {
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.9);
}

.color-block:hover .color-overlay {
  background: rgba(0, 0, 0, 0.45);
}

.color-block:hover .color-overlay.light-overlay {
  background: rgba(255, 255, 255, 0.72);
}

.color-id {
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 2px;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}

.color-hex {
  font-size: 8px;
  line-height: 1;
  font-family: Monaco, Consolas, monospace;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}


.usage-count {
  position: absolute;
  top: -8px;
  right: -8px;
}


.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 40px 20px;
}


@media (max-width: 768px) {
  .color-grid {
    grid-template-columns: repeat(auto-fill, 45px);
    row-gap: 10px;
    justify-content: space-between;
  }
  
  .color-item {
    width: 45px;
    height: 45px;
  }
  
  .color-block {
    height: 41px;
  }
  
  .color-id {
    font-size: 8px;
  }
  
  .color-hex {
    font-size: 7px;
  }
  
  .palette-header {
    padding: 8px;
  }
  
  .palette-content {
    padding: 8px;
    flex: 1;
    min-height: 0;
    overflow-x: hidden;
  }
  
  .selected-banner {
    height: 64px;
    min-height: 64px;
  }
  
  .banner-overlay {
    gap: 12px;
    padding: 6px 14px;
    font-size: 13px;
  }
  
  .banner-hex {
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .color-grid {
    grid-template-columns: repeat(auto-fill, 40px);
    row-gap: 8px;
    justify-content: space-between;
  }
  
  .color-item {
    width: 40px;
    height: 40px;
  }
  
  .color-block {
    height: 36px;
  }
  
  .color-id {
    font-size: 7px;
  }
  
  .color-hex {
    font-size: 6px;
  }
  
  .banner-overlay {
    gap: 8px;
    padding: 6px 10px;
    font-size: 12px;
  }
  
  .banner-hex {
    font-size: 11px;
  }
}


.palette-content::-webkit-scrollbar {
  width: 8px;
}

.palette-content::-webkit-scrollbar-track {
  background: #f5f5f5;
  border-radius: 4px;
  margin: 4px;
}

.palette-content::-webkit-scrollbar-thumb {
  background: #d9d9d9;
  border-radius: 4px;
  border: 2px solid #f5f5f5;
}

.palette-content::-webkit-scrollbar-thumb:hover {
  background: #bfbfbf;
}

.palette-content::-webkit-scrollbar-thumb:active {
  background: #999;
}
</style>
