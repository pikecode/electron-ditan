// Color space conversion utilities (RGB <-> Lab) and distance metrics
// Lightweight implementation without external deps.

function pivotXYZ(n){ return n > 0.008856 ? Math.cbrt(n) : (7.787 * n) + 16/116 }

export function rgbToXyz({r,g,b}) {
  // normalize
  r/=255; g/=255; b/=255;
  // sRGB companding
  r = r > 0.04045 ? Math.pow((r+0.055)/1.055,2.4) : r/12.92;
  g = g > 0.04045 ? Math.pow((g+0.055)/1.055,2.4) : g/12.92;
  b = b > 0.04045 ? Math.pow((b+0.055)/1.055,2.4) : b/12.92;
  // matrix
  const x = r*0.4124 + g*0.3576 + b*0.1805;
  const y = r*0.2126 + g*0.7152 + b*0.0722;
  const z = r*0.0193 + g*0.1192 + b*0.9505;
  return {x:x*100,y:y*100,z:z*100};
}
export function xyzToLab({x,y,z}) {
  // D65 reference white
  const Xn=95.047, Yn=100.000, Zn=108.883;
  let xr = x / Xn;
  let yr = y / Yn;
  let zr = z / Zn;
  const fx = pivotXYZ(xr);
  const fy = pivotXYZ(yr);
  const fz = pivotXYZ(zr);
  const L = (116 * fy) - 16;
  const a = 500 * (fx - fy);
  const b = 200 * (fy - fz);
  return {L,a,b};
}
export function rgbToLab(rgb) { return xyzToLab(rgbToXyz(rgb)); }
export function deltaE(lab1, lab2) {
  const dL = lab1.L - lab2.L;
  const da = lab1.a - lab2.a;
  const db = lab1.b - lab2.b;
  return dL*dL + da*da + db*db;
}

// CIEDE2000 implementation (returns actual ΔE00, not squared)
export function deltaE00(lab1, lab2) {
  const {L:L1,a:a1,b:b1} = lab1, {L:L2,a:a2,b:b2} = lab2
  const avgLp = (L1 + L2) * 0.5
  const C1 = Math.sqrt(a1*a1 + b1*b1)
  const C2 = Math.sqrt(a2*a2 + b2*b2)
  const avgC = (C1 + C2) * 0.5
  const G = 0.5 * (1 - Math.sqrt(Math.pow(avgC,7)/(Math.pow(avgC,7)+Math.pow(25,7))))
  const a1p = a1 * (1+G)
  const a2p = a2 * (1+G)
  const C1p = Math.sqrt(a1p*a1p + b1*b1)
  const C2p = Math.sqrt(a2p*a2p + b2*b2)
  const avgCp = (C1p + C2p) * 0.5
  const h1p = hp(a1p,b1)
  const h2p = hp(a2p,b2)
  let dLp = L2 - L1
  let dCp = C2p - C1p
  let dhp = 0
  if (C1p*C2p === 0) dhp = 0
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p
  else dhp = h2p <= h1p ? h2p - h1p + 360 : h2p - h1p - 360
  const dHp = 2 * Math.sqrt(C1p*C2p) * Math.sin(deg2rad(dhp/2))
  let avgHp = 0
  if (C1p*C2p === 0) avgHp = h1p + h2p
  else if (Math.abs(h1p - h2p) <= 180) avgHp = (h1p + h2p)/2
  else avgHp = (h1p + h2p + 360)/2
  const T = 1 - 0.17*Math.cos(deg2rad(avgHp-30)) + 0.24*Math.cos(deg2rad(2*avgHp)) + 0.32*Math.cos(deg2rad(3*avgHp+6)) - 0.20*Math.cos(deg2rad(4*avgHp-63))
  const dRo = 30 * Math.exp(-((avgHp-275)/25)*((avgHp-275)/25))
  const Rc = 2 * Math.sqrt(Math.pow(avgCp,7)/(Math.pow(avgCp,7)+Math.pow(25,7)))
  const Sl = 1 + ((0.015*(avgLp-50)*(avgLp-50))/Math.sqrt(20+(avgLp-50)*(avgLp-50)))
  const Sc = 1 + 0.045*avgCp
  const Sh = 1 + 0.015*avgCp*T
  const Rt = -Math.sin(deg2rad(2*dRo)) * Rc
  const dE = Math.sqrt(
    (dLp/Sl)*(dLp/Sl) + (dCp/Sc)*(dCp/Sc) + (dHp/Sh)*(dHp/Sh) + Rt*(dCp/Sc)*(dHp/Sh)
  )
  return dE
}
function hp(a,b){ if (a===0 && b===0) return 0; const h = rad2deg(Math.atan2(b,a)); return h>=0? h: h+360 }
function deg2rad(d){ return d * (Math.PI/180) }
function rad2deg(r){ return r * (180/Math.PI) }
export function hexToRgb(hex) {
  if (!hex) return {r:0,g:0,b:0};
  let h = hex.replace('#','');
  if (h.length === 3) h = h.split('').map(c=>c+c).join('');
  if (h.length >= 6) {
    const r = parseInt(h.slice(0,2),16);
    const g = parseInt(h.slice(2,4),16);
    const b = parseInt(h.slice(4,6),16);
    return {r,g,b};
  }
  return {r:0,g:0,b:0};
}
export function rgbToHex(r,g,b){ const to=(n)=> n.toString(16).padStart(2,'0'); return '#'+to(r)+to(g)+to(b); }
