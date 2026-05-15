// 生成图像导出（只在渲染进程使用）
// 需要 fabric Canvas 实例

function dataUrlToRaw(dataUrl) {
  return dataUrl // 保留前缀，主进程再处理
}

function nextFrame() { return new Promise(r => requestAnimationFrame(r)) }

function drawGridLinesOffscreen(ctx, renderer) {
  if (!renderer || !renderer.grid || !renderer.cellWidth || !renderer.cellHeight) return
  if (!renderer.gridVisible) return
  const w = renderer.grid.length * renderer.cellWidth
  const h = renderer.grid.height * renderer.cellHeight
  ctx.save()
  ctx.globalAlpha = renderer.gridLineOpacity
  ctx.strokeStyle = renderer.gridLineColor
  ctx.lineWidth = renderer.gridLineWidth
  ctx.beginPath()
  for (let c = 0; c <= renderer.grid.length; c++) {
    const x = Math.round(c * renderer.cellWidth) + 0.5
    ctx.moveTo(x, 0)
    ctx.lineTo(x, h)
  }
  for (let r = 0; r <= renderer.grid.height; r++) {
    const y = Math.round(r * renderer.cellHeight) + 0.5
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
  }
  ctx.stroke()
  ctx.restore()
}

export async function exportBaseImages(diamondCanvas, { quality = 0.9, includeBorder = true } = {}) {
  const canvas = diamondCanvas.getFabricCanvas()
  if (!canvas) throw new Error('No fabric canvas')

  // 基础 PNG (当前状态)
  const canvasPng = dataUrlToRaw(canvas.toDataURL({ format: 'png' }))

  // 生成无网格 JPG: 临时隐藏网格线再导出
  const renderer = diamondCanvas._renderer
  const prevStyle = { color: renderer.gridLineColor, width: renderer.gridLineWidth, opacity: renderer.gridLineOpacity, visible: renderer.gridVisible }
  renderer.setGridLineStyle({ color: '#ffffff00', width: 0, opacity: 0 })
  renderer.setGridVisibility(true) // 对象仍在，只是线透明
  canvas.requestRenderAll(); await nextFrame()
  const canvasJpg = dataUrlToRaw(canvas.toDataURL({ format: 'jpeg', quality }))

  // 还原线样式
  renderer.setGridLineStyle({ color: prevStyle.color, width: prevStyle.width, opacity: prevStyle.opacity })
  renderer.setGridVisibility(prevStyle.visible)
  canvas.requestRenderAll(); await nextFrame()

  let canvasBorderJpg = null
  if (includeBorder) {
    // 离屏合成带线版本
    const baseEl = canvas.toCanvasElement()
    const off = document.createElement('canvas')
    off.width = baseEl.width
    off.height = baseEl.height
    const ctx = off.getContext('2d')
    ctx.drawImage(baseEl, 0, 0)
    // 重新画网格线
    if (renderer && renderer.grid && renderer.cellWidth && renderer.cellHeight && renderer.gridVisible) {
      const w = renderer.grid.length * renderer.cellWidth
      const h = renderer.grid.height * renderer.cellHeight
      ctx.save();
      ctx.globalAlpha = renderer.gridLineOpacity
      ctx.strokeStyle = renderer.gridLineColor
      ctx.lineWidth = renderer.gridLineWidth
      ctx.beginPath()
      for (let c = 0; c <= renderer.grid.length; c++) {
        const x = Math.round(c * renderer.cellWidth) + 0.5
        ctx.moveTo(x, 0); ctx.lineTo(x, h)
      }
      for (let r = 0; r <= renderer.grid.height; r++) {
        const y = Math.round(r * renderer.cellHeight) + 0.5
        ctx.moveTo(0, y); ctx.lineTo(w, y)
      }
      ctx.stroke(); ctx.restore()
    }
    canvasBorderJpg = off.toDataURL('image/jpeg', quality)
  }

  return { canvasPng, canvasJpg, canvasBorderJpg }
}

export function generateGridImage(diamondCanvas, { format = 'png', scale = 1, drawGrid = false, background = 'transparent', quality = 0.92 } = {}) {
  const renderer = diamondCanvas._renderer
  const model = diamondCanvas._gridModel
  if (!renderer || !model) throw new Error('Grid not ready')
  const rows = model.height
  const cols = model.length
  const cellW = renderer.cellWidth || (renderer.getCanvas?.().width / cols)
  const cellH = renderer.cellHeight || (renderer.getCanvas?.().height / rows)
  const outW = Math.ceil(cols * cellW * scale)
  const outH = Math.ceil(rows * cellH * scale)
  const off = document.createElement('canvas')
  off.width = outW
  off.height = outH
  const ctx = off.getContext('2d')
  if (background && background !== 'transparent') {
    ctx.fillStyle = background
    ctx.fillRect(0,0,outW,outH)
  }
  // 逐格绘制
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = model.getCell(r, c)
      if (!cell) continue
      const color = cell.color
      if (!color || color === 'transparent' || /#?ffffff00/i.test(color) || /rgba\(0,0,0,0\)/i.test(color)) continue
      ctx.fillStyle = color
      const x = c * cellW * scale
      const y = r * cellH * scale
      ctx.fillRect(Math.round(x), Math.round(y), Math.ceil(cellW * scale), Math.ceil(cellH * scale))
    }
  }
  if (drawGrid) {
    ctx.save()
    ctx.strokeStyle = renderer.gridLineColor || '#ddd'
    ctx.lineWidth = (renderer.gridLineWidth || 1) * scale
    ctx.globalAlpha = renderer.gridLineOpacity || 1
    ctx.beginPath()
    for (let c = 0; c <= cols; c++) {
      const x = Math.round(c * cellW * scale) + 0.5
      ctx.moveTo(x, 0); ctx.lineTo(x, outH)
    }
    for (let r = 0; r <= rows; r++) {
      const y = Math.round(r * cellH * scale) + 0.5
      ctx.moveTo(0, y); ctx.lineTo(outW, y)
    }
    ctx.stroke();
    ctx.restore()
  }
  const mime = (format === 'jpeg' || format === 'jpg') ? 'image/jpeg' : 'image/png'
  return off.toDataURL(mime, quality)
}

export function generateGridImageBoth(diamondCanvas, opts = {}) {
  const { scale = 1, drawGrid = false, background = 'transparent', quality = 0.92 } = opts
  const png = generateGridImage(diamondCanvas, { format: 'png', scale, drawGrid, background, quality })
  const jpg = generateGridImage(diamondCanvas, { format: 'jpeg', scale, drawGrid, background: background === 'transparent' ? '#ffffff' : background, quality })
  return { png, jpg }
}
