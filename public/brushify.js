(function(){
console.log('[Brushify] script start');

function whenOpenCVReady(cb){
  function ready(){
    return typeof cv!=='undefined' && cv.Mat && typeof cv.Mat==='function' && cv.imread;
  }
  if(ready()) return cb();
  console.log('[Brushify] waiting OpenCV...');
  setTimeout(()=>whenOpenCVReady(cb),150);
}

whenOpenCVReady(()=>defineBrushify());

function defineBrushify(){

// sRGB IEC 61966-2-1：解码到线性光空间再算混合，更接近 PS 在「线性」工作流程 / 新版合成管线下的观感（相对旧版在 gamma 编码值上直接算 Linear Light）
function srgbByteToLinear01(u8) {
  const x = Math.max(0, Math.min(255, u8 | 0)) / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}
function linear01ToSrgbByte(lin) {
  let x;
  if (lin <= 0) x = 0;
  else if (lin >= 1) x = 1;
  else if (lin <= 0.0031308) x = 12.92 * lin;
  else x = 1.055 * Math.pow(lin, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(x * 255)));
}

class BrushifyJS {
  constructor(){
    this.params = {
      radii: [48,24,12,6],
      alphaLarge: 0.55,
      alphaSmall: 0.85,
      jitterLarge: 0.10,
      jitterSmall: 0.18,
      stepFactor: 1.0,
      elongate: 2.0,
      thicknessLarge: 2.05,
      thicknessSmall: 1.75,
      angleJitterDeg: 8.0,
      sampleOriginalColor: true,
      bgThreshold: 50,

      // --- Quality knobs (match "标程" look: less speckle, more coherent stitches) ---
      // Only place strokes where current canvas differs from blurred reference (classic painterly rendering)
      useErrorMask: true,
      errorThresholdLarge: 36, // larger => fewer strokes on large layers
      errorThresholdSmall: 10,

      // Align stroke angle to local image gradient (reduces random noise / improves edge coherence)
      useGradientAngle: true,
      // Use blurred ref color on coarse layers; keep original color only on finest layer for detail
      useScaleRefColor: true,

      // --- Pixel-art / grid-image stylization (target: smooth cartoon + brush feel) ---
      pixelArtMaxColors: 260,         // heuristic threshold
      pixelArtSmoothPasses: 3,        // 1-4: more => smoother/less blocky
      pixelArtMeanShiftSp: 14,        // spatial window
      pixelArtMeanShiftSr: 16,        // color window
      pixelArtEdgeSoften: 0.98,       // 0..1, soften boundaries to remove blocky grid edges
      pixelArtEdgeSigma: 2,         // edge mask blur sigma (bigger => wider soft band)
      pixelArtBlurSigma: 4.0,         // strong blur used for edge blending (bigger => less blocky)
      pixelArtEdgeProtect: 0.90,      // 0..1, reduce brush texture near edges
      pixelArtSharpenAmount: 0.85,    // 0..2.0, recover crispness after smoothing
      pixelArtSharpenSigma: 1.0,      // sigma for unsharp mask
      pixelArtEdgeSharpenMix: 1.0,    // 0..1, apply sharpening mainly on edges
      pixelArtBrushStrength: 0.08,    // brush shading strength (0..0.25)
      pixelArtBrushFreq: 0.10,        // brush stroke frequency

      // Deblock pixel-art: collapse big upscaled blocks back to a true low-res cell map (mode pooling),
      // then upscale smoothly. This is the most effective way to kill visible grid structure.
      pixelArtDeblock: true,
      pixelArtDeblockMin: 2,
      pixelArtDeblockMax: 64,
      pixelArtDeblockMinVotes: 120,
      // Composite pre-downsample upper bound (for quality/perf tradeoff)
      // 3,000,000 was too aggressive for export quality on large templates.
      compositeMaxPixels: 12000000,

      // linearLight / linearLightPure 专用：合成前像素上限取 max(compositeMaxPixels, 本值)。
      // 先被缩小再线性光会和 PS 全尺寸叠加差异很大；在 Electron 桌面端默认提到 ~36MP 更贴近导出档。
      linearLightCompositeMaxPixels: 36000000,

      // Linear Light 与「网页 PS / Photopea」对齐：在 8-bit 通道上算 v=b+2*m-255 再按不透明度混合（多数 canvas 工具属此类）。
      // false 则在线性 sRGB 空间算 v=b+2*m-1 再编码（更接近 PS「用灰度系数混合 RGB 颜色」/ 线性工作流）。
      linearLightBlendInEncodedSpace: true,

      // 线性光合成后：客户反馈「整体偏闷、提亮又吃纹理、艳色区更易糊」——用「小幅提亮 + 模板亮度高频」折中
      linearLightPostLift: 8, // 0..24，每通道约加亮（高饱和像素会按比例减弱，见 _linearLightPostTune）
      // 略降默认，底纹更轻（客户：纹理淡一点）
      linearLightTextureRelief: 0.10, // 0..0.42，把模板灰度上的细节（high-pass）等量加回 RGB
      linearLightReliefSigma: 1.35, // 高斯模糊 σ，越大纹理频段越粗
      linearLightVividLiftScale: 0.42, // 饱和度很高时，lift 最低缩到此比例，减轻「艳色一提亮纹理就没了」

      // 近似 PS 滤镜库「喷色描边 / Sprayed Strokes」：仅在 linearLight 上层（格子图）merge 之前做，非 1:1 复刻
      linearLightSprayedStrokesEnabled: true,
      linearLightSprayedStrokeLength: 20,
      linearLightSprayedSprayRadius: 7,
      linearLightSprayedDirection: 'rightDiagonal', // 'rightDiagonal' | 'leftDiagonal'
      linearLightSprayedMix: 0.28, // 0..1，越大笔触越强；默认偏淡

      // 叠加前：弱化「一格一格」硬边（客户在合图/线性光之前就要虚化方格，不是叠加之后）
      linearLightGridPresoftenEnabled: true,
      linearLightGridPresoftenSigma: 1.25, // 仅模糊 BGR；0 或极小则等效关闭
      // 仅对暗部做去块，避免阴影区保留明显色块，同时不把高光/边缘整体洗掉
      linearLightShadowDeblockEnabled: false,
      linearLightShadowDeblockSigma: 1.15,
      linearLightShadowDeblockStart: 0.14, // 0..1，亮度低于此值时最强
      linearLightShadowDeblockEnd: 0.5,    // 0..1，亮度高于此值时关闭
      linearLightShadowDeblockMix: 0.82,
      // 仅在 PSD/Pattern Overlay 纯路径下使用：如果低分辨率格子图被大倍率放大，
      // 先按推测块尺寸回收成低分辨率色块，再用 cubic 放回目标尺寸，避免阴影区保留整块矩形。
      linearLightPixelArtDeblockEnabled: false,
      linearLightPixelArtDeblockMinScale: 2.5,
      // 像素风格子放大到模板尺寸时，用线性插值代替最近邻，减轻马赛克（再与 presoften 配合）
      linearLightGridUpscaleSmooth: true,

      // linearLight 纯合成默认 'hybrid'：低饱和区偏 Linear Light（保留底纹/PS 感），高饱和区偏 alpha 上叠（减轻橙偏黄等色相漂移）
      // 'alphaNormal' | 'linearLight' 仍可选用（调试/对比）
      mergePureBlendMode: 'hybrid',
      mergeHybridNormalMin: 0.06,
      mergeHybridNormalMax: 0.9,
      mergeHybridChromaScale: 2.15,
      // 纯合图 merge + postTune 之后：绕中灰轻微拉对比（建议 5–8，对应约 PS「对比度 +5~+8」量级）；0 关闭
      mergePureMicroContrast: 6
    };
    // 去除固定种子，改为非确定随机以对齐 C++ std::random_device + mt19937 行为
  }

  _dbgEnabled(){
    try {
      return !!(typeof window !== 'undefined' && (window.__BRUSHIFY_DEBUG__ || window.localStorage?.getItem('BRUSHIFY_DEBUG') === '1'));
    } catch(_) { return false; }
  }

  _dbgOnce(key, payload){
    if(!this._dbgEnabled()) return;
    if(!this.__dbgOnceKeys) this.__dbgOnceKeys = new Set();
    if(this.__dbgOnceKeys.has(key)) return;
    this.__dbgOnceKeys.add(key);
    try { console.log(`[Brushify:debug] ${key}`, payload||''); } catch(_) {}
  }

  // srand 与自定义 LCG 移除，保持接口最小化修改（如外部未调用不受影响）
  srand(_seed){} // no-op
  rand(){ return Math.random(); }
  frand(a,b){ return a + (b-a)*Math.random(); }

  detectBackgroundColor(src){
    if(src.empty()) return [0,0,0];
    let H=src.rows, W=src.cols;
    let work = src, resized=false;
    if(H>2000||W>2000){
      const scale=Math.min(2000/H,2000/W);
      const newH=Math.max(1,Math.round(H*scale));
      const newW=Math.max(1,Math.round(W*scale));
      work = new cv.Mat();
      cv.resize(src, work, new cv.Size(newW,newH),0,0,cv.INTER_AREA);
      resized=true;
    }
    const map = new Map();
    for(let y=0;y<work.rows;y++){
      for(let x=0;x<work.cols;x++){
        const p=work.ucharPtr(y,x);
        const b=(p[0]>>2), g=(p[1]>>2), r=(p[2]>>2);
        const key=(b<<16)|(g<<8)|r;
        map.set(key,(map.get(key)||0)+1);
      }
    }
    let bestKey=0, bestCnt=0;
    for(const [k,c] of map){ if(c>bestCnt){bestCnt=c;bestKey=k;} }
    const bg=[
      ((bestKey>>16)&0xFF)<<2,
      ((bestKey>>8)&0xFF)<<2,
      (bestKey&0xFF)<<2
    ];
    if(resized) work.delete();
    return bg;
  }

  buildForegroundMask(src,bg,thr){
    const mask=new cv.Mat(src.rows,src.cols,cv.CV_8UC1);
    for(let y=0;y<src.rows;y++){
      for(let x=0;x<src.cols;x++){
        const p=src.ucharPtr(y,x);
        const diff = Math.abs(p[0]-bg[0])+Math.abs(p[1]-bg[1])+Math.abs(p[2]-bg[2]);
        mask.ucharPtr(y,x)[0]= diff>thr?255:0;
      }
    }
    const kernel=cv.getStructuringElement(cv.MORPH_ELLIPSE,new cv.Size(5,5));
    cv.morphologyEx(mask,mask,cv.MORPH_CLOSE,kernel);
    kernel.delete();

    // flood fill 边界孔洞
    const ff=mask.clone();
    for(let y=0;y<ff.rows;y++){
      for(let x=0;x<ff.cols;x++){
        if(y===0||y===ff.rows-1||x===0||x===ff.cols-1){
          if(ff.ucharPtr(y,x)[0]===0){
            // 修复：OpenCV.js 需要4通道标量，之前 new cv.Scalar(100) 触发错误
            cv.floodFill(ff,new cv.Mat(),new cv.Point(x,y),new cv.Scalar(100,100,100,100));
          }
        }
      }
    }
    for(let y=0;y<ff.rows;y++){
      for(let x=0;x<ff.cols;x++){
        const v=ff.ucharPtr(y,x)[0];
        const m=mask.ucharPtr(y,x);
        if(v===0) m[0]=255;
        else if(v===100) m[0]=0;
      }
    }
    ff.delete();
    return mask;
  }

  buildScaleRefs(src,radii){
    const refs=[];
    for(const r of radii){
      const sigma=Math.max(0.8,r/3.0);
      const b=new cv.Mat();
      cv.GaussianBlur(src,b,new cv.Size(0,0),sigma);
      refs.push(b);
    }
    return refs;
  }

  isPixelArtLike(bgrMat){
    // Heuristic: few unique colors (after quantization) => grid/pixel art
    // Sample up to ~25k pixels for speed.
    if(!bgrMat || bgrMat.empty()) return false;
    const H=bgrMat.rows, W=bgrMat.cols;
    const step=Math.max(1, Math.floor(Math.sqrt((H*W)/25000)));
    const seen=new Set();
    for(let y=0;y<H;y+=step){
      for(let x=0;x<W;x+=step){
        const p=bgrMat.ucharPtr(y,x);
        const b=p[0]>>3, g=p[1]>>3, r=p[2]>>3; // 5-bit each
        const key=(b<<10)|(g<<5)|r;
        seen.add(key);
        if(seen.size>this.params.pixelArtMaxColors) return false;
      }
    }
    return true;
  }

  extractPalette(bgrMat, maxColors=256){
    // Collect unique colors (exact). Pixel-art images typically have a manageable palette (<= ~300).
    if(!bgrMat || bgrMat.empty()) return [];
    const H=bgrMat.rows, W=bgrMat.cols;
    const map=new Map(); // key-> [b,g,r]
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const p=bgrMat.ucharPtr(y,x);
        const b=p[0], g=p[1], r=p[2];
        const key=(b<<16)|(g<<8)|r;
        if(!map.has(key)) map.set(key,[b,g,r]);
        if(map.size>=maxColors) break;
      }
      if(map.size>=maxColors) break;
    }
    return Array.from(map.values());
  }

  nearestPaletteColor(b,g,r,palette){
    // palette: Array<[b,g,r]>
    let best=0, bestD=1e18;
    for(let i=0;i<palette.length;i++){
      const c=palette[i];
      const db=b-c[0], dg=g-c[1], dr=r-c[2];
      const d=db*db+dg*dg+dr*dr;
      if(d<bestD){ bestD=d; best=i; if(d===0) break; }
    }
    return palette[best] || [b,g,r];
  }

  _estimateBlockSizeBGR(mat, axis /*'x'|'y'*/){
    const rows = mat.rows, cols = mat.cols;
    const minB = Math.max(1, this.params.pixelArtDeblockMin|0);
    const maxB = Math.max(minB, this.params.pixelArtDeblockMax|0);
    const hist = new Map();
    const samples = 24;
    if(axis === 'x'){
      for(let si=0; si<samples; si++){
        const y = Math.min(rows-1, Math.round((si+0.5)*rows/samples));
        let last = null, run = 0;
        for(let x=0;x<cols;x++){
          const p = mat.ucharPtr(y,x);
          const key = (p[0]<<16)|(p[1]<<8)|p[2];
          if(last===null){ last=key; run=1; continue; }
          if(key===last){ run++; continue; }
          if(run>=minB && run<=maxB) hist.set(run,(hist.get(run)||0)+1);
          last=key; run=1;
        }
        if(run>=minB && run<=maxB) hist.set(run,(hist.get(run)||0)+1);
      }
    } else {
      for(let si=0; si<samples; si++){
        const x = Math.min(cols-1, Math.round((si+0.5)*cols/samples));
        let last = null, run = 0;
        for(let y=0;y<rows;y++){
          const p = mat.ucharPtr(y,x);
          const key = (p[0]<<16)|(p[1]<<8)|p[2];
          if(last===null){ last=key; run=1; continue; }
          if(key===last){ run++; continue; }
          if(run>=minB && run<=maxB) hist.set(run,(hist.get(run)||0)+1);
          last=key; run=1;
        }
        if(run>=minB && run<=maxB) hist.set(run,(hist.get(run)||0)+1);
      }
    }
    let best=1, bestC=0;
    for(const [k,c] of hist){
      if(c>bestC){ bestC=c; best=k; }
    }
    const minVotes = this.params.pixelArtDeblockMinVotes|0;
    if(bestC < minVotes) return 1;
    return best;
  }

  _modePoolDownsample(mat, bx, by){
    const rows=mat.rows, cols=mat.cols;
    const outW = Math.max(1, Math.floor(cols / bx));
    const outH = Math.max(1, Math.floor(rows / by));
    const out = new cv.Mat(outH, outW, cv.CV_8UC3);
    for(let oy=0; oy<outH; oy++){
      for(let ox=0; ox<outW; ox++){
        const x0 = ox*bx;
        const y0 = oy*by;
        const map = new Map();
        let bestKey=0, bestCnt=0;
        for(let y=y0; y<Math.min(rows, y0+by); y++){
          for(let x=x0; x<Math.min(cols, x0+bx); x++){
            const p = mat.ucharPtr(y,x);
            const key=(p[0]<<16)|(p[1]<<8)|p[2];
            const v=(map.get(key)||0)+1;
            map.set(key,v);
            if(v>bestCnt){ bestCnt=v; bestKey=key; }
          }
        }
        const q = out.ucharPtr(oy,ox);
        q[0]=(bestKey>>16)&255;
        q[1]=(bestKey>>8)&255;
        q[2]=bestKey&255;
      }
    }
    return out;
  }

  brushifyPixelArtEffect(srcBGR, fgMask, bgColor){
    // Target: remove pixel blocks and produce smooth, painted cartoon shapes (gradients allowed).
    const rows = srcBGR.rows, cols = srcBGR.cols;
    if(rows<3 || cols<3) return srcBGR.clone();
    this._dbgOnce('brushify:pixelArtEffect', {
      size: `${cols}x${rows}`,
      passes: this.params.pixelArtSmoothPasses,
      meanShift: [this.params.pixelArtMeanShiftSp, this.params.pixelArtMeanShiftSr],
      brushStrength: this.params.pixelArtBrushStrength
    });

    // 1) Smoothing to kill blockiness (prefer mean-shift; fallback to stronger painterly smoothing)
    let cur = srcBGR.clone();
    const passes = Math.max(1, Math.min(4, this.params.pixelArtSmoothPasses|0));
    const sp = Math.max(1, this.params.pixelArtMeanShiftSp|0);
    const sr = Math.max(1, this.params.pixelArtMeanShiftSr|0);

    const hasMeanShift = (typeof cv.pyrMeanShiftFiltering === 'function');
    this._dbgOnce('brushify:pixelArtMeanShift', { hasMeanShift, passes, sp, sr });
    if(hasMeanShift){
      for(let i=0;i<passes;i++){
        const nxt = new cv.Mat();
        cv.pyrMeanShiftFiltering(cur, nxt, sp, sr);
        cur.delete();
        cur = nxt;
      }
    } else {
      // Strong painterly fallback:
      // - repeatedly downsample (area) + upsample (cubic) to remove pixel stair-steps
      // - strong bilateral to keep region boundaries while smoothing interiors
      const rows = cur.rows, cols = cur.cols;
      const levels = Math.max(1, Math.min(3, passes));
      this._dbgOnce('brushify:pixelArtFallback', { kind: 'pyr+bilateral', levels });
      for(let i=0;i<levels;i++){
        const scale = (i===0) ? 0.45 : 0.62;
        const sw = Math.max(1, Math.round(cols * scale));
        const sh = Math.max(1, Math.round(rows * scale));
        const small = new cv.Mat();
        cv.resize(cur, small, new cv.Size(sw, sh), 0, 0, cv.INTER_AREA);
        const up = new cv.Mat();
        cv.resize(small, up, new cv.Size(cols, rows), 0, 0, cv.INTER_CUBIC);
        small.delete();
        cur.delete();
        cur = up;

        const nxt = new cv.Mat();
        // stronger than before; tuned to reduce blockiness
        cv.bilateralFilter(cur, nxt, 13, 170, 22);
        cur.delete();
        cur = nxt;
      }
    }

    // 2) Slight soften of edges so it looks "painted" not plastic
    cv.GaussianBlur(cur, cur, new cv.Size(0,0), 0.7, 0.7, cv.BORDER_DEFAULT);

    // 2.5) Explicit boundary softening: blur only near boundaries so "pixel steps" disappear
    const edgeSoften = Math.max(0, Math.min(1, this.params.pixelArtEdgeSoften ?? 0.75));
    if(edgeSoften > 1e-3){
      const gray = new cv.Mat();
      cv.cvtColor(srcBGR, gray, cv.COLOR_BGR2GRAY);
      const edges = new cv.Mat();
      cv.Canny(gray, edges, 16, 48);
      gray.delete();
      // thicken + blur edge mask into a soft band
      const k = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5,5));
      cv.dilate(edges, edges, k);
      k.delete();
      const edgeSigma = Math.max(0.1, this.params.pixelArtEdgeSigma ?? 1.2);
      cv.GaussianBlur(edges, edges, new cv.Size(0,0), edgeSigma, edgeSigma, cv.BORDER_DEFAULT);

      const blurSigma = Math.max(0.1, this.params.pixelArtBlurSigma ?? 2.2);
      const blurStrong = new cv.Mat();
      cv.GaussianBlur(cur, blurStrong, new cv.Size(0,0), blurSigma, blurSigma, cv.BORDER_DEFAULT);

      // Blend: out = cur*(1-m) + blurStrong*m, where m in [0, edgeSoften]
      const curF = new cv.Mat(); cur.convertTo(curF, cv.CV_32FC3, 1/255.0);
      const blurF = new cv.Mat(); blurStrong.convertTo(blurF, cv.CV_32FC3, 1/255.0);
      blurStrong.delete();
      const maskF = new cv.Mat(); edges.convertTo(maskF, cv.CV_32F, edgeSoften/255.0);
      edges.delete();
      const mask3 = new cv.Mat(); cv.cvtColor(maskF, mask3, cv.COLOR_GRAY2BGR);
      maskF.delete();
      const ones = new cv.Mat(cur.rows, cur.cols, cv.CV_32FC3);
      ones.setTo(new cv.Scalar(1,1,1));
      const inv = new cv.Mat();
      cv.subtract(ones, mask3, inv);
      ones.delete();
      const a = new cv.Mat(); cv.multiply(curF, inv, a);
      const b = new cv.Mat(); cv.multiply(blurF, mask3, b);
      curF.delete(); blurF.delete(); inv.delete(); mask3.delete();
      cv.add(a, b, a);
      b.delete();
      a.convertTo(cur, cv.CV_8UC3, 255.0);
      a.delete();

      this._dbgOnce('brushify:pixelArtEdgeSoften', { edgeSoften, edgeSigma, blurSigma });
    }

    // Build an edge mask from current image (after smoothing) for edge-aware steps below
    let edgeMask = null;
    {
      const gray2 = new cv.Mat();
      cv.cvtColor(cur, gray2, cv.COLOR_BGR2GRAY);
      edgeMask = new cv.Mat();
      cv.Canny(gray2, edgeMask, 28, 96);
      gray2.delete();
      const k2 = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(3,3));
      cv.dilate(edgeMask, edgeMask, k2);
      k2.delete();
      cv.GaussianBlur(edgeMask, edgeMask, new cv.Size(0,0), 0.9, 0.9, cv.BORDER_DEFAULT);
    }

    // 3) Optional brush shading inside foreground
    const strength = Math.max(0, Math.min(0.25, this.params.pixelArtBrushStrength ?? 0.08));
    const freq = this.params.pixelArtBrushFreq ?? 0.10;
    if(strength > 1e-3){
      const fg = fgMask ? fgMask.data : null;
      const gfield = this.computeGradientField(cur);
      const gx = gfield.gradX.data32F;
      const gy = gfield.gradY.data32F;
      const outData = cur.data;
      const edgeData = edgeMask ? edgeMask.data : null;
      const edgeProtect = Math.max(0, Math.min(1, this.params.pixelArtEdgeProtect ?? 0.90));
      for(let y=0;y<rows;y++){
        const rowOff=y*cols;
        for(let x=0;x<cols;x++){
          const idx=rowOff+x;
          if(fg && fg[idx]===0) continue;
          const di=idx*3;
          const diffBG = Math.abs(outData[di]-bgColor[0])+Math.abs(outData[di+1]-bgColor[1])+Math.abs(outData[di+2]-bgColor[2]);
          if(diffBG <= this.params.bgThreshold) continue;

          // reduce texture near edges to keep silhouettes crisp
          let localStrength = strength;
          if(edgeData){
            const em = (edgeData[idx] / 255.0);
            localStrength = strength * (1.0 - edgeProtect * em);
            if(localStrength < 1e-4) continue;
          }

          const gxi=gx[idx]||0, gyi=gy[idx]||0;
          const mag=Math.abs(gxi)+Math.abs(gyi);
          let ux=1.0, uy=0.0;
          if(mag>1e-3){
            const ang=Math.atan2(gyi,gxi) + Math.PI*0.5;
            ux=Math.cos(ang); uy=Math.sin(ang);
          }
          const proj=(x*ux + y*uy);
          const n = this.perlinNoise(x*0.04, y*0.04, 111) * 0.5 + 0.5;
          const wave = Math.sin(proj*freq + n*2.3);
          const mod = (wave*0.55 + (n-0.5)*0.65);
          const f = 1.0 + localStrength*mod;
          outData[di]   = Math.max(0, Math.min(255, (outData[di]*f)|0));
          outData[di+1] = Math.max(0, Math.min(255, (outData[di+1]*f)|0));
          outData[di+2] = Math.max(0, Math.min(255, (outData[di+2]*f)|0));
        }
      }
      gfield.gradX.delete(); gfield.gradY.delete(); gfield.gray.delete();
    }

    // 4) Unsharp mask to make result look "HD" again (avoid muddy blur)
    const sharpenAmt = Math.max(0, Math.min(2.0, this.params.pixelArtSharpenAmount ?? 0.85));
    if(sharpenAmt > 1e-3){
      const sigma = Math.max(0.2, this.params.pixelArtSharpenSigma ?? 1.0);
      const blur = new cv.Mat();
      cv.GaussianBlur(cur, blur, new cv.Size(0,0), sigma, sigma, cv.BORDER_DEFAULT);
      const sharp = new cv.Mat();
      cv.addWeighted(cur, 1.0 + sharpenAmt, blur, -sharpenAmt, 0, sharp);
      blur.delete();
      // Apply sharpening mainly on edges to avoid amplifying remaining grid texture
      const edgeMix = Math.max(0, Math.min(1, this.params.pixelArtEdgeSharpenMix ?? 1.0));
      if(edgeMask && edgeMix > 1e-3){
        const curF = new cv.Mat(); cur.convertTo(curF, cv.CV_32FC3, 1/255.0);
        const shF = new cv.Mat(); sharp.convertTo(shF, cv.CV_32FC3, 1/255.0);
        const mF = new cv.Mat(); edgeMask.convertTo(mF, cv.CV_32F, edgeMix/255.0);
        const m3 = new cv.Mat(); cv.cvtColor(mF, m3, cv.COLOR_GRAY2BGR);
        mF.delete();
        const ones = new cv.Mat(cur.rows, cur.cols, cv.CV_32FC3);
        ones.setTo(new cv.Scalar(1,1,1));
        const inv = new cv.Mat(); cv.subtract(ones, m3, inv);
        ones.delete();
        const a = new cv.Mat(); cv.multiply(curF, inv, a);
        const b = new cv.Mat(); cv.multiply(shF, m3, b);
        curF.delete(); shF.delete(); inv.delete(); m3.delete();
        cv.add(a, b, a);
        b.delete();
        a.convertTo(cur, cv.CV_8UC3, 255.0);
        a.delete();
        sharp.delete();
      } else {
        if(fgMask){
          sharp.copyTo(cur, fgMask);
          sharp.delete();
        } else {
          cur.delete();
          cur = sharp;
        }
      }
      this._dbgOnce('brushify:pixelArtSharpen', { sharpenAmt, sigma });
    }

    if(edgeMask) edgeMask.delete();
    return cur;
  }

  computeGradientField(srcBGR){
    // returns { gray, gradX, gradY } (caller must delete)
    const gray=new cv.Mat();
    cv.cvtColor(srcBGR,gray,cv.COLOR_BGR2GRAY);
    // small blur to stabilize gradients on pixel art edges
    cv.GaussianBlur(gray,gray,new cv.Size(0,0),0.8,0.8,cv.BORDER_DEFAULT);
    const gradX=new cv.Mat();
    const gradY=new cv.Mat();
    cv.Sobel(gray,gradX,cv.CV_32F,1,0,3,1,0,cv.BORDER_DEFAULT);
    cv.Sobel(gray,gradY,cv.CV_32F,0,1,3,1,0,cv.BORDER_DEFAULT);
    return { gray, gradX, gradY };
  }

  angleFromGradient(gradX,gradY,x,y){
    // Stroke direction is perpendicular to gradient (along isophotes)
    // OpenCV.js floatPtr access
    const gx=gradX.floatPtr(y,x)[0];
    const gy=gradY.floatPtr(y,x)[0];
    const mag=Math.abs(gx)+Math.abs(gy);
    if(mag < 1e-3) return null;
    return (Math.atan2(gy,gx)*180/Math.PI) + 90.0;
  }

  buildErrorMask(refBGR, canvas8, fgMask, thr){
    const diff=new cv.Mat();
    cv.absdiff(refBGR,canvas8,diff);
    const diffG=new cv.Mat();
    cv.cvtColor(diff,diffG,cv.COLOR_BGR2GRAY);
    diff.delete();
    // small blur to avoid pepper noise triggering too many tiny strokes
    cv.GaussianBlur(diffG,diffG,new cv.Size(3,3),0.6,0.6,cv.BORDER_DEFAULT);
    const mask=new cv.Mat();
    cv.threshold(diffG,mask,thr,255,cv.THRESH_BINARY);
    diffG.delete();
    cv.bitwise_and(mask,fgMask,mask);
    return mask; // caller delete
  }

  // 单笔触绘制到 float 画布
  drawStroke(canvasF, center, angleDeg, length, thickness, color, alpha){
    const halfLen=length*0.5, halfTh=thickness*0.5;
    if(halfLen<1||halfTh<1) return;
    const angleRad=angleDeg*Math.PI/180;
    const cosA=Math.cos(angleRad), sinA=Math.sin(angleRad);
    const hw=Math.abs(halfLen*cosA)+Math.abs(halfTh*sinA);
    const hh=Math.abs(halfLen*sinA)+Math.abs(halfTh*cosA);
    const minX=Math.max(0,Math.floor(center.x-hw));
    const maxX=Math.min(canvasF.cols-1,Math.ceil(center.x+hw));
    const minY=Math.max(0,Math.floor(center.y-hh));
    const maxY=Math.min(canvasF.rows-1,Math.ceil(center.y+hh));
    if(minX>maxX||minY>maxY) return;

    const mask=new cv.Mat.zeros(maxY-minY+1,maxX-minX+1,cv.CV_8UC1);
    const localCenter=new cv.Point(center.x-minX, center.y-minY);
    const axes=new cv.Size(Math.round(halfLen),Math.round(halfTh));
    // 修复：OpenCV.js 需要完整 Scalar(4通道) 而不是 [255]
    cv.ellipse(mask,localCenter,axes,angleDeg,0,360,new cv.Scalar(255,255,255,255),-1,cv.LINE_AA);

    const isFloat = canvasF.type()===cv.CV_32FC3;
    for(let y=minY;y<=maxY;y++){
      for(let x=minX;x<=maxX;x++){
        const mv=mask.ucharPtr(y-minY,x-minX)[0];
        if(!mv) continue;
        const aLocal=alpha*(mv/255);
        if(isFloat){
          const ptr=canvasF.floatPtr(y,x);
          ptr[0]+= (color[0]-ptr[0])*aLocal;
          ptr[1]+= (color[1]-ptr[1])*aLocal;
          ptr[2]+= (color[2]-ptr[2])*aLocal;
        }
      }
    }
    mask.delete();
  }

  perlinNoise(x,y,seed=42){
    const xi=Math.floor(x)&255;
    const yi=Math.floor(y)&255;
    const xf=x-Math.floor(x);
    const yf=y-Math.floor(y);
    const hash=(x,y,s)=>{
      const h=(x*374761393 + y*668265263 + s) & 0x7fffffff;
      return (h/0x7fffffff)*2.0-1.0;
    };
    const u=xf*xf*(3-2*xf);
    const v=yf*yf*(3-2*yf);
    const n00=hash(xi,yi,seed)*(xf*0.5 + yf*0.5);
    const n10=hash(xi+1,yi,seed)*((xf-1)*0.5 + yf*0.5);
    const n01=hash(xi,yi+1,seed)*(xf*0.5 + (yf-1)*0.5);
    const n11=hash(xi+1,yi+1,seed)*((xf-1)*0.5 + (yf-1)*0.5);
    const nx0=n00*(1-u)+n10*u;
    const nx1=n01*(1-u)+n11*u;
    return nx0*(1-v)+nx1*v;
  }

  embroideryTexture(x,y){
    const n1=this.perlinNoise(x*8,y*8,123)*0.5;
    const n2=this.perlinNoise(x*24,y*24,456)*0.3;
    const n3=this.perlinNoise(x*64,y*64,789)*0.2;
    const line=Math.sin(x*32 + n1*4)*0.15;
    return (n1+n2+n3+line)*0.5+0.5;
  }

  smoothstep(e0,e1,x){
    const t=Math.max(0,Math.min(1,(x-e0)/(e1-e0)));
    return t*t*(3-2*t);
  }

  makeVivid(bgr,satScale=1.3,valScale=1.1){
    const bgrMat=new cv.Mat(1,1,cv.CV_8UC3);
    const p=bgrMat.ucharPtr(0,0);
    p[0]=bgr[0];p[1]=bgr[1];p[2]=bgr[2];
    const hsv=new cv.Mat();
    cv.cvtColor(bgrMat,hsv,cv.COLOR_BGR2HSV);
    const hp=hsv.ucharPtr(0,0);
    hp[1]=Math.min(255,Math.round(hp[1]*satScale));
    hp[2]=Math.min(255,Math.round(hp[2]*valScale));
    const back=new cv.Mat();
    cv.cvtColor(hsv,back,cv.COLOR_HSV2BGR);
    const out=[back.ucharPtr(0,0)[0],back.ucharPtr(0,0)[1],back.ucharPtr(0,0)[2]];
    bgrMat.delete();hsv.delete();back.delete();
    return out;
  }

  brushify(src){
    try {
      const hasAlpha = (src.channels()===4);
      let alphaOrig=null;
      // console.log("brushify 1")
      let procImgBGR;
      if(hasAlpha){
        const mv=new cv.MatVector();
        cv.split(src,mv);
        alphaOrig=mv.get(3).clone();
        const bgrVec=new cv.MatVector();
        bgrVec.push_back(mv.get(0)); bgrVec.push_back(mv.get(1)); bgrVec.push_back(mv.get(2));
        procImgBGR=new cv.Mat(); cv.merge(bgrVec,procImgBGR);
        for(let i=0;i<mv.size();i++) mv.get(i).delete();
        for(let i=0;i<bgrVec.size();i++) bgrVec.get(i).delete();
        mv.delete(); bgrVec.delete();
      } else if(src.channels()===1){
        procImgBGR=new cv.Mat(); cv.cvtColor(src,procImgBGR,cv.COLOR_GRAY2BGR);
      } else if(src.channels()===3){
        procImgBGR=src.clone();
      } else {
        procImgBGR=new cv.Mat(); cv.cvtColor(src,procImgBGR,cv.COLOR_BGRA2BGR);
      }
      const origH=src.rows, origW=src.cols;
      let procImg=procImgBGR.clone();
      let alphaProc=alphaOrig;
      let scale=1.0;
      if(origH>2000||origW>2000){
        scale=Math.min(2000/origH,2000/origW);
        const newH=Math.max(1,Math.round(origH*scale));
        const newW=Math.max(1,Math.round(origW*scale));
        const resized=new cv.Mat();
        cv.resize(procImgBGR,resized,new cv.Size(newW,newH),0,0,cv.INTER_AREA);
        procImg.delete(); procImg=resized;
        if(hasAlpha){
          const aRes=new cv.Mat();
          cv.resize(alphaOrig,aRes,new cv.Size(newW,newH),0,0,cv.INTER_NEAREST);
            if(alphaProc && alphaProc!==alphaOrig) alphaProc.delete();
          alphaProc=aRes;
        }
      }
      const bgColor=this.detectBackgroundColor(procImg);
      const fgMask=this.buildForegroundMask(procImg,bgColor,this.params.bgThreshold);
      if(hasAlpha){
        const alphaMask=new cv.Mat();
        cv.threshold(alphaProc,alphaMask,0,255,cv.THRESH_BINARY);
        cv.bitwise_and(fgMask,alphaMask,fgMask);
        alphaMask.delete();
      }
      // IMPORTANT: composite can hint "this is pixel-art grid" even if resize introduced gradients
      const hinted = !!this._pixelArtHint;
      const pixelArt = hinted || this.isPixelArtLike(procImg);
      this._pixelArtHint = false;
      this._dbgOnce('brushify:pixelArtDetect', { hinted, pixelArt, size: `${procImg.cols}x${procImg.rows}` });

      // Pixel-art/grid path: preserve exact shapes; only add internal thread shading
      if(pixelArt){
        const textured = this.brushifyPixelArtEffect(procImg, fgMask, bgColor);
        let result = textured;
        // restore alpha if needed (same logic as later pipeline)
        if(hasAlpha){
          const mv=new cv.MatVector();
          cv.split(textured,mv);
          let finalAlpha=alphaOrig;
          if(alphaOrig.rows!==textured.rows||alphaOrig.cols!==textured.cols){
            finalAlpha=new cv.Mat();
            cv.resize(alphaOrig,finalAlpha,new cv.Size(textured.cols,textured.rows),0,0,cv.INTER_NEAREST);
          }
          mv.push_back(finalAlpha);
          result=new cv.Mat();
          cv.merge(mv,result);
          for(let i=0;i<mv.size();i++) mv.get(i).delete();
          mv.delete();
          if(finalAlpha!==alphaOrig) finalAlpha.delete();
          textured.delete();
        }
        procImgBGR.delete();
        procImg.delete();
        if(alphaProc && alphaProc!==alphaOrig) alphaProc.delete();
        if(alphaOrig) alphaOrig.delete();
        fgMask.delete();
        return result;
      }

      // For pixel art/grid images: avoid bilateral + heavy Gaussian blur (it creates mixed colors on edges)
      const smoothSrc=new cv.Mat();
      if(pixelArt){
        // light median to remove single-pixel specks without edge bleeding
        cv.medianBlur(procImg,smoothSrc,3);
      } else {
        cv.bilateralFilter(procImg,smoothSrc,5,40,6);
      }

      // pixelArt is handled by the early-return path above; this branch is for photos/continuous-tone inputs.
      const refs = this.buildScaleRefs(smoothSrc,this.params.radii);

      const gradField = this.params.useGradientAngle ? this.computeGradientField(smoothSrc) : null;
      const canvasF=new cv.Mat(procImg.rows,procImg.cols,cv.CV_32FC3);
      // 使用 3 通道 Scalar 避免隐式 4->3 适配问题
      canvasF.setTo(new cv.Scalar(bgColor[0],bgColor[1],bgColor[2]));
      const H=procImg.rows, W=procImg.cols;
      for(let li=0; li<this.params.radii.length; li++){
        const r=this.params.radii[li];
        const t= li/Math.max(1,this.params.radii.length-1);
        const alpha=this.params.alphaLarge*(1-t)+this.params.alphaSmall*t;
        const baseJitter=this.params.jitterLarge*(1-t)+this.params.jitterSmall*t;
        const jitter=pixelArt ? Math.min(baseJitter, 0.10) : baseJitter;
        const thickF=this.params.thicknessLarge*(1-t)+this.params.thicknessSmall*t;
        const ref=refs[li];
        const step=Math.max(1,Math.round(r*this.params.stepFactor));

        // Build painterly error mask (optional)
        let errMask=null;
        if(this.params.useErrorMask){
          const canvas8=new cv.Mat();
          canvasF.convertTo(canvas8,cv.CV_8UC3);
          const errThr = this.params.errorThresholdLarge*(1-t) + this.params.errorThresholdSmall*t;
          errMask=this.buildErrorMask(ref,canvas8,fgMask,errThr);
          canvas8.delete();
        }

        const grid=[];
        for(let y=Math.floor(r/2); y<H; y+=step){
          for(let x=Math.floor(r/2); x<W; x+=step){
            if(fgMask.ucharPtr(y,x)[0]===0) continue;
            if(errMask && errMask.ucharPtr(y,x)[0]===0) continue;
            grid.push({x,y});
          }
        }
        for(let i=grid.length-1;i>0;i--){
          const j=Math.floor(Math.random()*(i+1));
          [grid[i],grid[j]]=[grid[j],grid[i]];
        }
        for(const gp of grid){
          const jx=this.frand(-jitter*r,jitter*r);
          const jy=this.frand(-jitter*r,jitter*r);
            const px=Math.max(0,Math.min(W-1,gp.x+jx));
            const py=Math.max(0,Math.min(H-1,gp.y+jy));
            const ix=px|0, iy=py|0;
            if(fgMask.ucharPtr(iy,ix)[0]===0) continue;
            if(errMask && errMask.ucharPtr(iy,ix)[0]===0) continue;

            // Color sampling
            let srcPtr;
            if(this.params.useScaleRefColor){
              // use original only on finest layer for crisp detail; otherwise take blurred ref
              const useOrig = (li===this.params.radii.length-1) ? this.params.sampleOriginalColor : false;
              srcPtr = useOrig ? procImg.ucharPtr(iy,ix) : ref.ucharPtr(iy,ix);
            } else {
              srcPtr=this.params.sampleOriginalColor? procImg.ucharPtr(iy,ix): ref.ucharPtr(iy,ix);
            }
            const col=[srcPtr[0],srcPtr[1],srcPtr[2]];
            // Angle sampling
            let baseAngle=0.0;
            if(this.params.useGradientAngle && gradField){
              const a=this.angleFromGradient(gradField.gradX,gradField.gradY,ix,iy);
              if(a!==null) baseAngle=a;
            }
            const aj = pixelArt ? Math.min(this.params.angleJitterDeg, 4.0) : this.params.angleJitterDeg;
            const angle=baseAngle + this.frand(-aj,aj);
            const len=r*this.params.elongate;
            const thick=r*thickF;
            this.drawStroke(canvasF,{x:px,y:py},angle,len,thick,col,alpha);
        }

        if(errMask) errMask.delete();
      }
      const outBGR=new cv.Mat();
      canvasF.convertTo(outBGR,cv.CV_8UC3);
      let finalBGR=outBGR;
      if(scale<1.0){
        finalBGR=new cv.Mat();
        cv.resize(outBGR,finalBGR,new cv.Size(origW,origH),0,0,cv.INTER_CUBIC);
        outBGR.delete();
      }
      let result;
      if(hasAlpha){
        const mv=new cv.MatVector();
        cv.split(finalBGR,mv);
        let finalAlpha=alphaOrig;
        if(alphaOrig.rows!==finalBGR.rows||alphaOrig.cols!==finalBGR.cols){
          finalAlpha=new cv.Mat();
          cv.resize(alphaOrig,finalAlpha,new cv.Size(finalBGR.cols,finalBGR.rows),0,0,cv.INTER_NEAREST);
        }
        mv.push_back(finalAlpha);
        result=new cv.Mat();
        cv.merge(mv,result);
        const zeroMask=new cv.Mat();
        cv.compare(finalAlpha,new cv.Mat.zeros(finalAlpha.rows,finalAlpha.cols,finalAlpha.type()),zeroMask,cv.CMP_EQ);
        result.setTo(new cv.Scalar(0,0,0,0),zeroMask);
        for(let i=0;i<mv.size();i++) mv.get(i).delete();
        mv.delete();
        zeroMask.delete();
        if(finalAlpha!==alphaOrig) finalAlpha.delete();
      } else {
        result=finalBGR;
      }
      procImgBGR.delete();
      procImg.delete();
      if(alphaProc && alphaProc!==alphaOrig) alphaProc.delete();
      if(alphaOrig) alphaOrig.delete();
      fgMask.delete();
      smoothSrc.delete();
      refs.forEach(r=>r.delete());
      if(gradField){ gradField.gradX.delete(); gradField.gradY.delete(); gradField.gray.delete(); }
      canvasF.delete();
      return result;
    } catch(e){
      console.error('[Brushify] brushify error', e);
      throw e;
    }
  }

  makeVividPixel(b, g, r, satScale, valScale) {
    // Build small Mat
    let src = new cv.Mat(1, 1, cv.CV_8UC3);
    src.data[0] = b; src.data[1] = g; src.data[2] = r;
    let hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_BGR2HSV);
    let H = hsv.data[0], S = hsv.data[1], V = hsv.data[2];
    S = Math.min(255, Math.round(S * satScale));
    V = Math.min(255, Math.round(V * valScale));
    hsv.data[1] = S; hsv.data[2] = V;
    let out = new cv.Mat();
    cv.cvtColor(hsv, out, cv.COLOR_HSV2BGR);
    const ob = out.data[0], og = out.data[1], or_ = out.data[2];
    src.delete(); hsv.delete(); out.delete();
    return [ob, og, or_];
}

  /**
   * blendMode: 'current'(原有混合) | 'linearLight' | 'overlay' | 'softLight' | 'multiply' | 'screen' | 'hardLight' | 'vividLight'
   *           | 'linearLightPure'(仅线性光+透明度；跳过纹理/边缘/模糊/鲜艳度等增强管线，用于对齐 PS 测试)
   * textureOpacity: 0.0~1.0，控制 effect(笔触纹理层) 叠加到 template 的强度
   */
  mergeImagesAdvanced(templateImg, effectImg, brightness = 1.0, vividBgDiffThr = 18, vividBgProtect = 1.0, blendMode = 'current', textureOpacity = 1.0) {
    if (templateImg.empty() || effectImg.empty()) return new cv.Mat();

    // pure 模式：只做“像素(上层 effect) + 底图 template”的 PS 混合与透明度，不做任何额外增强
    if (blendMode === 'linearLightPure') {
      return this.mergeImagesPure(templateImg, effectImg, 'linearLight', textureOpacity);
    }

    // Ensure BGRA
    let tmpl = new cv.Mat(), eff = new cv.Mat();
    if (templateImg.channels() === 4) tmpl = templateImg.clone();
    else { cv.cvtColor(templateImg, tmpl, cv.COLOR_BGR2BGRA); }
    if (effectImg.channels() === 4) eff = effectImg.clone();
    else { cv.cvtColor(effectImg, eff, cv.COLOR_BGR2BGRA); }

    // Background color from template
    let tmplBGR = new cv.Mat();
    cv.cvtColor(tmpl, tmplBGR, cv.COLOR_BGRA2BGR);
    const bgColorProtect = this.detectBackgroundColor(tmplBGR); // Scalar(b,g,r,a)

    // Edges
    let templGray = new cv.Mat(), effectGray = new cv.Mat();
    cv.cvtColor(tmpl, templGray, cv.COLOR_BGRA2GRAY);
    cv.cvtColor(eff, effectGray, cv.COLOR_BGRA2GRAY);
    let templEdges = new cv.Mat(), effectEdges = new cv.Mat();
    cv.Canny(templGray, templEdges, 50, 150);
    cv.Canny(effectGray, effectEdges, 30, 100);

    const rows = tmpl.rows, cols = tmpl.cols;
    let result = new cv.Mat(rows, cols, cv.CV_8UC4);

    const tData = tmpl.data, eData = eff.data, rData = result.data;
    const teData = templEdges.data, eeData = effectEdges.data;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const idx = (y * cols + x) * 4;
            const tA = tData[idx + 3] / 255.0;
            const eA = eData[idx + 3] / 255.0;

            if (tA < 0.01) {
                rData[idx] = rData[idx + 1] = rData[idx + 2] = 0;
                rData[idx + 3] = 0;
                continue;
            }
            if (eA < 0.01) {
                // copy template pixel
                rData[idx] = tData[idx];
                rData[idx + 1] = tData[idx + 1];
                rData[idx + 2] = tData[idx + 2];
                rData[idx + 3] = tData[idx + 3];
                continue;
            }

            // Textures
            const coarseTexture = this.embroideryTexture(x / 120.0, y / 120.0);
            const fineTexture = this.embroideryTexture(x / 40.0, y / 40.0);
            const microTexture = this.perlinNoise(x / 15.0, y / 15.0, 555) * 0.5 + 0.5;
            const stitchAngle = Math.atan2(y - rows / 2.0, x - cols / 2.0);
            const stitchPattern = Math.sin(x * 0.2 + y * 0.15 + stitchAngle * 1.5) * 0.5 + 0.5;
            const fuzzTexture1 = this.perlinNoise(x / 21.0, y / 21.0, 333) * 0.3 + 0.5;
            const fuzzTexture2 = this.perlinNoise(x / 11.0, y / 11.0, 666) * 0.2 + 0.5;
            const fuzzPattern = fuzzTexture1 * 0.5 + fuzzTexture2 * 0.2;
            const edgeFactor = (teData[y * cols + x] > 0 || eeData[y * cols + x] > 0) ? 1.2 : 1.0;

            const tb = tData[idx], tg = tData[idx + 1], tr = tData[idx + 2];
            const eb = eData[idx], eg = eData[idx + 1], er = eData[idx + 2];

            const tLum = (tb * 0.114 + tg * 0.587 + tr * 0.299) / 255.0;
            const eLum = (eb * 0.114 + eg * 0.587 + er * 0.299) / 255.0;
            const isDark = 1.0 - this.smoothstep(0.1, 0.4, eLum);

            // Background diff for protection
            const diffBG =
                Math.abs(tb - bgColorProtect[0]) +
                Math.abs(tg - bgColorProtect[1]) +
                Math.abs(tr - bgColorProtect[2]);
            const isBG = diffBG <= vividBgDiffThr;

            for (let c = 0; c < 3; c++) {
                const tCh = tData[idx + c] / 255.0;
                const eCh = eData[idx + c] / 255.0;
                const multiply = tCh * eCh;
                const overlay = (tCh < 0.5) ? 2.0 * tCh * eCh : 1.0 - 2.0 * (1.0 - tCh) * (1.0 - eCh);
                const softLight = (eCh < 0.5)
                    ? tCh - (1.0 - 2.0 * eCh) * tCh * (1.0 - tCh)
                    : tCh + (2.0 * eCh - 1.0) * (Math.sqrt(tCh) - tCh);

                // === PS 各混合模式（底层=template, 上层=effect）===
                const linearLight = Math.max(0, Math.min(1, tCh + 2.0 * eCh - 1.0));
                const hardLight   = (eCh < 0.5) ? 2.0 * tCh * eCh : 1.0 - 2.0 * (1.0 - tCh) * (1.0 - eCh);
                const vividLight  = (eCh < 0.5)
                    ? (eCh < 1e-5 ? 0 : Math.max(0, Math.min(1, 1.0 - (1.0 - tCh) / (2.0 * eCh))))
                    : (eCh > 1.0 - 1e-5 ? 1 : Math.max(0, Math.min(1, tCh / (2.0 * (1.0 - eCh)))));
                const screenMode  = 1.0 - (1.0 - tCh) * (1.0 - eCh);
                // 根据外部 blendMode 参数选择主混合结果
                let blendResult;
                if      (blendMode === 'linearLight') { blendResult = linearLight; }
                else if (blendMode === 'overlay')     { blendResult = overlay; }
                else if (blendMode === 'softLight')   { blendResult = softLight; }
                else if (blendMode === 'hardLight')   { blendResult = hardLight; }
                else if (blendMode === 'multiply')    { blendResult = multiply; }
                else if (blendMode === 'screen')      { blendResult = screenMode; }
                else if (blendMode === 'vividLight')  { blendResult = vividLight; }
                else { blendResult = multiply * 0.15 + overlay * 0.5 + softLight * 0.35; }
                // textureOpacity: 模拟 PS 图层透明度（0=只显示模板, 1=完全混合）
                const blendMixed = tCh * (1.0 - textureOpacity) + blendResult * textureOpacity;
                let blendModeVal = blendMixed;
                const textureBlend = coarseTexture * 0.3 + fineTexture * 0.3 + microTexture * 0.4;
                blendModeVal *= (0.85 + textureBlend * 0.3);
                blendModeVal += (stitchPattern - 0.5) * 0.02 * tA;
                const fuzzEffect = (fuzzPattern - 0.5) * 0.04 * isDark;
                blendModeVal += fuzzEffect;
                blendModeVal *= edgeFactor;
                // 结合枕头的明暗与刺绣方向，增加轻微的“凸起”立体感（降低强度，避免整体偏暗）
                const pillowShade = this.smoothstep(0.15, 0.85, tLum);
                const lightDir = Math.PI * 0.35; // 约等于左上角光源
                const stitchLight = 0.5 + 0.5 * Math.cos(stitchAngle - lightDir);
                const depth = (stitchLight - 0.5) * 0.06 * (1.0 - isBG);
                blendModeVal += depth;
                // shade 在 [~0.96, ~1.06] 之间，小幅随明暗波动，整体略亮一点
                const shade = 1.01 + 0.05 * (pillowShade - 0.5);
                const contrast = 1.05 + Math.abs(tLum - eLum) * 0.3;
                let final = tCh * (1.0 - tA) + blendModeVal * tA;
                final = (final - 0.5) * contrast + 0.5;
                final *= shade;

                const colorShift = microTexture * 0.015;
                if (c === 0) final *= (0.99 + colorShift);
                if (c === 1) final *= (0.995 + colorShift * 0.5);
                if (c === 2) final *= (1.005 + colorShift);
                if (isDark > 0.3) {
                    const subtleFuzz = this.perlinNoise(x / 8.0, y / 8.0, 111) * 0.5 + 0.5;
                    const fuzzHighlight = (subtleFuzz - 0.5) * 0.03 * isDark;
                    final += fuzzHighlight;
                    const colorVariation = (subtleFuzz - 0.5) * 0.02 * isDark;
                    if (c === 0) final += colorVariation * 0.6;
                    if (c === 1) final += colorVariation * 0.4;
                    if (c === 2) final += colorVariation * 0.8;
                    const sparkleNoise = this.perlinNoise(x / 3.0, y / 3.0, 999) * 0.5 + 0.5;
                    if (sparkleNoise > 0.95)
                        final += 0.04 * isDark * (sparkleNoise - 0.95) / 0.05;
                }
                // 适度提升整体亮度，同时保留外部 brightness 控制
                const brightFactor = (blendMode === 'current') ? (1.10 + 0.6 * (brightness - 1.0)) : (1.0 + 0.6 * (brightness - 1.0));
                final *= brightFactor;

                if (isBG) {
                    const tBase = tCh;
                    const bgAdjust = 0.40 - 0.30 * Math.max(0, Math.min(1, vividBgProtect));
                    final = tBase + (final - tBase) * bgAdjust;
                    final = Math.min(final, 0.92 - 0.25 * vividBgProtect);
                }

                rData[idx + c] = Math.max(0, Math.min(255, Math.round(final * 255.0)));
            }
            rData[idx + 3] = tData[idx + 3];
        }
    }

    // Blur & mix
    let blurred = new cv.Mat();
    cv.GaussianBlur(result, blurred, new cv.Size(3, 3), 0.3, 0.3, cv.BORDER_DEFAULT);
    const rd = result.data, bd = blurred.data;
    for (let i = 0; i < rd.length; i += 4) {
        if (rd[i + 3] === 0) { rd[i] = rd[i + 1] = rd[i + 2] = 0; continue; }
        rd[i] = (rd[i] * 0.9 + bd[i] * 0.1) & 0xFF;
        rd[i + 1] = (rd[i + 1] * 0.9 + bd[i + 1] * 0.1) & 0xFF;
        rd[i + 2] = (rd[i + 2] * 0.9 + bd[i + 2] * 0.1) & 0xFF;
    }
    blurred.delete();

    // Vivid stage
    // background color from effectImg
    let effBGR = new cv.Mat();
    if (effectImg.channels() === 4) cv.cvtColor(effectImg, effBGR, cv.COLOR_BGRA2BGR);
    else effBGR = effectImg.clone();
    const effBgColor = this.detectBackgroundColor(effBGR);

    const satScaleFG = brightness + 0.5;
    const valScaleFG = brightness + 0.5;
    const satScaleBG = brightness - 0.5;
    const valScaleBG = brightness - 0.5;

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const idx = (y * cols + x) * 4;
            if (rData[idx + 3] === 0) continue;
            const db = rData[idx], dg = rData[idx + 1], dr = rData[idx + 2];
            const diff =
                Math.abs(db - effBgColor[0]) +
                Math.abs(dg - effBgColor[1]) +
                Math.abs(dr - effBgColor[2]);
            const isBG = diff <= vividBgDiffThr;
            if (isBG) continue;
            const [nb, ng, nr] = this.makeVividPixel(db, dg, dr,
                                                satScaleFG, valScaleFG);
            rData[idx] = nb; rData[idx + 1] = ng; rData[idx + 2] = nr;
        }
    }

    // Cleanup
    tmpl.delete(); eff.delete(); tmplBGR.delete();
    templGray.delete(); effectGray.delete();
    templEdges.delete(); effectEdges.delete();
    effBGR.delete();

    return result;
}

  /** 离散线段卷积核，方向近似 PS 「喷色描边」笔触 */
  _motionBlurKernel(strokeLength, angleRad) {
    const L = Math.max(3, Math.min(64, Math.round(strokeLength)));
    const size = L % 2 === 1 ? L : L + 1;
    const arr = new Float32Array(size * size);
    const cx = (size - 1) / 2;
    const cy = (size - 1) / 2;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    const half = Math.floor(L / 2);
    for (let t = -half; t <= half; t++) {
      const x = Math.round(cx + t * cos);
      const y = Math.round(cy + t * sin);
      if (x >= 0 && x < size && y >= 0 && y < size) arr[y * size + x] += 1;
    }
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    if (s < 1e-6) {
      arr[Math.floor(cy) * size + Math.floor(cx)] = 1;
      s = 1;
    }
    for (let i = 0; i < arr.length; i++) arr[i] /= s;
    return cv.matFromArray(size, size, cv.CV_32F, arr);
  }

  /**
   * 线性光叠加之前：对格子层 BGR 做高斯虚化，削弱色块边界；alpha 与原版一致（不糊透明边）。
   * @returns {cv.Mat} 成功时为新的 BGRA（并 delete 入参 bgra）；关闭或失败时返回原 bgra
   */
  _softenGridBlocksBeforeMerge(bgra) {
    if (this.params.linearLightGridPresoftenEnabled === false) return bgra;
    const sigma = Math.max(0, Math.min(4, Number(this.params.linearLightGridPresoftenSigma) || 0));
    if (sigma < 0.08) return bgra;

    const bgr = new cv.Mat();
    const bgrBlur = new cv.Mat();
    try {
      cv.cvtColor(bgra, bgr, cv.COLOR_BGRA2BGR);
      cv.GaussianBlur(bgr, bgrBlur, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT);

      const rows = bgra.rows;
      const cols = bgra.cols;
      const out = new cv.Mat(rows, cols, cv.CV_8UC4);
      const odat = out.data;
      const bdat = bgrBlur.data;
      const adat = bgra.data;
      const n = rows * cols;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        odat[i4] = bdat[i3];
        odat[i4 + 1] = bdat[i3 + 1];
        odat[i4 + 2] = bdat[i3 + 2];
        odat[i4 + 3] = adat[i4 + 3];
      }
      bgr.delete();
      bgrBlur.delete();
      bgra.delete();
      return out;
    } catch (e) {
      try { bgr.delete(); } catch (_) {}
      try { bgrBlur.delete(); } catch (_) {}
      console.warn('[Brushify] grid presoften skipped', e);
      return bgra;
    }
  }

  /**
   * 仅在暗部区域做去块模糊，减轻阴影中的方格感，同时尽量保住亮部边缘与纹理。
   * @returns {cv.Mat} 成功时为新的 BGRA（并 delete 入参 bgra）；关闭或失败时返回原 bgra
   */
  _softenShadowBlocksBeforeMerge(bgra) {
    if (this.params.linearLightShadowDeblockEnabled === false) return bgra;
    const sigma = Math.max(0, Math.min(4, Number(this.params.linearLightShadowDeblockSigma) || 0));
    const mix = Math.max(0, Math.min(1, Number(this.params.linearLightShadowDeblockMix) || 0));
    const start = Math.max(0, Math.min(1, Number(this.params.linearLightShadowDeblockStart) || 0));
    const end = Math.max(start + 1e-3, Math.min(1, Number(this.params.linearLightShadowDeblockEnd) || 0.5));
    if (sigma < 0.08 || mix < 0.01) return bgra;

    const bgr = new cv.Mat();
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    try {
      cv.cvtColor(bgra, bgr, cv.COLOR_BGRA2BGR);
      cv.cvtColor(bgr, gray, cv.COLOR_BGR2GRAY);
      cv.GaussianBlur(bgr, blur, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT);

      const rows = bgra.rows;
      const cols = bgra.cols;
      const out = new cv.Mat(rows, cols, cv.CV_8UC4);
      const odat = out.data;
      const bdat = bgr.data;
      const blurDat = blur.data;
      const grayDat = gray.data;
      const adat = bgra.data;
      const n = rows * cols;
      const invRange = 1 / Math.max(1e-6, end - start);

      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        const lum = grayDat[i] / 255;
        let t = (end - lum) * invRange;
        if (t <= 0) t = 0;
        else if (t >= 1) t = 1;
        else t = t * t * (3 - 2 * t);
        const localMix = mix * t;

        if (localMix > 1e-4) {
          odat[i4] = Math.round(bdat[i3] * (1 - localMix) + blurDat[i3] * localMix);
          odat[i4 + 1] = Math.round(bdat[i3 + 1] * (1 - localMix) + blurDat[i3 + 1] * localMix);
          odat[i4 + 2] = Math.round(bdat[i3 + 2] * (1 - localMix) + blurDat[i3 + 2] * localMix);
        } else {
          odat[i4] = bdat[i3];
          odat[i4 + 1] = bdat[i3 + 1];
          odat[i4 + 2] = bdat[i3 + 2];
        }
        odat[i4 + 3] = adat[i4 + 3];
      }

      bgr.delete();
      gray.delete();
      blur.delete();
      bgra.delete();
      return out;
    } catch (e) {
      try { bgr.delete(); } catch (_) {}
      try { gray.delete(); } catch (_) {}
      try { blur.delete(); } catch (_) {}
      console.warn('[Brushify] shadow deblock skipped', e);
      return bgra;
    }
  }

  /**
   * 低分辨率格子图被大倍率放大后，先按放大后块尺寸做 mode-pooling 回收，再 cubic 放回目标尺寸。
   * 这一步比单纯高斯模糊更接近“先按主色重绘，再叠纹理”的效果，不会在暗部留下整齐矩形。
   */
  _deblockUpscaledPixelArtBeforeMerge(bgra, sourceCols = 0, sourceRows = 0) {
    if (this.params.linearLightPixelArtDeblockEnabled === false) return bgra;
    const minScale = Math.max(1, Number(this.params.linearLightPixelArtDeblockMinScale) || 2.5);
    const bgr = new cv.Mat();
    let pooled = null;
    let upscaled = null;
    try {
      cv.cvtColor(bgra, bgr, cv.COLOR_BGRA2BGR);
      const bx = this._estimateBlockSizeBGR(bgr, 'x');
      const by = this._estimateBlockSizeBGR(bgr, 'y');
      const scaleX = sourceCols > 0 ? bgra.cols / sourceCols : bx;
      const scaleY = sourceRows > 0 ? bgra.rows / sourceRows : by;
      const scale = Math.max(scaleX, scaleY, bx, by);
      if (scale < minScale) {
        bgr.delete();
        return bgra;
      }
      if (bx <= 1 && by <= 1) {
        bgr.delete();
        return bgra;
      }

      pooled = this._modePoolDownsample(bgr, Math.max(1, bx), Math.max(1, by));
      upscaled = new cv.Mat();
      cv.resize(
        pooled,
        upscaled,
        new cv.Size(bgra.cols, bgra.rows),
        0,
        0,
        cv.INTER_CUBIC
      );

      const out = new cv.Mat(bgra.rows, bgra.cols, cv.CV_8UC4);
      const odat = out.data;
      const udat = upscaled.data;
      const adat = bgra.data;
      const n = bgra.rows * bgra.cols;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        odat[i4] = udat[i3];
        odat[i4 + 1] = udat[i3 + 1];
        odat[i4 + 2] = udat[i3 + 2];
        odat[i4 + 3] = adat[i4 + 3];
      }

      this._dbgOnce('patternOverlay:pixelArtDeblock', {
        from: `${sourceCols}x${sourceRows}`,
        to: `${bgra.cols}x${bgra.rows}`,
        scale,
        block: [bx, by],
        pooled: `${pooled.cols}x${pooled.rows}`
      });

      bgr.delete();
      pooled.delete();
      upscaled.delete();
      bgra.delete();
      return out;
    } catch (e) {
      try { bgr.delete(); } catch (_) {}
      if (pooled) try { pooled.delete(); } catch (_) {}
      if (upscaled) try { upscaled.delete(); } catch (_) {}
      console.warn('[Brushify] pixel-art deblock skipped', e);
      return bgra;
    }
  }

  /**
   * linearLight / linearLightPure：在上层 BGRA（格子图）上近似「喷色描边」——方向运动模糊 + 喷溅式模糊，再与原图淡混合。
   * @returns {cv.Mat} 新 Mat（成功时；并 delete 入参 bgra）或失败时原 bgra
   */
  _applySprayedStrokesToEffect(bgra) {
    if (this.params.linearLightSprayedStrokesEnabled === false) return bgra;

    const strokeLen = Math.max(3, Math.min(64, Math.round(Number(this.params.linearLightSprayedStrokeLength) || 20)));
    const sprayR = Math.max(1, Math.min(32, Math.round(Number(this.params.linearLightSprayedSprayRadius) || 7)));
    const mix = Math.max(0, Math.min(1, Number(this.params.linearLightSprayedMix ?? 0.28)));
    if (mix < 0.001) return bgra;

    const dir = String(this.params.linearLightSprayedDirection || 'rightDiagonal');
    let angle = Math.PI / 4;
    if (dir === 'leftDiagonal') angle = -Math.PI / 4;

    const bgr = new cv.Mat();
    const bgrMotion = new cv.Mat();
    const bgrOut = new cv.Mat();
    let kernel = null;
    try {
      cv.cvtColor(bgra, bgr, cv.COLOR_BGRA2BGR);
      kernel = this._motionBlurKernel(strokeLen, angle);
      cv.filter2D(bgr, bgrMotion, cv.CV_8U, kernel, new cv.Point(-1, -1), 0, cv.BORDER_DEFAULT);
      kernel.delete();
      kernel = null;

      const sigma = Math.max(0.6, sprayR * 0.38);
      cv.GaussianBlur(bgrMotion, bgrMotion, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT);
      cv.addWeighted(bgr, 1.0 - mix, bgrMotion, mix, 0, bgrOut, -1);

      const rows = bgra.rows;
      const cols = bgra.cols;
      const out = new cv.Mat(rows, cols, cv.CV_8UC4);
      const odat = out.data;
      const bdat = bgrOut.data;
      const adat = bgra.data;
      const n = rows * cols;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        const i4 = i * 4;
        odat[i4] = bdat[i3];
        odat[i4 + 1] = bdat[i3 + 1];
        odat[i4 + 2] = bdat[i3 + 2];
        odat[i4 + 3] = adat[i4 + 3];
      }

      bgr.delete();
      bgrMotion.delete();
      bgrOut.delete();
      bgra.delete();
      return out;
    } catch (e) {
      if (kernel) try { kernel.delete(); } catch (_) {}
      try { bgr.delete(); } catch (_) {}
      try { bgrMotion.delete(); } catch (_) {}
      try { bgrOut.delete(); } catch (_) {}
      console.warn('[Brushify] sprayed strokes skipped', e);
      return bgra;
    }
  }

  /**
   * 纯 PS 混合：仅 blend + opacity（不做纹理、边缘、模糊、鲜艳度、背景保护等）
   * base = template, top = effect
   * @param {'hybrid'|'alphaNormal'|'linearLight'} blendMode hybrid：饱和度自适应（保色+毛绒）；alphaNormal：全图上叠；linearLight：全图线性光
   */
  mergeImagesPure(templateImg, effectImg, blendMode = 'hybrid', textureOpacity = 1.0) {
    if (templateImg.empty() || effectImg.empty()) return new cv.Mat();

    // Ensure BGRA
    let tmpl = new cv.Mat(), eff = new cv.Mat();
    if (templateImg.channels() === 4) tmpl = templateImg.clone();
    else { cv.cvtColor(templateImg, tmpl, cv.COLOR_BGR2BGRA); }
    if (effectImg.channels() === 4) eff = effectImg.clone();
    else { cv.cvtColor(effectImg, eff, cv.COLOR_BGR2BGRA); }

    const mode = blendMode === 'alphaNormal' || blendMode === 'linearLight' ? blendMode : 'hybrid';
    const hasEffectAlpha = eff.channels() === 4;

    const fMin = Math.max(0, Math.min(1, Number(this.params.mergeHybridNormalMin) || 0.06));
    const fMax = Math.max(fMin, Math.min(1, Number(this.params.mergeHybridNormalMax) || 0.9));
    const chromaScale = Math.max(0.1, Math.min(6, Number(this.params.mergeHybridChromaScale) || 2.15));

    const rows = tmpl.rows, cols = tmpl.cols;
    let result = new cv.Mat(rows, cols, cv.CV_8UC4);
    const tData = tmpl.data, eData = eff.data, rData = result.data;

    const opacity = Math.max(0, Math.min(1, Number(textureOpacity)));
    const encodedLL = this.params.linearLightBlendInEncodedSpace !== false;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 4;
        const tA = tData[idx + 3] / 255.0;

        if (tA < 0.01) {
          rData[idx] = rData[idx + 1] = rData[idx + 2] = 0;
          rData[idx + 3] = 0;
          continue;
        }

        if (opacity < 1e-6) {
          rData[idx] = tData[idx];
          rData[idx + 1] = tData[idx + 1];
          rData[idx + 2] = tData[idx + 2];
          rData[idx + 3] = tData[idx + 3];
          continue;
        }

        const ePA = hasEffectAlpha ? eData[idx + 3] / 255.0 : 1.0;
        if (mode !== 'linearLight' && ePA < 1e-5) {
          rData[idx] = tData[idx];
          rData[idx + 1] = tData[idx + 1];
          rData[idx + 2] = tData[idx + 2];
          rData[idx + 3] = tData[idx + 3];
          continue;
        }
        if (mode === 'linearLight' && hasEffectAlpha && ePA < 1e-5) {
          rData[idx] = tData[idx];
          rData[idx + 1] = tData[idx + 1];
          rData[idx + 2] = tData[idx + 2];
          rData[idx + 3] = tData[idx + 3];
          continue;
        }

        if (mode === 'alphaNormal') {
          const w = opacity * Math.max(0, Math.min(1, ePA));
          const ow = 1.0 - w;
          for (let c = 0; c < 3; c++) {
            const out = ow * tData[idx + c] + w * eData[idx + c];
            rData[idx + c] = out <= 0 ? 0 : out >= 255 ? 255 : Math.round(out);
          }
        } else if (mode === 'linearLight') {
          const topAlpha = opacity * Math.max(0, Math.min(1, ePA));

          if (topAlpha < 1e-6) {
            rData[idx] = tData[idx];
            rData[idx + 1] = tData[idx + 1];
            rData[idx + 2] = tData[idx + 2];
            rData[idx + 3] = tData[idx + 3];
            continue;
          }

          if (encodedLL) {
            for (let c = 0; c < 3; c++) {
              const b = tData[idx + c];
              const m = eData[idx + c];
              let vf = b + 2.0 * m - 255.0;
              if (vf < 0) vf = 0;
              else if (vf > 255) vf = 255;
              const out = (1.0 - topAlpha) * b + topAlpha * vf;
              rData[idx + c] = out <= 0 ? 0 : out >= 255 ? 255 : Math.round(out);
            }
          } else {
            for (let c = 0; c < 3; c++) {
              const b = tData[idx + c];
              const m = eData[idx + c];
              const bLin = srgbByteToLinear01(b);
              const mLin = srgbByteToLinear01(m);
              let vLin = bLin + 2 * mLin - 1;
              vLin = Math.max(0, Math.min(1, vLin));
              const outLin = (1.0 - topAlpha) * bLin + topAlpha * vLin;
              rData[idx + c] = linear01ToSrgbByte(outLin);
            }
          }
        } else {
          const w = opacity * Math.max(0, Math.min(1, ePA));
          const ow = 1.0 - w;
          const mb = eData[idx];
          const mg = eData[idx + 1];
          const mr = eData[idx + 2];
          const mx = Math.max(mb, mg, mr);
          const mn = Math.min(mb, mg, mr);
          const chroma01 = (mx - mn) / 255.0;
          let fn = fMin + (fMax - fMin) * Math.min(1, chroma01 * chromaScale);
          if (fn < 0) fn = 0;
          else if (fn > 1) fn = 1;
          const topAlpha = opacity * Math.max(0, Math.min(1, ePA));

          if (topAlpha < 1e-6) {
            rData[idx] = tData[idx];
            rData[idx + 1] = tData[idx + 1];
            rData[idx + 2] = tData[idx + 2];
            rData[idx + 3] = tData[idx + 3];
            continue;
          }

          for (let c = 0; c < 3; c++) {
            const b = tData[idx + c];
            const m = eData[idx + c];
            const nm = ow * b + w * m;
            let ll;
            if (encodedLL) {
              let vf = b + 2.0 * m - 255.0;
              if (vf < 0) vf = 0;
              else if (vf > 255) vf = 255;
              ll = (1.0 - topAlpha) * b + topAlpha * vf;
            } else {
              const bLin = srgbByteToLinear01(b);
              const mLin = srgbByteToLinear01(m);
              let vLin = bLin + 2 * mLin - 1;
              vLin = Math.max(0, Math.min(1, vLin));
              ll = (1.0 - topAlpha) * bLin + topAlpha * vLin;
              ll = linear01ToSrgbByte(ll);
            }
            const out = (1.0 - fn) * ll + fn * nm;
            rData[idx + c] = out <= 0 ? 0 : out >= 255 ? 255 : Math.round(out);
          }
        }

        rData[idx + 3] = tData[idx + 3];
      }
    }

    tmpl.delete();
    eff.delete();
    return result;
  }

  /**
   * PS 风格图案叠加专用合成（独立入口，不影响现有 brushifyComposite）：
   * 1) 上层=格子图（grid）
   * 2) 图案叠加=模板纹理（template）做 Linear Light + 不透明度
   * 3) 以模板 alpha 作为剪贴蒙版输出
   *
   * @param {cv.Mat} gridImg 上层彩色图（BGR/BGRA）
   * @param {cv.Mat} templateImg 模板纹理图（BGR/BGRA）
   * @param {boolean} resizeGridToTemplate true: grid 对齐 template；false: template 对齐 grid
   * @param {number} overlayOpacity 图案叠加不透明度 0..1（PS Pattern Overlay opacity）
   * @returns {{merged: cv.Mat, effect: cv.Mat}}
   */
  psPatternOverlayComposite(gridImg, templateImg, resizeGridToTemplate = true, overlayOpacity = 0.55) {
    if (gridImg.empty() || templateImg.empty()) return { merged: new cv.Mat(), effect: new cv.Mat() };

    let grid = new cv.Mat();
    let templ = new cv.Mat();
    let gridSized = null;
    let templSized = null;
    let merged = null;
    let effect = null;

    try {
      if (gridImg.channels() === 4) grid = gridImg.clone();
      else cv.cvtColor(gridImg, grid, cv.COLOR_BGR2BGRA);

      if (templateImg.channels() === 4) templ = templateImg.clone();
      else cv.cvtColor(templateImg, templ, cv.COLOR_BGR2BGRA);

      const pixelArt = this.isPixelArtLike(grid);
      const maxPixels = Math.max(
        1000000,
        Number(this.params.linearLightCompositeMaxPixels || this.params.compositeMaxPixels || 36000000)
      );

      if (grid.rows * grid.cols > maxPixels) {
        const scale = Math.sqrt(maxPixels / (grid.rows * grid.cols));
        const w = Math.max(1, Math.round(grid.cols * scale));
        const h = Math.max(1, Math.round(grid.rows * scale));
        const rs = new cv.Mat();
        cv.resize(grid, rs, new cv.Size(w, h), 0, 0, cv.INTER_AREA);
        grid.delete();
        grid = rs;
      }

      if (templ.rows * templ.cols > maxPixels) {
        const scale = Math.sqrt(maxPixels / (templ.rows * templ.cols));
        const w = Math.max(1, Math.round(templ.cols * scale));
        const h = Math.max(1, Math.round(templ.rows * scale));
        const rs = new cv.Mat();
        cv.resize(templ, rs, new cv.Size(w, h), 0, 0, cv.INTER_AREA);
        templ.delete();
        templ = rs;
      }

      if (resizeGridToTemplate) {
        const target = new cv.Size(templ.cols, templ.rows);
        if (grid.rows !== templ.rows || grid.cols !== templ.cols) {
          gridSized = new cv.Mat();
          const scaleDown = grid.cols > target.width || grid.rows > target.height;
          let interp;
          if (scaleDown) interp = cv.INTER_AREA;
          else if (pixelArt) interp = this.params.linearLightGridUpscaleSmooth !== false ? cv.INTER_CUBIC : cv.INTER_NEAREST;
          else interp = cv.INTER_LINEAR;
          cv.resize(grid, gridSized, target, 0, 0, interp);
        } else {
          gridSized = grid.clone();
        }
        templSized = templ.clone();
      } else {
        const target = new cv.Size(grid.cols, grid.rows);
        if (templ.rows !== grid.rows || templ.cols !== grid.cols) {
          templSized = new cv.Mat();
          const interp = (templ.cols > target.width || templ.rows > target.height) ? cv.INTER_AREA : cv.INTER_LINEAR;
          cv.resize(templ, templSized, target, 0, 0, interp);
        } else {
          templSized = templ.clone();
        }
        gridSized = grid.clone();
      }

      // PSD Pattern Overlay 语义：底图是原始图像，pattern 作为上层纹理参与 Linear Light。
      // 格子源图若来自低分辨率色块放大，先做轻量去块/柔化，再叠模板纹理；
      // 否则 linearLight 会把整齐方格边缘一起放大，阴影区域尤其明显。
      let base = gridSized.clone();
      base = this._deblockUpscaledPixelArtBeforeMerge(base, grid.cols, grid.rows);
      base = this._softenGridBlocksBeforeMerge(base);
      base = this._softenShadowBlocksBeforeMerge(base);

      effect = templSized.clone();
      merged = this.mergeImagesPure(
        base,
        effect,
        'linearLight',
        Math.max(0, Math.min(1, Number(overlayOpacity)))
      );
      base.delete();

      // 输出 alpha 以底图为准；透明区 RGB 清零，避免后续缩放时出现脏边。
      const eData = merged.data;
      const tData = gridSized.data;
      for (let i = 0, n = eData.length; i < n; i += 4) {
        const a = tData[i + 3];
        eData[i + 3] = a;
        if (a === 0) {
          eData[i] = 0;
          eData[i + 1] = 0;
          eData[i + 2] = 0;
        }
      }

      // effect 返回实际参与叠加的 pattern 纹理，供预览/调试
      return { merged, effect };
    } catch (e) {
      console.warn('[Brushify] psPatternOverlayComposite failed', e);
      if (effect) try { effect.delete(); } catch (_) {}
      if (merged) try { merged.delete(); } catch (_) {}
      return { merged: new cv.Mat(), effect: new cv.Mat() };
    } finally {
      if (gridSized) try { gridSized.delete(); } catch (_) {}
      if (templSized) try { templSized.delete(); } catch (_) {}
      if (!grid.empty()) try { grid.delete(); } catch (_) {}
      if (!templ.empty()) try { templ.delete(); } catch (_) {}
    }
  }

  /** 纯合图尾部：绕 127.5 轻拉对比，量小（默认 ~+6）避免发灰/发闷，不改 alpha */
  _applyMicroContrastBgra(bgra, pctRaw) {
    const pct = Math.max(0, Math.min(12, Number(pctRaw) || 0));
    if (pct < 0.5 || bgra.empty() || bgra.channels() !== 4) return bgra;
    const gain = 1 + pct / 100;
    const mid = 127.5;
    const d = bgra.data;
    for (let i = 0, n = d.length; i < n; i += 4) {
      for (let c = 0; c < 3; c++) {
        const v = (d[i + c] - mid) * gain + mid;
        d[i + c] = v <= 0 ? 0 : v >= 255 ? 255 : (v | 0);
      }
    }
    return bgra;
  }

  /**
   * 线性光专用后处理：合成整体略提亮 + 从模板亮度里取高频加回三色通道。
   * 比单纯拉亮度更少冲淡格子/纹理；高饱和处减弱「加亮」避免艳色发灰、细节假丢失。
   */
  _linearLightPostTune(mergedBgra, templateBgra) {
    const lift = Math.max(0, Math.min(24, Number(this.params.linearLightPostLift) || 0));
    let relief = Math.max(0, Math.min(0.42, Number(this.params.linearLightTextureRelief) || 0));
    const sigma = Math.max(0.6, Math.min(3.5, Number(this.params.linearLightReliefSigma) || 1.35));
    const vividScale = Math.max(0.15, Math.min(1, Number(this.params.linearLightVividLiftScale ?? 0.42)));
    if (lift < 0.25 && relief < 0.002) return mergedBgra;

    const rows = mergedBgra.rows;
    const cols = mergedBgra.cols;
    if (templateBgra.rows !== rows || templateBgra.cols !== cols) return mergedBgra;
    if (mergedBgra.channels() !== 4 || templateBgra.channels() !== 4) return mergedBgra;

    const gray = new cv.Mat();
    const blur = new cv.Mat();
    cv.cvtColor(templateBgra, gray, cv.COLOR_BGRA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(0, 0), sigma, sigma, cv.BORDER_DEFAULT);

    const g32 = new cv.Mat();
    const b32 = new cv.Mat();
    const hp = new cv.Mat();
    gray.convertTo(g32, cv.CV_32F);
    blur.convertTo(b32, cv.CV_32F);
    cv.subtract(g32, b32, hp);

    const data = mergedBgra.data;
    const tAlpha = templateBgra.data;
    const vividTh = 0.3;

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const idx = (y * cols + x) * 4;
        const aTpl = tAlpha[idx + 3] / 255;
        // 半透明边缘不参与「提亮+高频」：否则高斯会沿透明区渗漏，加重发白/发灰边（对比 PS 硬边）
        if (aTpl < 0.04) continue;
        const edgeProtect = Math.min(1, (aTpl - 0.04) / 0.38);

        const h = hp.floatPtr(y, x)[0];
        const bb = data[idx];
        const gg = data[idx + 1];
        const rr = data[idx + 2];
        const mx = Math.max(bb, gg, rr);
        const mn = Math.min(bb, gg, rr);
        const chroma = (mx - mn) / 255;

        let liftUse = lift * edgeProtect;
        if (chroma > vividTh) {
          const t = Math.min(1, (chroma - vividTh) / 0.48);
          liftUse *= (1 - t) + t * vividScale;
        }

        let rel = relief * edgeProtect;
        if (chroma > 0.52) rel *= 0.82;

        for (let c = 0; c < 3; c++) {
          let v = data[idx + c] + liftUse + rel * h;
          data[idx + c] = v <= 0 ? 0 : v >= 255 ? 255 : Math.round(v);
        }
      }
    }

    gray.delete();
    blur.delete();
    g32.delete();
    b32.delete();
    hp.delete();
    return mergedBgra;
  }

 updateTemplate(mat, brightness) {
    if (mat.empty()) return mat.clone();
    const ch = mat.channels();
    if (ch !== 3 && ch !== 4 && ch !== 1) return mat.clone();

    // Derive cnt from brightness thresholds
    let cnt = 0;
    if (brightness > 1.1) cnt = 10;
    if (brightness > 1.2) cnt = 20;
    if (brightness > 1.3) cnt = 30;
    if (brightness > 1.4) cnt = 35;
    if (brightness > 1.5) cnt = 40;
    if (brightness < 0.91) cnt = -10;
    if (brightness < 0.81) cnt = -15;
    if (brightness < 0.61) cnt = -20;
    if (brightness < 0.51) cnt = -30;

    const thd = [10, 20, 30, 40, 50, 60];
    const val = [60, 55, 55, 55, 55, 55];

    let out = mat.clone();
    if (ch === 1) {
        // Simple escalate for grayscale
        const data = out.data;
        for (let i = 0; i < data.length; i++) {
            let v = data[i];
            if (v < thd[thd.length - 1]) {
                for (let k = 0; k < thd.length; k++) {
                    if (v < thd[k]) {
                        v = Math.min(255, v + val[k] + cnt);
                        break;
                    }
                }
            }
            data[i] = v;
        }
        return out;
    }

    const step = ch;
    const data = out.data;
    for (let i = 0; i < data.length; i += step) {
        if (ch === 4 && data[i + 3] === 0) continue; // skip transparent
        // if any channel already > last threshold (60) skip
        if (data[i] > thd[thd.length - 1] ||
            data[i + 1] > thd[thd.length - 1] ||
            data[i + 2] > thd[thd.length - 1]) continue;

        let avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        for (let k = 0; k < thd.length; k++) {
            if (avg < thd[k]) {
                const add = val[k] + cnt;
                data[i] = Math.min(255, data[i] + add);
                data[i + 1] = Math.min(255, data[i + 1] + add);
                data[i + 2] = Math.min(255, data[i + 2] + add);
                break;
            }
        }
    }
    return out;
}

  brushifyComposite(gridImg, templateImg, brightness=1.0, resizeGridToTemplate=true, blendMode='current', textureOpacity=1.0){
   // resizeGridToTemplate: true => 统一把 grid 尺寸缩放到 template；false => 反向把 template 缩放到 grid
    const vividBgDiffThr = 18; // 与 C++ 默认保持一致
    const vividBgProtect = 1.0; // 保留占位（未使用）
    const start=Date.now();
    // pixel-art hint: decide once on original grid (before any resize introduces gradients)
    const gridIsPixelArt = this.isPixelArtLike(gridImg);
    this._pixelArtHint = gridIsPixelArt;
    this._dbgOnce('composite:gridHint', { grid: `${gridImg.cols}x${gridImg.rows}`, gridIsPixelArt });
        // pure 模式 / linearLight 模式对齐 PS：只做叠加，不引入额外亮度/鲜艳度偏移
    // linearLight 与 linearLightPure 统一走纯 PS 路径，不做 brightness 偏移
    const _isPurePath = (blendMode === 'linearLight' || blendMode === 'linearLightPure');
    if (!_isPurePath) {
      brightness = brightness - 0.1;
    }
    // 下采样 gridImg
    let gridInput = gridImg;
    const maxPixels = Math.max(1000000, Number(this.params.compositeMaxPixels || 3000000));
    const llCap = Number(this.params.linearLightCompositeMaxPixels);
    const maxPixelsForComposite =
      _isPurePath && Number.isFinite(llCap) && llCap >= 1_000_000
        ? Math.max(maxPixels, llCap)
        : maxPixels;
    if (gridImg.rows * gridImg.cols > maxPixelsForComposite) {
      const scale = Math.sqrt(maxPixelsForComposite / (gridImg.rows * gridImg.cols));
      const newH = Math.max(1, Math.round(gridImg.rows * scale));
      const newW = Math.max(1, Math.round(gridImg.cols * scale));
      let resized = new cv.Mat();
      // Pixel-art now targets painted/cartoon look, so downsample should preserve area averages.
      const interp = cv.INTER_AREA;
      this._dbgOnce('composite:preDownsample', { from: `${gridImg.cols}x${gridImg.rows}`, to: `${newW}x${newH}`, gridIsPixelArt, interp });
      cv.resize(gridImg, resized, new cv.Size(newW, newH), 0, 0, interp);
      gridInput = resized;
    }
    // 下采样 templateImg
    let templateInput = templateImg;
    if (templateImg.rows * templateImg.cols > maxPixelsForComposite) {
      const scale = Math.sqrt(maxPixelsForComposite / (templateImg.rows * templateImg.cols));
      const newH = Math.max(1, Math.round(templateImg.rows * scale));
      const newW = Math.max(1, Math.round(templateImg.cols * scale));
      let resized = new cv.Mat();
      cv.resize(templateImg, resized, new cv.Size(newW, newH), 0, 0, cv.INTER_AREA);
      templateInput = resized;
    }
    templateImg = templateInput
    gridImg = gridInput

    // 线性光「对齐 PS 叠加」路径：不要 deblock（会破坏格子边缘、产生虚化），与网页端硬边叠加观感一致
    // Deblock pixel-art before final resize: collapse back to cell-map (mode pooling)
    if(!_isPurePath && gridIsPixelArt && this.params.pixelArtDeblock && gridImg.cols >= 600 && gridImg.rows >= 600){
      const bx = this._estimateBlockSizeBGR(gridImg, 'x');
      const by = this._estimateBlockSizeBGR(gridImg, 'y');
      this._dbgOnce('composite:deblock:estimate', { bx, by, size: `${gridImg.cols}x${gridImg.rows}` });
      if(bx>1 && by>1){
        const pooled = this._modePoolDownsample(gridImg, bx, by);
        this._dbgOnce('composite:deblock:pooled', { from: `${gridImg.cols}x${gridImg.rows}`, to: `${pooled.cols}x${pooled.rows}` });
        if(gridImg !== gridInput) gridImg.delete();
        gridImg = pooled;
      }
    }
    let gridSized, templSized;
    if(resizeGridToTemplate){
      const target=new cv.Size(templateImg.cols, templateImg.rows);
      if(gridImg.rows!==templateImg.rows || gridImg.cols!==templateImg.cols){
        const pixelArt = gridIsPixelArt;
        const scaleDown = (gridImg.cols>target.width || gridImg.rows>target.height);
        this._dbgOnce('composite:resizeGridToTemplate', {
          grid: `${gridImg.cols}x${gridImg.rows}`,
          template: `${templateImg.cols}x${templateImg.rows}`,
          target: `${target.width}x${target.height}`,
          pixelArt, scaleDown,
          note: pixelArt ? 'pixelArt->AREA/CUBIC (then mean-shift + brush)' : 'photo->AREA/LINEAR'
        });
        gridSized=new cv.Mat();
        // 像素风缩小：AREA。放大：非 pure 用 CUBIC；pure 且 linearLightGridUpscaleSmooth 用 LINEAR（减轻一格一格），否则最近邻
        const pureSmoothUp = _isPurePath && this.params.linearLightGridUpscaleSmooth !== false;
        const interp = pixelArt
          ? (scaleDown ? cv.INTER_AREA : (pureSmoothUp ? cv.INTER_LINEAR : (_isPurePath ? cv.INTER_NEAREST : cv.INTER_CUBIC)))
          : (scaleDown ? cv.INTER_AREA : cv.INTER_LINEAR);
        this._dbgOnce('composite:resize', { interp });
        cv.resize(gridImg,gridSized,target,0,0,interp);
      } else gridSized=gridImg.clone();
      templSized=templateImg.clone();
    } else {
      const target=new cv.Size(gridImg.cols, gridImg.rows);
      if(templateImg.rows!==gridImg.rows || templateImg.cols!==gridImg.cols){
        templSized=new cv.Mat();
        const interp=(templateImg.cols>target.width||templateImg.rows>target.height)?cv.INTER_AREA:cv.INTER_LINEAR;

        cv.resize(templateImg,templSized,target,0,0,interp);
      } else {
        templSized=templateImg.clone();
      }
      gridSized=gridImg.clone();
    }
        // linearLight 纯 PS 路径：格子图直接作为上层图像，不经过 brushify() 笔触化，
    // 避免 mean-shift/平滑/锐化处理导致颜色偏移；template 也跳过 updateTemplate 色阶增亮。
    let effect, t, merged;
    if (_isPurePath) {
      // 上层 = 格子图：虚化边 → 喷色描边 → linearLight（是否执行前两步由 params 控制，合图 UI 可在提亮/底纹全关时关掉）
      effect = gridSized.clone();
      effect = this._softenGridBlocksBeforeMerge(effect);
      effect = this._softenShadowBlocksBeforeMerge(effect);
      effect = this._applySprayedStrokesToEffect(effect);
      t = templSized.clone();
      const m = this.params.mergePureBlendMode;
      const pureBlend = m === 'linearLight' || m === 'alphaNormal' ? m : 'hybrid';
      merged = this.mergeImagesPure(t, effect, pureBlend, textureOpacity);
      merged = this._linearLightPostTune(merged, t);
      merged = this._applyMicroContrastBgra(merged, this.params.mergePureMicroContrast);
    } else {
      effect = this.brushify(gridSized); // 非纯路径保留笔触化
      t = this.updateTemplate(templSized, brightness);
      merged = this.mergeImagesAdvanced(t, effect, brightness, 18, 1.0, blendMode, textureOpacity);
    }
    if(gridSized!==gridImg) gridSized.delete();
    if(templSized!==templateImg) templSized.delete();
    // 注意: 不在这里删除 effect，交由调用者释放，与 C++ 返回 pair 行为对应
    return { merged, effect }; // 返回两个 Mat
  }
}

window.BrushifyJS = BrushifyJS;
console.log('[Brushify] class ready');
}

})();
