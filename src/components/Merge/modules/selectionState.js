// Unified selection state abstraction
// selection = { type: 'merge'|'text'|'grid'|'table'|'strokes'|null, id?: string }
// Provides helper predicates for template logic.

import bus, { EVENTS } from './eventBus.js'

const selection = { type: null, id: null };

export function setSelection(type, id=null){
  selection.type = type;
  selection.id = id || null;
  bus.emit(EVENTS.SELECTION_CHANGED, { ...selection });
}

export function clearSelection(){ setSelection(null,null); }

export function isActive(type){ return selection.type === type; }

export function getSelection(){ return selection; }

// Convenience helpers matching previous flags
export function activateMerge(){ setSelection('merge'); }
export function activateGrid(){ setSelection('grid'); }
export function activateTable(){ setSelection('table'); }
export function activateStrokes(){ setSelection('strokes'); }
export function activateText(id){ setSelection('text', id); }
