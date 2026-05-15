import { hexToRgb, rgbToLab } from './color_space.js'
// Removed kmeans + deltaE imports; new count mode uses frequency + diversity selection

// Build palette from group or count.
// paletteConfig: { type:'group', colors:[{id,hex,name}] } OR { type:'count', colorCount, allColors:[{id,hex,name}] }
// sampleColors: array of {r,g,b}
export function buildPalette(paletteConfig, sampleColors) {
  if (!paletteConfig) return []
  const { colorCount, allColors=[] } = paletteConfig
  const allEntries = allColors.map(c => normalizeEntry(c))
  if (allEntries.length === 0 || colorCount <= 0) return []

  // 1) Precompute labs for samples
  const sampleLabs = sampleColors.map(c => rgbToLab(c))

  // 2) Frequency mapping: for each sample find nearest palette color (Euclidean in Lab)
  const freq = new Map() // id => {entry,count}
  for (const lab of sampleLabs) {
    let best=null; let bestDist=Infinity
    for (const entry of allEntries) {
      const d = dist2Lab(lab, entry.lab)
      if (d < bestDist) { bestDist=d; best=entry }
    }
    if (!best) continue
    const rec = freq.get(best.id)
    if (rec) rec.count++
    else freq.set(best.id, { entry: best, count: 1 })
  }

  // 3) Sort by frequency desc (guarantee the most used colors are chosen)
  const ranked = Array.from(freq.values())
    .sort((a,b)=> b.count - a.count)
    .map(r=>r.entry)

  // 4) Take topN first
  const selected = []
  const used = new Set()
  for (const e of ranked) {
    if (selected.length >= colorCount) break
    selected.push(e); used.add(e.id)
  }

  // 5) Diversity supplement (farthest point) if still need more colors
  if (selected.length < colorCount) {
    // Candidate pool: colors never used OR low frequency
    const remaining = allEntries.filter(e => !used.has(e.id))
    while (selected.length < colorCount && remaining.length) {
      let bestCand=null; let bestMinDist=-1
      for (const cand of remaining) {
        let minD = Infinity
          for (const sel of selected) {
            const d = dist2Lab(cand.lab, sel.lab)
            if (d < minD) minD = d
            if (minD === 0) break
          }
        if (minD > bestMinDist) { bestMinDist = minD; bestCand = cand }
      }
      if (!bestCand) break
      selected.push(bestCand); used.add(bestCand.id)
      // remove chosen from remaining
      const idx = remaining.findIndex(e=>e.id===bestCand.id)
      if (idx>=0) remaining.splice(idx,1)
    }
  }

  return selected
}

function normalizeEntry(c){
  const rgb = hexToRgb(c.hex)
  return { id: c.id || c.code || c.name, name: c.name || c.id, hex: c.hex, rgb, lab: rgbToLab(rgb) }
}
function dist2Lab(a,b){ const dL=a.L-b.L, da=a.a-b.a, db=a.b-b.b; return dL*dL+da*da+db*db }
