import { rgbToLab, deltaE00 } from '../../color/color_space.js'
import { sampleCellMeanAndVariance, DEFAULT_MIN_SAMPLES_PER_CELL } from '../cellSampling.js'
import { findPureWhitePaletteEntry, preferPureWhiteEntry } from './whiteBias.js'

const EMPTY_COLOR = '#FFFFFF00'
const EMPTY_COLOR_ID = 'DEFAULT'

// Simplified "Wu + Adaptive Diffusion" strategy (enhanced):
// 1. Optional palette subset (median-cut or approximate Wu quantization) unless disabled.
// 2. Adaptive error diffusion with selectable kernel & strength curve; variance normalized by dynamic p95 if enabled.
// 3. Post cleanup with configurable neighbor set (4 / 8) + optional ΔE gate.
export class WuAdaptiveStrategy {
  constructor(palette, opts={}){
    this.originalPalette = palette
    this.whiteEntry = findPureWhitePaletteEntry(palette)
    this.opts = {
      // Quantization / subset
      wuColorCount: opts.wuColorCount || 24,
      quantizationMode: opts.quantizationMode || 'median-cut', // 'median-cut' | 'wu'
      disableSubset: !!opts.disableSubset, // if true always use full original palette
      useTrueWu: opts.useTrueWu || false,  // alias for quantizationMode==='wu'
      // Adaptive diffusion strength
      minStrength: opts.minStrength == null ? 0.15 : opts.minStrength,
      maxStrength: opts.maxStrength == null ? 0.95 : opts.maxStrength,
      varianceWindow: opts.varianceWindow || 2, // neighborhood radius
      varianceScale: opts.varianceScale || 60,  // fallback scale
      autoVarianceScale: opts.autoVarianceScale !== false, // compute p95 local variance to scale
      strengthCurve: opts.strengthCurve || 'sqrt', // 'linear' | 'sqrt' | 'log'
      // Diffusion kernel
      diffusionKernel: opts.diffusionKernel || 'FS', // 'FS' | 'JJN' | 'Stucki'
      // Cleanup
      cleanup: opts.cleanup !== false,
      cleanupPasses: opts.cleanupPasses || 2,
      majorityThreshold: opts.majorityThreshold || 0.6,
      cleanupNeighbors: opts.cleanupNeighbors || 8, // 4 or 8
      cleanupDeltaEThreshold: opts.cleanupDeltaEThreshold || 35 // only merge if ΔE <= threshold (preserve strong edges)
    }
    this.palette = this.originalPalette
  }
  buildSubsetPalette(sampleColors){
    if (this.opts.disableSubset){ this.palette = this.originalPalette; return }
    const target = Math.min(this.opts.wuColorCount, this.originalPalette.length)
    if (this.originalPalette.length <= target) { this.palette = this.originalPalette; return }
    if (this.opts.quantizationMode === 'wu' || this.opts.useTrueWu){
      this.palette = this._wuQuantization(sampleColors, target) || this.originalPalette
      return
    }
    // median-cut fallback
    let boxes = [{ colors: sampleColors }]
    while (boxes.length < target) {
      let bi = -1; let maxRange = -1; let axis='r'
      for (let i=0;i<boxes.length;i++){
        const cs = boxes[i].colors
        if (cs.length <= 1) continue
        let rMin=255,rMax=0,gMin=255,gMax=0,bMin=255,bMax=0
        for (const c of cs){ if (c.r<rMin) rMin=c.r; if (c.r>rMax) rMax=c.r; if (c.g<gMin) gMin=c.g; if (c.g>gMax) gMax=c.g; if (c.b<bMin) bMin=c.b; if (c.b>bMax) bMax=c.b }
        const rRange = rMax-rMin, gRange = gMax-gMin, bRange = bMax-bMin
        const range = Math.max(rRange, gRange, bRange)
        if (range > maxRange){ maxRange=range; bi=i; axis = rRange>=gRange && rRange>=bRange ? 'r' : (gRange>=bRange ? 'g':'b') }
      }
      if (bi === -1) break
      const box = boxes.splice(bi,1)[0]
      if (box.colors.length <= 1) { boxes.push(box); break }
      // Sort by chosen axis & split mid
      box.colors.sort((a,b)=> a[axis]-b[axis])
      const mid = Math.floor(box.colors.length/2)
      boxes.push({ colors: box.colors.slice(0,mid) })
      boxes.push({ colors: box.colors.slice(mid) })
    }
    // Compute centers
    const centers = boxes.map(b=>{
      let sr=0,sg=0,sb=0; for (const c of b.colors){ sr+=c.r; sg+=c.g; sb+=c.b }
      const n = b.colors.length || 1
      return { r:sr/n, g:sg/n, b:sb/n }
    })
    // Map centers to nearest entry in original palette (ΔE00 in Lab)
    for (const entry of this.originalPalette){ if (!entry.lab) entry.lab = rgbToLab(entry.rgb) }
    const chosen = new Map()
    const subset = []
    for (const ctr of centers){
      const labCtr = rgbToLab({ r:ctr.r, g:ctr.g, b:ctr.b })
      let best=null; let bestDist=Infinity
      for (const p of this.originalPalette){
        const d = deltaE00(labCtr, p.lab)
        if (d < bestDist){ bestDist=d; best=p }
      }
      if (best && !chosen.has(best.id)){ chosen.set(best.id,true); subset.push(best) }
    }
    if (subset.length > 4) this.palette = subset; else this.palette = this.originalPalette
  }
  // Approximate Wu quantization (simplified) on sampled colors (not full image pixels for speed)
  _wuQuantization(sampleColors, target){
    if (!sampleColors.length) return null
    // Quantize to 5 bits per channel
    const Q = 32
    const hist = new Array(Q*Q*Q).fill(0)
    const sumR = new Array(hist.length).fill(0)
    const sumG = new Array(hist.length).fill(0)
    const sumB = new Array(hist.length).fill(0)
    const sumSq = new Array(hist.length).fill(0)
    function idx(r,g,b){ return (r<<10) + (g<<5) + b }
    for (const c of sampleColors){
      const r = Math.min(31, c.r>>3), g=Math.min(31, c.g>>3), b=Math.min(31, c.b>>3)
      const id = idx(r,g,b)
      hist[id]++; sumR[id]+=c.r; sumG[id]+=c.g; sumB[id]+=c.b; sumSq[id]+= c.r*c.r + c.g*c.g + c.b*c.b
    }
    // Collect non-empty voxels
    const voxels = []
    for (let r=0;r<32;r++) for (let g=0;g<32;g++) for (let b=0;b<32;b++){
      const id = idx(r,g,b); const h=hist[id]; if (!h) continue
      voxels.push({ r, g, b, count:h, sr:sumR[id], sg:sumG[id], sb:sumB[id], ss:sumSq[id] })
    }
    if (voxels.length <= target){
      // Map each voxel mean directly
      return this._mapCentersToPalette(voxels.map(v=>({ r:v.sr/v.count, g:v.sg/v.count, b:v.sb/v.count })))
    }
    // Simple variance-based splitting similar to median-cut but using voxel centers; faster than full Wu box evaluation
    let boxes = [ { voxels } ]
    function boxStats(box){
      let cnt=0,sr=0,sg=0,sb=0,ss=0,rMin=32,rMax=-1,gMin=32,gMax=-1,bMin=32,bMax=-1
      for (const v of box.voxels){ cnt+=v.count; sr+=v.sr; sg+=v.sg; sb+=v.sb; ss+=v.ss; if (v.r<rMin) rMin=v.r; if (v.r>rMax) rMax=v.r; if (v.g<gMin) gMin=v.g; if (v.g>gMax) gMax=v.g; if (v.b<bMin) bMin=v.b; if (v.b>bMax) bMax=v.b }
      const meanR=sr/cnt, meanG=sg/cnt, meanB=sb/cnt
      const variance = (ss/cnt) - (meanR*meanR + meanG*meanG + meanB*meanB)
      return { cnt, meanR, meanG, meanB, variance, rRange:rMax-rMin, gRange:gMax-gMin, bRange:bMax-bMin }
    }
    while (boxes.length < target){
      // Pick box with max variance
      let bi=-1, bVar=-1
      for (let i=0;i<boxes.length;i++){
        if (!boxes[i].stats) boxes[i].stats = boxStats(boxes[i])
        if (boxes[i].stats.variance > bVar && boxes[i].voxels.length>1){ bVar=boxes[i].stats.variance; bi=i }
      }
      if (bi===-1) break
      const box = boxes.splice(bi,1)[0]
      const stats = box.stats || boxStats(box)
      // Choose axis with largest range
      let axis='r'; let range=stats.rRange
      if (stats.gRange >= range && stats.gRange >= stats.bRange){ axis='g'; range=stats.gRange } else if (stats.bRange >= range){ axis='b'; range=stats.bRange }
      if (range===0){ boxes.push(box); break }
      // Sort voxels by axis and split at weighted median
      box.voxels.sort((a,b)=> a[axis]-b[axis])
      let total=0; for (const v of box.voxels) total+=v.count
      let acc=0, splitIndex=0
      for (let i=0;i<box.voxels.length;i++){ acc+=box.voxels[i].count; if (acc >= total/2){ splitIndex=i; break } }
      if (splitIndex<=0 || splitIndex>=box.voxels.length-1){ boxes.push(box); break }
      const left = { voxels: box.voxels.slice(0,splitIndex) }
      const right = { voxels: box.voxels.slice(splitIndex) }
      boxes.push(left); boxes.push(right)
    }
    const centers = boxes.map(b=>{ const st = boxStats(b); return { r:st.meanR, g:st.meanG, b:st.meanB } })
    return this._mapCentersToPalette(centers)
  }
  _mapCentersToPalette(centers){
    for (const entry of this.originalPalette){ if (!entry.lab) entry.lab = rgbToLab(entry.rgb) }
    const chosen = new Map(); const subset=[]
    for (const ctr of centers){
      const labCtr = rgbToLab({ r:ctr.r, g:ctr.g, b:ctr.b })
      let best=null; let bestDist=Infinity
      for (const p of this.originalPalette){ const d = deltaE00(labCtr, p.lab); if (d<bestDist){ bestDist=d; best=p } }
      if (best && !chosen.has(best.id)){ chosen.set(best.id,true); subset.push(best) }
    }
    return subset.length>4 ? subset : this.originalPalette
  }
  apply({
    cells,
    rows,
    cols,
    imageData,
    cellWidthPx,
    cellHeightPx,
    offsetX,
    offsetY,
    onProgress,
    minSamples = DEFAULT_MIN_SAMPLES_PER_CELL,
    cellStatsGrid,
    emptyMask,
    emptyFill
  }){
    const resolvedEmptyFill = emptyFill || this.whiteEntry || this.palette[0] || {
      hex: EMPTY_COLOR,
      id: EMPTY_COLOR_ID
    }
    const { width, height } = imageData
    const pw = cellWidthPx
    const ph = cellHeightPx
    const work = new Array(rows)
    const samples = []
    for (let r = 0; r < rows; r++) {
      work[r] = new Array(cols)
      for (let c = 0; c < cols; c++) {
        if (emptyMask?.[r]?.[c]) {
          work[r][c] = null
          continue
        }
        const x0 = Math.floor(offsetX + c * pw)
        const y0 = Math.floor(offsetY + r * ph)
        const x1 = Math.min(Math.floor(x0 + pw), width)
        const y1 = Math.min(Math.floor(y0 + ph), height)
        if (x0 >= width || y0 >= height) {
          work[r][c] = null
          continue
        }
        const stat =
          cellStatsGrid?.[r]?.[c] || sampleCellMeanAndVariance(imageData, x0, y0, x1, y1, minSamples)
        work[r][c] = { r: stat.r, g: stat.g, b: stat.b, v: stat.v }
        if (r % 3 === 0 && c % 3 === 0) samples.push({ r: stat.r, g: stat.g, b: stat.b })
      }
      onProgress?.(((r + 1) / rows) * 0.22)
    }
    this.buildSubsetPalette(samples)
    onProgress?.(0.24)
    for (const entry of this.palette){ if (!entry.lab) entry.lab = rgbToLab(entry.rgb) }

    const rWin = this.opts.varianceWindow
    // Precompute local variance field for percentile scaling
    const localVar = new Array(rows)
    const localVarList = []
    for (let r=0;r<rows;r++){
      localVar[r] = new Array(cols)
      for (let c=0;c<cols;c++){
        if (!work[r][c]) {
          localVar[r][c] = 0
          continue
        }
        let vsum=0, vcount=0
        for (let rr=r-rWin; rr<=r+rWin; rr++){
          if (rr<0||rr>=rows) continue
          for (let cc=c-rWin; cc<=c+rWin; cc++){
            if (cc<0||cc>=cols) continue
            if (!work[rr][cc]) continue
            vsum += work[rr][cc].v; vcount++
          }
        }
        const vLocal = vsum/(vcount||1)
        localVar[r][c]=vLocal
        localVarList.push(vLocal)
      }
      onProgress?.(0.24 + ((r + 1) / rows) * 0.12)
    }
    let scale = this.opts.varianceScale
    if (this.opts.autoVarianceScale && localVarList.length){
      localVarList.sort((a,b)=>a-b)
      const p95Index = Math.floor(localVarList.length*0.95)
      scale = localVarList[p95Index] || scale
      if (scale <= 0) scale = this.opts.varianceScale
    }

    const kernel = this._getKernel(this.opts.diffusionKernel)
    for (let r=0;r<rows;r++){
      const dir = (r % 2 === 0) ? 1 : -1
      const cStart = dir === 1 ? 0 : cols-1
      const cEnd = dir === 1 ? cols : -1
      for (let c=cStart; c!==cEnd; c+=dir){
        if (emptyMask?.[r]?.[c] || !work[r][c]) {
          cells[r][c].color = resolvedEmptyFill.hex
          cells[r][c].color_id = resolvedEmptyFill.id
          continue
        }
        const vLocal = localVar[r][c]
        let vNorm = scale>0 ? vLocal/scale : 0
        if (vNorm>1) vNorm=1; if (vNorm<0) vNorm=0
        // strength curve mapping
        switch (this.opts.strengthCurve){
          case 'sqrt': vNorm = Math.sqrt(vNorm); break
          case 'log': vNorm = Math.log1p(vNorm*9)/Math.log(10); break
          case 'linear': default: break
        }
        const strength = this.opts.minStrength + (this.opts.maxStrength - this.opts.minStrength) * vNorm

        const col = work[r][c]
        const lab = rgbToLab(col)
        let best=null; let bestDist=Infinity
        for (const entry of this.palette){ const d = deltaE00(lab, entry.lab); if (d<bestDist){ bestDist=d; best=entry } }
        const preferred = preferPureWhiteEntry(
          lab,
          cellStatsGrid?.[r]?.[c] || col,
          best,
          bestDist,
          this.whiteEntry
        )
        best = preferred.entry
        cells[r][c].color = best.hex
        cells[r][c].color_id = best.id

        // diffused error scaled by strength; suppress in very low variance zones
        if (strength > 0.01){
          const err = { r: (col.r - best.rgb.r)*strength, g: (col.g - best.rgb.g)*strength, b: (col.b - best.rgb.b)*strength }
          this._applyKernel(work, r, c, err, dir, kernel)
        }
      }
      onProgress?.(0.36 + ((r + 1) / rows) * 0.62)
    }
    if (this.opts.cleanup) this.postCleanup(cells, rows, cols)
  }
  _getKernel(name){
    switch(name){
      case 'JJN': // Jarvis, Judice, Ninke (denom 48)
        return { denom:48, offsets:[ [1,0,7],[2,0,5], [-2,1,3],[-1,1,5],[0,1,7],[1,1,5],[2,1,3], [-2,2,1],[-1,2,3],[0,2,5],[1,2,3],[2,2,1] ] }
      case 'Stucki': // denom 42
        return { denom:42, offsets:[ [1,0,8],[2,0,4], [-2,1,2],[-1,1,4],[0,1,8],[1,1,4],[2,1,2], [-2,2,1],[-1,2,2],[0,2,4],[1,2,2],[2,2,1] ] }
      case 'FS': default:
        return { denom:16, offsets:[ [1,0,7], [-1,1,3],[0,1,5],[1,1,1] ] }
    }
  }
  _applyKernel(work, r, c, err, dir, kernel){
    const { offsets, denom } = kernel
    for (const off of offsets){
      let [dx, dy, w] = off
      // serpentine mirror horizontally when dir == -1 (reverse)
      if (dir === -1){ dx = -dx }
      spread(work, r+dy, c+dx, err, w/denom)
    }
  }
  postCleanup(cells, rows, cols){
    // Precompute Lab for original palette for ΔE checks
    for (const p of this.originalPalette){ if (!p.lab) p.lab = rgbToLab(p.rgb) }
    const idByHex = new Map(this.originalPalette.map(p=>[p.hex, p]))
    const use8 = this.opts.cleanupNeighbors === 8
    const dEThresh = this.opts.cleanupDeltaEThreshold
    for (let pass=0; pass<this.opts.cleanupPasses; pass++){
      let changed=false
      for (let r=0;r<rows;r++){
        for (let c=0;c<cols;c++){
          if (cells[r][c].color_id === EMPTY_COLOR_ID) continue
          const curHex = cells[r][c].color
          const curEntry = idByHex.get(curHex)
          const neighbors=[]
          // 4-neighbors
            if (r>0 && cells[r-1][c].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r-1][c].color)
            if (r<rows-1 && cells[r+1][c].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r+1][c].color)
            if (c>0 && cells[r][c-1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r][c-1].color)
            if (c<cols-1 && cells[r][c+1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r][c+1].color)
          if (use8){
            if (r>0 && c>0 && cells[r-1][c-1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r-1][c-1].color)
            if (r>0 && c<cols-1 && cells[r-1][c+1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r-1][c+1].color)
            if (r<rows-1 && c>0 && cells[r+1][c-1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r+1][c-1].color)
            if (r<rows-1 && c<cols-1 && cells[r+1][c+1].color_id !== EMPTY_COLOR_ID) neighbors.push(cells[r+1][c+1].color)
          }
          if (!neighbors.length) continue
          const freq = new Map()
          for (const n of neighbors) freq.set(n, (freq.get(n)||0)+1)
          const arr = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1])
          const [topHex, count] = arr[0]
          if (topHex !== curHex && (count / neighbors.length) >= this.opts.majorityThreshold){
            const topEntry = idByHex.get(topHex)
            if (curEntry && topEntry){
              const dE = deltaE00(curEntry.lab, topEntry.lab)
              if (dE <= dEThresh){
                cells[r][c].color = topHex
                cells[r][c].color_id = topEntry.id
                changed = true
              }
            } else { // fallback if missing lab
              cells[r][c].color = topHex
              if (topEntry) cells[r][c].color_id = topEntry.id
              changed = true
            }
          }
        }
      }
      if (!changed) break
    }
  }
}
function spread(work, r,c, err, factor){ if (r<0||c<0||r>=work.length||c>=work[0].length) return; const px=work[r][c]; if (!px) return; px.r=clamp(px.r+err.r*factor); px.g=clamp(px.g+err.g*factor); px.b=clamp(px.b+err.b*factor); }
function clamp(v){ return v<0?0:v>255?255:Math.round(v) }
