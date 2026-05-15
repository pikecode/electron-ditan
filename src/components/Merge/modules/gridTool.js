// gridTool: manages back-side grid generation & scaling
import { GRID_MIN_SCALE, GRID_MAX_SCALE, MERGE_DEBUG } from '../../../constants/mergeDefaults.js'
import { GridGenerator } from '../../../core/grid/GridGenerator.js'
import { GridObject } from '../../../core/grid/GridObject.js'

export function createGridTool(ctx){
  const { activeSide, coverImg, gridLayer, gridObj, gridGenerator, activeGrid, cellsData, selectedProject, setCellsData, redraw } = ctx;

  function getRotatedBoundsSize(width, height, rotation = 0){
    const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1);
    const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1);
    const angle = Number(rotation);
    if(!Number.isFinite(angle) || angle === 0){
      return { width: safeWidth, height: safeHeight };
    }
    const radians = angle * Math.PI / 180;
    const sin = Math.abs(Math.sin(radians));
    const cos = Math.abs(Math.cos(radians));
    return {
      width: safeWidth * cos + safeHeight * sin,
      height: safeWidth * sin + safeHeight * cos
    };
  }

  function rotateVector(x, y, radians){
    return {
      x: (x * Math.cos(radians)) - (y * Math.sin(radians)),
      y: (x * Math.sin(radians)) + (y * Math.cos(radians))
    };
  }

  function resolveScaleAnchor(pointer, x, y, width, height, rotation = 0){
    if(width <= 0 || height <= 0){
      return { xRatio: 0.5, yRatio: 0.5 };
    }
    const radians = Number.isFinite(+rotation) ? (+rotation * Math.PI / 180) : 0;
    const centerX = x + (width / 2);
    const centerY = y + (height / 2);
    const local = rotateVector(pointer.x - centerX, pointer.y - centerY, -radians);
    return {
      xRatio: (local.x + (width / 2)) / width,
      yRatio: (local.y + (height / 2)) / height
    };
  }

  function resolveScaledTopLeft(pointer, anchor, width, height, rotation = 0){
    const radians = Number.isFinite(+rotation) ? (+rotation * Math.PI / 180) : 0;
    const localX = (anchor?.xRatio ?? 0.5) * width;
    const localY = (anchor?.yRatio ?? 0.5) * height;
    const offset = rotateVector(localX - (width / 2), localY - (height / 2), radians);
    const centerX = pointer.x - offset.x;
    const centerY = pointer.y - offset.y;
    return {
      x: centerX - (width / 2),
      y: centerY - (height / 2)
    };
  }

  function ensureGrid(opts={}){
    if(activeSide.value !== 'back') return;
    const placement = opts.placement || null; // {x,y,w,h,has}
    const hasPlacement = !!(placement && placement.has && placement.w>0 && placement.h>0);
    // acquire cells
    let cellsToUse = cellsData?.value;
    if(!cellsToUse && selectedProject.value?.result?.cells){
      cellsToUse = selectedProject.value.result.cells;
      if(setCellsData) setCellsData(cellsToUse);
    }
    if(!cellsToUse) { if(MERGE_DEBUG) console.warn('[gridTool] no cells'); return; }
    if(!gridGenerator.value) gridGenerator.value = new GridGenerator(cellsToUse);
    if(!gridObj.value){
      if(!hasPlacement){
        if(MERGE_DEBUG) console.warn('[gridTool] missing placement, skip create');
        return;
      }
      const bmp = gridGenerator.value.generate(1);
      if(!bmp) return;
      gridLayer.w = bmp.width; gridLayer.h = bmp.height; // base size
      const fitScale = Math.min(placement.w / gridLayer.w, placement.h / gridLayer.h);
      gridLayer.scale = isFinite(fitScale) && fitScale>0 ? fitScale : 1;
      gridLayer.rotate = Number.isFinite(+placement.rotation) ? +placement.rotation : gridLayer.rotate;
      gridLayer.x = Number.isFinite(+placement.x) ? +placement.x : 0;
      gridLayer.y = Number.isFinite(+placement.y) ? +placement.y : 0;
      if(MERGE_DEBUG) console.log('[gridTool] placement fit scale=', gridLayer.scale, 'rect=', placement);
      gridObj.value = new GridObject({ bitmap: bmp.canvas, baseW: bmp.width, baseH: bmp.height });
      gridObj.value.x = gridLayer.x; gridObj.value.y = gridLayer.y; gridObj.value.scale = gridLayer.scale; gridObj.value.rotate = gridLayer.rotate;
      activeGrid.value = true;
      if(gridLayer.scale !== 1) regenerateGrid();
      if(MERGE_DEBUG) console.log('[gridTool] grid created');
    }
  }

  function regenerateGrid(){
    if(!gridGenerator.value || !gridObj.value) return;
    const bmp = gridGenerator.value.generate(gridLayer.scale);
    if(!bmp) return;
    gridObj.value.bitmap = bmp.canvas;
    gridObj.value.scale = gridLayer.scale;
    redraw();
  }

  function handleWheel(p, delta){
    if(activeSide.value !== 'back' || !activeGrid.value || !gridObj.value) return false;
    const scaleDelta = delta > 0 ? 0.9 : 1.1;
    const newScale = Math.min(GRID_MAX_SCALE, Math.max(GRID_MIN_SCALE, gridLayer.scale * scaleDelta));
    if(newScale === gridLayer.scale) return true;
    const currentWidth = gridLayer.w * gridLayer.scale;
    const currentHeight = gridLayer.h * gridLayer.scale;
    const anchor = resolveScaleAnchor(p, gridLayer.x, gridLayer.y, currentWidth, currentHeight, gridLayer.rotate);
    gridLayer.scale = newScale;
    
    // 计算新位置
    const nextWidth = gridLayer.w * gridLayer.scale;
    const nextHeight = gridLayer.h * gridLayer.scale;
    let newX = resolveScaledTopLeft(p, anchor, nextWidth, nextHeight, gridLayer.rotate).x;
    let newY = resolveScaledTopLeft(p, anchor, nextWidth, nextHeight, gridLayer.rotate).y;
    
    // 应用边界限制
    if(coverImg.value) {
      const width = gridLayer.w * gridLayer.scale;
      const height = gridLayer.h * gridLayer.scale;
      const coverWidth = coverImg.value.width;
      const coverHeight = coverImg.value.height;
      const rotated = getRotatedBoundsSize(width, height, gridLayer.rotate);
      if(rotated.width > coverWidth || rotated.height > coverHeight){
        const minX = 0;
        const maxX = coverWidth - width;
        const minY = 0;
        const maxY = coverHeight - height;
        if(width >= coverWidth) {
          newX = 0;
        } else {
          newX = Math.max(minX, Math.min(newX, maxX));
        }
        if(height >= coverHeight) {
          newY = 0;
        } else {
          newY = Math.max(minY, Math.min(newY, maxY));
        }
      } else {
        const centerX = newX + width / 2;
        const centerY = newY + height / 2;
        newX = Math.max(rotated.width / 2, Math.min(centerX, coverWidth - rotated.width / 2)) - width / 2;
        newY = Math.max(rotated.height / 2, Math.min(centerY, coverHeight - rotated.height / 2)) - height / 2;
      }
    }
    
    gridLayer.x = newX;
    gridLayer.y = newY;

    regenerateGrid();
    return true;
  }

  return { ensureGrid, regenerateGrid, handleWheel };
}
