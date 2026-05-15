import { Canvas, FabricImage, Rect } from 'fabric'
import { RectInfo } from '../rect_info'
import { drawSelectionOverlay } from './afer_reder/drawSelectionOverlay'
import { drawGridLines } from './afer_reder/drawGridLines'
import { directDrawCells } from './afer_reder/directDrawCells'
import { h } from 'vue'

export class FabricRenderer {
  constructor(canvasElement, opts) {
    this.canvas = new Canvas(canvasElement, { selection: opts.selection, backgroundColor: opts.backgroundColor });
    this.canvas.renderOnAddRemove = false;
    this.grid = null;
    this.rectInfos = [];
    this.cellWidth = null;
    this.cellHeight = null;
    this.bgImageObj = null;
    this.selectionBounds = null;
    this.cellType = 'full';
    this.gridVisible = true;
    /** 原图是否在画布上显示（格子模式为 false）；用于叠加模式下交叉线与底图撞色时增强对比度 */
    this.backgroundVisible = true;
    this.backgroundOpacity = 1;
    this.gridLineColor = '#ddd';
    this.gridLineWidth = 1;
    this.gridLineOpacity = 1;
    this.gridMajorLineColor = this.gridLineColor;
    this.gridMajorLineWidth = Math.max(2, this.gridLineWidth + 1);
    this.gridMajorLineStep = 10;
    this.gridLineLayer = 'overlay';
    this.stitchStyle = {
      renderMode: 'solid',
      previewMode: 'real',
      gapPixels: 0,
      outlined: false,
      outlineColor: null,
      outlineColorPercentage: 80,
      outlineThickness: 0.2,
    };
    // `grid-origin`: use the same top-left anchored coordinate space as stitch/grid data.
    // `contain-center`: preserve the legacy centered contain-fit behavior.
    this.backgroundAlignMode = opts.backgroundAlignMode || 'contain-center';
    // direct draw additions
    this.directDraw = this.directDraw ?? true;
    this.cellData = this.cellData || null;
    this.dirtyCells = this.dirtyCells || new Set();
    this.fullRedrawNeeded = this.fullRedrawNeeded || true; // 首次需要全量

    // 新增离屏缓冲
    this.rasterCanvas = document.createElement('canvas');
    this.rasterCtx = this.rasterCanvas.getContext('2d');
    if (this.rasterCtx) this.rasterCtx.imageSmoothingEnabled = false;

    this.canvas.on('after:render', () => {
      const baseCtx = this.canvas.contextContainer;
      const overlayCtx = this.canvas.contextTop || (this.canvas.getSelectionContext && this.canvas.getSelectionContext());

      if (this.gridVisible && baseCtx && this.grid && this.cellWidth && this.cellHeight && this.gridLineLayer === 'underlay') {
        drawGridLines(baseCtx, this.grid, this.cellWidth, this.cellHeight, {
          color: this.gridLineColor,
          width: this.gridLineWidth,
          opacity: this.gridLineOpacity,
          majorColor: this.gridMajorLineColor,
          majorWidth: this.gridMajorLineWidth,
          majorStep: this.gridMajorLineStep,
        });
      }

      if (this.gridVisible && this.directDraw && baseCtx && this.grid && this.cellWidth && this.cellHeight) {
        directDrawCells(baseCtx, this.grid, this.cellWidth, this.cellHeight, {
          rasterCtx: this.rasterCtx,
          rasterCanvas: this.rasterCanvas,
          fullRedrawNeeded: this.fullRedrawNeeded,
          crossContrastOnOverlay: !!(this.bgImageObj && this.backgroundVisible),
          stitchStyle: this.stitchStyle,
          afterDraw: () => {
            this.fullRedrawNeeded = false;
            this.grid.clearChangeList();
          }
        });
      }

      if (!overlayCtx) return;
      // 清空 overlay 层，保留 Fabric retina 缩放效果
      const dpr = this.canvas.getRetinaScaling ? this.canvas.getRetinaScaling() : (window.devicePixelRatio || 1);
      overlayCtx.save();
      overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
      overlayCtx.clearRect(0, 0, this.canvas.getWidth() * dpr, this.canvas.getHeight() * dpr);
      overlayCtx.restore();

      // 按逻辑坐标绘制（Fabric 已经对 overlayCtx 做过缩放）
      if (this.gridVisible && this.grid && this.cellWidth && this.cellHeight && this.gridLineLayer !== 'underlay') {
        drawGridLines(overlayCtx, this.grid, this.cellWidth, this.cellHeight, {
          color: this.gridLineColor,
          width: this.gridLineWidth,
          opacity: this.gridLineOpacity,
          majorColor: this.gridMajorLineColor,
          majorWidth: this.gridMajorLineWidth,
          majorStep: this.gridMajorLineStep,
        });
      }
      if (this.selectionBounds) {
        drawSelectionOverlay(overlayCtx, this.selectionBounds);
      }
    });
  }

  markFullRedraw() { this.fullRedrawNeeded = true; }

  bindGrid(gridModel) {
    this.grid = gridModel;
  }

  _alignBackgroundToGrid() {
    if (
        !this.bgImageObj ||
        !this.grid ||
        !this.cellWidth ||
        !this.cellHeight
    )
      return;
    const gridW = this.grid.length * this.cellWidth;
    const gridH = this.grid.height * this.cellHeight;
    const iw =
        this.bgImageObj.width ||
        this.bgImageObj._originalElement?.width ||
        gridW;
    const ih =
        this.bgImageObj.height ||
        this.bgImageObj._originalElement?.height ||
        gridH;
    let left = 0;
    let top = 0;
    let scaleX = 1;
    let scaleY = 1;

    if (this.backgroundAlignMode === 'grid-origin') {
      // Exact overlay mode: background and grid share the same origin and bounds.
      scaleX = gridW / iw;
      scaleY = gridH / ih;
    } else {
      const scale = Math.min(gridW / iw, gridH / ih);
      const drawW = iw * scale;
      const drawH = ih * scale;
      left = (gridW - drawW) / 2;
      top = (gridH - drawH) / 2;
      scaleX = scale;
      scaleY = scale;
    }

    if (!isFinite(scaleX) || !isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
      return;
    }
    this.bgImageObj.set({
      left,
      top,
      scaleX,
      scaleY,
      originX: 'left',
      originY: 'top',
      selectable: false,
      evented: false,
    });
    const clip = new Rect({
      left: 0,
      top: 0,
      width: gridW,
      height: gridH,
      absolutePositioned: true,
    });
    this.bgImageObj.clipPath = clip;
    try {
      if (typeof this.bgImageObj.sendToBack === 'function')
        this.bgImageObj.sendToBack();
      else if (typeof this.canvas.moveTo === 'function')
        this.canvas.moveTo(this.bgImageObj, 0);
    } catch (e) {
      console.warn('无法设置背景图片层级:', e);
    }
  }

  drawGrid(cellWidth, cellHeight) {
    this.cellWidth = cellWidth;
    this.cellHeight = cellHeight;
    if (this.grid && this.cellWidth && this.cellHeight) {
      const gridW = Math.round(this.grid.length * this.cellWidth);
      const gridH = Math.round(this.grid.height * this.cellHeight);
      if (this.canvas.getWidth() !== gridW || this.canvas.getHeight() !== gridH) {
        this.canvas.setWidth(gridW);
        this.canvas.setHeight(gridH);
      }
      // 调整离屏缓冲尺寸
      if (this.rasterCanvas.width !== gridW || this.rasterCanvas.height !== gridH) {
        this.rasterCanvas.width = gridW;
        this.rasterCanvas.height = gridH;
        if (this.rasterCtx) {
          this.rasterCtx.imageSmoothingEnabled = false;
        }
        this.fullRedrawNeeded = true; // 尺寸变化需全量
      }
    }
    const bgObj = this.bgImageObj;
    this.canvas.clear();
    if (bgObj) {
      this.canvas.add(bgObj);
      try {
        if (typeof bgObj.sendToBack === 'function') bgObj.sendToBack();
        else if (typeof this.canvas.moveTo === 'function')
          this.canvas.moveTo(bgObj, 0);
      } catch (e) {
        console.warn('无法设置背景图片层级:', e);
      }
      this._alignBackgroundToGrid();
    }
    // height is w, length is h
    console.log('绘制网格:', this.grid.length, this.grid.height, cellWidth, cellHeight);
    // this.rectInfos = [];
    // for (let r = 0; r < this.grid.length; r++) {
    //   this.rectInfos[r] = [];
    //   for (let c = 0; c < this.grid.height; c++) {
    //     const data = this.grid.getCell(r, c);
    //     console.log('绘制单元格:', r, c,  c * cellWidth, r * cellHeight);
    //     console.log(this.canvas.width, this.canvas.height)
    //     const rectInfo = new RectInfo({
    //       left: c * cellWidth,
    //       top: r * cellHeight,
    //       width: cellWidth,
    //       height: cellHeight,
    //       color: data.color,
    //       stroke: null,
    //       strokeWidth: 0,
    //       type: this.cellType,
    //       color_id: data.color_id,
    //       row: r,
    //       col: c,
    //     });
    //     rectInfo.set_border_visible(false);
    //     const obj = rectInfo.get_rect();
    //     if (obj)
    //       obj.set({
    //         objectCaching: false,
    //         stateful: false,
    //         selectable: false,
    //         evented: false,
    //         visible: this.gridVisible,
    //       });
    //     this.canvas.add(obj);
    //     // 新增：添加文字对象（初始为空）
    //     const txt = rectInfo.get_text();
    //     if (txt) {
    //       txt.set({
    //         objectCaching: false,
    //         selectable: false,
    //         evented: false,
    //         visible: this.gridVisible && !!txt.text,
    //       });
    //       this.canvas.add(txt);
    //     }
    //     this.rectInfos[r][c] = rectInfo;
    //   }
    // }
    this.canvas.requestRenderAll();
  }

  setGridLineStyle({ color = '#ddd', width = 1, opacity = 1, majorColor = null, majorWidth = null, majorStep = 10, layer = 'overlay' } = {}) {
    console.log('设置网格线样式:', color, width, opacity, majorColor, majorWidth, majorStep, layer);
    this.gridLineColor = color;
    this.gridLineWidth = width;
    this.gridLineOpacity = opacity;
    this.gridMajorLineColor = majorColor || color;
    this.gridMajorLineWidth = majorWidth == null ? Math.max(Number(width || 1) + 1, 2) : majorWidth;
    this.gridMajorLineStep = Math.max(1, Number(majorStep || 10));
    this.gridLineLayer = layer === 'underlay' ? 'underlay' : 'overlay';
    this.markFullRedraw();
    this.canvas.requestRenderAll();
  }

  setStitchStyle(style = {}) {
    this.stitchStyle = {
      ...this.stitchStyle,
      ...style,
    };
    this.markFullRedraw();
    this.canvas.requestRenderAll();
  }

  setGridVisibility(visible) {
    this.gridVisible = !!visible;
    this.canvas.requestRenderAll();
  }

  setBackgroundVisible(visible) {
    this.backgroundVisible = !!visible;
    if (this.bgImageObj) {
      this.bgImageObj.set('visible', this.backgroundVisible);
    }
    this.canvas.requestRenderAll();
  }

  setBackgroundOpacity(opacity) {
    this.backgroundOpacity = Number.isFinite(Number(opacity)) ? Number(opacity) : 1;
    if (this.bgImageObj) {
      this.bgImageObj.set('opacity', this.backgroundOpacity);
      this.canvas.requestRenderAll();
    }
  }

  setCanvasBackgroundColor(color) {
    if (!color) return;
    this.canvas.backgroundColor = color;
    this.canvas.requestRenderAll();
  }

  updateCellColor(r, c, color, color_id) {
    // const info = this.rectInfos[r] && this.rectInfos[r][c];
    // if (!info) return;
    // info.set_color(color, color_id);
  }

  showColorHover(color, enabled=true) {
    this.grid.setCellShowID && this.grid.setCellShowID(color);
    this.canvas.requestRenderAll();
  }

  hideColorHover(color) {
    if (color != null) {
      this.grid.setCellShowID && this.grid.setCellShowID(color);
    } else {
      this.grid.removeCellShowID && this.grid.removeCellShowID();
    }
    this.canvas.requestRenderAll();
  }

  setSelectionBounds(bounds) {
    this.selectionBounds = bounds;
    this.canvas.requestRenderAll();
  }

  clearSelectionBounds() {
    this.selectionBounds = null;
    this.canvas.requestRenderAll();
  }

  setBackgroundImageBase64(base64Data, cb) {
    console.log('[FabricRenderer] setBackgroundImageBase64 start', { hasData: !!base64Data })
    if (!base64Data) {
      cb && cb(null);
      return;
    }
    if (this.bgImageObj) {
      try {
        this.canvas.remove(this.bgImageObj);
      } catch (_) {}
      this.bgImageObj = null;
    }
    FabricImage.fromURL(base64Data, { crossOrigin: 'anonymous' })
        .then(fabricImg => {
          fabricImg.set({
            originX: 'left',
            originY: 'top',
            selectable: false,
            evented: false,
            visible: this.backgroundVisible,
            opacity: this.backgroundOpacity,
          });
          this.bgImageObj = fabricImg;
          this.canvas.add(fabricImg);
          try {
            if (typeof fabricImg.sendToBack === 'function') fabricImg.sendToBack();
            else if (typeof this.canvas.moveTo === 'function')
              this.canvas.moveTo(fabricImg, 0);
          } catch (e) {
            console.warn('无法设置背景图片层级:', e);
          }
          this._alignBackgroundToGrid();
          this.canvas.renderAll();
          // 缓存像素数据
          try {
            const el = fabricImg._originalElement
            if (el) {
              console.log('[FabricRenderer] caching image data', { w: el.width, h: el.height })
              const off = document.createElement('canvas')
              off.width = el.width; off.height = el.height
              const octx = off.getContext('2d')
              octx.drawImage(el,0,0)
              this._cachedImageData = octx.getImageData(0,0,off.width,off.height)
              console.log('[FabricRenderer] cache complete')
              if (this.grid && typeof this.grid.autoColorizeWithImage === 'function' && this.grid.options?.autoColor) {
                console.log('[FabricRenderer] triggering grid autoColorizeWithImage')
                Promise.resolve(this.grid.autoColorizeWithImage(this._cachedImageData))
                    .then(() => {
                      this.markFullRedraw()
                      this.canvas.requestRenderAll()
                    })
                    .catch((e) => console.warn('[FabricRenderer] autoColorizeWithImage failed', e))
                    .finally(() => {
                      try {
                        this.grid.options?.onAutoColorizeProgress?.(null)
                      } catch (_) {}
                    })
              }
            } else {
              console.warn('[FabricRenderer] no original element for image')
            }
          } catch(e){ console.warn('缓存背景像素失败', e) }
          cb && cb(fabricImg);
        })
        .catch(e => { console.warn('[FabricRenderer] load image failed', e); cb && cb(null, e) });
  }

  getImageData(){
    if (!this._cachedImageData) console.warn('[FabricRenderer] getImageData no cache yet')
    return this._cachedImageData
  }

  setSize(w, h) {
    console.log('设置画布尺寸:', w, h);
    this.canvas.setWidth(w);
    this.canvas.setHeight(h);
    this._alignBackgroundToGrid();
  }

  getCanvas() {
    return this.canvas;
  }
}
