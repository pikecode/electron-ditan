// Debounced persistence scheduler for cover compose state
// Context requirements passed in factory to avoid direct coupling with component.

import { PERSIST_DEBOUNCE_MS, MERGE_DEBUG } from '../../../constants/mergeDefaults.js'

export function createPersistScheduler(ctx){
  const {
    mergeLayer,        // reactive merge layer
    gridLayer,         // reactive back grid layer
    tableLayer,        // reactive back table layer
    texts,             // ref([]) front texts
    backTexts,         // ref([]) back texts
    strokes,           // ref([]) front strokes
    backStrokes,       // ref([]) back strokes
    coverFrontDesign,  // reactive snapshot meta
    updateCoverFrontDesign, // store method
    selectedCoverId    // ref cover id
  } = ctx;

  let timer = null;
  let pendingKinds = new Set(); // record which kinds triggered (merge|text|strokes|auto)
  let lastSnapshot = null;

  function cloneTextList(list){
    return Array.isArray(list) ? list.map(item => ({ ...item })) : [];
  }

  function cloneStrokeList(list){
    return Array.isArray(list)
      ? list.map(stroke => ({
          ...stroke,
          points: Array.isArray(stroke?.points) ? stroke.points.map(point => ({ ...point })) : []
        }))
      : [];
  }

  function cloneLayerState(layer, defaults = {}){
    return { ...defaults, ...(layer || {}) };
  }

  function cloneSnapshot(snapshot){
    return {
      coverId: snapshot.coverId,
      coverUpdatedAt: snapshot.coverUpdatedAt ?? null,
      hasSnapshot: snapshot.hasSnapshot === true,
      merge: { ...(snapshot.merge || {}) },
      grid: cloneLayerState(snapshot.grid, { x: 0, y: 0, w: 0, h: 0, scale: 1, rotate: 0 }),
      table: cloneLayerState(snapshot.table, { x: 0, y: 0, w: 0, h: 0, scale: 1, rotate: 0, columns: 1, maxRowsPerTable: 15 }),
      texts: cloneTextList(snapshot.texts),
      backTexts: cloneTextList(snapshot.backTexts),
      strokes: cloneStrokeList(snapshot.strokes),
      backStrokes: cloneStrokeList(snapshot.backStrokes)
    };
  }

  function buildSnapshot(){
    return cloneSnapshot({
      coverId: selectedCoverId.value,
      coverUpdatedAt: coverFrontDesign?.coverUpdatedAt ?? null,
      hasSnapshot: true,
      merge: mergeLayer,
      grid: gridLayer,
      table: tableLayer,
      texts: texts.value,
      backTexts: backTexts.value,
      strokes: strokes.value,
      backStrokes: backStrokes.value
    })
  }

  function sameText(a, b){
    if(!a || !b) return false;
    const keys = [
      'id', 'text', 'x', 'y', 'w', 'h', 'fontSize', 'color', 'weight', 'fontFamily',
      'align', 'rotate', 'manualPosition', 'placementId', 'placementX', 'placementY',
      'placementW', 'placementH', 'placementRotation', 'boxX', 'boxY', 'ascent',
      'descent', 'baseline'
    ];
    return keys.every(key => a[key] === b[key]);
  }

  function sameTextList(prev = [], next = []){
    if(prev.length !== next.length) return false;
    for(let i = 0; i < next.length; i++){
      if(!sameText(prev[i], next[i])) return false;
    }
    return true;
  }

  function sameStroke(a, b){
    if(!a || !b) return false;
    if(a.color !== b.color || a.size !== b.size) return false;
    const prevPoints = Array.isArray(a.points) ? a.points : [];
    const nextPoints = Array.isArray(b.points) ? b.points : [];
    if(prevPoints.length !== nextPoints.length) return false;
    for(let i = 0; i < nextPoints.length; i++){
      if(prevPoints[i]?.x !== nextPoints[i]?.x || prevPoints[i]?.y !== nextPoints[i]?.y) return false;
    }
    return true;
  }

  function sameStrokeList(prev = [], next = []){
    if(prev.length !== next.length) return false;
    for(let i = 0; i < next.length; i++){
      if(!sameStroke(prev[i], next[i])) return false;
    }
    return true;
  }

  function diffChanged(newSnap){
    if(!lastSnapshot) return true;
    // shallow compare essential properties
    if(lastSnapshot.coverId !== newSnap.coverId) return true;
    if(lastSnapshot.coverUpdatedAt !== newSnap.coverUpdatedAt) return true;
    const aM = lastSnapshot.merge, bM = newSnap.merge;
    const mergeKeys = ['x','y','w','h','scale','rotate'];
    for(const k of mergeKeys){ if(aM[k] !== bM[k]) return true; }
    const aG = lastSnapshot.grid, bG = newSnap.grid;
    const gridKeys = ['x','y','w','h','scale','rotate'];
    for(const k of gridKeys){ if(aG[k] !== bG[k]) return true; }
    const aT = lastSnapshot.table, bT = newSnap.table;
    const tableKeys = ['x','y','w','h','scale','rotate','columns','maxRowsPerTable'];
    for(const k of tableKeys){ if(aT[k] !== bT[k]) return true; }
    if(!sameTextList(lastSnapshot.texts, newSnap.texts)) return true;
    if(!sameTextList(lastSnapshot.backTexts, newSnap.backTexts)) return true;
    if(!sameStrokeList(lastSnapshot.strokes, newSnap.strokes)) return true;
    if(!sameStrokeList(lastSnapshot.backStrokes, newSnap.backStrokes)) return true;
    return false;
  }

  function flush(){
    const snap = buildSnapshot();
    if(!diffChanged(snap)) { if(MERGE_DEBUG) console.log('[persistScheduler] no diff, skip'); pendingKinds.clear(); return; }
    if(MERGE_DEBUG) console.log('[persistScheduler] persist', [...pendingKinds]);
    updateCoverFrontDesign(snap);
    lastSnapshot = cloneSnapshot(snap);
    pendingKinds.clear();
  }

  function schedule(kind='auto'){
    pendingKinds.add(kind);
    if(timer) clearTimeout(timer);
    timer = setTimeout(()=>{ timer=null; flush(); }, PERSIST_DEBOUNCE_MS);
  }

  function reset(snapshot = null){
    if(timer){
      clearTimeout(timer);
      timer = null;
    }
    pendingKinds.clear();
    lastSnapshot = snapshot ? cloneSnapshot(snapshot) : null;
  }

  return { schedule, flush, reset };
}
