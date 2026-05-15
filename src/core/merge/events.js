// Simple event bus for merge core
export class MergeEventBus {
  constructor() {
    this.listeners = new Map();
  }
  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.off(event, cb);
  }
  once(event, cb) {
    const off = this.on(event, (...a) => { off(); cb(...a); });
    return off;
  }
  off(event, cb) {
    if (!this.listeners.has(event)) return;
    this.listeners.get(event).delete(cb);
  }
  emit(event, payload) {
    if (!this.listeners.has(event)) return;
    for (const cb of [...this.listeners.get(event)]) {
      try { cb(payload); } catch (e) { console.error('MergeEventBus listener error', event, e); }
    }
  }
}

export const MergeEvents = {
  CORE_READY: 'core:ready',
  CANVAS_RESIZED: 'canvas:resized',
  LAYER_ADDED: 'layer:added',
  LAYER_UPDATED: 'layer:updated',
  LAYER_REMOVED: 'layer:removed',
  ACTIVE_LAYER_CHANGED: 'layer:activeChanged',
  VIEW_CHANGED: 'view:changed',
  ALIGN_APPLIED: 'align:applied',
  EXPORT_DONE: 'export:done',
  ERROR: 'core:error',
  MASK_APPLIED: 'mask:applied', // 新增遮罩事件
  STITCH_APPLIED: 'stitch:applied', // 基础针迹效果完成
};
