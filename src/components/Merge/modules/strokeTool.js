// strokeTool: manages stroke arrays for front/back & brush mode

import { BRUSH_DEFAULT_SIZE, BRUSH_DEFAULT_COLOR } from '../../../constants/mergeDefaults.js'

export function createStrokeTool(ctx){
  const { activeSide, strokes, backStrokes, schedulePersist, redraw } = ctx;

  const brushMode = ctx.brushMode; // ref(boolean)
  const brushColor = ctx.brushColor; // ref
  const brushSize = ctx.brushSize; // ref

  function toggleBrushMode(){ brushMode.value = !brushMode.value; if(brushMode.value) { /* ensure selection external if needed */ } redraw(); }

  function clearCurrent(){ const arr = activeSide.value==='front'? strokes.value : backStrokes.value; if(!arr.length) return; arr.splice(0,arr.length); schedulePersist('strokes'); redraw(); }

  function startStroke(p){ const stroke = { color: brushColor.value, size: brushSize.value, points: [p] }; const arr = activeSide.value==='front'? strokes.value : backStrokes.value; arr.push(stroke); redraw(); return stroke; }
  function extendStroke(stroke,p){ stroke.points.push(p); }
  function endStroke(stroke){ schedulePersist('strokes'); }

  // init defaults
  if(!brushColor.value) brushColor.value = BRUSH_DEFAULT_COLOR;
  if(!brushSize.value) brushSize.value = BRUSH_DEFAULT_SIZE;

  return { toggleBrushMode, clearCurrent, startStroke, extendStroke, endStroke };
}
