// MergeEngine: facade combining managers and adapter
import { MergeEventBus, MergeEvents } from './events'
import { FabricAdapter } from './fabricAdapter'
import { LayerManager } from './layerManager'
import { CommandManager, BaseCommand } from './commandManager'
import { getCanvasPool } from '../../utils/canvasPool.js'
import { getMergeWorker } from './mergeWorkerProxy.js'
import {
  fastAverageAlpha,
  fastSobelAngles,
  fastQuantize,
  batchApplyMask,
  shadeColor
} from './pixelUtils.js'

export class MergeEngine {
  constructor(canvasEl, opts = {}) {
    this.eventBus = new MergeEventBus();
    this.fabric = new FabricAdapter(canvasEl, opts.canvas || {});
    this.layerManager = new LayerManager(this.eventBus);
    this.commandManager = new CommandManager();
    this.state = { ready:false, alignment:null, activeTool:'select', zoom:1 };
    this._imageCache = new Map();
    this._initialViewportSize = null; // 记录最初画布窗口尺寸用于 fit
    this._readyPromise = this._init();
  }
  async _init() {
    await this.fabric.isReady();
    this.state.ready = true;
    this.state.zoom = this.fabric.getZoom();
    this._initialViewportSize = { ...this.fabric.canvasSize }; // e.g. 800x600
    this.eventBus.emit(MergeEvents.CORE_READY, {});
    return true;
  }
  // --- lifecycle / readiness ---
  waitForInitialization() { return this._readyPromise; }
  async isInitialized() { return this.state.ready; }

  // --- event bus passthrough ---
  on(...a) { return this.eventBus.on(...a); }
  once(...a) { return this.eventBus.once(...a); }
  off(...a) { return this.eventBus.off(...a); }

  // --- layer operations ---
  async addImageLayer(id, source, opts = {}) {
    const imgEl = await this._loadImage(source);
    const fabricLib = this.fabric.getFabric();
    const fabricImage = new fabricLib.Image(imgEl, {
      left: opts.x || 0,
      top: opts.y || 0,
      opacity: (opts.opacity != null ? opts.opacity / 100 : 1), // incoming usually 0-100
      selectable: false
    });
    if (opts.blendMode && opts.blendMode !== 'normal') {
      fabricImage.globalCompositeOperation = opts.blendMode;
    }
    this.fabric.addFabricImage(fabricImage);
    this.layerManager.addLayer({
      id,
      source,
      x: fabricImage.left,
      y: fabricImage.top,
      opacity: fabricImage.opacity,
      blendMode: opts.blendMode || 'normal',
      fabricObject: fabricImage
    });
    // 缓存原始图像
    if (!this._imageCache.has(id)) {
      this._imageCache.set(id, { originalSource: source, maskedSource: null });
    } else {
      const c = this._imageCache.get(id); c.originalSource = source;
    }
    // 新增：若图像尺寸超过当前画布，自动扩展画布并平移对象保证完整显示
    this._ensureCanvasFitsContent(fabricImage);
    if (opts.center) this.centerLayer(id);
    // 新增：若已经有 zoom 基准(_baseCanvasSize)，为新图层建立 _baseTransform 以参与后续缩放
    const layer = this.layerManager.getLayer(id);
    if (this._baseCanvasSize && layer && layer.fabricObject && !layer._baseTransform) {
      const o = layer.fabricObject;
      layer._baseTransform = {
        left: (o.left || 0) / this.state.zoom,
        top: (o.top || 0) / this.state.zoom,
        scaleX: (o.scaleX || 1) / this.state.zoom,
        scaleY: (o.scaleY || 1) / this.state.zoom
      };
    }
  }
  _ensureCanvasFitsContent(obj, margin = 50) {
    if (!obj) return;
    const { width: cw, height: ch } = this.fabric.canvasSize;
    const objW = (obj.width || 0) * (obj.scaleX || 1);
    const objH = (obj.height || 0) * (obj.scaleY || 1);
    let needResize = false;
    let newW = cw, newH = ch;
    if (objW + margin * 2 > cw) { newW = Math.ceil(objW + margin * 2); needResize = true; }
    if (objH + margin * 2 > ch) { newH = Math.ceil(objH + margin * 2); needResize = true; }
    if (needResize) {
      // 让对象放在居中位置
      const offsetX = (newW - objW) / 2 - (obj.left || 0);
      const offsetY = (newH - objH) / 2 - (obj.top || 0);
      // 平移全部对象
      this.layerManager.list().forEach(l => {
        if (l.fabricObject) {
          l.fabricObject.left = (l.fabricObject.left || 0) + offsetX;
          l.fabricObject.top = (l.fabricObject.top || 0) + offsetY;
          l.fabricObject.setCoords();
          l.x = l.fabricObject.left; l.y = l.fabricObject.top;
        }
      });
      this.fabric.setSize(newW, newH);
      // 若还未建立 zoom 基准，更新 baseCanvasSize
      if (!this._baseCanvasSize) {
        this._baseCanvasSize = { width: newW, height: newH };
      } else {
        // 已经建立，按比例更新基准，保持当前 zoom 逻辑一致
        this._baseCanvasSize.width = newW;
        this._baseCanvasSize.height = newH;
      }
      this.fabric.canvas.requestRenderAll();
      this.eventBus.emit(MergeEvents.CANVAS_RESIZED, { width: newW, height: newH });
    }
  }
  centerLayer(id) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return;
    const { width: cw, height: ch } = this.fabric.canvasSize;
    const obj = layer.fabricObject;
    if (!obj) return;
    obj.left = (cw - obj.width) / 2;
    obj.top = (ch - obj.height) / 2;
    obj.setCoords();
    layer.x = obj.left; layer.y = obj.top;
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch: { x: layer.x, y: layer.y } });
  }
  applyCenterAlignment() {
    this.layerManager.list().forEach(l => this.centerLayer(l.id));
    this.state.alignment = 'center';
    this.eventBus.emit(MergeEvents.ALIGN_APPLIED, { strategy: 'center' });
  }
  setOpacity(id, value /* 0-100 */) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return;
    const v = value > 1 ? value / 100 : value; // accept 0-1 or 0-100
    layer.opacity = v;
    if (layer.fabricObject) { layer.fabricObject.set('opacity', v); }
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch: { opacity: v } });
  }
  setBlendMode(id, mode) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return;
    layer.blendMode = mode;
    if (layer.fabricObject) { layer.fabricObject.globalCompositeOperation = mode === 'normal' ? 'source-over' : mode; }
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch: { blendMode: mode } });
  }
  toggleVisibility(id) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return;
    layer.visible = !layer.visible;
    if (layer.fabricObject) { layer.fabricObject.visible = layer.visible; }
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch: { visible: layer.visible } });
  }
  setLayerVisibility(id, visible) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return;
    if (layer.visible === visible) return;
    layer.visible = visible;
    if (layer.fabricObject) { layer.fabricObject.visible = visible; }
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch: { visible } });
  }
  selectLayer(id) { this.layerManager.setActive(id); }
  getActiveLayer() { return this.layerManager.getLayer(this.layerManager.activeLayerId); }
  getLayerProperty(id) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return null;
    return {
      id: layer.id,
      x: layer.x,
      y: layer.y,
      width: layer.fabricObject?.width || 0,
      height: layer.fabricObject?.height || 0,
      opacity: Math.round(layer.opacity * 100),
      blendMode: layer.blendMode,
      visible: layer.visible
    };
  }
  updateLayerProperty(id, prop, value) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return;
    const obj = layer.fabricObject;
    switch (prop) {
      case 'x':
        layer.x = parseFloat(value); if (obj) obj.left = layer.x; break;
      case 'y':
        layer.y = parseFloat(value); if (obj) obj.top = layer.y; break;
      case 'opacity':
        this.setOpacity(id, parseFloat(value)); return; // already emits
      case 'blendMode':
        this.setBlendMode(id, value); return;
      case 'width':
        if (obj && obj.width) { const scaleX = parseFloat(value) / obj.width; obj.scaleX = scaleX; layer.scaleX = scaleX; obj.setCoords(); }
        break;
      case 'height':
        if (obj && obj.height) { const scaleY = parseFloat(value) / obj.height; obj.scaleY = scaleY; layer.scaleY = scaleY; obj.setCoords(); }
        break;
      default:
        layer[prop] = value;
    }
    if (obj) this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch: { [prop]: value } });
  }

  // --- Masking ---
  /**
   * 根据模板透明度/颜色键对目标图层进行遮罩
   * options: { templateId: 'template', targetId: 'grid', mode:'alpha'|'colorKey', color:'#RRGGBB'|[r,g,b], tolerance: number (0-255), alphaThreshold: number (0-255), useWorker: boolean }
   */
  async applyTemplateMask(options = {}) {
    const { templateId = 'template', targetId = 'grid', mode = 'alpha', color, tolerance = 0, alphaThreshold = 1, useWorker = true } = options;
    const templateLayer = this.layerManager.getLayer(templateId);
    const targetLayer = this.layerManager.getLayer(targetId);
    if (!templateLayer || !targetLayer) return;

    const tmplImg = await this._loadImage(this._imageCache.get(templateId)?.originalSource || templateLayer.source);
    const tgtImg = await this._loadImage(this._imageCache.get(targetId)?.originalSource || targetLayer.source);
    const w = tmplImg.width;
    const h = tmplImg.height;

    // 使用 CanvasPool 减少 GC 压力
    const pool = getCanvasPool();
    const off = pool.acquire(w, h);
    const tOff = pool.acquire(w, h);

    try {
      const ctx = off.getContext('2d');
      const tCtx = tOff.getContext('2d');

      // 绘制目标图和模板
      ctx.drawImage(tgtImg, 0, 0, w, h);
      tCtx.drawImage(tmplImg, 0, 0, w, h);

      const targetImageData = ctx.getImageData(0, 0, w, h);
      const tmplData = tCtx.getImageData(0, 0, w, h);

      let keyColor = null;
      if (mode === 'colorKey') {
        if (Array.isArray(color)) {
          keyColor = { r: color[0], g: color[1], b: color[2] };
        } else if (typeof color === 'string') {
          keyColor = this._hexToRgb(color);
        }
      }

      if (useWorker) {
        try {
          const worker = getMergeWorker();
          const masked = await worker.applyTemplateMask(tmplData, targetImageData, {
            mode,
            alphaThreshold,
            color: keyColor,
            tolerance
          });
          ctx.putImageData(masked, 0, 0);
        } catch (err) {
          console.warn('[MergeEngine] worker mask failed, fallback to main thread', err);
          batchApplyMask(targetImageData, tmplData, alphaThreshold, mode, {
            color: keyColor,
            tolerance
          });
          ctx.putImageData(targetImageData, 0, 0);
        }
      } else {
        batchApplyMask(targetImageData, tmplData, alphaThreshold, mode, {
          color: keyColor,
          tolerance
        });
        ctx.putImageData(targetImageData, 0, 0);
      }

      const maskedDataUrl = off.toDataURL('image/png');

      // 释放 CanvasPool
      pool.release(off);
      pool.release(tOff);

      // 更新图层图像
      await this.updateImageOnLayer(targetId, maskedDataUrl, { keepOriginal: true });
      const cacheEntry = this._imageCache.get(targetId);
      if (cacheEntry) cacheEntry.maskedSource = maskedDataUrl;
      this.eventBus.emit(MergeEvents.MASK_APPLIED, { targetId, templateId, mode, timestamp: Date.now() });
      return maskedDataUrl;
    } catch (err) {
      pool.release(off);
      pool.release(tOff);
      throw err;
    }
  }

  /**
   * 双向透明：任一图层该像素透明(<=alphaThreshold) -> 两图层都置透明
   * options: { templateId, targetId, alphaThreshold }
   */
  async applyMutualTransparency(options = {}) {
    const { templateId = 'template', targetId = 'grid', alphaThreshold = 1, useWorker = true } = options;
    const templateLayer = this.layerManager.getLayer(templateId);
    const targetLayer = this.layerManager.getLayer(targetId);
    if (!templateLayer || !targetLayer) return;

    const tmplSrc = this._imageCache.get(templateId)?.originalSource || templateLayer.source;
    const tgtSrc = this._imageCache.get(targetId)?.originalSource || targetLayer.source;
    const tmplImg = await this._loadImage(tmplSrc);
    const tgtImg = await this._loadImage(tgtSrc);
    const w = Math.max(tmplImg.width, tgtImg.width);
    const h = Math.max(tmplImg.height, tgtImg.height);

    // 使用 CanvasPool
    const pool = getCanvasPool();
    const c1 = pool.acquire(w, h);
    const c2 = pool.acquire(w, h);

    try {
      const ctx1 = c1.getContext('2d');
      const ctx2 = c2.getContext('2d');

      ctx1.drawImage(tmplImg, 0, 0, w, h);
      ctx2.drawImage(tgtImg, 0, 0, w, h);

      const d1 = ctx1.getImageData(0, 0, w, h);
      const d2 = ctx2.getImageData(0, 0, w, h);

      if (useWorker) {
        try {
          const worker = getMergeWorker();
          const result = await worker.applyMutualTransparency(d1, d2, alphaThreshold);
          ctx1.putImageData(result.template, 0, 0);
          ctx2.putImageData(result.target, 0, 0);
        } catch (err) {
          console.warn('[MergeEngine] worker mutual transparency failed, fallback to main thread', err);
          batchApplyMask(d1, d2, alphaThreshold, 'mutual');
          ctx1.putImageData(d1, 0, 0);
          ctx2.putImageData(d2, 0, 0);
        }
      } else {
        batchApplyMask(d1, d2, alphaThreshold, 'mutual');
        ctx1.putImageData(d1, 0, 0);
        ctx2.putImageData(d2, 0, 0);
      }

      const tmplMasked = c1.toDataURL('image/png');
      const tgtMasked = c2.toDataURL('image/png');

      // 释放 CanvasPool
      pool.release(c1);
      pool.release(c2);

      await this.updateImageOnLayer(templateId, tmplMasked, { keepOriginal: true });
      await this.updateImageOnLayer(targetId, tgtMasked, { keepOriginal: true });
      const tc = this._imageCache.get(templateId); if (tc) tc.maskedSource = tmplMasked;
      const gc = this._imageCache.get(targetId); if (gc) gc.maskedSource = tgtMasked;
      this.eventBus.emit(MergeEvents.MASK_APPLIED, { targetId, templateId, mode: 'mutual-alpha', timestamp: Date.now() });
      return { template: tmplMasked, target: tgtMasked };
    } catch (err) {
      pool.release(c1);
      pool.release(c2);
      throw err;
    }
  }

  async updateImageOnLayer(id, newSource, opts = {}) {
    const layer = this.layerManager.getLayer(id);
    if (!layer) return;
    const obj = layer.fabricObject;
    const imgEl = await this._loadImage(newSource);
    const fabricLib = this.fabric.getFabric();
    const newFabricImage = new fabricLib.Image(imgEl, {
      left: obj ? obj.left : 0,
      top: obj ? obj.top : 0,
      opacity: layer.opacity,
      selectable: false
    });
    if (layer.blendMode && layer.blendMode !== 'normal') {
      newFabricImage.globalCompositeOperation = layer.blendMode;
    }
    if (obj) { this.fabric.canvas.remove(obj); }
    this.fabric.addFabricImage(newFabricImage);
    layer.fabricObject = newFabricImage;
    layer.source = newSource;
    if (!opts.keepOriginal) {
      const entry = this._imageCache.get(id) || {}; entry.originalSource = newSource; this._imageCache.set(id, entry);
    }
    // 若已经发生过缩放，需为新对象建立基准变换，以保持后续缩放比例正确
    if (this._baseCanvasSize) {
      layer._baseTransform = {
        left: newFabricImage.left / this.state.zoom,
        top: newFabricImage.top / this.state.zoom,
        scaleX: (newFabricImage.scaleX || 1) / this.state.zoom,
        scaleY: (newFabricImage.scaleY || 1) / this.state.zoom
      };
    }
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.LAYER_UPDATED, { id, patch: { source: newSource } });
    await this._afterLayerImageChange(layer);
  }
  async _afterLayerImageChange(layer) {
    if (!layer || !layer.fabricObject) return;
    // 确保替换后若尺寸更大仍能完整显示
    this._ensureCanvasFitsContent(layer.fabricObject);
  }

  // --- view / zoom ---
  setZoom(percent) {
    const factor = percent > 5 ? percent / 100 : percent;
    if (!this._baseCanvasSize) {
      this._baseCanvasSize = { ...this.fabric.canvasSize };
    }
    // 确保所有图层都有 _baseTransform，没有的按当前对象逆向除以现有缩放生成
    this.layerManager.list().forEach(l => {
      if (l.fabricObject && !l._baseTransform) {
        l._baseTransform = {
          left: (l.fabricObject.left || 0) / this.state.zoom,
            top: (l.fabricObject.top || 0) / this.state.zoom,
            scaleX: (l.fabricObject.scaleX || 1) / this.state.zoom,
            scaleY: (l.fabricObject.scaleY || 1) / this.state.zoom
        };
      }
    });
    // 物理放大画布像素尺寸
    const newW = this._baseCanvasSize.width * factor;
    const newH = this._baseCanvasSize.height * factor;
    this.fabric.canvas.setWidth(newW);
    this.fabric.canvas.setHeight(newH);
    this.layerManager.list().forEach(l => {
      const o = l.fabricObject; if (!o || !l._baseTransform) return;
      o.left = l._baseTransform.left * factor;
      o.top = l._baseTransform.top * factor;
      o.scaleX = l._baseTransform.scaleX * factor;
      o.scaleY = l._baseTransform.scaleY * factor;
      o.setCoords();
    });
    this.state.zoom = factor;
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.VIEW_CHANGED, { zoom: factor });
  }
  zoomIn(step = 1.25) { this.setZoom(Math.min(8, this.state.zoom * step)); }
  zoomOut(step = 1.25) { this.setZoom(Math.max(0.1, this.state.zoom / step)); }
  fitToView(containerW, containerH) {
    // 若未传容器尺寸，使用初始窗口尺寸
    const targetW = containerW || this._initialViewportSize?.width || this.fabric.canvasSize.width;
    const targetH = containerH || this._initialViewportSize?.height || this.fabric.canvasSize.height;
    const layers = this.layerManager.list().filter(l=>l.fabricObject && l.visible !== false);
    if (!layers.length) return;
    // 确保每层有基准变换
    layers.forEach(l => {
      if (!l._baseTransform) {
        const o = l.fabricObject;
        l._baseTransform = {
          left: (o.left || 0) / this.state.zoom,
          top: (o.top || 0) / this.state.zoom,
          scaleX: (o.scaleX || 1) / this.state.zoom,
          scaleY: (o.scaleY || 1) / this.state.zoom
        };
      }
    });
    // 以基准变换计算原始内容包围盒
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    layers.forEach(l => {
      const o = l.fabricObject; const bt = l._baseTransform; if (!o || !bt) return;
      const w = (o.width || 0) * bt.scaleX; const h = (o.height || 0) * bt.scaleY;
      left = Math.min(left, bt.left);
      top = Math.min(top, bt.top);
      right = Math.max(right, bt.left + w);
      bottom = Math.max(bottom, bt.top + h);
    });
    if (!isFinite(left) || !isFinite(top)) return;
    const contentW = right - left; const contentH = bottom - top;
    if (contentW <=0 || contentH <=0) return;
    // 目标缩放（限制最大为1，避免初始就放大超过基准）
    const scale = Math.min(1, Math.min(targetW / contentW, targetH / contentH) * 0.95);
    this.setZoom(scale);
    // 缩放后重新计算中心偏移: 将内容置于画布中央（通过调整对象基准 left/top 再 setZoom 会复杂，这里直接在缩放后再平移对象）
    const { width: cw, height: ch } = this.fabric.canvasSize; // 已缩放后的画布尺寸 = baseCanvasSize * scale
    const newContentW = contentW * scale; const newContentH = contentH * scale;
    const offsetX = (cw - newContentW)/2 - left*scale;
    const offsetY = (ch - newContentH)/2 - top*scale;
    this.layerManager.list().forEach(l => {
      const o = l.fabricObject; if (!o) return;
      o.left = l._baseTransform.left * this.state.zoom + offsetX;
      o.top = l._baseTransform.top * this.state.zoom + offsetY;
      o.setCoords();
      l.x = o.left; l.y = o.top;
    });
    this.fabric.canvas.requestRenderAll();
    this.eventBus.emit(MergeEvents.VIEW_CHANGED, { zoom: this.state.zoom });
  }
  resetAndCenter() { this.setZoom(1); /* 重置后再执行对齐 */ this.applyCenterAlignment(); }

  // --- tools (placeholders) ---
  setActiveTool(toolId) { this.state.activeTool = toolId; }
  setDrawingColor(/* color */) { /* TODO: integrate drawing layer */ }
  setBrushSize(/* size */) { /* TODO */ }

  // --- export / config ---
  exportToImage(format = 'png', multiplier = 1, backgroundColor = null) { return this.exportMerged(format, multiplier, backgroundColor); }
  exportMerged(format = 'png', multiplier = 1, backgroundColor = null) {
    const data = this.fabric.exportImage(format, multiplier, backgroundColor);
    this.eventBus.emit(MergeEvents.EXPORT_DONE, { format, data, multiplier, backgroundColor });
    return data;
  }
  exportExactSize(targetWidth, targetHeight, format = 'png', backgroundColor = null) {
    // 仅在等比缩放情况下使用 multiplier，假设当前画布宽高与目标宽高同一比例
    const { width: cw, height: ch } = this.fabric.canvasSize;
    const scaleX = targetWidth / cw;
    const scaleY = targetHeight / ch;
    if (Math.abs(scaleX - scaleY) < 1e-6) {
      return this.exportToImage(format, scaleX, backgroundColor);
    }
    // 比例不同，退化为使用宽度倍率 (可能被拉伸) —— 可后续实现更复杂逻辑
    return this.exportToImage(format, scaleX, backgroundColor);
  }
  exportLayerExact(layerId, format = 'png', backgroundColor = null) {
    const layer = this.layerManager.getLayer(layerId);
    if (!layer || !layer.fabricObject) return null;
    const o = layer.fabricObject;
    // 计算对象在画布上的像素包围盒（不含透明边缘裁剪，这里用 boundingRect）
    const bb = o.getBoundingRect(true, true);
    // 去小数，保证像素对齐
    const left = Math.max(0, Math.floor(bb.left));
    const top = Math.max(0, Math.floor(bb.top));
    const width = Math.ceil(bb.width);
    const height = Math.ceil(bb.height);
    return this.fabric.exportRegion({ left, top, width, height }, format, 1, backgroundColor);
  }
  getConfiguration() { return this.serializeConfig(); }
  serializeConfig() {
    return {
      version: 1,
      alignment: this.state.alignment,
      layers: this.layerManager.serialize(),
      timestamp: Date.now()
    };
  }

  // --- Basic stitch effect (color quantization + directional texture + highlight/shadow) ---
  /**
   * applyBasicStitchEffect: generate a stylized embroidery look for a layer.
   * options: { layerId, palette?[[r,g,b]], paletteSize=32, cellSize=2, highlight=0.15, shadow=0.18, directionMode:'sobel'|'fixed', fixedAngleDeg=45, onProgress? }
   */
  async applyBasicStitchEffect(options = {}) {
    const { layerId = 'grid', palette, paletteSize = 32, cellSize = 2, highlight = 0.15, shadow = 0.18, directionMode = 'sobel', fixedAngleDeg = 45, alphaThreshold = 8, onProgress = null, useWorker = true } = options;
    const layer = this.layerManager.getLayer(layerId);
    if (!layer) return;

    // 使用当前显示的 source（可能已遮罩），保证透明区域被保留
    const src = layer.source;
    const img = await this._loadImage(src);
    const w = img.width;
    const h = img.height;

    // 使用 CanvasPool
    const pool = getCanvasPool();
    const base = pool.acquire(w, h);
    const out = pool.acquire(w, h);
    const threadCanvas = pool.acquire(cellSize, cellSize);

    try {
      const ctx = base.getContext('2d');
      const octx = out.getContext('2d');
      const tctx = threadCanvas.getContext('2d');

      ctx.drawImage(img, 0, 0);
      let imgData = ctx.getImageData(0, 0, w, h);

      if (useWorker) {
        try {
          const worker = getMergeWorker();
          const resultImageData = await worker.applyStitchEffect(imgData, {
            palette,
            paletteSize,
            cellSize,
            highlight,
            shadow,
            directionMode,
            fixedAngleDeg,
            alphaThreshold
          }, onProgress);
          octx.putImageData(resultImageData, 0, 0);
          const resultUrl = out.toDataURL('image/png');
          pool.release(base);
          pool.release(out);
          pool.release(threadCanvas);
          await this.updateImageOnLayer(layerId, resultUrl, { keepOriginal: true });
          const updated = this.layerManager.getLayer(layerId);
          this._afterLayerImageChange(updated);
          this.eventBus.emit(MergeEvents.STITCH_APPLIED, { layerId, timestamp: Date.now(), type: 'basic' });
          return resultUrl;
        } catch (err) {
          console.warn('[MergeEngine] worker stitch failed, fallback to main thread', err);
        }
      }

      // 预计算 alpha - 使用指针递增
      const alphaRef = new Uint8ClampedArray(w * h);
      for (let i = 3, pi = 0; i < imgData.data.length; i += 4, pi++) {
        alphaRef[pi] = imgData.data[i];
      }

      // 颜色量化 - 使用优化版本
      const quant = fastQuantize(imgData.data, palette, paletteSize);
      for (let i = 0, p = 0; i < imgData.data.length; i += 4, p++) {
        const q = quant.colors[quant.map[p]];
        imgData.data[i] = q[0];
        imgData.data[i + 1] = q[1];
        imgData.data[i + 2] = q[2];
      }
      ctx.putImageData(imgData, 0, 0);

      // 方向 - 使用优化版本
      const angleField = directionMode === 'sobel'
        ? fastSobelAngles(imgData, w, h)
        : new Float32Array(w * h).fill(fixedAngleDeg * Math.PI / 180);

      // 先绘制量化底色（带透明）
      octx.drawImage(base, 0, 0);

      const half = cellSize / 2;
      const rows = Math.ceil(h / cellSize);
      const cols = Math.ceil(w / cellSize);
      const totalCells = rows * cols;
      let processed = 0;

      for (let y = 0; y < h; y += cellSize) {
        for (let x = 0; x < w; x += cellSize) {
          // 使用优化函数计算平均 alpha
          const aAvg = fastAverageAlpha(alphaRef, w, h, x, y, cellSize, cellSize);
          if (aAvg <= alphaThreshold) {
            processed++;
            continue;
          }

          const idx = (y * w + x) * 4;
          const r = imgData.data[idx];
          const g = imgData.data[idx + 1];
          const b = imgData.data[idx + 2];
          const ang = angleField[y * w + x];

          tctx.clearRect(0, 0, cellSize, cellSize);
          const grad = shadeColor([r, g, b], highlight, shadow, Math.cos(ang));
          const alphaFactor = aAvg / 255;

          tctx.globalAlpha = alphaFactor;
          tctx.fillStyle = `rgb(${grad.base[0]},${grad.base[1]},${grad.base[2]})`;
          tctx.fillRect(0, 0, cellSize, cellSize);

          tctx.save();
          tctx.translate(half, half);
          tctx.rotate(ang);
          const lw = Math.max(1, cellSize * 0.15);
          tctx.strokeStyle = `rgb(${grad.hi[0]},${grad.hi[1]},${grad.hi[2]})`;
          tctx.lineWidth = lw;
          tctx.beginPath();
          tctx.moveTo(-half, -lw);
          tctx.lineTo(half, -lw);
          tctx.stroke();
          tctx.strokeStyle = `rgb(${grad.sh[0]},${grad.sh[1]},${grad.sh[2]})`;
          tctx.beginPath();
          tctx.moveTo(-half, lw);
          tctx.lineTo(half, lw);
          tctx.stroke();
          tctx.restore();
          tctx.globalAlpha = 1;

          octx.drawImage(threadCanvas, x, y);
          processed++;
        }

        // 进度回调
        if (onProgress && (y / cellSize) % 10 === 0) {
          onProgress(processed / totalCells);
        }
      }

      const resultUrl = out.toDataURL('image/png');

      // 释放 CanvasPool
      pool.release(base);
      pool.release(out);
      pool.release(threadCanvas);

      await this.updateImageOnLayer(layerId, resultUrl, { keepOriginal: true });

      // 生成后再适配一次（针迹可能尺寸同原图，一般不会更大，但以防）
      const updated = this.layerManager.getLayer(layerId);
      this._afterLayerImageChange(updated);
      this.eventBus.emit(MergeEvents.STITCH_APPLIED, { layerId, timestamp: Date.now(), type: 'basic' });
      return resultUrl;
    } catch (err) {
      pool.release(base);
      pool.release(out);
      pool.release(threadCanvas);
      throw err;
    }
  }
  _fixedAngles(w, h, ang) {
    // 使用 fastSobelAngles 的替代方案
    return new Float32Array(w * h).fill(ang);
  }

  _computeSobelAngles(imgData, w, h) {
    // 委托给优化版本
    return fastSobelAngles(imgData, w, h);
  }

  _quantize(data, palette, paletteSize) {
    // 委托给优化版本
    return fastQuantize(data, palette, paletteSize);
  }

  // --- internal helpers ---
  async _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(e);
      img.src = src;
    });
  }
  _hexToRgb(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : { r: 0, g: 0, b: 0 };
  }
  _colorWithin(r, g, b, R, G, B, tolerance) {
    return Math.abs(r - R) <= tolerance && Math.abs(g - G) <= tolerance && Math.abs(b - B) <= tolerance;
  }
  destroy() { this.fabric.destroy(); }
}

// Example command (can be expanded)
export class SetOpacityCommand extends BaseCommand {
  constructor(engine, layerId, newValue) {
    super('SetOpacity');
    this.engine = engine;
    this.layerId = layerId;
    this.newValue = newValue;
    this.prev = null;
  }
  execute() {
    const layer = this.engine.layerManager.getLayer(this.layerId);
    if (!layer) return;
    this.prev = layer.opacity;
    this.engine.setOpacity(this.layerId, this.newValue);
  }
  undo() { this.engine.setOpacity(this.layerId, this.prev); }
}
