export const DEFAULT_CELL_ID = 'DEFAULT'
export const CUTOUT_CELL_ID = 'ERASED'
export const CUTOUT_CELL_ALIASES = new Set([CUTOUT_CELL_ID, 'CUTOUT', 'cutout', 'erased'])
export const TRANSPARENT_CELL_COLOR = '#FFFFFF00'

export function normalizeCellId(cellId) {
  if (cellId == null) return DEFAULT_CELL_ID
  if (typeof cellId === 'string') {
    const trimmed = cellId.trim()
    return trimmed || DEFAULT_CELL_ID
  }
  return cellId
}

export function isDefaultCellId(cellId) {
  const id = normalizeCellId(cellId)
  return id === DEFAULT_CELL_ID || id === 'default' || id === -1 || id === '-1'
}

export function isCutoutCellId(cellId) {
  const id = normalizeCellId(cellId)
  return CUTOUT_CELL_ALIASES.has(id)
}

export function isTransparentCellColor(color) {
  if (color == null) return true
  const raw = String(color).trim()
  if (!raw) return true
  const lower = raw.toLowerCase()
  if (
    lower === 'transparent' ||
    lower === 'rgba(0,0,0,0)' ||
    lower === 'rgba(0, 0, 0, 0)' ||
    lower === 'rgba(255,255,255,0)' ||
    lower === 'rgba(255, 255, 255, 0)'
  ) {
    return true
  }
  const hex = raw.startsWith('#') ? raw.slice(1) : raw
  return /^[0-9a-fA-F]{8}$/.test(hex) && hex.endsWith('00')
}

export function buildCutoutCell() {
  return { id: CUTOUT_CELL_ID, hex: TRANSPARENT_CELL_COLOR }
}
