export class TableObject {
  constructor({ bitmap, baseW, baseH }){
    this.x = 0
    this.y = 0
    this.scale = 1
    this.rotate = 0
    this.baseW = baseW
    this.baseH = baseH
    this.bitmap = bitmap // canvas
    // 允许非等比缩放 & 目标矩形强制尺寸
    this.scaleX = null
    this.scaleY = null
    this.forceW = null
    this.forceH = null
  }
  
  hitTest(px,py){
    const sx = this.scaleX != null ? this.scaleX : (this.scale || 1)
    const sy = this.scaleY != null ? this.scaleY : (this.scale || 1)
    let w = this.baseW * sx
    let h = this.baseH * sy
    if(this.forceW!=null && this.forceH!=null){
      w = this.forceW
      h = this.forceH
    }
    
    // 如果没有旋转，使用简单的矩形检测
    if(!this.rotate || this.rotate === 0) {
      return px>=this.x && py>=this.y && px<=this.x+w && py<=this.y+h
    }
    
    // 有旋转时，使用反向变换检测
    const centerX = this.x + w/2
    const centerY = this.y + h/2
    const angle = -this.rotate * Math.PI / 180 // 反向旋转
    
    // 将点相对于中心点进行反向旋转
    const dx = px - centerX
    const dy = py - centerY
    const rotatedX = dx * Math.cos(angle) - dy * Math.sin(angle)
    const rotatedY = dx * Math.sin(angle) + dy * Math.cos(angle)
    
    // 检测旋转后的点是否在原始矩形内
    return rotatedX >= -w/2 && rotatedX <= w/2 && rotatedY >= -h/2 && rotatedY <= h/2
  }
  
/**
   * 逻辑绘制宽高（与 placement / 交互一致）；位图可比其多 1px 留白，避免 1px 边框贴边被裁半。
   */
  draw(ctx){
    if(!this.bitmap) return
    const logicalW = this.forceW != null ? this.forceW : this.baseW
    const logicalH = this.forceH != null ? this.forceH : this.baseH
    const w = logicalW * this.scale
    const h = logicalH * this.scale
    const srcW = this.bitmap.width
    const srcH = this.bitmap.height
    
    ctx.save()
    
    if(this.rotate && this.rotate !== 0) {
      // 如果有旋转，先移动到旋转中心点
      ctx.translate(this.x + w/2, this.y + h/2)
      // 应用旋转
      ctx.rotate(this.rotate * Math.PI / 180)
      // 绘制图像（中心点为原点）
      ctx.drawImage(this.bitmap, 0, 0, srcW, srcH, -w/2, -h/2, w, h)
    } else {
      // 没有旋转时直接绘制
      ctx.drawImage(this.bitmap, 0, 0, srcW, srcH, this.x, this.y, w, h)
    }
    
    ctx.restore()
  }
}
