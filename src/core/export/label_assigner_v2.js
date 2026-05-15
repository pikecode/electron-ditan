// 负责颜色统计排序与标签分配 (A..Z A1..Z1 A2..)
export function buildPaletteAndLabels(colorStats) {
  // colorStats: Map colorId -> { hex, count }
  const entries = Array.from(colorStats.values())
    .sort((a,b)=> a.colorId  - b.colorId)
  function idxToLabel(idx){
    const base = idx % 26
    const cycle = Math.floor(idx / 26)
    const letter = String.fromCharCode(65 + base)
    return cycle === 0 ? letter : `${letter}${cycle}`
  }
  const palette = []
  const labelMap = {}
  entries.forEach((e, i) => {
    const label = idxToLabel(i)
    palette.push({ order:i, label, colorId: e.colorId, hex: e.hex, count: e.count })
    labelMap[e.colorId] = label
  })
  return { palette, labelMap }
}
