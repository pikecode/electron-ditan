// XML 序列化 / 反序列化封面结构
// cover: { name, placements:[{id,side,type,x,y,width,height,rotation?,text?,fontSize?,color?,fontFamily?,align?}], frontImage(dataURL), backImage(dataURL) }

import { resolveTextFontFamily } from '@/core/textLayout.js'

const PLACEMENT_TYPES = ['effect','grid','table','text']

function resolveTextAlign(value){
  const align = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return ['left', 'center', 'right'].includes(align) ? align : 'left'
}

export function coverToXml(cover){
  if(!cover) throw new Error('cover 为空')
  const esc = s => (s==null? '' : String(s).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])))
  const escAttr = s => (s==null? '' : String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])))
  const safeCdata = s => String(s == null ? '' : s).replace(/\]\]>/g, ']]]]><![CDATA[>')
  const serializePlacement = (p) => {
    const rotation = Number.isFinite(+p.rotation) ? ((+p.rotation % 360) + 360) % 360 : 0
    const base = `id="${escAttr(p.id)}" type="${escAttr(p.type)}" x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" rotation="${rotation}"`
    if(p.type !== 'text'){
      return `      <placement ${base} />`
    }
    const fontSize = Number.isFinite(+p.fontSize) ? +p.fontSize : 32
    const color = typeof p.color === 'string' ? p.color : '#000000'
    const fontFamily = resolveTextFontFamily(p.fontFamily)
    const align = resolveTextAlign(p.align)
    return [
      `      <placement ${base} fontSize="${fontSize}" color="${escAttr(color)}" fontFamily="${escAttr(fontFamily)}" align="${escAttr(align)}">`,
      `        <text><![CDATA[${safeCdata(p.text ?? '')}]]></text>`,
      '      </placement>'
    ].join('\n')
  }
  const serializeSide = (sideName, dataUrl, placements=[]) => {
    if(!dataUrl && (!placements || !placements.length)) return ''
    const items = (placements||[]).filter(p=>p.side===sideName).map(serializePlacement).join('\n')
    return [
      `  <${sideName}>`,
      dataUrl? `    <image><![CDATA[${dataUrl}]]></image>`: '    <image/>',
      '    <placements>',
      items,
      '    </placements>',
      `  </${sideName}>`
    ].join('\n')
  }
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<cover version="2">',
    `  <name>${esc(cover.name||'')}</name>`,
    serializeSide('front', cover.frontImage, cover.placements),
    serializeSide('back', cover.backImage, cover.placements),
    '</cover>'
  ].join('\n')
}

export function xmlToCover(xml){
  if(!xml) throw new Error('xml 内容为空')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'application/xml')
  const err = doc.querySelector('parsererror')
  if(err) throw new Error('XML 解析失败')
  const name = doc.querySelector('cover > name')?.textContent || ''
  const frontImage = doc.querySelector('cover > front > image')?.textContent || ''
  const backImage = doc.querySelector('cover > back > image')?.textContent || ''
  const placements = []
  const pushPlacements = (side) => {
    doc.querySelectorAll(`cover > ${side} > placements > placement`).forEach(el => {
      const type = el.getAttribute('type')
      if(!PLACEMENT_TYPES.includes(type)) return
      const id = el.getAttribute('id') || `${type}_${side}_${placements.length}`
      const x = parseFloat(el.getAttribute('x')||'0')
      const y = parseFloat(el.getAttribute('y')||'0')
      const width = parseFloat(el.getAttribute('width')||'0')
      const height = parseFloat(el.getAttribute('height')||'0')
      const rotation = parseFloat(el.getAttribute('rotation') || '0')
      if(type === 'text'){
        const textNode = el.querySelector('text')
        const text = textNode?.textContent ?? el.getAttribute('text') ?? ''
        const fontSize = parseFloat(el.getAttribute('fontSize') || '32')
        const color = el.getAttribute('color') || '#000000'
        const fontFamily = resolveTextFontFamily(el.getAttribute('fontFamily'))
        const align = resolveTextAlign(el.getAttribute('align'))
        if(!textNode && !el.hasAttribute('text')){
          console.warn('[coverXml] legacy text placement missing text payload, fallback to empty text', { side, id })
        }
        placements.push({
          id,
          side,
          type,
          x,
          y,
          width,
          height,
          rotation: Number.isFinite(rotation) ? ((rotation % 360) + 360) % 360 : 0,
          text,
          fontSize: Number.isFinite(fontSize) ? fontSize : 32,
          color,
          fontFamily,
          align
        })
        return
      }
      placements.push({
        id,
        side,
        type,
        x,
        y,
        width,
        height,
        rotation: Number.isFinite(rotation) ? ((rotation % 360) + 360) % 360 : 0
      })
    })
  }
  pushPlacements('front')
  pushPlacements('back')
  return { name, frontImage, backImage, placements }
}

export { PLACEMENT_TYPES }
