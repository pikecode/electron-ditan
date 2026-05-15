// Interaction Controller (Step 3 initial)
export class InteractionController {
  constructor(getState, redraw, persist) {
    this.getState = getState
    this.redraw = redraw
    this.persist = persist
    this.dragging = false
    this.dragTarget = null
    this.dragOffsetX = 0
    this.dragOffsetY = 0
    this.resizeHandle = null // tl tr bl br
    this.resizeStart = {
      anchorX: 0,
      anchorY: 0,
      startScale: 1,
      startW: 0,
      startH: 0
    }
  }

  attach() {
    window.addEventListener('mouseup', this.onPointerUp)
    window.addEventListener('mousemove', this.onPointerMove)
  }

  detach() {
    window.removeEventListener('mouseup', this.onPointerUp)
    window.removeEventListener('mousemove', this.onPointerMove)
  }
  // Will be bound later inside component since we need 'this'
}
