// Canvas 对象池 - 减少频繁创建/销毁 Canvas 的 GC 压力
// 添加内存上限和 LRU 淘汰机制

export class CanvasPool {
  constructor(poolSize = 4, maxPixels = 4096 * 4096) {
    this.pool = []
    this.maxSize = poolSize
    this.maxPixels = maxPixels // 最大像素限制 (约 64MB @ 4通道)
    this._inUse = new Set()
    this._lastUsed = new Map() // LRU 时间戳
    this._totalPixels = 0
  }

  acquire(width, height) {
    // 检查单个 canvas 是否超过限制
    const requestedPixels = width * height
    if (requestedPixels > this.maxPixels) {
      console.warn(`[CanvasPool] Requested canvas ${width}x${height} exceeds maxPixels limit`)
    }

    // 查找尺寸匹配且未使用的 canvas
    for (const item of this.pool) {
      if (!this._inUse.has(item) && item.width >= width && item.height >= height) {
        this._inUse.add(item)
        this._lastUsed.set(item, Date.now())
        item.width = width
        item.height = height
        return item
      }
    }

    // 如果池已满，淘汰最久未使用的
    if (this.pool.length >= this.maxSize) {
      const evicted = this._evictLRU()
      if (evicted) {
        this._inUse.add(evicted)
        this._lastUsed.set(evicted, Date.now())
        evicted.width = width
        evicted.height = height
        return evicted
      }
    }

    // 创建新的
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    if (this.pool.length < this.maxSize) {
      this.pool.push(canvas)
      this._totalPixels += requestedPixels
    }

    this._inUse.add(canvas)
    this._lastUsed.set(canvas, Date.now())
    return canvas
  }

  _evictLRU() {
    let oldest = null
    let oldestTime = Infinity

    for (const item of this.pool) {
      if (!this._inUse.has(item)) {
        const lastUsed = this._lastUsed.get(item) || 0
        if (lastUsed < oldestTime) {
          oldestTime = lastUsed
          oldest = item
        }
      }
    }

    return oldest
  }

  release(canvas) {
    if (!this._inUse.has(canvas)) return

    this._inUse.delete(canvas)
    this._lastUsed.set(canvas, Date.now())

    // 清理上下文避免内存泄漏
    try {
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    } catch (e) {
      // 忽略已销毁的 canvas
    }
  }

  releaseAll() {
    for (const canvas of this._inUse) {
      this.release(canvas)
    }
  }

  getStats() {
    return {
      poolSize: this.pool.length,
      inUse: this._inUse.size,
      available: this.pool.length - this._inUse.size,
      totalPixels: this._totalPixels
    }
  }

  destroy() {
    this.releaseAll()
    this.pool = []
    this._inUse.clear()
    this._lastUsed.clear()
    this._totalPixels = 0
  }
}

// 单例实例
let globalPool = null
export function getCanvasPool() {
  if (!globalPool) globalPool = new CanvasPool(6, 4096 * 4096)
  return globalPool
}

// 重置池（用于测试或内存紧张时）
export function resetCanvasPool() {
  if (globalPool) {
    globalPool.destroy()
    globalPool = null
  }
}
