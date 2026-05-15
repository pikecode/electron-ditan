// Color conversion and distance utilities extracted from DiamondCanvas.vue
// Keep pure functions; no Vue dependency

export function hexToRgb(hex) {
  if (!hex) return null
  let h = hex.replace('#','')
  if (h.length === 3) h = h.split('').map(ch => ch + ch).join('')
  if (h.length === 8) h = h.slice(0,6) // ignore alpha
  if (!/^([0-9a-fA-F]{6})$/.test(h)) return null
  const num = parseInt(h, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function srgbToLinear(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
function rgbToXyz({r,g,b}) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const x = R*0.4124564 + G*0.3575761 + B*0.1804375
  const y = R*0.2126729 + G*0.7151522 + B*0.0721750
  const z = R*0.0193339 + G*0.1191920 + B*0.9503041
  return { x: x*100, y: y*100, z: z*100 }
}
function xyzToLab({x,y,z}) {
  const Xn=95.047, Yn=100.0, Zn=108.883
  let fx = x/Xn, fy = y/Yn, fz = z/Zn
  const f = (t) => t > 216/24389 ? Math.cbrt(t) : (841/108)*t + 4/29
  fx = f(fx); fy = f(fy); fz = f(fz)
  return { L: 116*fy - 16, a: 500*(fx - fy), b: 200*(fy - fz) }
}
export function rgbHexToLab(hex) {
  const rgb = hexToRgb(hex)
  if (!rgb) return null
  const xyz = rgbToXyz(rgb)
  return xyzToLab(xyz)
}
export function deltaE76(l1, l2) {
  const dL = l1.L - l2.L, da = l1.a - l2.a, db = l1.b - l2.b
  return Math.sqrt(dL*dL + da*da + db*db)
}
export function deltaE94(lab1, lab2, kL=1, K1=0.045, K2=0.015) {
  const {L:L1,a:a1,b:b1}=lab1,{L:L2,a:a2,b:b2}=lab2
  const dL = L1 - L2
  const C1 = Math.hypot(a1,b1)
  const C2 = Math.hypot(a2,b2)
  const dC = C1 - C2
  const da = a1 - a2
  const db = b1 - b2
  const dH2 = Math.max(0, da*da + db*db - dC*dC)
  const SL = 1
  const SC = 1 + K1*C1
  const SH = 1 + K2*C1
  return Math.sqrt(Math.pow(dL/(kL*SL),2) + Math.pow(dC/SC,2) + dH2/(SH*SH))
}
export function deltaE2000(lab1, lab2) {
  const {L:L1,a:a1,b:b1}=lab1,{L:L2,a:a2,b:b2}=lab2
  const avgLp=(L1+L2)/2
  const C1=Math.hypot(a1,b1), C2=Math.hypot(a2,b2)
  const avgC=(C1+C2)/2
  const G=0.5*(1-Math.sqrt(Math.pow(avgC,7)/(Math.pow(avgC,7)+Math.pow(25,7))))
  const a1p=(1+G)*a1, a2p=(1+G)*a2
  const C1p=Math.hypot(a1p,b1), C2p=Math.hypot(a2p,b2)
  const avgCp=(C1p+C2p)/2
  const h1p=Math.atan2(b1,a1p)+(Math.atan2(b1,a1p)<0?2*Math.PI:0)
  const h2p=Math.atan2(b2,a2p)+((Math.atan2(b2,a2p)<0)?2*Math.PI:0)
  let dhp=h2p-h1p
  if (Math.abs(dhp)>Math.PI) dhp+= (dhp>0?-2*Math.PI:2*Math.PI)
  const dHp=2*Math.sqrt(C1p*C2p)*Math.sin(dhp/2)
  const dLp=L2-L1
  const dCp=C2p-C1p
  const avgHp = (Math.abs(h1p-h2p)>Math.PI) ? (h1p+h2p+2*Math.PI)/2 : (h1p+h2p)/2
  const T=1-0.17*Math.cos(avgHp-Math.PI/6)+0.24*Math.cos(2*avgHp)+0.32*Math.cos(3*avgHp+Math.PI/30)-0.20*Math.cos(4*avgHp-63*Math.PI/180)
  const SL=1+ (0.015*Math.pow(avgLp-50,2))/Math.sqrt(20+Math.pow(avgLp-50,2))
  const SC=1+0.045*avgCp
  const SH=1+0.015*avgCp*T
  const Rt=-2*Math.sqrt(Math.pow(avgCp,7)/(Math.pow(avgCp,7)+Math.pow(25,7))) * Math.sin(60*Math.PI/180*Math.exp(-Math.pow((avgHp*180/Math.PI-275)/25,2)))
  return Math.sqrt(Math.pow(dLp/SL,2)+Math.pow(dCp/SC,2)+Math.pow(dHp/SH,2)+Rt*(dCp/SC)*(dHp/SH))
}
export function deltaCMC(lab1, lab2, l=2, c=1) {
  const {L:L1,a:a1,b:b1}=lab1,{L:L2,a:a2,b:b2}=lab2
  const dL=L1-L2
  const C1=Math.hypot(a1,b1)
  const C2=Math.hypot(a2,b2)
  const dC=C1-C2
  const dA=a1-a2, dB=b1-b2
  const dH2=dA*dA + dB*dB - dC*dC
  const H1=Math.atan2(b1,a1)
  const h1=H1<0?H1+2*Math.PI:H1
  const F=Math.sqrt(Math.pow(C1,4)/(Math.pow(C1,4)+1900))
  const T=(h1>=0 && h1<Math.PI/6)||(h1>=5*Math.PI/3 && h1<2*Math.PI)?0.56+Math.abs(0.2*Math.cos(h1+2*Math.PI/9)):0.36+Math.abs(0.4*Math.cos(h1+2*Math.PI/9))
  const SL=(L1<16)?0.511:(0.040975*L1)/(1+0.01765*L1)
  const SC=(0.0638*C1)/(1+0.0131*C1)+0.638
  const SH=SC*(F*T+1-F)
  return Math.sqrt(Math.pow(dL/(l*SL),2)+Math.pow(dC/(c*SC),2)+dH2/(SH*SH))
}
export function distanceRGB2(a, b) { if (!a || !b) return Number.POSITIVE_INFINITY; const dr=a.r-b.r,dg=a.g-b.g,db=a.b-b.b; return dr*dr+dg*dg+db*db }

export function findNearestPaletteAll(hex, palette) {
  const targetRGB = hexToRgb(hex)
  const targetLab = rgbHexToLab(hex)
  if (!targetRGB || !targetLab) return []
  const labs = new Map()
  const ensureLab = (h) => {
    const key = (h || '').toLowerCase()
    if (!labs.has(key)) labs.set(key, rgbHexToLab(h))
    return labs.get(key)
  }
  const pick = (methodName, cmpFn) => {
    let best = null, bestScore = Infinity
    for (const p of palette) {
      if (!p || !p.hex) continue
      const score = cmpFn(p)
      if (score < bestScore) { bestScore = score; best = p }
    }
    return best ? { method: methodName, entry: best } : null
  }
  const results = []
  results.push(pick('RGB', (p) => distanceRGB2(targetRGB, hexToRgb(p.hex))))
  results.push(pick('CIE76', (p) => deltaE76(targetLab, ensureLab(p.hex))))
  results.push(pick('CIE94', (p) => deltaE94(targetLab, ensureLab(p.hex))))
  results.push(pick('CMC(2:1)', (p) => deltaCMC(targetLab, ensureLab(p.hex), 2, 1)))
  results.push(pick('CIEDE2000', (p) => deltaE2000(targetLab, ensureLab(p.hex))))
  const seen = new Set()
  const uniq = []
  for (const r of results) {
    if (!r || !r.entry) continue
    const key = (r.entry.hex || '').toLowerCase()
    if (!key) continue
    if (!seen.has(key)) { seen.add(key); uniq.push(r) }
  }
  return uniq
}
