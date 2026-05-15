// interactionController: centralizes pointer & wheel logic
// Keeps component lean; depends on provided context/state & tool APIs.

export function createInteractionController(ctx){
  const {
    canvasRef,
    activeSide,
    brushMode,
    strokeTool,
    gridTool,
    mergeTool,
    gridLayer,
    tableLayer,
    mergeLayer,
    imageObj,
    gridObj,
    tableObj,
    texts,
    backTexts,
    currentTexts,
    currentActiveText,
    activeMerge,
    activeStrokeLayer,
    activeGrid,
    activeTable,
    activeTextId,
    activeText,
    backActiveTextId,
    backActiveText,
    setActiveText,
    setActiveBackText,
    activateMerge,
    activateGrid,
    activateTable,
    schedulePersist,
    onTextMutated,
    redraw,
    draggingMerge: draggingMergeRef,
    coverImg
  } = ctx;

  let isBrushing = false;
  let currentStroke = null;
  let draggingGrid = false, gridDragDX=0, gridDragDY=0;
  let draggingTable = false, tableDragDX=0, tableDragDY=0;
  let localDraggingMerge=false, dragOffsetX=0, dragOffsetY=0;
  let draggingTextId=null, textDragDX=0, textDragDY=0;

  function setMergeDragging(v){ localDraggingMerge=v; if(draggingMergeRef) draggingMergeRef.value = v; }

  // 边界限制函数：确保对象不会超出封面边界
  function getRotatedBoundsSize(width, height, rotation = 0) {
    const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1)
    const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1)
    const angle = Number(rotation)
    if(!Number.isFinite(angle) || angle === 0) return { width: safeWidth, height: safeHeight }
    const radians = angle * Math.PI / 180
    const sin = Math.abs(Math.sin(radians))
    const cos = Math.abs(Math.cos(radians))
    return {
      width: safeWidth * cos + safeHeight * sin,
      height: safeWidth * sin + safeHeight * cos
    }
  }

  function clampToBounds(x, y, width, height, rotation = 0) {
    if (!coverImg.value) return { x, y }

    const safeWidth = Math.max(1, Number.isFinite(+width) ? +width : 1)
    const safeHeight = Math.max(1, Number.isFinite(+height) ? +height : 1)
    const coverWidth = coverImg.value.width
    const coverHeight = coverImg.value.height

    const rotated = getRotatedBoundsSize(safeWidth, safeHeight, rotation)
    if(rotated.width > coverWidth || rotated.height > coverHeight){
      return {
        x: safeWidth >= coverWidth ? 0 : Math.max(0, Math.min(x, coverWidth - safeWidth)),
        y: safeHeight >= coverHeight ? 0 : Math.max(0, Math.min(y, coverHeight - safeHeight))
      }
    }

    const halfBoundsW = rotated.width / 2
    const halfBoundsH = rotated.height / 2
    const centerX = x + safeWidth / 2
    const centerY = y + safeHeight / 2
    const clampedCenterX = Math.max(halfBoundsW, Math.min(centerX, coverWidth - halfBoundsW))
    const clampedCenterY = Math.max(halfBoundsH, Math.min(centerY, coverHeight - halfBoundsH))

    return {
      x: clampedCenterX - safeWidth / 2,
      y: clampedCenterY - safeHeight / 2
    }
  }

  function getPointerPos(ev){
    const rect = canvasRef.value.getBoundingClientRect();
    const dispX = ev.clientX - rect.left;
    const dispY = ev.clientY - rect.top;
    const realW = canvasRef.value.width;
    const realH = canvasRef.value.height;
    const scaleX = realW / rect.width;
    const scaleY = realH / rect.height;
    return { x: dispX*scaleX, y: dispY*scaleY };
  }

  function onPointerDown(ev){
    if(!canvasRef.value) return;
    ev.preventDefault();
    const p = getPointerPos(ev);
    if(activeSide.value==='back'){
      gridTool.ensureGrid();
      if(brushMode.value){
        isBrushing=true;
        currentStroke = strokeTool.startStroke(p);
        return;
      }
      activeStrokeLayer.value=false;
      // hit texts (reverse order)
      for(let i=backTexts.value.length-1;i>=0;i--){
        const t=backTexts.value[i];
        if(t.hitTest(p.x,p.y,canvasRef.value.getContext('2d'))){
          const textBoxX = Number.isFinite(+t.boxX) ? +t.boxX : (Number.isFinite(+t.x) ? +t.x : 0)
          const textBoxY = Number.isFinite(+t.boxY) ? +t.boxY : ((Number.isFinite(+t.y) ? +t.y : 0) - (Number.isFinite(+t.ascent) ? +t.ascent : 0))
          setActiveBackText(t.id); draggingTextId=t.id; textDragDX=p.x-textBoxX; textDragDY=p.y-textBoxY; return;
        }
      }
      if(gridObj.value && gridObj.value.hitTest(p.x,p.y)){ activateGrid(); draggingGrid=true; gridDragDX=p.x-gridLayer.x; gridDragDY=p.y-gridLayer.y; return }
      if(tableObj.value && tableObj.value.hitTest(p.x,p.y)){ activateTable(); draggingTable=true; tableDragDX=p.x-tableLayer.x; tableDragDY=p.y-tableLayer.y; return }
      activeGrid.value=false; backActiveTextId.value=null; backActiveText.value=null; redraw();
      return;
    }
    // front side
    if(brushMode.value){ isBrushing=true; currentStroke=strokeTool.startStroke(p); return }
    activeStrokeLayer.value=false;
    for(let i=texts.value.length-1;i>=0;i--){
      const t=texts.value[i];
      if(t.hitTest(p.x,p.y,canvasRef.value.getContext('2d'))){
        const textBoxX = Number.isFinite(+t.boxX) ? +t.boxX : (Number.isFinite(+t.x) ? +t.x : 0)
        const textBoxY = Number.isFinite(+t.boxY) ? +t.boxY : ((Number.isFinite(+t.y) ? +t.y : 0) - (Number.isFinite(+t.ascent) ? +t.ascent : 0))
        setActiveText(t.id); draggingTextId=t.id; textDragDX=p.x-textBoxX; textDragDY=p.y-textBoxY; return
      }
    }
    if(imageObj.value && imageObj.value.hitTest(p.x,p.y)){ activateMerge(); setMergeDragging(true); dragOffsetX=p.x-mergeLayer.x; dragOffsetY=p.y-mergeLayer.y; return }
    activeMerge.value=false; setActiveText(null); redraw();
  }

  function onPointerMove(ev){
    const p=getPointerPos(ev);
    if(isBrushing && currentStroke){ strokeTool.extendStroke(currentStroke,p); redraw(); return }
    if(activeSide.value==='back'){
      if(draggingGrid){ 
        const newX = p.x-gridDragDX
        const newY = p.y-gridDragDY
        const scaledWidth = gridLayer.w * gridLayer.scale
        const scaledHeight = gridLayer.h * gridLayer.scale
        const clamped = clampToBounds(newX, newY, scaledWidth, scaledHeight, gridLayer.rotate)
        gridLayer.x = clamped.x
        gridLayer.y = clamped.y
        schedulePersist('grid')
        redraw()
        return
      }
      if(draggingTable){ 
        const newX = p.x-tableDragDX
        const newY = p.y-tableDragDY
        const scaledWidth = tableLayer.w * tableLayer.scale
        const scaledHeight = tableLayer.h * tableLayer.scale
        const clamped = clampToBounds(newX, newY, scaledWidth, scaledHeight, tableLayer.rotate)
        tableLayer.x = clamped.x
        tableLayer.y = clamped.y
        schedulePersist('table')
        redraw()
        return
      }
    }
    if(localDraggingMerge){ 
      const newX = p.x-dragOffsetX
      const newY = p.y-dragOffsetY
      const renderedWidth = (mergeLayer.w || 0) * (mergeLayer.scale || 1)
      const renderedHeight = (mergeLayer.h || 0) * (mergeLayer.scale || 1)
      const clamped = clampToBounds(newX, newY, renderedWidth, renderedHeight, mergeLayer.rotate)
      mergeLayer.x = clamped.x
      mergeLayer.y = clamped.y
      schedulePersist('merge')
      redraw()
      return
    }
    if(draggingTextId){ 
      const arr=currentTexts.value
      const t=arr.find(v=>v.id===draggingTextId)
      if(t){ 
        const newX = p.x-textDragDX
        const newY = p.y-textDragDY
        const textWidth = t.w || 100
        const textHeight = t.h || t.fontSize || 20
        const ascent = t.ascent || textHeight * 0.8
        const clamped = clampToBounds(newX, newY, textWidth, textHeight, t.rotate)
        t.x = clamped.x
        t.y = clamped.y + ascent
        t.boxX = clamped.x
        t.boxY = clamped.y
        t.manualPosition = true
        schedulePersist('text')
        redraw()
      }
    }
  }

  function onPointerUp(){
    if(isBrushing){ isBrushing=false; strokeTool.endStroke(currentStroke); currentStroke=null; }
    if(localDraggingMerge){ setMergeDragging(false); schedulePersist('merge'); }
    if(draggingTextId){ draggingTextId=null; schedulePersist('text'); }
    if(draggingGrid){ draggingGrid=false; schedulePersist('grid'); }
    if(draggingTable){ draggingTable=false; schedulePersist('table'); }
  }
  function onPointerLeave(){ onPointerUp(); }

  function onCanvasWheel(ev){
    const wantsEditWheel = !!(ev.ctrlKey || ev.metaKey || ev.altKey)
    if(!wantsEditWheel) return false
    const p=getPointerPos(ev);
    if(gridTool.handleWheel(p, ev.deltaY)){
      schedulePersist('grid');
      return true;
    }
    if(mergeTool.wheelScale(p, ev.deltaY)) return true;
    if(currentActiveText.value){
      const step = ev.deltaY>0?-5:5;
      currentActiveText.value.fontSize = Math.max(8, currentActiveText.value.fontSize + step);
      if(typeof onTextMutated === 'function') onTextMutated(currentActiveText.value, 'wheel');
      schedulePersist('text');
      redraw();
      return true
    }
    return false
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerLeave, onCanvasWheel };
}
