<template>
  <div class="canvas-toolbar">
    
    <div class="project-info-section">
      <el-tooltip placement="right" effect="light">
        <template #content>
          <div class="project-tooltip">
            <div class="tooltip-item">
              <span class="tooltip-label">{{ t('canvasToolbar.tipImageSize') }}:</span>
              <span class="tooltip-value">{{ projectData.image?.size?.width || 0 }}×{{ projectData.image?.size?.height || 0 }}px</span>
            </div>
            <div class="tooltip-item">
              <span class="tooltip-label">{{ t('canvasToolbar.tipGridSize') }}:</span>
              <span class="tooltip-value">{{ projectData.grid?.width || 0 }}×{{ projectData.grid?.length || 0 }}</span>
            </div>
            <div class="tooltip-item">
              <span class="tooltip-label">{{ t('canvasToolbar.tipCellSize') }}:</span>
              <span class="tooltip-value">{{ projectData.grid?.cellSize || 1 }}cm</span>
            </div>
          </div>
        </template>
        <div class="project-info-title">
          <span class="section-title">{{ t('canvasToolbar.projectInfo') }}</span>
        </div>
      </el-tooltip>
    </div>
    
    
    <div class="color-palette-section">
      <el-divider content-position="left">
        <span class="section-title">{{ t('canvasToolbar.colorPickSection') }}</span>
      </el-divider>
      <ColorPalette 
        ref="colorPaletteRef"
        :initial-selected-index="selectedColorIndex"
        @color-selected="handleColorSelected"
        class="toolbar-color-palette"
      />
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ColorPalette from './ColorPalette.vue'

const { t } = useI18n()

// props
const props = defineProps({
  projectData: {
    type: Object,
    default: () => ({})
  },
  // 
  getColorData: {
    type: Function,
    required: true
  },
  // 
  showColorOnCanvas: {
    type: Function,
    required: false
  },
  // 
  hideColorOnCanvas: {
    type: Function,
    required: false
  }
})

// 
const emit = defineEmits(['color-selected'])

// 
const selectedColorIndex = ref(-1)
const currentSelectedColor = ref(null)
const colorPaletteRef = ref(null)

// 
const handleColorSelected = (data) => {
  selectedColorIndex.value = data.index
  currentSelectedColor.value = data.color
  emit('color-selected', data)
}

// 
defineExpose({
  // 
  getPaletteColors: () => colorPaletteRef.value?.getAllColors?.() || [],
  // 
  refreshColorStatistics: () => {}
})
</script>

<style scoped>
.canvas-toolbar {
  width: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
}


.project-info-section {
  padding: 12px 16px;
  border-bottom: 1px solid #e4e7ed;
}

.project-info-title {
  cursor: pointer;
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.project-info-title:hover {
  background-color: #f0f9ff;
}


.color-palette-section {
  margin-top: 16px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #409eff;
}

.toolbar-color-palette {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}


.project-tooltip {
  padding: 8px 0;
}

.tooltip-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
  min-width: 200px;
}

.tooltip-item:last-child {
  margin-bottom: 0;
}

.tooltip-label {
  font-size: 13px;
  color: #666;
  margin-right: 12px;
}

.tooltip-value {
  font-size: 13px;
  color: #333;
  font-weight: 500;
}
</style>
