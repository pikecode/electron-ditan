import { runAutoColorizePipeline, serializeCellsColors } from '../core/color/autoColorizePipeline.js'

self.onmessage = (e) => {
  const msg = e.data
  if (msg.type !== 'run') return
  try {
    const {
      imageWidth,
      imageHeight,
      buffer,
      rows,
      cols,
      paletteConfig,
      strategyName,
      strategyParams,
      minSamples
    } = msg
    const data = new Uint8ClampedArray(buffer)
    const imageData = { width: imageWidth, height: imageHeight, data }
    const cells = Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({ color: '#FFFFFF', color_id: 'DEFAULT' }))
    )
    runAutoColorizePipeline({
      imageData,
      rows,
      cols,
      paletteConfig,
      strategyName,
      strategyParams,
      cells,
      minSamples,
      onProgress: (t) => {
        self.postMessage({ type: 'progress', p: t })
      }
    })
    const { colors, colorIds } = serializeCellsColors(cells, rows, cols)
    self.postMessage({ type: 'done', colors, colorIds })
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err && err.message ? err.message : String(err)
    })
  }
}
