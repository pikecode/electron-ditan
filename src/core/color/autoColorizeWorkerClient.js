let WorkerCtor = null

/**
 * @param {object} payload
 * @param {number} payload.imageWidth
 * @param {number} payload.imageHeight
 * @param {ArrayBuffer} payload.imageBuffer — transferable; will be neutered
 * @param {number} payload.rows
 * @param {number} payload.cols
 * @param {object} payload.paletteConfig
 * @param {string} payload.strategyName
 * @param {object} payload.strategyParams
 * @param {number} [payload.minSamples]
 * @param {(p:number)=>void} [onProgress] 0..1
 */
export async function runAutoColorizeInWorker(payload, onProgress) {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Worker not available')
  }
  if (!WorkerCtor) {
    WorkerCtor = (await import('../../workers/autoColorize.worker.js?worker')).default
  }
  const worker = new WorkerCtor()
  const buffer = payload.imageBuffer
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const d = e.data
      if (d.type === 'progress') onProgress?.(d.p)
      else if (d.type === 'done') {
        worker.terminate()
        resolve({ colors: d.colors, colorIds: d.colorIds })
      } else if (d.type === 'error') {
        worker.terminate()
        reject(new Error(d.message || 'autoColorize worker error'))
      }
    }
    worker.onerror = (err) => {
      worker.terminate()
      reject(err)
    }
    worker.postMessage(
      {
        type: 'run',
        imageWidth: payload.imageWidth,
        imageHeight: payload.imageHeight,
        buffer,
        rows: payload.rows,
        cols: payload.cols,
        paletteConfig: payload.paletteConfig,
        strategyName: payload.strategyName,
        strategyParams: payload.strategyParams,
        minSamples: payload.minSamples
      },
      [buffer]
    )
  })
}
