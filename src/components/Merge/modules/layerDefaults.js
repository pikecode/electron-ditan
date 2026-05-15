// Helper pure functions for computing initial geometry & scale of layers.
// These functions should NOT have side-effects; they just return numbers/objects.

import {
  MERGE_BASE_WIDTH,
  MERGE_WIDTH_RATIO_ON_COVER,
  MERGE_POS_X_RATIO,
  MERGE_POS_Y_RATIO,
  GRID_VERTICAL_MARGIN,
  TABLE_TARGET_HEIGHT_RATIO,
  TABLE_TOP_OFFSET,
  TEXT_DEFAULT_FONT_SIZE,
  FRONT_TEXT_DEFAULT,
  BACK_TEXT_DEFAULT
} from '../../../constants/mergeDefaults.js'

// Compute initial merged image rectangle on front side
// Returns {w,h,scale,x,y}
export function computeMergeInitialRect(coverW, coverH, imgW, imgH){
  if(!imgW || !imgH){
    return { w:0,h:0,scale:1,x:0,y:0 };
  }
  // Target width based on cover width if available, else fallback base width
  let targetW = coverW ? coverW * MERGE_WIDTH_RATIO_ON_COVER : MERGE_BASE_WIDTH;
  // Ensure we do not exceed cover height when scaled (simple pass)
  const aspect = imgH / imgW;
  let targetH = targetW * aspect;
  if(coverH && targetH > coverH){
    // shrink to fit height (rare with chosen ratio, but safe)
    targetH = coverH * 0.9; // leave 10% breathing room
    targetW = targetH / aspect;
  }
  const scale = targetW / imgW;
  const x = coverW ? Math.round(coverW * MERGE_POS_X_RATIO) : Math.round(imgW * MERGE_POS_X_RATIO);
  const y = coverH ? Math.round(coverH * MERGE_POS_Y_RATIO) : Math.round(imgH * MERGE_POS_Y_RATIO);
  return { w:targetW, h:targetH, scale, x, y };
}

// Compute grid scale & position to fit cover height with margin
// Returns {scale,x,y}
export function computeGridInitialTransform(coverW, coverH, baseGridW, baseGridH){
  if(!coverH || !baseGridH){
    return { scale:1,x:0,y:0 };
  }
  const scale = (coverH) / (baseGridH + GRID_VERTICAL_MARGIN);
  return { scale, x:0, y:0 };
}

// Compute table initial transform (scale to 50% cover height, right-top align)
// Returns {scale,x,y,w,h}
export function computeTableInitialTransform(coverW, coverH, baseW, baseH){
  if(!coverH || !baseH){
    return { scale:1,x:0,y:0,w:baseW||0,h:baseH||0 };
  }
  const targetH = coverH * TABLE_TARGET_HEIGHT_RATIO;
  const scale = targetH / baseH;
  const w = baseW * scale;
  const h = baseH * scale;
  const x = coverW - w; // right align
  const y = TABLE_TOP_OFFSET;
  return { scale,x,y,w,h };
}

// Compute initial centered text placement
// Returns {x,y,fontSize,text}
export function computeInitialTextPlacement(coverW, coverH, textWidth, fontSize = TEXT_DEFAULT_FONT_SIZE, side='front'){
  const x = Math.round(coverW/2 - textWidth/2);
  const y = Math.round(coverH/2 + fontSize/2);
  const text = side === 'front' ? FRONT_TEXT_DEFAULT : BACK_TEXT_DEFAULT;
  return { x,y,fontSize,text };
}
