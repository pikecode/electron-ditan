import { ref, computed, onMounted, onUnmounted } from 'vue'

export function useLayoutManagement() {
  // 面板宽度控制 - 调整默认宽度
  const sidebarWidth = ref(200)
  const colorPanelWidth = ref(280) // 从320减少到280

  // 计算画布区域宽度
  const canvasAreaWidth = computed(() => {
    const windowWidth = window.innerWidth
    const splitterWidth = 2 * 2 // 两个分隔器的宽度
    return windowWidth - sidebarWidth.value - colorPanelWidth.value - splitterWidth
  })

  // 窗口大小变化处理
  const handleWindowResize = () => {
    const windowWidth = window.innerWidth
    const splitterWidth = 2 * 2
    const minCanvasWidth = 300 // 减少画布最小宽度，给面板更多空间
    const maxTotalWidth = windowWidth - splitterWidth - minCanvasWidth
    
    // 当前面板总宽度
    const currentTotalWidth = sidebarWidth.value + colorPanelWidth.value
    
    if (currentTotalWidth > maxTotalWidth) {
      // 窗口变小或面板总宽度超出可用空间时，按比例缩小
      const ratio = maxTotalWidth / currentTotalWidth
      sidebarWidth.value = Math.max(180, sidebarWidth.value * ratio)
      colorPanelWidth.value = Math.max(180, colorPanelWidth.value * ratio)
    } else if (currentTotalWidth < maxTotalWidth * 0.85) {
      // 当面板总宽度小于可用空间的85%时，更积极地扩展
      const availableSpace = maxTotalWidth - currentTotalWidth
      const idealSidebarWidth = Math.min(280, windowWidth * 0.16)  // 减少理想宽度
      const idealColorPanelWidth = Math.min(400, windowWidth * 0.28) // 减少理想宽度
      
      // 优先扩展颜色面板，但不会过度扩展
      if (colorPanelWidth.value < idealColorPanelWidth && availableSpace > 0) {
        const panelIncrease = Math.min(idealColorPanelWidth - colorPanelWidth.value, availableSpace * 0.6) // 降低扩展比例
        colorPanelWidth.value += panelIncrease
      }
      
      // 如果还有剩余空间，适当扩展侧边栏
      const remainingSpace = maxTotalWidth - sidebarWidth.value - colorPanelWidth.value
      if (sidebarWidth.value < idealSidebarWidth && remainingSpace > 0) {
        const sidebarIncrease = Math.min(idealSidebarWidth - sidebarWidth.value, remainingSpace * 0.5)
        sidebarWidth.value += sidebarIncrease
      }
    }
  }

  // 处理侧边栏宽度调整
  const onSidebarResize = (newWidth) => {
    const windowWidth = window.innerWidth
    const splitterWidth = 2 * 2
    const minCanvasWidth = 300 // 减少最小画布宽度
    const minWidth = 150
    const maxWidth = Math.min(400, windowWidth - colorPanelWidth.value - splitterWidth - minCanvasWidth)
    
    // 确保新宽度在合理范围内
    const adjustedWidth = Math.min(Math.max(minWidth, newWidth), maxWidth)
    sidebarWidth.value = adjustedWidth
    
    // 如果调整后画布区域过小，触发整体布局调整
    const currentCanvasWidth = windowWidth - sidebarWidth.value - colorPanelWidth.value - splitterWidth
    if (currentCanvasWidth < minCanvasWidth) {
      handleWindowResize()
    }
  }

  // 处理颜色面板宽度调整
  const onColorPanelResize = (newWidth) => {
    const windowWidth = window.innerWidth
    const splitterWidth = 2 * 2
    const minCanvasWidth = 300 // 减少最小画布宽度
    const maxColorPanelWidth = windowWidth - sidebarWidth.value - splitterWidth - minCanvasWidth
    const minColorPanelWidth = 180 // 减少最小面板宽度
    
    // 确保新宽度在合理范围内
    const adjustedWidth = Math.min(Math.max(minColorPanelWidth, newWidth), maxColorPanelWidth)
    colorPanelWidth.value = adjustedWidth
    
    // 如果调整后画布区域过小，触发整体布局调整
    const currentCanvasWidth = windowWidth - sidebarWidth.value - colorPanelWidth.value - splitterWidth
    if (currentCanvasWidth < minCanvasWidth) {
      handleWindowResize()
    }
  }

  // 重置布局
  const resetLayout = () => {
    sidebarWidth.value = 200
    colorPanelWidth.value = 280  // 修改默认重置宽度
    handleWindowResize()
    
    return {
      success: true,
      message: '布局已重置'
    }
  }

  // 智能调整布局 - 在窗口大小变化时优化面板分布
  const smartAdjustLayout = () => {
    const windowWidth = window.innerWidth
    const splitterWidth = 2 * 2
    const minCanvasWidth = 300 // 减少最小画布宽度
    const availableWidth = windowWidth - splitterWidth
    
    // 计算更合理的比例分配 - 减少色卡面板占比
    const idealSidebarRatio = 0.16     // 侧边栏占16%
    const idealColorPanelRatio = 0.28   // 颜色面板占28% (从35%减少)
    const idealCanvasRatio = 0.56       // 画布占56% (增加)
    
    const idealSidebarWidth = Math.max(180, Math.min(320, availableWidth * idealSidebarRatio))
    const idealColorPanelWidth = Math.max(250, Math.min(450, availableWidth * idealColorPanelRatio))
    const remainingWidth = availableWidth - idealSidebarWidth - idealColorPanelWidth
    
    // 如果剩余宽度足够画布使用，采用理想分配
    if (remainingWidth >= minCanvasWidth) {
      sidebarWidth.value = idealSidebarWidth
      colorPanelWidth.value = idealColorPanelWidth
    } else {
      // 否则优先保证画布最小宽度，但仍然尽量扩展面板
      const maxPanelWidth = availableWidth - minCanvasWidth
      
      // 调整优先级分配 - 降低颜色面板的优先级
      const colorPanelPriority = 0.58 // 颜色面板优先获得58%的可用面板空间 (从65%降低)
      const targetColorPanelWidth = Math.max(220, maxPanelWidth * colorPanelPriority)
      const targetSidebarWidth = maxPanelWidth - targetColorPanelWidth
      
      sidebarWidth.value = Math.max(160, Math.min(280, targetSidebarWidth))
      colorPanelWidth.value = Math.max(220, targetColorPanelWidth)
    }
  }

  // 组件挂载时添加事件监听
  onMounted(() => {
    window.addEventListener('resize', handleWindowResize)
    // 初始化布局 - 立即执行一次，然后延迟执行确保DOM已渲染
    smartAdjustLayout()
    setTimeout(() => {
      smartAdjustLayout()
    }, 50)
    // 再次触发以确保完全加载后的调整
    setTimeout(() => {
      smartAdjustLayout()
    }, 200)
  })

  // 组件卸载时清理监听器
  onUnmounted(() => {
    window.removeEventListener('resize', handleWindowResize)
  })

  return {
    // 响应式数据
    sidebarWidth,
    colorPanelWidth,
    
    // 计算属性
    canvasAreaWidth,
    
    // 方法
    onSidebarResize,
    onColorPanelResize,
    resetLayout,
    handleWindowResize,
    smartAdjustLayout
  }
}
