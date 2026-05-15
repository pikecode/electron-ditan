import { buildPaletteAndLabels } from './label_assigner_v2.js'
import { generateColoredImages, generateGridCellImages } from './image_colored_v2.js'
import { buildDisplayConfig } from './meta_builder.js'
import { isDefaultCellId, isTransparentCellColor } from '../cellState.js'

function collectColorStats(dc) {
  const stats = new Map() // key colorId
  const model = dc._gridModel
  if (!model) return stats
  const rows = model.GetHeight()
  const cols = model.GetWidth()
  for (let r=0;r<rows;r++) {
    for (let c=0;c<cols;c++) {
      const cell = model.getCell(r,c)
      if (!cell) continue
      const colorId = cell.color_id
      const hex = cell.color
      if (!colorId || isDefaultCellId(colorId)) continue
      if (isTransparentCellColor(hex)) continue
      let rec = stats.get(colorId)
      if (!rec) { rec = { colorId, hex, count:0 }; stats.set(colorId, rec) }
      rec.count++
    }
  }
  return stats
}

export function buildSaveDataV2(dc, { projectName } = {}) {
  const model = dc._gridModel
  if (!model) throw new Error('grid model not ready')
  const rows = model.GetHeight()
  const cols = model.GetWidth()
  // 保存项目时必须使用原图尺寸，不能使用编辑器当前缩放后的画布尺寸
  const image_width = dc.origin_image_width || dc.image_width
  const image_height = dc.origin_image_height || dc.image_height
  const colorStats = collectColorStats(dc)
  const { palette, labelMap } = buildPaletteAndLabels(colorStats)
  // colorId -> palette index
  const indexMap = {}; palette.forEach(p=> indexMap[p.colorId] = p.order)
  const cells = []
  for (let r=0;r<rows;r++) {
    const rowArr = []
    for (let c=0;c<cols;c++) {
      const cell = model.getCell(r,c)
      if (!cell) { rowArr.push({ color:'transparent', colorId:-1, label:'' }); continue }
      const isTransparent = isTransparentCellColor(cell.color)
      const colorId = isDefaultCellId(cell.color_id) ? -1 : (cell.color_id || -1)
      const hex = (isTransparent || !cell.color) ? 'transparent' : cell.color
      const label = (colorId === -1 || isTransparent) ? '' : (labelMap[colorId] || '')
      rowArr.push({ color:hex, colorId, label })
    }
    cells.push(rowArr)
  }
  return {
    version:2,
    savedAt:new Date().toISOString(),
    projectName: projectName || 'Project',
    grid:{ rows, cols },
    palette, labelMap,
    cells:{ image_height, image_width, rows, cols, data: cells },
    images:null, // 后续填
    meta:{ labelScheme:'A..Z,A1..', emptyColorId:-1 },
    display: buildDisplayConfig(dc)
  }
}

export async function saveProjectV2(dc, { projectName, quality=0.92 } = {}) {
  const data = buildSaveDataV2(dc,{ projectName })
  // 生成基于网格的 4 张图片(full/x * png/jpeg) + 旧兼容彩色图(full)
  try {
    const gridImgs = generateGridCellImages(dc,{ quality })
    data.images = {
      full: gridImgs.full,
      x: gridImgs.x,
    }
  } catch(e){ console.warn('generate grid images failed', e) }
  return data
}
