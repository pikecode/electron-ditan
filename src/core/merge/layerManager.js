// LayerManager: logical layer abstraction independent of UI
import { MergeEvents } from './events'

export class LayerManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.layers = new Map(); // id -> layer
    this.activeLayerId = null;
  }
  addLayer(layer) {
    if (this.layers.has(layer.id)) throw new Error('Layer exists: ' + layer.id);
    const norm = {
      id: layer.id,
      type: layer.type || 'image',
      source: layer.source, // raw source (url/base64/blob path)
      fabricObject: layer.fabricObject || null,
      x: layer.x || 0,
      y: layer.y || 0,
      scaleX: layer.scaleX || 1,
      scaleY: layer.scaleY || 1,
      rotation: layer.rotation || 0,
      opacity: layer.opacity != null ? layer.opacity : 1,
      visible: layer.visible !== false,
      locked: !!layer.locked,
      blendMode: layer.blendMode || 'normal',
      filters: { ...(layer.filters || {}) }
    };
    this.layers.set(norm.id, norm);
    if (!this.activeLayerId) this.activeLayerId = norm.id;
    this.eventBus.emit(MergeEvents.LAYER_ADDED, { id: norm.id });
    return norm.id;
  }
  getLayer(id) { return this.layers.get(id); }
  updateLayer(id, patch) {
    const layer = this.layers.get(id);
    if (!layer) return;
    Object.assign(layer, patch);
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch });
  }
  removeLayer(id) {
    if (!this.layers.has(id)) return;
    this.layers.delete(id);
    if (this.activeLayerId === id) this.activeLayerId = [...this.layers.keys()][0] || null;
    this.eventBus.emit(MergeEvents.LAYER_REMOVED, { id });
  }
  setActive(id) {
    if (!this.layers.has(id)) return;
    this.activeLayerId = id;
    this.eventBus.emit(MergeEvents.ACTIVE_LAYER_CHANGED, { id });
  }
  list() { return [...this.layers.values()]; }
  serialize() {
    return this.list().map(l => ({
      id: l.id,
      type: l.type,
      source: l.source,
      x: l.x, y: l.y,
      scaleX: l.scaleX, scaleY: l.scaleY,
      rotation: l.rotation,
      opacity: l.opacity,
      visible: l.visible,
      locked: l.locked,
      blendMode: l.blendMode,
      filters: l.filters
    }));
  }
}
