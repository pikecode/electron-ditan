// Core object model (Step 1)
import { drawTextRun, measureTextBox, resolveTextFontFamily } from '../../../core/textLayout.js'

function normalizeRotation(value) {
  const angle = Number(value)
  if (!Number.isFinite(angle)) return 0
  return ((angle % 360) + 360) % 360
}

function resolvePlacementRect(obj) {
  const x = Number(obj?.placementX)
  const y = Number(obj?.placementY)
  const w = Number(obj?.placementW)
  const h = Number(obj?.placementH)
  if (![x, y, w, h].every(Number.isFinite)) return null
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

function pointInRotatedRect(px, py, rect, rotation = 0) {
  if (!rect) return false
  const angle = normalizeRotation(rotation)
  if (!angle) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h
  }
  const radians = angle * Math.PI / 180
  const centerX = rect.x + rect.w / 2
  const centerY = rect.y + rect.h / 2
  const dx = px - centerX
  const dy = py - centerY
  const cosA = Math.cos(radians)
  const sinA = Math.sin(radians)
  const localX = cosA * dx + sinA * dy
  const localY = -sinA * dx + cosA * dy
  return localX >= -rect.w / 2 && localX <= rect.w / 2 && localY >= -rect.h / 2 && localY <= rect.h / 2
}

function getRotatedBounds(rect, rotation = 0) {
  if (!rect) return null
  const angle = normalizeRotation(rotation)
  if (!angle) return { ...rect }
  const radians = angle * Math.PI / 180
  const sin = Math.abs(Math.sin(radians))
  const cos = Math.abs(Math.cos(radians))
  const width = rect.w * cos + rect.h * sin
  const height = rect.w * sin + rect.h * cos
  const centerX = rect.x + rect.w / 2
  const centerY = rect.y + rect.h / 2
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    w: width,
    h: height
  }
}

export class BaseObject {
  constructor(type) {
    this.id = Date.now() + '' + Math.random().toString(36).slice(2)
    this.type = type
    this.visible = true
  }
  draw(ctx) { /* override */ }
  hitTest(x, y) { return false }
  serialize() {
    return { id: this.id, type: this.type, visible: this.visible }
  }
}

export class ImageObject extends BaseObject {
  constructor(img) {
    super('image')
    this.img = img
    this.x = 0
    this.y = 0
    this.w = img ? img.width : 0
    this.h = img ? img.height : 0
    this.scale = 1
    this.rotate = 0
  }
  draw(ctx) {
    if (!this.img) return
    const w = this.w * this.scale
    const h = this.h * this.scale
    ctx.save()
    ctx.translate(this.x + w / 2, this.y + h / 2)
    ctx.rotate((this.rotate || 0) * Math.PI / 180)
    ctx.drawImage(this.img, -w / 2, -h / 2, w, h)
    ctx.restore()
  }
  hitTest(px, py) {
    const w = this.w * this.scale
    const h = this.h * this.scale
    return pointInRotatedRect(px, py, { x: this.x, y: this.y, w, h }, this.rotate)
  }
  serialize() {
    return { ...super.serialize(), x: this.x, y: this.y, w: this.w, h: this.h, scale: this.scale, rotate: this.rotate }
  }
}

export class TextObject extends BaseObject {
  constructor(opts) {
    super('text')
    this.text = opts.text || ''
    this.x = opts.x || 0
    this.y = opts.y || 0
    this.fontSize = opts.fontSize || 12
    this.color = opts.color || '#000'
    this.weight = opts.weight || 'normal'
    this.fontFamily = resolveTextFontFamily(opts.fontFamily)
    const align = typeof opts.align === 'string' ? opts.align.trim().toLowerCase() : ''
    this.align = ['left', 'center', 'right'].includes(align) ? align : 'left'
    this.rotate = normalizeRotation(opts.rotate)
  }
  draw(ctx) {
    const placementRect = this.manualPosition !== true ? resolvePlacementRect(this) : null
    const selectionRect = this.getSelectionRect(ctx)
    const drawOptions = {
      weight: this.weight,
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      color: this.color || '#000',
      baseline: 'alphabetic'
    }
    if (placementRect && !this.rotate) {
      ctx.save()
      ctx.beginPath()
      ctx.rect(placementRect.x, placementRect.y, placementRect.w, placementRect.h)
      ctx.clip()
      drawTextRun(ctx, this.text, this.x, this.y, drawOptions)
      ctx.restore()
      return
    }
    if (this.rotate && selectionRect) {
      const centerX = selectionRect.x + selectionRect.w / 2
      const centerY = selectionRect.y + selectionRect.h / 2
      ctx.save()
      ctx.translate(centerX, centerY)
      ctx.rotate(this.rotate * Math.PI / 180)
      if (placementRect) {
        ctx.beginPath()
        ctx.rect(-placementRect.w / 2, -placementRect.h / 2, placementRect.w, placementRect.h)
        ctx.clip()
      }
      drawTextRun(ctx, this.text, this.x - centerX, this.y - centerY, drawOptions)
      ctx.restore()
      return
    }
    drawTextRun(ctx, this.text, this.x, this.y, drawOptions)
  }
  measure(ctx) {
    const metrics = measureTextBox(ctx, this.text, { weight: this.weight, fontSize: this.fontSize, fontFamily: this.fontFamily })
    return { w: metrics.width, h: metrics.height, ascent: metrics.ascent, descent: metrics.descent }
  }
  getSelectionRect(ctx) {
    const placementRect = this.manualPosition !== true ? resolvePlacementRect(this) : null
    if (placementRect) return { ...placementRect, rotate: normalizeRotation(this.rotate) }
    const m = this.measure(ctx)
    return { x: this.x, y: this.y - m.ascent, w: m.w, h: m.h, rotate: normalizeRotation(this.rotate) }
  }
  getSelectionBounds(ctx) {
    const rect = this.getSelectionRect(ctx)
    if (!rect) return null
    return getRotatedBounds(rect, rect.rotate)
  }
  hitTest(px, py, ctx) {
    const rect = this.getSelectionRect(ctx)
    return pointInRotatedRect(px, py, rect, rect?.rotate)
  }
  serialize() {
    return {
      ...super.serialize(),
      text: this.text,
      x: this.x,
      y: this.y,
      w: this.w,
      h: this.h,
      ascent: this.ascent,
      descent: this.descent,
      fontSize: this.fontSize,
      color: this.color,
      weight: this.weight,
      fontFamily: this.fontFamily,
      align: this.align,
      rotate: normalizeRotation(this.rotate),
      baseline: this.baseline,
      manualPosition: this.manualPosition === true,
      placementId: this.placementId ?? null,
      placementX: this.placementX,
      placementY: this.placementY,
      placementW: this.placementW,
      placementH: this.placementH,
      placementRotation: this.placementRotation,
      boxX: this.boxX,
      boxY: this.boxY
    }
  }
}

export class StrokeLayer extends BaseObject {
  constructor() {
    super('strokes')
    this.strokes = []
  }
  addStroke(stroke) { if(!this.strokes) this.strokes=[]; this.strokes.push(stroke) }
  clear() { if(!this.strokes) this.strokes=[]; this.strokes.length = 0 }
  draw(ctx) {
    if (!Array.isArray(this.strokes) || this.strokes.length === 0) return
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of this.strokes) {
      if (!s || !s.points || !s.points.length) continue
      ctx.strokeStyle = s.color || '#000'
      ctx.lineWidth = s.size || 1
      ctx.beginPath()
      const pts = s.points
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) { ctx.lineTo(pts[i].x, pts[i].y) }
      ctx.stroke()
    }
    ctx.restore()
  }
  serialize() {
    return { ...super.serialize(), strokes: Array.isArray(this.strokes)? JSON.parse(JSON.stringify(this.strokes)) : [] }
  }
}

export function deserializeObjects(raw, resources) {
  const arr = []
  if (!Array.isArray(raw)) return arr
  for (const r of raw) {
    if (!r || !r.type) continue
    if (r.type === 'text') {
      const t = new TextObject(r)
      t.id = r.id
      t.visible = r.visible !== false
      if (Number.isFinite(+r.w)) t.w = +r.w
      if (Number.isFinite(+r.h)) t.h = +r.h
      if (Number.isFinite(+r.ascent)) t.ascent = +r.ascent
      if (Number.isFinite(+r.descent)) t.descent = +r.descent
      if (typeof r.baseline === 'string' && r.baseline.trim()) t.baseline = r.baseline
      t.rotate = normalizeRotation(r.rotate)
      t.manualPosition = r.manualPosition === true
      if (r.placementId != null && r.placementId !== '') t.placementId = r.placementId
      if (Number.isFinite(+r.placementX)) t.placementX = +r.placementX
      if (Number.isFinite(+r.placementY)) t.placementY = +r.placementY
      if (Number.isFinite(+r.placementW)) t.placementW = +r.placementW
      if (Number.isFinite(+r.placementH)) t.placementH = +r.placementH
      if (Number.isFinite(+r.placementRotation)) t.placementRotation = normalizeRotation(r.placementRotation)
      if (Number.isFinite(+r.boxX)) t.boxX = +r.boxX
      if (Number.isFinite(+r.boxY)) t.boxY = +r.boxY
      arr.push(t)
    } else if (r.type === 'image' && resources && resources.mergedImg) {
      const imgObj = new ImageObject(resources.mergedImg)
      Object.assign(imgObj, r)
      arr.push(imgObj)
    } else if (r.type === 'strokes') {
      const sl = new StrokeLayer()
      sl.id = r.id
      sl.strokes = r.strokes || []
      arr.push(sl)
    }
  }
  return arr
}
