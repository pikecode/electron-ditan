// exportTool: handles canvas export logic
import { EXPORT_DEFAULT_FORMAT } from '../../../constants/mergeDefaults.js'

function canvasToBlob(canvas, mime, quality){
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if(!blob){
        reject(new Error('canvas-to-blob-failed'))
        return
      }
      resolve(blob)
    }, mime, quality)
  })
}

function createSizedExportCanvas(sourceCanvas, exportConfig){
  const rawTargetWidth = Math.round(Number(exportConfig?.width) || 0)
  const rawTargetHeight = Math.round(Number(exportConfig?.height) || 0)
  if(rawTargetWidth <= 0 || rawTargetHeight <= 0) return sourceCanvas
  const targetWidth = Math.max(1, rawTargetWidth)
  const targetHeight = Math.max(1, rawTargetHeight)
  if(targetWidth === sourceCanvas.width && targetHeight === sourceCanvas.height) return sourceCanvas
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if(!ctx) throw new Error('export-canvas-context-unavailable')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight)
  return canvas
}

function downloadBlob(blob, fileName){
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => {
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 500)
}

export function createExportTool(ctx){
  const { canvasRef, activeSide, getImageExportConfig, addPngDpiToBlob, addJpegDpiToBlob } = ctx;

  async function exportImage(fmt = EXPORT_DEFAULT_FORMAT){
    const sourceCanvas = canvasRef.value
    if(!sourceCanvas) return
    const mime = fmt === 'jpeg' ? 'image/jpeg' : 'image/png'
    const exportConfig = typeof getImageExportConfig === 'function' ? getImageExportConfig(fmt) : null
    const exportCanvas = createSizedExportCanvas(sourceCanvas, exportConfig)
    let blob = await canvasToBlob(exportCanvas, mime, fmt === 'jpeg' ? 0.92 : undefined)
    const dpi = Number(exportConfig?.dpi) || 0
    if(fmt === 'png' && dpi > 0 && typeof addPngDpiToBlob === 'function'){
      blob = await addPngDpiToBlob(blob, dpi)
    }
    if(fmt === 'jpeg' && dpi > 0 && typeof addJpegDpiToBlob === 'function'){
      blob = await addJpegDpiToBlob(blob, dpi)
    }
    downloadBlob(blob, `cover_${activeSide.value}.${fmt}`)
  }

  return { exportImage };
}
