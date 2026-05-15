import {
  normalizeStitchPreviewMode,
  resolveCrossGeometry,
  resolveCrossOutlineColor,
  resolveCrossOutlineWidth,
  resolveCrossStrokeColor,
  resolveCrossStrokeWidth,
  shouldDrawCrossOutline,
  shouldDrawTexturePreview,
  STITCH_CROSS_LINE_CAP,
  STITCH_CROSS_LINE_JOIN,
  STITCH_TEXTURE_CROSS_COLOR
} from '../renderer/stitchColor.js'

function drawTextureCross(ctx, x, y, cellWidth, cellHeight) {
  const base = Math.min(cellWidth, cellHeight)
  const lw = resolveCrossStrokeWidth(base, { maxWidth: 3.4 })
  const { startX, startY, endX, endY } = resolveCrossGeometry(x, y, cellWidth, cellHeight, {
    strokeWidth: lw
  })
  ctx.save()
  ctx.lineWidth = lw
  ctx.strokeStyle = STITCH_TEXTURE_CROSS_COLOR
  ctx.lineCap = STITCH_CROSS_LINE_CAP
  ctx.lineJoin = STITCH_CROSS_LINE_JOIN
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.moveTo(endX, startY)
  ctx.lineTo(startX, endY)
  ctx.stroke()
  ctx.restore()
}

// 基于 GridModel 直接按原始尺寸渲染生成图片 (full / x)
// 保留旧导出名兼容（若外部还引用 generateColoredImages 则返回 full 结果）
export function generateGridCellImages(diamondCanvas, { quality = 0.92, backgroundColor = null } = {}) {
  const model = diamondCanvas?._gridModel
  const w = diamondCanvas?.origin_image_width || 0
  const h = diamondCanvas?.origin_image_height || 0
  const stitchStyle = diamondCanvas?._renderer?.stitchStyle || {}
  console.log("generateGridCellImages w h",w, h)
  if (!model || !w || !h) throw new Error('grid model 或 尺寸未就绪')
  const rows = model.GetHeight(); const cols = model.GetWidth()
  if (!rows || !cols) throw new Error('无有效网格尺寸')

  // 解决 fillRect 浮点导致的细缝/边框：将每个单元格映射为整数像素区域并保证覆盖整个画布
  const colStarts = new Array(cols)
  const colWidths = new Array(cols)
  for (let c=0;c<cols;c++) {
    const start = Math.round(c * w / cols)
    const end = (c === cols - 1) ? w : Math.round((c+1) * w / cols)
    colStarts[c] = start
    colWidths[c] = end - start
  }
  const rowStarts = new Array(rows)
  const rowHeights = new Array(rows)
  for (let r=0;r<rows;r++) {
    const start = Math.round(r * h / rows)
    const end = (r === rows - 1) ? h : Math.round((r+1) * h / rows)
    rowStarts[r] = start
    rowHeights[r] = end - start
  }

  function draw(mode){
    const off = document.createElement('canvas')
    off.width = w; off.height = h
    const ctx = off.getContext('2d')
    ctx.imageSmoothingEnabled = false
    const previewMode = normalizeStitchPreviewMode(stitchStyle.previewMode)
    // full 模式改为透明背景；若指定 backgroundColor 则填充该色
    if (mode === 'full' && backgroundColor) { ctx.fillStyle = backgroundColor; ctx.fillRect(0,0,w,h) }
    for (let r=0;r<rows;r++) {
      for (let c=0;c<cols;c++) {
        const cell = model.getCell(r,c)
        if (!cell) continue
        const color = cell.color
        const x = colStarts[c]
        const y = rowStarts[r]
        const cellWidth = colWidths[c]
        const cellHeight = rowHeights[r]
        if (mode==='full') {
          if (!color || color==='transparent' || color==='#FFFFFF00') continue
          ctx.fillStyle = color
          ctx.fillRect(x, y, cellWidth, cellHeight)
        } else if (mode==='x') {
          if (shouldDrawTexturePreview(previewMode)) {
            drawTextureCross(ctx, x, y, cellWidth, cellHeight)
          }
          if (!color || color==='transparent' || color==='#FFFFFF00') continue
          // 为每个格子单独裁剪，绘制粗体 X，保持背景透明
          ctx.save()
          ctx.beginPath(); ctx.rect(x, y, cellWidth, cellHeight); ctx.clip()
          const base = Math.min(cellWidth, cellHeight)
          const lw = resolveCrossStrokeWidth(base, { maxWidth: 3.4 })
          const { startX, startY, endX, endY } = resolveCrossGeometry(x, y, cellWidth, cellHeight, {
            strokeWidth: lw
          })
          if (shouldDrawCrossOutline(color, stitchStyle.outlined, previewMode)) {
            ctx.lineWidth = resolveCrossOutlineWidth(lw, {
              outlineThickness: stitchStyle.outlineThickness || 0.2,
              color,
              previewMode
            })
            ctx.strokeStyle = resolveCrossOutlineColor(
              color,
              stitchStyle.outlineColor || null,
              stitchStyle.outlineColorPercentage || 80,
              previewMode
            )
            ctx.lineCap = STITCH_CROSS_LINE_CAP
            ctx.lineJoin = STITCH_CROSS_LINE_JOIN
            ctx.beginPath()
            ctx.moveTo(startX, startY)
            ctx.lineTo(endX, endY)
            ctx.moveTo(endX, startY)
            ctx.lineTo(startX, endY)
            ctx.stroke()
          }
          ctx.lineWidth = lw
          ctx.strokeStyle = resolveCrossStrokeColor(color)
          ctx.lineCap = STITCH_CROSS_LINE_CAP
          ctx.lineJoin = STITCH_CROSS_LINE_JOIN
          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.moveTo(endX, startY)
          ctx.lineTo(startX, endY)
          ctx.stroke()
          ctx.restore()
        }
      }
    }
    const png = off.toDataURL('image/png')
    const jpeg = off.toDataURL('image/jpeg', quality)
    return { png, jpeg }
  }

  return { full: draw('full'), x: draw('x') }
}

// 兼容旧函数名：返回 full 图 (原代码结构期望 colored.png/jpeg)
export function generateColoredImages(dc, opts){
  const imgs = generateGridCellImages(dc, opts)
  return { png: imgs.full.png, jpeg: imgs.full.jpeg }
}
