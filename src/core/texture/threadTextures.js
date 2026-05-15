// Stage 1 embroidery texture integration (simple canvas version)
// Provides: loadEmbroideryTextures() returning { fabricPattern(ctx), getThreadTile(color, w, h) }
// If images not found, it silently falls back.

const FABRIC_SRC = 'textures/fabric_base.png';
const THREAD_SRC = 'textures/thread_tile.png';

function loadImage(src){
  return new Promise((resolve,reject)=>{
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('fail load '+src));
    img.src = src;
  });
}

export async function loadEmbroideryTextures(){
  let fabricImg=null, threadImg=null;
  try { fabricImg = await loadImage(FABRIC_SRC) } catch(e){ console.warn('[embroidery] fabric load fail', e) }
  try { threadImg = await loadImage(THREAD_SRC) } catch(e){ console.warn('[embroidery] thread load fail', e) }
  const cache = new Map();
  function getThreadTile(color, w, h){
    if(!threadImg) return null;
    const key = color + ':' + w + 'x' + h;
    if(cache.has(key)) return cache.get(key);
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const ictx = off.getContext('2d');
    // draw base thread texture stretched
    ictx.drawImage(threadImg, 0, 0, w, h);
    // tint
    ictx.globalCompositeOperation = 'source-atop';
    ictx.fillStyle = color;
    ictx.fillRect(0,0,w,h);
    // slight brightness random (stable per key hash):
    const hash = [...key].reduce((a,c)=>a+c.charCodeAt(0),0);
    const r = ((hash * 9301 + 49297) % 233280)/233280; // pseudo random 0-1
    const delta = (r - 0.5) * 0.08; // -4% ~ +4%
    if(delta !== 0){
      const imgData = ictx.getImageData(0,0,w,h);
      const d = imgData.data;
      for(let i=0;i<d.length;i+=4){
        d[i] = clamp(d[i] * (1+delta));
        d[i+1] = clamp(d[i+1] * (1+delta));
        d[i+2] = clamp(d[i+2] * (1+delta));
      }
      ictx.putImageData(imgData,0,0);
    }
    cache.set(key, off);
    return off;
  }
  function clamp(v){ return v<0?0:v>255?255:v }
  function fabricPattern(ctx){
    if(!fabricImg) return null;
    try { return ctx.createPattern(fabricImg,'repeat') } catch(e){ return null }
  }
  return { fabricPattern, getThreadTile };
}
