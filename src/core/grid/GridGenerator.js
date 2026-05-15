// GridGenerator: 根据 cellsData 生成格子图位图 (canvas)
// cellsData: { image_width, image_height, rows, cols, data: [][] }
export class GridGenerator {
  constructor(cellsData){
    this.cells = cellsData
  }
  generate(scale=1){
    if(!this.cells) return null
    const { image_width, image_height, rows, cols, data } = this.cells
    const gridW = Math.round(image_width * scale)
    const gridH = Math.round(image_height * scale)
    const cellW = gridW / cols
    const cellH = gridH / rows
    
    // 为刻度留出空间（数字和格子图之间留 2px 间距）
    const scaleMarginLeft = 60
    const scaleMarginTop = 60
    const scaleMarginRight = 60  // 右侧留空间显示最后的刻度
    const scaleMarginBottom = 60 // 底部留空间显示最后的刻度
    const scaleGap = 2 // 刻度数字和格子图的间距
    const outW = gridW + scaleMarginLeft + scaleMarginRight
    const outH = gridH + scaleMarginTop + scaleMarginBottom
    
    const cvs = document.createElement('canvas')
    cvs.width = outW
    cvs.height = outH
    const ctx = cvs.getContext('2d')
    ctx.imageSmoothingEnabled = false

    // 先填充格子颜色 & label
    for(let r=0;r<rows;r++){
      const row = data[r]
      for(let c=0;c<cols;c++){
        const cell = row[c]
        const x = scaleMarginLeft + c*cellW
        const y = scaleMarginTop + r*cellH
        ctx.fillStyle = cell.color || '#cccccc'
        ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH))
        // label
        const label = cell.label || ''
        if(label){
          const rgb = parseHex(cell.color || '#cccccc')
          const luma = 0.2126*rgb.r + 0.7152*rgb.g + 0.0722*rgb.b
          ctx.fillStyle = luma < 140 ? '#ffffff' : '#000000'
          let fontPx = Math.max(8, cellH*0.8)
          ctx.font = `bold ${Math.round(fontPx)}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'alphabetic' // 使用基线对齐，手动计算垂直中心
          // 启用文字抗锯齿，提升清晰度
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          // 手动计算垂直中心以适配不同系统的字体度量
          const metrics = ctx.measureText(label)
          const textY = (y + cellH / 2) + (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2
          ctx.fillText(label, x + cellW/2, textY)
          // 恢复设置
          ctx.imageSmoothingEnabled = false
        }
      }
    }

    // 画网格线
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.beginPath()
    for(let c=0;c<=cols;c++){
      const x = Math.round(scaleMarginLeft + c*cellW)+0.5
      ctx.moveTo(x, scaleMarginTop)
      ctx.lineTo(x, scaleMarginTop + gridH)
    }
    for(let r=0;r<=rows;r++){
      const y = Math.round(scaleMarginTop + r*cellH)+0.5
      ctx.moveTo(scaleMarginLeft, y)
      ctx.lineTo(scaleMarginLeft + gridW, y)
    }
    ctx.stroke()

    // 加粗每10格线 & 刻度
    ctx.save()
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(0,0,0,1)'
    ctx.fillStyle = '#000'
    // 刻度字号适当缩小一些，避免过于粗大
    const scaleFontPx = 28
    ctx.font = `bold ${scaleFontPx}px sans-serif`
    
    // 垂直线和顶部刻度
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic' // 使用基线对齐，手动计算垂直中心
    for(let c=0;c<=cols;c+=10){
      const x = Math.round(scaleMarginLeft + c*cellW)+0.5
      // 加粗垂直线
      ctx.beginPath()
      ctx.moveTo(x, scaleMarginTop)
      ctx.lineTo(x, scaleMarginTop + gridH)
      ctx.stroke()
      // 顶部刻度数字（跳过 0，因为会在左侧显示）
      if(c > 0 && c <= cols) {
        // 向左偏移一些，避免与左侧刻度重叠
        const offsetX = c === 10 ? -8 : 0
        const scaleText = String(c)
        const scaleMetrics = ctx.measureText(scaleText)
        // 计算精确的垂直中心位置
        const textY = scaleMarginTop - scaleGap - scaleFontPx * 0.5 + (scaleMetrics.actualBoundingBoxAscent - scaleMetrics.actualBoundingBoxDescent) / 2
        ctx.fillText(scaleText, x + offsetX, textY)
      }
    }

    if (cols % 10 != 0) {
      const x = Math.round(scaleMarginLeft + cols*cellW)+0.5
      // 加粗垂直线
      ctx.beginPath()
      ctx.moveTo(x, scaleMarginTop)
      ctx.lineTo(x, scaleMarginTop + gridH)
      ctx.stroke()
    }
    
    // 水平线和左侧刻度
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic' // 使用基线对齐，手动计算垂直中心
    for(let r=0;r<=rows;r+=10){
      const y = Math.round(scaleMarginTop + r*cellH)+0.5
      // 加粗水平线
      ctx.beginPath()
      ctx.moveTo(scaleMarginLeft, y)
      ctx.lineTo(scaleMarginLeft + gridW, y)
      ctx.stroke()
      // 左侧刻度数字（包括 0），向左移动与格子图保持 2px 间距
      if(r <= rows) {
        const scaleText = String(r)
        const scaleMetrics = ctx.measureText(scaleText)
        const textX = scaleMarginLeft - scaleGap - scaleFontPx * 0.7 // 字体宽度的估算
        // 计算精确的垂直中心位置，使数字与网格线对齐
        const textY = y + (scaleMetrics.actualBoundingBoxAscent - scaleMetrics.actualBoundingBoxDescent) / 2
        ctx.fillText(scaleText, textX, textY)
      }
    }
    if (rows % 10 != 0) {
      // 末尾补最后一条加粗线（之前错误使用未定义 r 变量导致 ReferenceError）
      const y = Math.round(scaleMarginTop + rows*cellH)+0.5
      ctx.beginPath()
      ctx.moveTo(scaleMarginLeft, y)
      ctx.lineTo(scaleMarginLeft + gridW, y)
      ctx.stroke()
    }
    ctx.restore()

    return { canvas: cvs, width: outW, height: outH }
  }
}

function parseHex(hex){
  let h = hex.replace('#','')
  if(h.length===3){ h = h.split('').map(ch=>ch+ch).join('') }
  const num = parseInt(h,16)
  return { r:(num>>16)&255, g:(num>>8)&255, b:num&255 }
}
