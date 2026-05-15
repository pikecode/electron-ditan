// Utility to build project XML representation
// Includes cells JSON, selected images (full png, x png), and original source image
// result: object returned by diamondCanvas.saveProjectV2
// projectData: original project meta (contains image info)
import { isMarkedBakedGridPreview } from './originalImageSemantics.js'

function wrapCData(value) {
  return String(value ?? '').replace(/]]>/g, ']]]]><![CDATA[>')
}

function escapeXmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function parseXml(xmlString) {
  if (!xmlString || typeof xmlString !== 'string') return null
  try {
    const dom = new DOMParser().parseFromString(xmlString, 'application/xml')
    if (dom.querySelector('parsererror')) return null
    return dom
  } catch {
    return null
  }
}

export function buildProjectXml({ result, projectData }) {
  if (!result) throw new Error('No result data provided')
  const images = result.images || {}
  const originalImage = projectData?.image || {}
  const size = originalImage.size || {}
  const projectName = result.projectName || projectData?.name || projectData?.project_name || ''
  const displayConfig = result.display || projectData?.result?.display || null
  const pixelWidth = Number(size.width || projectData?.image_width || result.cells?.image_width || 0) || ''
  const pixelHeight = Number(size.height || projectData?.image_height || result.cells?.image_height || 0) || ''

  function dataUrlToBase64(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return ''
    const i = dataUrl.indexOf(',')
    if (i === -1) return dataUrl
    return dataUrl.slice(i + 1)
  }
  function detectMime(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') return ''
    const m = dataUrl.match(/^data:([^;]+);base64,/)
    return m ? m[1] : ''
  }
  const fullPng = images.full?.png || ''
  const xPng = images.x?.png || ''
  const originalData = isMarkedBakedGridPreview(originalImage)
    ? ''
    : (
        originalImage.data ||
        projectData?.image_data ||
        originalImage.base64 ||
        originalImage.base64Data ||
        originalImage.base64_image ||
        ''
      )

  const xmlParts = []
  xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>')
  xmlParts.push('<Project format="EasyStitch" version="xml1">')
  if (projectName) {
    xmlParts.push(`  <ProjectName>${escapeXmlText(projectName)}</ProjectName>`)
  }
  // Meta (optional rows / cols if included in result.grid)
  const rows = result.grid?.rows ?? result.grid?.length ?? ''
  const cols = result.grid?.cols ?? result.grid?.width ?? ''
  xmlParts.push(`  <Meta rows="${rows}" cols="${cols}" imageWidth="${pixelWidth}" imageHeight="${pixelHeight}" savedAt="${result.savedAt || ''}" />`)
  // Cells as JSON inside CDATA (safer for large dataset)
  try {
    const cellsJson = JSON.stringify(result.cells || {})
    xmlParts.push('  <Cells encoding="json"><![CDATA[' + wrapCData(cellsJson) + ']]></Cells>')
  } catch (e) {
    xmlParts.push('  <Cells error="serialization_failed" />')
  }
  if (displayConfig) {
    try {
      const displayJson = JSON.stringify(displayConfig)
      xmlParts.push('  <Display encoding="json"><![CDATA[' + wrapCData(displayJson) + ']]></Display>')
    } catch (e) {
      xmlParts.push('  <Display error="serialization_failed" />')
    }
  }
  xmlParts.push('  <Images>')
  if (fullPng) {
    xmlParts.push(`    <FullPNG mime="${detectMime(fullPng)}" encoding="base64">${dataUrlToBase64(fullPng)}</FullPNG>`) }
  if (xPng) {
    xmlParts.push(`    <XPNG mime="${detectMime(xPng)}" encoding="base64">${dataUrlToBase64(xPng)}</XPNG>`) }
  if (originalData) {
    xmlParts.push(`    <Original mime="${detectMime(originalData)}" width="${size.width || ''}" height="${size.height || ''}" encoding="base64">${dataUrlToBase64(originalData)}</Original>`) }
  xmlParts.push('  </Images>')
  xmlParts.push('</Project>')
  return xmlParts.join('\n')
}

export function readProjectXmlProjectName(xmlString) {
  const dom = parseXml(xmlString)
  const node = dom?.querySelector('ProjectName')
  return node?.textContent?.trim?.() || ''
}

export function readProjectXmlImageSize(xmlString) {
  const dom = parseXml(xmlString)
  const metaNode = dom?.querySelector('Meta')
  const originalNode = dom?.querySelector('Images > Original')
  const width = Number(
    metaNode?.getAttribute?.('imageWidth') ||
    originalNode?.getAttribute?.('width') ||
    0
  ) || null
  const height = Number(
    metaNode?.getAttribute?.('imageHeight') ||
    originalNode?.getAttribute?.('height') ||
    0
  ) || null
  return { width, height }
}

export function readProjectXmlDisplay(xmlString) {
  const dom = parseXml(xmlString)
  const node = dom?.querySelector('Display')
  if (!node) return null
  const text = node.textContent || ''
  if (!text.trim()) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function downloadXml(xmlString, fileName = 'project.easystitch.xml') {
  const blob = new Blob([xmlString], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url) }, 0)
}
