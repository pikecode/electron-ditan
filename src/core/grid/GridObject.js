export class GridObject {
  constructor({ bitmap, baseW, baseH }){
    this.x = 0
    this.y = 0
    this.scale = 1
    this.rotate = 0
    this.baseW = baseW
    this.baseH = baseH
    this.bitmap = bitmap // canvas
  }
  hitTest(px,py){
    const w = this.baseW * this.scale
    const h = this.baseH * this.scale
    
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
  draw(ctx){
    if(!this.bitmap) return
    const w = this.baseW * this.scale
    const h = this.baseH * this.scale
    
    ctx.save()
    // 移动到旋转中心点
    ctx.translate(this.x + w/2, this.y + h/2)
    // 应用旋转
    ctx.rotate(this.rotate * Math.PI / 180)
    // 绘制图像（中心点为原点）
    ctx.drawImage(this.bitmap, -w/2, -h/2, w, h)
    ctx.restore()
  }
}
