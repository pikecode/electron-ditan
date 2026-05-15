// Renderer controller: centralizes redraw batching & state sync into CoverRenderer
// Usage: const rc = createRendererController({ canvasRef, coverImg, ... }); rc.requestRedraw('reason');

import { MERGE_DEBUG } from '../../../constants/mergeDefaults.js'
import { CoverRenderer } from '../core/renderer.js'

export function createRendererController(ctx){
  const { canvasRef, coverImg, imageObj, mergeLayer, gridLayer, tableLayer, gridObj, tableObj, strokeLayerObj, activeSide, currentTexts, currentActiveText, activeMerge, activeGrid, activeTable, currentStrokes, suppressSelectionOutlines } = ctx;

  let renderer = null;
  let ctx2d = null;
  let rafId = null;

  function ensure(){
    if(!canvasRef.value) return false;
    if(!ctx2d){ ctx2d = canvasRef.value.getContext('2d'); }
    if(ctx2d && !renderer){ renderer = new CoverRenderer(ctx2d); }
    return !!(ctx2d && renderer);
  }

  function syncImageObject(){
    if(!imageObj.value) return;
    Object.assign(imageObj.value, { x:mergeLayer.x, y:mergeLayer.y, w:mergeLayer.w, h:mergeLayer.h, scale:mergeLayer.scale, rotate:mergeLayer.rotate });
  }

  function buildState(){
    return {
      side: activeSide.value,
      coverImg: coverImg.value,
      imageObj: activeSide.value==='front'? imageObj.value : null,
      gridObj: activeSide.value==='back'? gridObj.value : null,
      tableObj: activeSide.value==='back'? tableObj.value : null,
      strokeLayer: strokeLayerObj,
      texts: currentTexts.value,
      activeText: currentActiveText.value,
      activeMerge: activeMerge.value,
      canvasHover: !suppressSelectionOutlines?.value,
      activeGrid: activeGrid.value,
      activeTable: activeTable.value
    };
  }

  function drawSelectionOutlines(state){
    if(!renderer || suppressSelectionOutlines?.value) return;
    if(state.side === 'front' && state.activeMerge && state.imageObj){
      renderer.drawMergeOutline(state.imageObj, state);
    }
    if(state.activeText){
      renderer.drawActiveTextOutline(state.activeText);
    }
    if(state.side === 'back' && state.activeGrid && state.gridObj){
      renderer.drawActiveGridOutline(state.gridObj);
    }
    if(state.side === 'back' && state.activeTable && state.tableObj){
      renderer.drawActiveTableOutline(state.tableObj);
    }
  }

  function redrawInternal(){
    rafId = null;
    if(!ensure()) return;
    if(!coverImg.value) return;
    const canvas = canvasRef.value;
    canvas.width = coverImg.value.width;
    canvas.height = coverImg.value.height;
    // sync objects
    syncImageObject();
    if(gridObj.value){ gridObj.value.scale = gridLayer.scale; gridObj.value.x = gridLayer.x; gridObj.value.y = gridLayer.y; gridObj.value.rotate = gridLayer.rotate; }
    if(tableObj.value){ tableObj.value.scale = tableLayer.scale; tableObj.value.x = tableLayer.x; tableObj.value.y = tableLayer.y; tableObj.value.rotate = tableLayer.rotate; }
    strokeLayerObj.strokes = currentStrokes.value;
    const state = buildState();
    renderer.render(state);
    drawSelectionOutlines(state);
  }

  function requestRedraw(reason='unknown'){
    if(MERGE_DEBUG) console.log('[rendererController] requestRedraw:', reason);
    if(rafId) return; // already scheduled
    rafId = requestAnimationFrame(redrawInternal);
  }

  return { requestRedraw, forceRedraw: redrawInternal, getCtx: ()=>ctx2d };
}
