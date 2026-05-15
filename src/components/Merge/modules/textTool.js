// textTool: encapsulates text creation & mutation for front/back sides
// Keeps logic pure; side switching handled by caller via activeSide ref.

import { FRONT_TEXT_DEFAULT, BACK_TEXT_DEFAULT, TEXT_DEFAULT_FONT_SIZE } from '../../../constants/mergeDefaults.js'
import { TextObject } from '../core/objects.js'
import { computeCenteredTextLayout, getTextMeasureContext, resolveTextFontFamily } from '../../../core/textLayout.js'

export function createTextTool(ctx){
  const { activeSide, coverImg, texts, backTexts, schedulePersist, redraw, setActiveFrontText, setActiveBackText } = ctx;

  function currentList(){ return activeSide.value==='front'? texts.value : backTexts.value; }

  function addText(){
    if(!coverImg.value) return null;
    const id = Date.now()+Math.random().toString(36).slice(2);
    const baseText = activeSide.value==='front'? FRONT_TEXT_DEFAULT : BACK_TEXT_DEFAULT;
    const fontSize = TEXT_DEFAULT_FONT_SIZE;
    const t = new TextObject({ id, text: baseText, x:0,y:0,fontSize,color:'#222222', fontFamily: resolveTextFontFamily(), weight:'bold' });
    const ctx2d = getTextMeasureContext();
    const layout = computeCenteredTextLayout(
      { x: 0, y: 0, width: coverImg.value.width, height: coverImg.value.height },
      t.text,
      { fontSize: t.fontSize, fontFamily: t.fontFamily, weight: t.weight },
      ctx2d
    );
    t.x = layout.left;
    t.y = layout.baselineY;
    t.w = layout.width;
    t.h = layout.height;
    t.ascent = layout.ascent;
    t.descent = layout.descent;
    if(activeSide.value==='front') { texts.value.push(t); setActiveFrontText(id); }
    else { backTexts.value.push(t); setActiveBackText(id); }
    schedulePersist('text');
    redraw();
    return t;
  }

  function removeText(id){ if(!id) return; const list = currentList(); const idx = list.findIndex(t=>t.id===id); if(idx>=0){ list.splice(idx,1); schedulePersist('text'); redraw(); } }

  function toggleBold(id){ const list=currentList(); const t=list.find(v=>v.id===id); if(!t) return; t.weight = t.weight==='bold'? 'normal':'bold'; schedulePersist('text'); redraw(); }

  function updateText(id, patch){ const list=currentList(); const t=list.find(v=>v.id===id); if(!t) return; Object.assign(t, patch); schedulePersist('text'); redraw(); }

  return { addText, removeText, toggleBold, updateText };
}
