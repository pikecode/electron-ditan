// 优化的像素处理工具函数

/**
 * 快速计算图像平均透明度 - 优化指针版本
 * @param {Uint8ClampedArray} alphaRef - Alpha 通道数组 (0-255)
 * @param {number} w - 图像宽度
 * @param {number} h - 图像高度
 * @param {number} x - 起始 x
 * @param {number} y - 起始 y
 * @param {number} cellW - 单元格宽度
 * @param {number} cellH - 单元格高度
 * @returns {number} 平均透明度 (0-255)
 */
export function fastAverageAlpha(alphaRef, w, h, x, y, cellW, cellH) {
  let aSum = 0
  let count = 0
  const maxY = Math.min(y + cellH, h)
  const maxX = Math.min(x + cellW, w)

  for (let yy = y; yy < maxY; yy++) {
    const rowStart = yy * w
    for (let xx = x; xx < maxX; xx++) {
      aSum += alphaRef[rowStart + xx]
      count++
    }
  }
  return count > 0 ? aSum / count : 0
}

/**
 * 优化的 Sobel 边缘检测 - 使用滑动窗口增量计算
 * @param {ImageData} imgData
 * @param {number} w
 * @param {number} h
 * @returns {Float32Array} 角度数组 (0-2π)
 */
export function fastSobelAngles(imgData, w, h) {
  const d = imgData.data
  const angles = new Float32Array(w * h)
  const gray = new Float32Array(w * h)

  // 预计算灰度值
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114
  }

  // Sobel 卷积核
  const gxK = [-1, 0, 1, -2, 0, 2, -1, 0, 1]
  const gyK = [-1, -2, -1, 0, 0, 0, 1, 2, 1]

  for (let y = 1; y < h - 1; y++) {
    const rowBase = y * w
    for (let x = 1; x < w - 1; x++) {
      let gx = 0
      let gy = 0
      let ki = 0

      // 手动展开 3x3 循环，避免循环开销
      const p00 = rowBase - w + x - 1
      const p01 = rowBase - w + x
      const p02 = rowBase - w + x + 1
      const p10 = rowBase + x - 1
      const p11 = rowBase + x
      const p12 = rowBase + x + 1
      const p20 = rowBase + w + x - 1
      const p21 = rowBase + w + x
      const p22 = rowBase + w + x + 1

      gx = gray[p00] * gxK[0] + gray[p01] * gxK[1] + gray[p02] * gxK[2] +
           gray[p10] * gxK[3] + gray[p11] * gxK[4] + gray[p12] * gxK[5] +
           gray[p20] * gxK[6] + gray[p21] * gxK[7] + gray[p22] * gxK[8]

      gy = gray[p00] * gyK[0] + gray[p01] * gyK[1] + gray[p02] * gyK[2] +
           gray[p10] * gyK[3] + gray[p11] * gyK[4] + gray[p12] * gyK[5] +
           gray[p20] * gyK[6] + gray[p21] * gyK[7] + gray[p22] * gyK[8]

      angles[p11] = Math.atan2(gy, gx) + Math.PI / 2
    }
  }

  return angles
}

/**
 * 颜色量化 - 使用预计算 LUT 加速
 * @param {Uint8ClampedArray} data - RGBA 数据
 * @param {Array} palette - 可选调色板 [[r,g,b],...]
 * @param {number} paletteSize - 默认调色板大小
 * @returns {Object} { colors: [[r,g,b],...], map: Uint16Array }
 */
export function fastQuantize(data, palette, paletteSize = 32) {
  if (palette && palette.length > 0) {
    const colors = palette
    const pixelCount = data.length / 4
    const map = new Uint16Array(pixelCount)

    // 预计算调色板颜色
    const paletteColors = colors.map(c => ({ r: c[0], g: c[1], b: c[2] }))

    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      let best = 0
      let bestDist = Infinity

      for (let pi = 0; pi < paletteColors.length; pi++) {
        const c = paletteColors[pi]
        const dr = r - c.r
        const dg = g - c.g
        const db = b - c.b
        const dist = dr * dr + dg * dg + db * db

        if (dist < bestDist) {
          bestDist = dist
          best = pi
          if (dist === 0) break // 精确匹配，提前退出
        }
      }
      map[p] = best
    }
    return { colors, map }
  }

  // 均匀量化
  const levels = Math.cbrt(paletteSize) | 0 || 4
  const step = 256 / levels
  const colors = []
  const colorIndex = new Map()
  const pixelCount = data.length / 4
  const map = new Uint16Array(pixelCount)

  // 预计算量化值 LUT
  const quantLUT = new Uint8Array(256)
  for (let i = 0; i < 256; i++) {
    quantLUT[i] = Math.min(255, Math.floor(i / step) * step + step / 2)
  }

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const r = quantLUT[data[i]]
    const g = quantLUT[data[i + 1]]
    const b = quantLUT[data[i + 2]]
    const key = (r << 16) | (g << 8) | b

    let ci = colorIndex.get(key)
    if (ci == null) {
      ci = colors.length
      colors.push([r, g, b])
      colorIndex.set(key, ci)
    }
    map[p] = ci
  }

  return { colors, map }
}

/**
 * 批量应用透明度遮罩 - 利用 TypedArray 批量操作
 * @param {ImageData} targetData
 * @param {ImageData} maskData
 * @param {number} alphaThreshold
 * @param {string} mode - 'alpha' | 'colorKey'
 * @param {Object} options
 */
export function batchApplyMask(targetData, maskData, alphaThreshold = 1, mode = 'alpha', options = {}) {
  const td = targetData.data
  const md = maskData.data
  const len = td.length

  if (mode === 'alpha') {
    // 批量处理：stride 4，alpha 在 index 3
    for (let i = 3; i < len; i += 4) {
      if (md[i] <= alphaThreshold) {
        td[i] = 0
      }
    }
  } else if (mode === 'colorKey' && options.color) {
    const { r: keyR, g: keyG, b: keyB } = options.color
    const tolerance = options.tolerance || 0

    for (let i = 0; i < len; i += 4) {
      const r = md[i]
      const g = md[i + 1]
      const b = md[i + 2]

      if (Math.abs(r - keyR) <= tolerance &&
          Math.abs(g - keyG) <= tolerance &&
          Math.abs(b - keyB) <= tolerance) {
        td[i + 3] = 0
      }
    }
  } else if (mode === 'mutual') {
    // 双向透明：任一 alpha 低于阈值，两者都置透明
    const minLen = Math.min(td.length, md.length)
    for (let i = 3; i < minLen; i += 4) {
      if (td[i] <= alphaThreshold || md[i] <= alphaThreshold) {
        td[i] = 0
        md[i] = 0
      }
    }
  }
}

/**
 * 分块处理大图像 - 避免阻塞主线程
 * @param {ImageData} imgData
 * @param {number} blockSize - 块大小 (默认 256x256)
 * @param {Function} processor - 处理函数 (blockImageData, x, y) => void
 * @param {Function} onProgress - (progress: 0-1) => void
 */
export function shadeColor(rgb, hiFactor, shFactor, dirDot) {
  // dirDot (-1..1) influences highlight vs shadow distribution
  const base = rgb
  const hi = base.map(v => Math.min(255, v * (1 + hiFactor * 0.8 + 0.2 * dirDot)))
  const sh = base.map(v => Math.max(0, v * (1 - shFactor * 0.8 - 0.2 * dirDot)))
  return { base, hi, sh }
}
