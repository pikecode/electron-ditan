import { ref } from 'vue'

function fitMaxKeepingAspect(imgW, imgH, maxW, maxH) {
  if (imgW <= 0 || imgH <= 0 || maxW <= 0 || maxH <= 0) {
    throw new Error('尺寸必须为正数');
  }
  console.log("fitMaxKeepingAspect", imgW, imgH, maxW, maxH);
  const scale = Math.min(maxW / imgW, maxH / imgH);
  const width = Math.floor(imgW * scale);
  const height = Math.floor(imgH * scale);
  console.log("fitMaxKeepingAspect result", width, height);
  return { width, height };
}

export function useCanvasResize(diamondCanvasRef) {
  const lastWidth = ref(0)
  const lastHeight = ref(0)
  let resizeCleanup = null
  let resizeTimer = null

  // base image size & scale
  const baseWidth = ref(0)
  const baseHeight = ref(0)
  const zoomScale = ref(1) // current scale
  const MIN_SCALE = 0.05  // 最小缩小到 50%
  const MAX_SCALE = 6.0  // 最大放大到 500%

  // expose current canvas pixel size for rulers
  const canvasPixelWidth = ref(0)
  const canvasPixelHeight = ref(0)

  function applyScale() {
    const dc = diamondCanvasRef.value
    if (!dc) return
    if (baseWidth.value <= 0 || baseHeight.value <= 0) return
    const w = Math.round(baseWidth.value * zoomScale.value)
    const h = Math.round(baseHeight.value * zoomScale.value)
    dc.resizeCanvas(w, h)
    canvasPixelWidth.value = w
    canvasPixelHeight.value = h
  }

  function setScale(newScale) {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale))
    if (clamped === zoomScale.value) return
    zoomScale.value = clamped
    applyScale()
  }
  function zoomIn(step = 0.1) { setScale(zoomScale.value * (1 + step)) }
  function zoomOut(step = 0.1) { setScale(zoomScale.value * (1 - step)) }
  function resetZoom() { setScale(1) }

  function setupResizeObserver(imgw, imgh) {
    baseWidth.value = imgw
    baseHeight.value = imgh
    zoomScale.value = 1
    const updateSize = () => {
      // on window resize we keep same scale, just reapply
      applyScale()
    }
    const handleWindowResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(updateSize, 100)
    }
    window.addEventListener('resize', handleWindowResize)
    updateSize()
    resizeCleanup = () => window.removeEventListener('resize', handleWindowResize)
  }

  function destroyResizeObserver() {
    if (resizeCleanup) resizeCleanup()
    resizeCleanup = null
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = null
  }

  return { setupResizeObserver, destroyResizeObserver, zoomIn, zoomOut, resetZoom, setScale, zoomScale, canvasPixelWidth, canvasPixelHeight }
}
