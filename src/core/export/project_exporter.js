import { buildProjectMeta, buildManifest } from './meta_builder'
import { generateGridImageBoth } from './image_exporter'

export async function prepareProjectPackage(diamondCanvas, options = {}) {
  const { projectName, paletteType, scale = 1, drawGrid = false, background = 'transparent', quality = 0.92 } = options
  const meta = buildProjectMeta(diamondCanvas, { projectName, paletteType })
  const images = {}
  try {
    const pair = generateGridImageBoth(diamondCanvas, { scale, drawGrid, background, quality })
    images.gridPurePng = pair.png
    images.gridPureJpg = pair.jpg
  } catch (e) { console.warn('generateGridImageBoth failed:', e) }
  const filesPresence = { gridPurePng: !!images.gridPurePng, gridPureJpg: !!images.gridPureJpg }
  const manifest = buildManifest(meta, filesPresence)
  return { manifest, meta, images, projectName: projectName || meta.project.name }
}

// 通过 IPC 请求主进程打包
export async function requestZipWrite(payload) {
  if (!window || !window.electron || !window.electron.ipcRenderer) {
    // 兼容 contextIsolation = false 情况
    const { ipcRenderer } = require('electron')
    return ipcRenderer.invoke('project:export', payload)
  }
  return window.electron.ipcRenderer.invoke('project:export', payload)
}
