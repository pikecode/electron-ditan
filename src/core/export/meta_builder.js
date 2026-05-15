import { v4 as uuidv4 } from 'uuid'

function clonePlainObject(obj) {
  return obj && typeof obj === 'object' ? JSON.parse(JSON.stringify(obj)) : null
}

function deriveCellType(diamondCanvas) {
  const renderMode = diamondCanvas?._renderer?.stitchStyle?.renderMode
  if (renderMode === 'mixed') return 'mixed'
  if (renderMode === 'cross') return 'x'
  return diamondCanvas?._gridModel?.type === 'x' ? 'x' : 'full'
}

export function buildDisplayConfig(diamondCanvas) {
  const dc = diamondCanvas
  const renderer = dc?._renderer
  const canvas = renderer?.getCanvas?.()

  return {
    opacity: Number(renderer?.backgroundOpacity ?? 1),
    cellType: deriveCellType(dc),
    displayMode: dc?._displayMode || 'both',
    borderWidth: Number(renderer?.gridLineWidth ?? 0),
    gridBackgroundVisible: !!dc?._gridModeBackgroundVisible,
    renderStyle: clonePlainObject(renderer?.stitchStyle) || { renderMode: 'solid', previewMode: 'real' },
    gridStyle: {
      color: renderer?.gridLineColor || '#ddd',
      width: Number(renderer?.gridLineWidth ?? 0),
      opacity: Number(renderer?.gridLineOpacity ?? 1),
      majorColor: renderer?.gridMajorLineColor || renderer?.gridLineColor || '#ddd',
      majorWidth: Number(renderer?.gridMajorLineWidth ?? 0),
      majorStep: Number(renderer?.gridMajorLineStep ?? 10),
      layer: renderer?.gridLineLayer || 'overlay'
    },
    canvasBackgroundColor: canvas?.backgroundColor || dc?.defaultBackgroundColor || '#ffffff'
  }
}

// 构建项目元数据 (简化版：无逐格编码，仅颜色统计)
export function buildProjectMeta(diamondCanvas, { projectName, paletteType } = {}) {
  const dc = diamondCanvas
  const colorStat = dc.getColorCount() || {}
  const colors = Object.entries(colorStat).map(([hex, v]) => ({
    id: v.color_id,
    hex,
    count: v.count
  }))

  const rows = dc.height_cell
  const cols = dc.width_cell

  const now = new Date().toISOString()
  const meta = {
    version: 1,
    project: {
      id: uuidv4(),
      name: projectName || 'Untitled',
      paletteType: paletteType || 'UNKNOWN',
      createdAt: now,
      updatedAt: now
    },
    grid: {
      rows,
      cols,
      cellSizeCm: dc.cell_size || null,
      borderWidth: dc._renderer?.gridLineWidth || 0,
      showGrid: !!dc._renderer?.gridVisible
    },
    palette: {
      totalColors: colors.length,
      colors
    },
    background: {
      hasImage: !!dc.backgroundImageBase64
    },
    display: buildDisplayConfig(dc)
  }
  return meta
}

// 构建 manifest (轻量)
export function buildManifest(meta, filesPresence) {
  return {
    format: 'EasyStitch',
    version: 1,
    name: meta?.project?.name,
    createdAt: meta?.project?.createdAt,
    rows: meta?.grid?.rows,
    cols: meta?.grid?.cols,
    files: {
      meta: 'data/project_meta.json',
      gridPurePng: filesPresence.gridPurePng ? 'grid_pure.png' : undefined,
      gridPureJpg: filesPresence.gridPureJpg ? 'grid_pure.jpg' : undefined
    }
  }
}
