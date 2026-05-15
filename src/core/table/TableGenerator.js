export class TableGenerator {
  constructor(cellsData) {
    this.cellsData = cellsData
    this.colorStats = this.generateColorStats()
  }

  // 从 cells 数据生成颜色统计
  generateColorStats() {
    const stats = new Map()

    // 检查数据格式：可能是数组格式 [{row, col, color, code, bag}, ...] 或者嵌套数组格式
    let cellsArray = []

    if (Array.isArray(this.cellsData)) {
      // 直接是数组格式
      cellsArray = this.cellsData
    } else if (this.cellsData?.data && Array.isArray(this.cellsData.data)) {
      // 嵌套数组格式：data[row][col] = {color, colorId, label}
      for (let row = 0; row < this.cellsData.data.length; row++) {
        for (let col = 0; col < this.cellsData.data[row].length; col++) {
          const cell = this.cellsData.data[row][col]
          if (cell) {
            cellsArray.push({
              row,
              col,
              color: cell.color,
              code: cell.label || `${row}-${col}`,
              No: cell.colorId,
              bag: 1
            })
          }
        }
      }
    }

    if (!cellsArray.length) return []

    // 遍历所有格子，统计每种颜色的数量
    for (const cell of cellsArray) {
      if (!cell || !cell.color) continue

      const key = `${cell.color}_${cell.code}`
      if (stats.has(key)) {
        stats.get(key).count++
        // 重新计算bag数
        const totalCount = stats.get(key).count
        stats.get(key).bag = Math.ceil(totalCount / 200)
      } else {
        stats.set(key, {
          color: cell.color,
          code: cell.code || 'N/A',
          bag: Math.ceil(1 / 200), // 初始数量为1，计算bag数
          count: 1,
          No: cell.No
        })
      }
    }

    // 按 code 自然排序（旧代码错用了 a.id）
    // 修复：如果 No 是字母（A, B, C...），需要转换成数字再排序
    // 否则会出现 "20号解析到 8号" 的问题
    const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })
    
    // 尝试将字母编号转换为数字
    const letterToNumber = (str) => {
      if (!str) return 0
      const s = String(str).trim()
      // 如果是纯数字，直接返回
      if (/^\d+$/.test(s)) return parseInt(s, 10)
      // 如果是字母编号（A, B, C... 或 A1, A2...）
      const match = s.match(/^([A-Z])+(\d*)$/i)
      if (match) {
        const letter = match[1].toUpperCase()
        const suffix = match[2] ? parseInt(match[2], 10) : 0
        // A=1, B=2, ..., Z=26, A1=27, A2=28...
        const base = letter.charCodeAt(0) - 'A'.charCodeAt(0) + 1
        return base + suffix * 26
      }
      // 其他情况，返回 0
      return 0
    }
    
    return Array.from(stats.values()).sort((a, b) => {
      const aNum = letterToNumber(a.No)
      const bNum = letterToNumber(b.No)
      // 先按数字排序
      if (aNum !== bNum) return aNum - bNum
      // 如果数字相同，再按字符串排序
      return collator.compare(a.No || '', b.No || '')
    })
  }

  // 生成表格 canvas
  // 支持非等比缩放：scaleX (宽度方向) / scaleY (高度方向)
  generate(scaleX = 1, scaleY = scaleX, columns = 1, maxRowsPerTable = 35) {
    if (!this.colorStats.length) return null
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    // 基础尺寸（列宽按 scaleX，高度按 scaleY）
    let numberCellWidth = 36 * scaleX
    let cellHeight = 30 * scaleY
    let colorCellWidth = 50 * scaleX
    const headerHeight = 35 * scaleY
    const footerHeight = 30 * scaleY
  // 字体整体放大一圈（约20%）：原先基准 12 -> 14.4 取整为 14
  const fontSize = Math.max(11, Math.round(14.4 * Math.min(scaleX, scaleY)))
    const borderWidth = 1 * Math.min(scaleX, scaleY)
    ctx.font = `${fontSize}px Arial`

    // 每个表格最多指定行数
    const total = this.colorStats.length
    const numTables = Math.ceil(total / maxRowsPerTable)

    // 单个表格的宽度和间距（4列：行号、Code、No.、Bag）
    const singleTableWidth = numberCellWidth + colorCellWidth * 3
    const tableSpacing = 10 * scaleX

    // 总画布宽度：所有表格并排，表格之间有间距
    const tableWidth = numTables * singleTableWidth + (numTables - 1) * tableSpacing

    // 计算每个表格实际的行数（不填充空行）
    const actualRowsPerTable = []
    for (let i = 0; i < numTables; i++) {
      const startIdx = i * maxRowsPerTable
      const endIdx = Math.min(startIdx + maxRowsPerTable, total)
      actualRowsPerTable.push(endIdx - startIdx)
    }
    // 使用最大的实际行数作为画布高度（所有表格高度一致）
    const maxActualRows = Math.max(...actualRowsPerTable)

    // 总画布高度：表头 + 实际最大行数 + 总计行
    const tableHeight = headerHeight + maxActualRows * cellHeight + footerHeight

    canvas.width = Math.round(tableWidth + borderWidth * 2)
    canvas.height = Math.round(tableHeight + borderWidth * 3)

    // 不锁定CSS尺寸，让canvas自适应显示
    // canvas.style.width = canvas.width + 'px'
    // canvas.style.height = canvas.height + 'px'

    ctx.font = `${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.strokeStyle = '#000000'
    ctx.lineWidth = borderWidth

    // 计算总 bag 数
    const totalBags = this.colorStats.reduce((sum, stat) => sum + Math.ceil(stat.count / 200), 0)

    // 绘制每个表格
    for (let tableIndex = 0; tableIndex < numTables; tableIndex++) {
      const startX = borderWidth + tableIndex * (singleTableWidth + tableSpacing)
      const startIndex = tableIndex * maxRowsPerTable
      const endIndex = Math.min(startIndex + maxRowsPerTable, total)

      // 绘制表头
      this.drawTableHeader(ctx, startX, borderWidth, numberCellWidth, colorCellWidth, headerHeight, fontSize)

      // 绘制数据行
      let rowIndex = 0
      for (let i = startIndex; i < endIndex; i++, rowIndex++) {
        const stat = this.colorStats[i]
        const rowY = headerHeight + rowIndex * cellHeight + borderWidth
        const rowNumber = i + 1  // 使用全局行号，而不是表内行号
        this.drawTableRow(ctx, stat, startX, rowY, numberCellWidth, colorCellWidth, cellHeight, fontSize, rowNumber)
      }

      // 总计行始终在最大行数位置绘制（保持所有表格对齐）
      const summaryY = headerHeight + maxActualRows * cellHeight + borderWidth
      if (tableIndex === numTables - 1) {
        // 最后一个表（最右边）显示 total
        this.drawSummaryRow(ctx, startX, summaryY, numberCellWidth, colorCellWidth, cellHeight, fontSize, totalBags, 'total')
      } else {
        // 其他表留空
        this.drawSummaryRow(ctx, startX, summaryY, numberCellWidth, colorCellWidth, cellHeight, fontSize, '', '')
      }
    }

    return { canvas, width: canvas.width, height: canvas.height }
  }

  // 绘制表头（新增行号列）
  drawTableHeader(ctx, startX, startY, numberCellWidth, colorCellWidth, headerHeight, fontSize) {
    let currentX = startX

    // 行号列
    ctx.fillStyle = '#ffecec'
    ctx.fillRect(currentX, startY, numberCellWidth, headerHeight)
    ctx.strokeRect(currentX, startY, numberCellWidth, headerHeight)

    ctx.fillStyle = '#cc0000'
    ctx.fillText('#', currentX + numberCellWidth / 2, startY + headerHeight / 2)
    currentX += numberCellWidth

    // Code 列（颜色块）
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(currentX, startY, colorCellWidth, headerHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, headerHeight)
    // Code 标签颜色仅黑白：根据背景亮度选择（复用 getContrastColor）
    const codeHeaderBg = '#f0f0f0'
    ctx.fillStyle = this.getContrastColor(codeHeaderBg)
    ctx.fillText('Code', currentX + colorCellWidth / 2, startY + headerHeight / 2)
    currentX += colorCellWidth

    // No. 列（宽度和 Code 列一样）
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(currentX, startY, colorCellWidth, headerHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, headerHeight)

    ctx.fillStyle = '#000000'
    ctx.fillText('No.', currentX + colorCellWidth / 2, startY + headerHeight / 2)
    currentX += colorCellWidth

    // Bag. 列（宽度和 Code 列一样）
    ctx.fillStyle = '#f0f0f0'
    ctx.fillRect(currentX, startY, colorCellWidth, headerHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, headerHeight)
    // Bag 列文字使用蓝色
    ctx.fillStyle = '#000000'
    ctx.fillText('Bag.', currentX + colorCellWidth / 2, startY + headerHeight / 2)
  }

  // 行绘制（新增行号单元）
  drawTableRow(ctx, stat, startX, startY, numberCellWidth, colorCellWidth, cellHeight, fontSize, rowNumber) {
    let currentX = startX
    // 行号列（白底 + 红字）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(currentX, startY, numberCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, numberCellWidth, cellHeight)
    ctx.fillStyle = '#ff0000'
    ctx.fillText(String(rowNumber), currentX + numberCellWidth / 2, startY + cellHeight / 2)
    currentX += numberCellWidth
    // Code 列
    ctx.fillStyle = stat.color
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)
    const textColor = this.getContrastColor(stat.color)
    ctx.fillStyle = textColor
    ctx.fillText(stat.code, currentX + colorCellWidth / 2, startY + cellHeight / 2)
    currentX += colorCellWidth
    // No. 列（宽度和 Code 列一样）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.fillStyle = '#000000'
    ctx.fillText(stat.No, currentX + colorCellWidth / 2, startY + cellHeight / 2)
    currentX += colorCellWidth
    // Bag. 列（宽度和 Code 列一样）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)
    // Bag 数量文字使用蓝色
    ctx.fillStyle = '#64CFFA'
    ctx.fillText(Math.ceil(stat.count / 200).toString(), currentX + colorCellWidth / 2, startY + cellHeight / 2)
  }

  // 绘制空行（用于填充不足15行的表格）
  drawEmptyRow(ctx, startX, startY, numberCellWidth, colorCellWidth, cellHeight) {
    let currentX = startX

    // 行号列（留空）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(currentX, startY, numberCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, numberCellWidth, cellHeight)
    currentX += numberCellWidth

    // Code 列（留空）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)
    currentX += colorCellWidth

    // No. 列（留空）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)
    currentX += colorCellWidth

    // Bag. 列（留空）
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)
  }

  // 汇总行（适配行号列，所有列宽度一致）
  drawSummaryRow(ctx, startX, startY, numberCellWidth, colorCellWidth, cellHeight, fontSize, totalBags, label = 'total') {
    let currentX = startX

    // 行号列（留空）
    ctx.fillStyle = '#e0e0e0'
    ctx.fillRect(currentX, startY, numberCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, numberCellWidth, cellHeight)
    currentX += numberCellWidth

    // Code 列（显示 total 标签）
    ctx.fillStyle = '#e0e0e0'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)

    if (label) {
      ctx.fillStyle = '#000000'
      ctx.fillText(label, currentX + colorCellWidth / 2, startY + cellHeight / 2)
    }
    currentX += colorCellWidth

    // No. 列（留空）
    ctx.fillStyle = '#e0e0e0'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)
    currentX += colorCellWidth

    // Bag. 列（显示总数）
    ctx.fillStyle = '#e0e0e0'
    ctx.fillRect(currentX, startY, colorCellWidth, cellHeight)
    ctx.strokeRect(currentX, startY, colorCellWidth, cellHeight)

    if (totalBags) {
      // 汇总行 Bag 数使用蓝色
      ctx.fillStyle = '#fc0303ff'
      ctx.fillText(`${totalBags}`, currentX + colorCellWidth / 2, startY + cellHeight / 2)
    }
  }

  // 计算对比色（黑或白）
  getContrastColor(hexColor) {
    // 移除 # 号
    const hex = hexColor.replace('#', '')

    // 转换为 RGB
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)

    // 计算亮度
    const brightness = (r * 299 + g * 587 + b * 114) / 1000

    // 如果背景较暗，使用白色文字；否则使用黑色文字
    return brightness < 128 ? '#ffffff' : '#000000'
  }
}
