export class CommandStack {
  constructor(max = 50) {
    this.undoStack = []
    this.redoStack = []
    this.max = max
  }

  push(cmd) {
    this.undoStack.push(cmd)
    if (this.undoStack.length > this.max) this.undoStack.shift()
    this.redoStack.length = 0
  }

  undo() {
    const cmd = this.undoStack.pop()
    if (!cmd) return false
    cmd.undo && cmd.undo()
    this.redoStack.push(cmd)
    return true
  }

  redo() {
    const cmd = this.redoStack.pop()
    if (!cmd) return false
    cmd.redo && cmd.redo()
    this.undoStack.push(cmd)
    return true
  }
}

export class PaintCellsCommand {
  constructor(grid, renderer, changes, onApplyCell) {
    this.grid = grid
    this.renderer = renderer
    this.changes = changes // [{row,col, prev:{color,id}, next:{color,id}}]
    this.onApplyCell = typeof onApplyCell === 'function' ? onApplyCell : null
  }
  apply(next = true) {
    for (const ch of this.changes) {
      const target = next ? ch.next : ch.prev
      this.grid.setCellColor(ch.row, ch.col, target.color, target.color_id)
      // invoke callback after applying each cell
      if (this.onApplyCell) {
        try { this.onApplyCell(ch.row, ch.col, target.color, target.color_id) } catch (_) {}
      }
    }
    this.renderer.getCanvas().requestRenderAll()
  }
  undo() { this.apply(false) }
  redo() { this.apply(true) }
}
