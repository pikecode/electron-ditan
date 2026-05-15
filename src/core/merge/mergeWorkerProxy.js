// MergeWorkerProxy - 在主线程调用 Web Worker 处理图像
import { getCanvasPool } from '../../utils/canvasPool.js'

export class MergeWorkerProxy {
  constructor() {
    this.worker = new Worker(new URL('../workers/merge.worker.js', import.meta.url), { type: 'module' })
    this.pending = new Map()
    this.id = 0

    this.worker.onmessage = (e) => {
      const { type, id, result, progress, error, p } = e.data
      const pending = this.pending.get(id)
      if (!pending) return

      if (type === 'progress' && pending.onProgress) {
        // 兼容两种 progress 字段名
        pending.onProgress(progress ?? p ?? 0)
      } else if (type === 'success') {
        pending.resolve(result)
        this.pending.delete(id)
      } else if (type === 'error') {
        pending.reject(new Error(error))
        this.pending.delete(id)
      }
    }
  }

  _call(type, payload, onProgress = null) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, onProgress })
      this.worker.postMessage({ type, payload, id })
    })
  }

  /**
   * 应用模板遮罩
   * @param {ImageData} templateImageData
   * @param {ImageData} targetImageData
   * @param {Object} options
   * @param {Function} onProgress
   */
  async applyTemplateMask(templateImageData, targetImageData, options = {}, onProgress = null) {
    const result = await this._call('applyTemplateMask', {
      templateImageData,
      targetImageData,
      mode: options.mode || 'alpha',
      options: {
        alphaThreshold: options.alphaThreshold || 1,
        color: options.color,
        tolerance: options.tolerance || 0
      }
    }, onProgress)

    return result.imageData
  }

  /**
   * 双向透明
   */
  async applyMutualTransparency(templateImageData, targetImageData, alphaThreshold = 1, onProgress = null) {
    const result = await this._call('applyMutualTransparency', {
      templateImageData,
      targetImageData,
      alphaThreshold
    }, onProgress)

    return {
      template: result.template.imageData,
      target: result.target.imageData
    }
  }

  /**
   * 应用针迹效果
   */
  async applyStitchEffect(imageData, options = {}, onProgress = null) {
    const result = await this._call('applyStitchEffect', {
      imageData,
      options: {
        palette: options.palette,
        paletteSize: options.paletteSize || 32,
        cellSize: options.cellSize || 2,
        highlight: options.highlight || 0.15,
        shadow: options.shadow || 0.18,
        directionMode: options.directionMode || 'sobel',
        fixedAngleDeg: options.fixedAngleDeg || 45,
        alphaThreshold: options.alphaThreshold || 8
      }
    }, onProgress)

    return result.imageData
  }

  /**
   * 颜色量化
   */
  async quantize(imageData, palette, paletteSize = 32) {
    const result = await this._call('quantize', {
      imageData,
      palette,
      paletteSize
    })
    return result
  }

  destroy() {
    this.worker.terminate()
    this.pending.clear()
  }
}

// 单例
let workerProxy = null
export function getMergeWorker() {
  if (!workerProxy) workerProxy = new MergeWorkerProxy()
  return workerProxy
}
