import { ref, computed } from 'vue'

export function useCanvasSettings() {
  // 画布设置
  const canvasWidth = ref(30.0)  // cm
  const canvasHeight = ref(40.0) // cm
  const gridSize = ref(0.614)    // cm

  // 转换设置
  const colorCount = ref(64)
  const ditherMode = ref('floyd')

  // 计算属性
  const gridCountX = computed(() => {
    if (!canvasWidth.value || !gridSize.value) return 0
    return Math.floor(canvasWidth.value / gridSize.value)
  })

  const gridCountY = computed(() => {
    if (!canvasHeight.value || !gridSize.value) return 0
    return Math.floor(canvasHeight.value / gridSize.value)
  })

  // 更新方法
  const updateCanvasWidth = (value) => {
    canvasWidth.value = value
  }

  const updateCanvasHeight = (value) => {
    canvasHeight.value = value
  }

  const updateGridSize = (value) => {
    gridSize.value = value
  }

  const updateColorCount = (value) => {
    colorCount.value = value
  }

  const updateDitherMode = (value) => {
    ditherMode.value = value
  }

  // 重置设置
  const resetSettings = () => {
    canvasWidth.value = 30.0
    canvasHeight.value = 40.0
    gridSize.value = 0.614
    colorCount.value = 64
    ditherMode.value = 'floyd'
    
    return {
      success: true,
      message: '设置已重置'
    }
  }

  return {
    // 响应式数据
    canvasWidth,
    canvasHeight,
    gridSize,
    colorCount,
    ditherMode,
    
    // 计算属性
    gridCountX,
    gridCountY,
    
    // 方法
    updateCanvasWidth,
    updateCanvasHeight,
    updateGridSize,
    updateColorCount,
    updateDitherMode,
    resetSettings
  }
}
