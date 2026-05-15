export const COVER_IMAGE_ACCEPT = 'image/png,image/jpeg,.psd,image/vnd.adobe.photoshop'
const COVER_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg']

export function guessCoverImageMime(name = ''){
  const lower = String(name).toLowerCase()
  if(lower.endsWith('.png')) return 'image/png'
  if(lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if(lower.endsWith('.psd')) return 'image/vnd.adobe.photoshop'
  return ''
}

export function isPsdCoverFile(file){
  const mime = file?.type || guessCoverImageMime(file?.name)
  return mime === 'image/vnd.adobe.photoshop'
}

export function fileToDataUrl(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function dataUrlToBlob(dataUrl){
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  if(!match) throw new Error('invalid-data-url')
  const mime = match[1]
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for(let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

async function convertPsdToPngFile(file){
  const mod = await import('ag-psd')
  const readPsd = mod.readPsd || mod.default?.readPsd
  if(typeof readPsd !== 'function') throw new Error('psd-read-unavailable')
  const buf = await file.arrayBuffer()
  const psd = readPsd(new Uint8Array(buf))
  const canvas = document.createElement('canvas')
  canvas.width = psd.width
  canvas.height = psd.height
  const ctx = canvas.getContext('2d')
  if(psd.canvas) ctx.drawImage(psd.canvas, 0, 0)
  else if(Array.isArray(psd.children)) {
    psd.children
      .filter(layer => !layer.hidden && layer.canvas)
      .forEach(layer => ctx.drawImage(layer.canvas, layer.left || 0, layer.top || 0))
  }
  const preview = canvas.toDataURL('image/png')
  const blob = dataUrlToBlob(preview)
  return {
    file: new File([blob], file.name.replace(/\.psd$/i, '.png'), { type: 'image/png' }),
    preview
  }
}

async function readJpegOrientation(file){
  const slice = file.slice(0, 65536)
  const buf = await slice.arrayBuffer()
  const view = new DataView(buf)
  if(view.getUint16(0) !== 0xFFD8) return 1
  let offset = 2
  while(offset < view.byteLength){
    const marker = view.getUint16(offset)
    offset += 2
    if(marker === 0xFFE1){
      const length = view.getUint16(offset)
      offset += 2
      if(view.getUint32(offset) === 0x45786966){
        const tiffOffset = offset + 6
        const endian = view.getUint16(tiffOffset)
        const little = endian === 0x4949
        if(endian !== 0x4949 && endian !== 0x4D4D) return 1
        const get16 = position => little ? view.getUint16(position, true) : view.getUint16(position, false)
        const get32 = position => little ? view.getUint32(position, true) : view.getUint32(position, false)
        let ifdOffset = tiffOffset + get32(tiffOffset + 4)
        const entries = get16(ifdOffset)
        ifdOffset += 2
        for(let i = 0; i < entries; i++){
          const entryOffset = ifdOffset + i * 12
          if(get16(entryOffset) === 0x0112){
            return get16(entryOffset + 8)
          }
        }
      }
      break
    }
    const length = view.getUint16(offset)
    offset += length
  }
  return 1
}

async function fixJpegOrientation(file, preview){
  const orientation = await readJpegOrientation(file)
  if(!orientation || orientation === 1){
    return { file, preview }
  }
  const img = await new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = preview
  })
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const width = img.naturalWidth
  const height = img.naturalHeight
  if(orientation === 6 || orientation === 8){
    canvas.width = height
    canvas.height = width
  } else {
    canvas.width = width
    canvas.height = height
  }
  ctx.save()
  switch(orientation){
    case 3:
      ctx.translate(width, height)
      ctx.rotate(Math.PI)
      break
    case 6:
      ctx.translate(height, 0)
      ctx.rotate(Math.PI / 2)
      break
    case 8:
      ctx.translate(0, width)
      ctx.rotate(-Math.PI / 2)
      break
    default:
      break
  }
  ctx.drawImage(img, 0, 0)
  ctx.restore()
  const fixedPreview = canvas.toDataURL('image/jpeg', 0.92)
  const fixedBlob = dataUrlToBlob(fixedPreview)
  return {
    file: new File([fixedBlob], file.name.replace(/\.jpe?g$/i, '_oriented.jpg'), { type: 'image/jpeg' }),
    preview: fixedPreview
  }
}

export async function normalizeCoverImageFile(file, messages = {}){
  const unsupportedMessage = messages.unsupportedMessage || '仅支持 PNG / JPEG / PSD'
  const processFailMessage = messages.processFailMessage || '文件处理失败'

  if(!file) throw new Error(processFailMessage)
  try {
    if(isPsdCoverFile(file)){
      return await convertPsdToPngFile(file)
    }

    const mime = file.type || guessCoverImageMime(file.name)
    if(!COVER_IMAGE_MIME_TYPES.includes(mime)){
      throw new Error(unsupportedMessage)
    }

    const preview = await fileToDataUrl(file)
    if(mime !== 'image/jpeg'){
      return { file, preview }
    }

    return await fixJpegOrientation(file, preview)
  } catch(error){
    if(error?.message === unsupportedMessage){
      throw error
    }
    throw new Error(processFailMessage)
  }
}
