// Simple KMeans for color clustering in Lab space.
import { rgbToLab } from './color_space.js'

export function kmeans(colorsLab, k, { maxIter=10, minShift=0.1, randomSeed } = {}) {
  if (k <= 0) return []
  const n = colorsLab.length
  if (n === 0) return []
  if (k > n) k = n
  const rand = seededRandom(randomSeed || 42)
  // init centers: random distinct
  const used = new Set();
  const centers = []
  while (centers.length < k) {
    const idx = Math.floor(rand()*n)
    if (!used.has(idx)) { used.add(idx); centers.push({...colorsLab[idx]}) }
  }
  let labels = new Array(n).fill(0)
  for (let iter=0; iter<maxIter; iter++) {
    // assignment
    let changed = false
    for (let i=0;i<n;i++) {
      let best=0; let bestDist=Infinity
      const c = colorsLab[i]
      for (let ci=0;ci<centers.length;ci++) {
        const dist = dist2(c, centers[ci])
        if (dist < bestDist) { bestDist=dist; best=ci }
      }
      if (labels[i] !== best) { labels[i]=best; changed = true }
    }
    // update
    const sums = centers.map(()=>({L:0,a:0,b:0,count:0}))
    for (let i=0;i<n;i++) {
      const lbl = labels[i]
      const c = colorsLab[i]
      const s = sums[lbl]
      s.L += c.L; s.a += c.a; s.b += c.b; s.count++
    }
    let maxShift = 0
    for (let ci=0;ci<centers.length;ci++) {
      const s = sums[ci]
      if (s.count === 0) continue // leave center unchanged
      const newC = { L: s.L/s.count, a: s.a/s.count, b: s.b/s.count }
      const shift = Math.sqrt(dist2(newC, centers[ci]))
      if (shift > maxShift) maxShift = shift
      centers[ci] = newC
    }
    if (!changed || maxShift < minShift) break
  }
  return centers
}
function dist2(a,b){ const dL=a.L-b.L, da=a.a-b.a, db=a.b-b.b; return dL*dL+da*da+db*db }
function seededRandom(seed){ let x = seed; return function(){ x = (x*1664525 + 1013904223) % 4294967296; return x/4294967296 } }
