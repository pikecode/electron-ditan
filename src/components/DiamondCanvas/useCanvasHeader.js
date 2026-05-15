import { ref } from 'vue'

// Header related controls (opacity, cell type, border width, display mode, rect selection)
export function useCanvasHeader(diamondCanvasRef) {
  const canvasConfig = ref({
    opacity: 0.8,
    cellType: 'full',
    stitchPreviewMode: 'real',
    borderWidth: 1,
    displayMode: 'both',
    showBorders: true
  })

  const handleOpacityChange = (opacity) => {
    canvasConfig.value.opacity = opacity
    const c = diamondCanvasRef.value
    c && c.setOpacity && c.setOpacity(opacity)
  }
  const handleCellTypeChange = (cellType) => {
    canvasConfig.value.cellType = cellType
    const c = diamondCanvasRef.value
    c && c.setCellType && c.setCellType(cellType)
  }
  const handleStitchPreviewModeChange = (mode) => {
    canvasConfig.value.stitchPreviewMode = mode
    const c = diamondCanvasRef.value
    c && c.setStitchPreviewMode && c.setStitchPreviewMode(mode)
  }
  const handleBorderWidthChange = (px) => {
    const width = Number(px) || 0
    canvasConfig.value.borderWidth = width
    canvasConfig.value.showBorders = width > 0
    const c = diamondCanvasRef.value
    c && c.setBorderWidth && c.setBorderWidth(width)
  }
  const handleDisplayModeChange = (mode) => {
    canvasConfig.value.displayMode = mode
    const c = diamondCanvasRef.value
    c && c.setDisplayMode && c.setDisplayMode(mode)
  }
  const handleRectSelectionChange = (enabled) => {
    const c = diamondCanvasRef.value
    c && c.setRectSelection && c.setRectSelection(!!enabled)
  }

  return {
    canvasConfig,
    handleOpacityChange,
    handleCellTypeChange,
    handleStitchPreviewModeChange,
    handleBorderWidthChange,
    handleDisplayModeChange,
    handleRectSelectionChange
  }
}
