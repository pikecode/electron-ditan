// Lightweight event bus (no external dependency)
// Usage: import bus from './eventBus'; bus.on('redraw', cb); bus.emit('redraw', payload)
// Kept intentionally minimal; can be swapped with mitt later.

const _map = new Map(); // event -> Set<handler>

function on(event, handler){
  let set = _map.get(event);
  if(!set){ set = new Set(); _map.set(event,set); }
  set.add(handler);
  return () => off(event, handler);
}

function off(event, handler){
  const set = _map.get(event);
  if(!set) return;
  set.delete(handler);
  if(set.size===0) _map.delete(event);
}

function emit(event, payload){
  const set = _map.get(event);
  if(!set) return;
  // copy to array to avoid mutation issues during iteration
  [...set].forEach(fn=>{ try{ fn(payload);}catch(e){ console.warn('[eventBus] handler error', event, e);} });
}

export const EVENTS = Object.freeze({
  SIDE_CHANGED: 'sideChanged',
  REDRAW_REQUEST: 'redrawRequest',
  PERSIST_REQUEST: 'persistRequest',
  SELECTION_CHANGED: 'selectionChanged'
});

export default { on, off, emit, EVENTS };
