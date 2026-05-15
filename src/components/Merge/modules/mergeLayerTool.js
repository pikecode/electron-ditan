// mergeLayerTool: front-side composite image utilities
import { MERGE_MIN_SCALE, MERGE_MAX_SCALE, MERGE_POS_X_RATIO, MERGE_POS_Y_RATIO, MERGE_WIDTH_RATIO_ON_COVER, MERGE_BASE_WIDTH, MERGE_DEBUG } from '../../../constants/mergeDefaults.js'

export function createMergeLayerTool(ctx){
  const { coverImg, mergedBitmap, mergeLayer, activeSide, schedulePersist, redraw, effectPlacementRect } = ctx;

  function syncBitmapSize(){
    if(!mergedBitmap.value) return false;
    mergeLayer.w = mergedBitmap.value.width || 0;
    mergeLayer.h = mergedBitmap.value.height || 0;
    return !!(mergeLayer.w && mergeLayer.h);
  }

  function getRenderedSize(scale = mergeLayer.scale){
    return {
      width: (mergeLayer.w || 0) * scale,
      height: (mergeLayer.h || 0) * scale
    };
  }

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

  function clampPosition(x, y, scale = mergeLayer.scale){
    if(!coverImg.value) return { x, y };
    const coverWidth = coverImg.value.width;
    const coverHeight = coverImg.value.height;
    const { width, height } = getRenderedSize(scale);
    const rotated = getRotatedBoundsSize(width, height, mergeLayer.rotate);
    if(rotated.width > coverWidth || rotated.height > coverHeight){
      const minX = 0;
      const maxX = coverWidth - width;
      const minY = 0;
      const maxY = coverHeight - height;
      return {
        x: width >= coverWidth ? 0 : Math.max(minX, Math.min(x, maxX)),
        y: height >= coverHeight ? 0 : Math.max(minY, Math.min(y, maxY))
      };
    }
    const halfBoundsW = rotated.width / 2;
    const halfBoundsH = rotated.height / 2;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    return {
      x: Math.max(halfBoundsW, Math.min(centerX, coverWidth - halfBoundsW)) - width / 2,
      y: Math.max(halfBoundsH, Math.min(centerY, coverHeight - halfBoundsH)) - height / 2
    };
  }

  function fitToPlacement(resetPosition = true){
    if(!syncBitmapSize()) return false;
    const rect = effectPlacementRect;
    const hasPlacement = !!(rect && rect.has && rect.w > 0 && rect.h > 0);
    if(!hasPlacement) return false;
    let scale = Math.min(rect.w / mergeLayer.w, rect.h / mergeLayer.h);
    if(!isFinite(scale) || scale <= 0) return false;
    scale = Math.min(MERGE_MAX_SCALE, Math.max(MERGE_MIN_SCALE, scale));
    mergeLayer.scale = scale;
    if(resetPosition){
      mergeLayer.x = rect.x;
      mergeLayer.y = rect.y;
    } else {
      const clamped = clampPosition(mergeLayer.x, mergeLayer.y, scale);
      mergeLayer.x = clamped.x;
      mergeLayer.y = clamped.y;
    }
    return true;
  }

  function reset(persist=true){
    if(!mergedBitmap.value) return;
    const img = mergedBitmap.value;

    if(fitToPlacement(true)){
      mergeLayer.rotate = Number.isFinite(+effectPlacementRect?.rotation) ? +effectPlacementRect.rotation : 0;
      if(persist) schedulePersist && schedulePersist('merge');
      redraw && redraw('merge-reset');
      return;
    }

    if(coverImg.value){
      const GRID_COLS = 4, GRID_ROWS = 3;
      const TARGET_COL = 3, TARGET_ROW = 2; // 1-based indices
      const blockW = coverImg.value.width / GRID_COLS;
      const blockH = coverImg.value.height / GRID_ROWS;
      // scale so that merged image width exactly equals one block width
      let scale = blockW / img.width;
      scale = scale + 0.1
      // clamp scale
      scale = Math.min(MERGE_MAX_SCALE, Math.max(MERGE_MIN_SCALE, scale));
      mergeLayer.scale = scale;
      mergeLayer.w = img.width;
      mergeLayer.h = img.height;
      // position at cell top-left (col 3, row 2)
      mergeLayer.x = (TARGET_COL - 1) * blockW + 300;
      mergeLayer.y = (TARGET_ROW - 1) * blockH + 80; 
    } else {
      // fallback (no cover): keep previous fixed width logic
      const TARGET_WIDTH = 600;
      let scale = TARGET_WIDTH / img.width;
      if(isFinite(scale)){
        scale = Math.min(MERGE_MAX_SCALE, Math.max(MERGE_MIN_SCALE, scale));
        mergeLayer.scale = scale;
        mergeLayer.w = img.width;
        mergeLayer.h = img.height;
        mergeLayer.x = 0; mergeLayer.y = 0;
      }
    }
    mergeLayer.rotate = 0;
    if(persist) schedulePersist && schedulePersist('merge');
    redraw && redraw('merge-reset');
  }

  function nudgeScale(f){
    mergeLayer.scale = Math.min(MERGE_MAX_SCALE, Math.max(MERGE_MIN_SCALE, mergeLayer.scale * f));
    const clamped = clampPosition(mergeLayer.x, mergeLayer.y, mergeLayer.scale);
    mergeLayer.x = clamped.x;
    mergeLayer.y = clamped.y;
    schedulePersist('merge');
    redraw();
  }

  function wheelScale(p, delta){
    if(activeSide.value!=='front' || !mergedBitmap.value) return false;
    if(!syncBitmapSize()) return false;
    const factor = delta>0?0.9:1.1;
    const currentWidth = (mergeLayer.w || 0) * mergeLayer.scale;
    const currentHeight = (mergeLayer.h || 0) * mergeLayer.scale;
    const anchor = resolveScaleAnchor(p, mergeLayer.x, mergeLayer.y, currentWidth, currentHeight, mergeLayer.rotate);
    const newScale = Math.min(MERGE_MAX_SCALE, Math.max(MERGE_MIN_SCALE, mergeLayer.scale*factor));
    if(newScale===mergeLayer.scale) return true;
    const nextWidth = (mergeLayer.w || 0) * newScale;
    const nextHeight = (mergeLayer.h || 0) * newScale;
    const nextPos = resolveScaledTopLeft(p, anchor, nextWidth, nextHeight, mergeLayer.rotate);
    mergeLayer.scale=newScale;
    const clamped = clampPosition(nextPos.x, nextPos.y, newScale);
    mergeLayer.x = clamped.x;
    mergeLayer.y = clamped.y;
    schedulePersist('merge'); redraw();
    return true;
  }

  return { reset, nudgeScale, wheelScale, fitToPlacement };
}
