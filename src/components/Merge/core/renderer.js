// Renderer abstraction (Step 2)
import { measureTextBox } from '../../../core/textLayout.js'

export class CoverRenderer {
  constructor(ctx) {
    this.ctx = ctx
  }

  render(base) {
    if (!this.ctx || !base) return
    const c = this.ctx.canvas // base: coverImg, imageObj, strokeLayer, texts, selection states
    this.ctx.clearRect(0, 0, c.width, c.height)

    if (base.coverImg) this.ctx.drawImage(base.coverImg, 0, 0)

    // 背面格子图
    if (base.gridObj) { base.gridObj.draw(this.ctx) }

    // 表格对象
    if (base.tableObj) { base.tableObj.draw(this.ctx) }

    if (base.imageObj && base.side === 'front') {
      base.imageObj.draw(this.ctx)
    }

    if (base.strokeLayer) base.strokeLayer.draw(this.ctx)

    if (base.texts) {
      for (const t of base.texts) { t.draw(this.ctx) }
    }
  }

  drawMergeOutline(imageObj, base) {
    const w = imageObj.w * imageObj.scale
    const h = imageObj.h * imageObj.scale
    this.ctx.save()
    this.ctx.translate(imageObj.x + w / 2, imageObj.y + h / 2)
    this.ctx.rotate((imageObj.rotate || 0) * Math.PI / 180)
    this.ctx.strokeStyle = '#ff2955'
    this.ctx.lineWidth = 3
    this.ctx.setLineDash([10, 5])
    this.ctx.strokeRect(-w / 2, -h / 2, w, h)
    this.ctx.setLineDash([])

    if (!imageObj.rotate) {
      // handles (unrotated only)
      const handles = [
        { x: -w / 2 - 5, y: -h / 2 - 5 },
        { x: w / 2 - 5, y: -h / 2 - 5 },
        { x: -w / 2 - 5, y: h / 2 - 5 },
        { x: w / 2 - 5, y: h / 2 - 5 }
      ]
      this.ctx.fillStyle = '#ffffff'
      this.ctx.strokeStyle = '#ff2955'
      for (const hdl of handles) {
        this.ctx.beginPath()
        this.ctx.rect(hdl.x, hdl.y, 10, 10)
        this.ctx.fill()
        this.ctx.stroke()
      }
    }
    this.ctx.restore()
  }

  drawActiveTextOutline(t) {
    const rect = t?.getSelectionRect?.(this.ctx)
    if (rect) {
      this.ctx.save()
      this.ctx.strokeStyle = '#00d8ff'
      this.ctx.lineWidth = 3
      this.ctx.setLineDash([8, 4])
      if (rect.rotate) {
        this.ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2)
        this.ctx.rotate((rect.rotate || 0) * Math.PI / 180)
        this.ctx.strokeRect(-rect.w / 2, -rect.h / 2, rect.w, rect.h)
      } else {
        this.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
      }
      this.ctx.setLineDash([])
      this.ctx.restore()
      return
    }
    const m = this.measureText(t)
    this.ctx.save()
    this.ctx.strokeStyle = '#00d8ff'
    this.ctx.lineWidth = 3
    this.ctx.setLineDash([8, 4])
    this.ctx.strokeRect(t.x, t.y - m.ascent, m.w, m.h)
    this.ctx.setLineDash([])
    this.ctx.restore()
  }

  measureText(t) {
    if(t && typeof t.measure === 'function'){
      return t.measure(this.ctx)
    }
    const metrics = measureTextBox(this.ctx, t?.text, { weight: t?.weight, fontSize: t?.fontSize, fontFamily: t?.fontFamily })
    return { w: metrics.width, h: metrics.height, ascent: metrics.ascent, descent: metrics.descent }
  }

  drawActiveGridOutline(gridObj) {
    const scale = gridObj.scale || 1
    const width = (gridObj.baseW || gridObj.width || 0) * scale
    const height = (gridObj.baseH || gridObj.height || 0) * scale
    this.ctx.save()
    this.ctx.translate(gridObj.x + width / 2, gridObj.y + height / 2)
    this.ctx.rotate((gridObj.rotate || 0) * Math.PI / 180)
    this.ctx.strokeStyle = '#00ff00'
    this.ctx.lineWidth = 3
    this.ctx.setLineDash([10, 5])
    this.ctx.strokeRect(-width / 2, -height / 2, width, height)
    this.ctx.setLineDash([])
    this.ctx.restore()
  }

  drawActiveTableOutline(tableObj) {
    this.ctx.save()
    const sx = tableObj.scaleX != null ? tableObj.scaleX : (tableObj.scale || 1)
    const sy = tableObj.scaleY != null ? tableObj.scaleY : (tableObj.scale || 1)
    const w = tableObj.baseW * sx
    const h = tableObj.baseH * sy
    this.ctx.translate(tableObj.x + w/2, tableObj.y + h/2)
    this.ctx.rotate((tableObj.rotate || 0) * Math.PI / 180)
    this.ctx.strokeStyle = '#ffaa00'
    this.ctx.lineWidth = 3
    this.ctx.setLineDash([10, 5])
    this.ctx.strokeRect(-w/2, -h/2, w, h)
    this.ctx.setLineDash([])
    this.ctx.restore()
  }
}
