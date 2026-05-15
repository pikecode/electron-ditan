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
} from '../stitchColor.js'
import { isCutoutCellId, isDefaultCellId } from '../../cellState.js'

let last_type = null;

/** 未上色 / 透明格：不参与着色块绘制（#FFFFFF00 等否则会在离屏上产生异常叠色，看起来像「消色失败」） */
function isCellVisuallyPainted(color) {
  if (color == null || color === '') return false
  const s = String(color).trim().toLowerCase()
  if (s === 'transparent') return false
  if (s === '#ffffff00') return false
  // 8 位 hex：alpha=0 视为透明（与消色/默认格一致）
  if (/^#[0-9a-f]{8}$/i.test(s)) {
    const a = parseInt(s.slice(7, 9), 16)
    if (a === 0) return false
  }
  if (s === 'rgba(0,0,0,0)' || s === 'rgba(0, 0, 0, 0)') return false
  if (s === 'rgba(255,255,255,0)' || s === 'rgba(255, 255, 255, 0)') return false
  return true
}

/** 是否在该格绘制有色层（full / 叉）：与格子数据绑定，避免仅因 hex 异常把 DEFAULT 画成实色白盖住底图 */
function shouldDrawCellInk(cell) {
  if (!cell) return false
  const id = cell.color_id
  if (isDefaultCellId(id) || isCutoutCellId(id)) return false
  return isCellVisuallyPainted(cell.color)
}

function clampGapPixels(gapPixels, cellWidth, cellHeight) {
  const maxGap = Math.max(0, Math.floor(Math.min(cellWidth, cellHeight) / 4))
  return Math.max(0, Math.min(maxGap, Number(gapPixels) || 0))
}

function drawCellFill(ctx, cellColor, x, y, cellWidth, cellHeight, gapPixels) {
  const pad = clampGapPixels(gapPixels, cellWidth, cellHeight)
  const drawW = Math.max(0, cellWidth - pad * 2)
  const drawH = Math.max(0, cellHeight - pad * 2)
  if (drawW <= 0 || drawH <= 0) return
  ctx.fillStyle = cellColor
  ctx.fillRect(x + pad, y + pad, drawW, drawH)
}

function drawCellTextureCross(ctx, x, y, cellWidth, cellHeight, gapPixels = 0) {
  const pad = clampGapPixels(gapPixels, cellWidth, cellHeight)
  const baseSize = Math.min(cellWidth, cellHeight) - pad * 2
  if (baseSize <= 0) return

  const strokeWidth = resolveCrossStrokeWidth(baseSize, { maxWidth: 3.4 })
  const { startX, startY, endX, endY } = resolveCrossGeometry(x, y, cellWidth, cellHeight, {
    pad,
    strokeWidth
  })

  ctx.save()
  ctx.globalAlpha = 1
  ctx.lineCap = STITCH_CROSS_LINE_CAP
  ctx.lineJoin = STITCH_CROSS_LINE_JOIN
  ctx.strokeStyle = STITCH_TEXTURE_CROSS_COLOR
  ctx.lineWidth = strokeWidth
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.moveTo(endX, startY)
  ctx.lineTo(startX, endY)
  ctx.stroke()
  ctx.restore()
}

function drawCellCross(ctx, cellColor, x, y, cellWidth, cellHeight, drawOpts = {}) {
  const {
    gapPixels = 0,
    crossContrastOnOverlay = false,
    outlined = false,
    outlineColor = null,
    outlineColorPercentage = 80,
    outlineThickness = 0.2,
    previewMode = 'real'
  } = drawOpts

  const pad = clampGapPixels(gapPixels, cellWidth, cellHeight)
  const baseSize = Math.min(cellWidth, cellHeight) - pad * 2
  if (baseSize <= 0) return

  const strokeWidth = resolveCrossStrokeWidth(baseSize, { maxWidth: 3.4 })
  const { startX, startY, endX, endY } = resolveCrossGeometry(x, y, cellWidth, cellHeight, {
    pad,
    strokeWidth
  })

  ctx.save()
  ctx.globalAlpha = 1
  ctx.lineCap = STITCH_CROSS_LINE_CAP
  ctx.lineJoin = STITCH_CROSS_LINE_JOIN

  if (shouldDrawCrossOutline(cellColor, outlined, previewMode)) {
    const outlineWidth = resolveCrossOutlineWidth(strokeWidth, {
      outlineThickness,
      color: cellColor,
      previewMode
    })
    ctx.strokeStyle = resolveCrossOutlineColor(cellColor, outlineColor, outlineColorPercentage, previewMode)
    ctx.lineWidth = outlineWidth
    ctx.beginPath()
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.moveTo(endX, startY)
    ctx.lineTo(startX, endY)
    ctx.stroke()
  }

  ctx.strokeStyle = resolveCrossStrokeColor(cellColor)
  ctx.lineWidth = strokeWidth
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.moveTo(endX, startY)
  ctx.lineTo(startX, endY)
  ctx.stroke()
  ctx.restore()
}

export function directDrawCells(baseCtx, grid, cellWidth, cellHeight, opts = {}) {
  if (!baseCtx || !grid || !cellHeight || !cellWidth) return;
  const cells = grid.get_cells();
  if (!cells || !cells.length) return;
  const type = grid.type;
  const { rasterCtx, rasterCanvas, fullRedrawNeeded, afterDraw, crossContrastOnOverlay = false, stitchStyle = {} } = opts;
  if (!rasterCtx || !rasterCanvas) return; // 必须有离屏
  let need_draw_all = false;
  if (last_type !== type) {
    need_draw_all = true; // 如果类型变了，强制全量重绘
  }

  // 全量重绘：把所有 cell 画到离屏
  if (fullRedrawNeeded || need_draw_all) {
    rasterCtx.clearRect(0, 0, rasterCanvas.width, rasterCanvas.height);
    for (let r = 0; r < cells.length; r++) {
      const row = cells[r];
      if (!row) continue;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        drawOne(rasterCtx, type, cell, r, c, cellWidth, cellHeight, false, { crossContrastOnOverlay, stitchStyle });
      }
    }
  } else {
    // 增量: 只重绘 change_list 里的 cell (在离屏上先清再画)
    const change_list = grid.getChangeList();
    if (change_list && change_list.size) {
      for (const [key, cell] of change_list) {
        const [rStr, cStr] = key.split(',');
        const r = Number(rStr); const c = Number(cStr);
        if (!Number.isInteger(r) || !Number.isInteger(c)) continue;
        clearOne(rasterCtx, r, c, cellWidth, cellHeight);
        drawOne(rasterCtx, type, cell, r, c, cellWidth, cellHeight, false, { crossContrastOnOverlay, stitchStyle });
      }
    }
  }

  // 将离屏缓冲一次性绘制到 baseCtx
  baseCtx.drawImage(rasterCanvas, 0, 0);
  afterDraw && afterDraw();
  last_type = type; // 记录上次类型，避免重复绘制同类型时不必要的清除

}

function clearOne(ctx, r, c, cellWidth, cellHeight) {
  ctx.clearRect(c * cellWidth, r * cellHeight, cellWidth, cellHeight);
}

function drawOne(ctx, type, cell, r, c, cellWidth, cellHeight, needClear = true, drawOpts = {}) {
  const {
    crossContrastOnOverlay = false,
    stitchStyle = {}
  } = drawOpts
  const x = c * cellWidth;
  const y = r * cellHeight;
  if (needClear) ctx.clearRect(x, y, cellWidth, cellHeight);
  const renderMode = stitchStyle.renderMode || (type === 'x' ? 'cross' : 'solid')
  const previewMode = normalizeStitchPreviewMode(stitchStyle.previewMode)

  if (renderMode === 'cross' && shouldDrawTexturePreview(previewMode)) {
    drawCellTextureCross(ctx, x, y, cellWidth, cellHeight, stitchStyle.gapPixels || 0)
  }

  let drew = false;
  if (shouldDrawCellInk(cell)) {
    const crossOpts = {
      gapPixels: stitchStyle.gapPixels || 0,
      crossContrastOnOverlay,
      outlined: !!stitchStyle.outlined,
      outlineColor: stitchStyle.outlineColor || null,
      outlineColorPercentage: stitchStyle.outlineColorPercentage || 80,
      outlineThickness: stitchStyle.outlineThickness || 0.2,
      previewMode
    }

    if (renderMode === 'solid') {
      drawCellFill(ctx, cell.color, x, y, cellWidth, cellHeight, stitchStyle.gapPixels || 0)
      drew = true
    } else if (renderMode === 'mixed') {
      drawCellFill(ctx, cell.color, x, y, cellWidth, cellHeight, stitchStyle.gapPixels || 0)
      drawCellCross(ctx, cell.color, x, y, cellWidth, cellHeight, crossOpts)
      drew = true
    } else {
      drawCellCross(ctx, cell.color, x, y, cellWidth, cellHeight, crossOpts)
      drew = true
    }
  }
  let textStr = ''
  if (cell.show_text && cell.text != null) {
    try { textStr = String(cell.text) } catch(_) { textStr = '' }
  }
  const trimmed = textStr.trim()
  let shouldDrawText = cell.show_text
  if (shouldDrawText && drew && cell.color_id && !isDefaultCellId(cell.color_id) && !isCutoutCellId(cell.color_id)) {
    ctx.save();
    const fontSize = Math.max(8, Math.min(cellWidth, cellHeight) * 0.4);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 自动选择文字颜色（简单亮度判断）
    let textColor = '#000';
    if (cell.color && /^#?[0-9a-fA-F]{6}/.test(cell.color)) {
      const hex = cell.color.replace('#','').slice(0,6);
      const rC = parseInt(hex.substr(0,2),16);
      const gC = parseInt(hex.substr(2,2),16);
      const bC = parseInt(hex.substr(4,2),16);
      const luminance = 0.299*rC + 0.587*gC + 0.114*bC;
      textColor = luminance < 140 ? '#fff' : '#000';
    }
    ctx.fillStyle = textColor;
    if (isDefaultCellId(cell.text) || isCutoutCellId(cell.text)) {
      return; // 如果是默认文字，不绘制
    }
    const label = trimmed.slice(0,6); // 截断防止太长
    ctx.fillText(label, x + cellWidth/2, y + cellHeight/2, cellWidth - 2);
    ctx.restore();
  }
}
