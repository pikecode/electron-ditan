// FabricAdapter: isolates direct fabric.js usage
// 动态导入 fabric，避免直接依赖 window.fabric
export class FabricAdapter {
  constructor(canvasEl, opts = {}) {
    this.canvasEl = canvasEl;
    this.opts = { width: 800, height: 600, backgroundColor: '#f5f5f5', ...opts };
    this.canvas = null;
    this.fabricLib = null; // 保存 fabric 引用
    this.ready = this._init();
    this._zoom = 1;
    this._pan = { x: 0, y: 0 };
  }
  async _init() {
    try {
      // 优先使用已存在的 window.fabric
      if (typeof window !== 'undefined' && window.fabric) {
        this.fabricLib = window.fabric;
      } else {
        const mod = await import('fabric');
        this.fabricLib = mod.fabric || mod.default || mod;
      }
      if (!this.fabricLib) throw new Error('fabric library not loaded');
      this.canvas = new this.fabricLib.Canvas(this.canvasEl, {
        backgroundColor: this.opts.backgroundColor,
        selection: false,
        preserveObjectStacking: true
      });
      this.canvas.setWidth(this.opts.width);
      this.canvas.setHeight(this.opts.height);
      return true;
    } catch (e) {
      console.error('FabricAdapter init failed', e);
      throw e;
    }
  }
  getFabric() { return this.fabricLib; }
  isReady() { return this.ready; }
  get canvasSize() { return { width: this.canvas.getWidth(), height: this.canvas.getHeight() }; }
  setSize(w, h) { this.canvas.setWidth(w); this.canvas.setHeight(h); this.canvas.requestRenderAll(); }
  addFabricImage(fabricImage) { this.canvas.add(fabricImage); this.canvas.requestRenderAll(); }
  removeObject(obj) { this.canvas.remove(obj); this.canvas.requestRenderAll(); }
  setActive(obj) { this.canvas.setActiveObject(obj); this.canvas.requestRenderAll(); }
  getZoom() { return this._zoom; }
  setZoom(zoom, center) {
    this._zoom = zoom;
    const fabric = this.fabricLib;
    const c = center || this.canvas.getCenter();
    this.canvas.zoomToPoint(new fabric.Point(c.left, c.top), zoom);
  }
  zoomBy(delta, center) { this.setZoom(Math.max(0.05, this._zoom * delta), center); }
  setPan(x, y) { this._pan = { x, y }; this.canvas.viewportTransform[4] = x; this.canvas.viewportTransform[5] = y; this.canvas.requestRenderAll(); }
  getPan() { return { ...this._pan }; }
  fitObjects() {
    const objs = this.canvas.getObjects();
    if (!objs.length) return;
    const bounds = objs.reduce((acc, o) => {
      const bb = o.getBoundingRect(true);
      acc.left = Math.min(acc.left, bb.left);
      acc.top = Math.min(acc.top, bb.top);
      acc.right = Math.max(acc.right, bb.left + bb.width);
      acc.bottom = Math.max(acc.bottom, bb.top + bb.height);
      return acc;
    }, { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
    const w = bounds.right - bounds.left;
    const h = bounds.bottom - bounds.top;
    const { width: cw, height: ch } = this.canvasSize;
    const scale = Math.min(cw / w, ch / h) * 0.95;
    this.setZoom(scale, { left: cw / 2, top: ch / 2 });
    const offsetX = (cw - w * scale) / 2 - bounds.left * scale;
    const offsetY = (ch - h * scale) / 2 - bounds.top * scale;
    this.setPan(offsetX, offsetY);
  }
  exportImage(format = 'png', multiplier = 1, backgroundColor = null) {
    let restoreBg = null;
    if (backgroundColor === null) {
      // 强制透明导出：暂时移除背景色
      restoreBg = this.canvas.backgroundColor;
      this.canvas.backgroundColor = null;
    }
    const opts = { format, multiplier, withoutTransform: false, enableRetinaScaling: false };
    if (backgroundColor && backgroundColor !== null) opts.backgroundColor = backgroundColor;
    const data = this.canvas.toDataURL(opts);
    if (restoreBg !== null) { this.canvas.backgroundColor = restoreBg; }
    return data;
  }
  exportRegion({ left, top, width, height }, format = 'png', multiplier = 1, backgroundColor = null) {
    let restoreBg = null;
    if (backgroundColor === null) {
      restoreBg = this.canvas.backgroundColor;
      this.canvas.backgroundColor = null;
    }
    const opts = { format, left, top, width, height, multiplier, withoutTransform: false, enableRetinaScaling: false };
    if (backgroundColor && backgroundColor !== null) opts.backgroundColor = backgroundColor;
    const data = this.canvas.toDataURL(opts);
    if (restoreBg !== null) { this.canvas.backgroundColor = restoreBg; }
    return data;
  }
  destroy() { if (this.canvas) { this.canvas.dispose(); this.canvas = null; } }
}
