// RLE 编码与解码工具
// 采用 每行: "valuexcount;valuexcount" 形式, value 为 palette 索引 (十进制)

export function encodeRowRLE(indices) {
  if (!indices || !indices.length) return ''
  let out = []
  let last = indices[0]
  let run = 1
  for (let i = 1; i < indices.length; i++) {
    const v = indices[i]
    if (v === last) run++
    else { out.push(`${last}x${run}`); last = v; run = 1 }
  }
  out.push(`${last}x${run}`)
  return out.join(';')
}

export function decodeRowRLE(str) {
  if (!str) return []
  const parts = str.split(';')
  const res = []
  for (const p of parts) {
    if (!p) continue
    const [valStr, countStr] = p.split('x')
    const v = parseInt(valStr, 10)
    const count = parseInt(countStr, 10)
    if (Number.isNaN(v) || Number.isNaN(count)) continue
    for (let i = 0; i < count; i++) res.push(v)
  }
  return res
}

export function encodeGridIndices(gridIndices) {
  // gridIndices: number[][]
  return gridIndices.map(encodeRowRLE)
}

export function decodeGridIndices(rleRows) {
  return (rleRows || []).map(decodeRowRLE)
}
