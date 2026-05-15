// Caching implementation: only regenerate grid lines bitmap when key changes
let _gridCache = null
// _gridCache = { key, canvas }
function buildKey(grid, cellWidth, cellHeight, color, width, majorColor, majorWidth, majorStep) {
  return [grid?.length, grid?.height, cellWidth, cellHeight, color, width, majorColor, majorWidth, majorStep].join('x')
}

function alignedCoord(value, lineWidth) {
  const rounded = Math.round(value)
  return Math.round(lineWidth) % 2 === 1 ? rounded + 0.5 : rounded
}

export function drawGridLines(ctx, grid, cellWidth, cellHeight, { color, width, opacity, majorColor = null, majorWidth = null, majorStep = 10 }) {
  if (!ctx || !grid || !cellWidth || !cellHeight) return;
  const resolvedMinorColor = color || '#ddd'
  const resolvedMinorWidth = Math.max(0, Number(width) || 0)
  const resolvedMajorColor = majorColor || resolvedMinorColor
  const resolvedMajorWidth = majorWidth == null
    ? Math.max(resolvedMinorWidth + 1, Math.round(resolvedMinorWidth * 2.2))
    : Math.max(0, Number(majorWidth) || 0)
  const resolvedMajorStep = Math.max(1, Number(majorStep || 10))
  const key = buildKey(
    grid,
    cellWidth,
    cellHeight,
    resolvedMinorColor,
    resolvedMinorWidth,
    resolvedMajorColor,
    resolvedMajorWidth,
    resolvedMajorStep
  )
  const totalW = grid.length * cellWidth
  const totalH = grid.height * cellHeight
  if (!_gridCache || _gridCache.key !== key) {
    const off = document.createElement('canvas')
    off.width = totalW
    off.height = totalH
    const offCtx = off.getContext('2d')
    if (offCtx) {
      offCtx.save()
      offCtx.globalAlpha = 1

      if (resolvedMinorWidth > 0) {
        offCtx.strokeStyle = resolvedMinorColor
        offCtx.lineWidth = resolvedMinorWidth
        offCtx.beginPath()
        for (let c = 0; c <= grid.length; c++) {
          if (c % resolvedMajorStep === 0) continue
          const x = alignedCoord(c * cellWidth, resolvedMinorWidth)
          offCtx.moveTo(x, 0)
          offCtx.lineTo(x, totalH)
        }
        for (let r = 0; r <= grid.height; r++) {
          if (r % resolvedMajorStep === 0) continue
          const y = alignedCoord(r * cellHeight, resolvedMinorWidth)
          offCtx.moveTo(0, y)
          offCtx.lineTo(totalW, y)
        }
        offCtx.stroke()
      }

      if (resolvedMajorWidth > 0) {
        offCtx.strokeStyle = resolvedMajorColor
        offCtx.lineWidth = resolvedMajorWidth
        offCtx.beginPath()
        for (let c = 0; c <= grid.length; c += resolvedMajorStep) {
          const x = alignedCoord(c * cellWidth, resolvedMajorWidth)
          offCtx.moveTo(x, 0)
          offCtx.lineTo(x, totalH)
        }
        if (grid.length % resolvedMajorStep !== 0) {
          const endX = alignedCoord(grid.length * cellWidth, resolvedMajorWidth)
          offCtx.moveTo(endX, 0)
          offCtx.lineTo(endX, totalH)
        }
        for (let r = 0; r <= grid.height; r += resolvedMajorStep) {
          const y = alignedCoord(r * cellHeight, resolvedMajorWidth)
          offCtx.moveTo(0, y)
          offCtx.lineTo(totalW, y)
        }
        if (grid.height % resolvedMajorStep !== 0) {
          const endY = alignedCoord(grid.height * cellHeight, resolvedMajorWidth)
          offCtx.moveTo(0, endY)
          offCtx.lineTo(totalW, endY)
        }
        offCtx.stroke()
      }

      offCtx.restore()
    }
    _gridCache = { key, canvas: off }
  }
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.drawImage(_gridCache.canvas, 0, 0)
  ctx.restore()
}
export function clearGridLinesCache(){ _gridCache = null }
