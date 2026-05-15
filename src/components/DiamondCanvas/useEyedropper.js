import { ref, nextTick, watch } from 'vue'
import { findNearestPaletteAll } from './useColorUtils'

// Eyedropper (color picker) composable
export function useEyedropper({ diamondCanvas, canvasContainer, getPaletteColors, zoomScale, canvasTopLeft }) {
  const eyedropperActive = ref(false)
  const eyedropper = ref({ visible:false, x:0, y:0, row:null, col:null, finalColor:null, nearest:null, nearestList:[] })
  // 保存逻辑像素与格子信息 (canvas 内部 pointer.x/y)
  const logicalPos = { canvasX:0, canvasY:0, row:null, col:null, has:false }
  let eyedropperListenerBound = false
  let lastPopoverSize = { w:260, h:140 }

  function computeSafePosition(baseX, baseY, rect) {
    const margin = 6
    const w = lastPopoverSize.w
    const h = lastPopoverSize.h
    let x = baseX
    let y = baseY
    // 横向: 如果越过右边界, 改为显示在指针左侧, 仅留 10px 间距
    if (x + w + margin > rect.width) {
      x = baseX - w - 10
    }
    // 纵向: 如果越过下边界, 改为显示在指针上方
    if (y + h + margin > rect.height) {
      y = baseY - h - 10
    }
    // 避免再被整体压缩导致远离鼠标, 只做最小边界修正
    if (x < margin) x = margin
    if (y < margin) y = margin
    return { x, y }
  }
  function measurePopoverLater(){ nextTick(()=>{ try{ const c=canvasContainer.value; if(!c) return; const el=c.querySelector('.eyedropper-popover'); if(el){ const br=el.getBoundingClientRect(); if(br.width>10&&br.height>10) lastPopoverSize={w:br.width,h:br.height} } }catch(_){} }) }

  function positionFromLogical(){
    const c = canvasContainer.value
    if(!c || !logicalPos.has) return
    const baseX = logicalPos.canvasX + 10
    const baseY = logicalPos.canvasY + 10
    const safe = computeSafePosition(baseX, baseY, { width: c.clientWidth, height: c.clientHeight })
    eyedropper.value.x = safe.x
    eyedropper.value.y = safe.y
  }

  function updateEyedropperOverlayFromEvent(evt){
    if(!eyedropperActive.value || !diamondCanvas.value) return
    const nativeEvt = (evt && (evt.e || evt)) || evt
    if(!nativeEvt) return
    const info = diamondCanvas.value.getColorInfoForPointerEvent(nativeEvt)
    if(!info){ eyedropper.value.visible=false; return }
    logicalPos.canvasX = info.canvasX ?? nativeEvt.offsetX ?? 0
    logicalPos.canvasY = info.canvasY ?? nativeEvt.offsetY ?? 0
    logicalPos.row = info.row; logicalPos.col = info.col; logicalPos.has = true
    const palette = getPaletteColors()
    const nearestList = info.finalColor ? findNearestPaletteAll(info.finalColor, palette):[]
    console.log('nearestList', nearestList)
    // 提取第一个最近颜色的 code
    let firstNearestCode = null
    if (nearestList.length > 0) {
      firstNearestCode = nearestList[0]?.entry?.code || null
      let color = nearestList[0]?.entry?.hex || null
      if (color != null && firstNearestCode != null) {
         diamondCanvas.value.SetNowSlectedColor(color, firstNearestCode)
         // 派发全局事件供调色板组件更新选中展示
         try { window.dispatchEvent(new CustomEvent('eyedropper-color-selected', { detail:{ code:firstNearestCode, hex:color } })) } catch(_) {}
      }
      console.log('[Eyedropper] firstNearestCode', firstNearestCode)
    }
    eyedropper.value = {
      visible:true,
      x:eyedropper.value.x,
      y:eyedropper.value.y,
      row:info.row,
      col:info.col,
      finalColor:info.finalColor,
      nearest: nearestList[0] ? nearestList[0].entry : null,
      nearestList,
      firstNearestCode
    }
    positionFromLogical()
    measurePopoverLater()
  }

  function handleEyedropperToggle(active){
    eyedropperActive.value = !!active
    if(diamondCanvas.value?.setEyedropperEnabled) diamondCanvas.value.setEyedropperEnabled(eyedropperActive.value)
    tryBindListener()
    if(!eyedropperActive.value){ eyedropper.value.visible=false; tryUnbindListener() } else { positionFromLogical() }
  }

  function tryBindListener(){
    const fc = diamondCanvas.value?.getFabricCanvas?.()
    if(!fc || !fc.upperCanvasEl) return
    if(eyedropperActive.value && !eyedropperListenerBound){ fc.upperCanvasEl.addEventListener('mousemove', updateEyedropperOverlayFromEvent); eyedropperListenerBound=true }
  }
  function tryUnbindListener(){
    const fc = diamondCanvas.value?.getFabricCanvas?.()
    if(!fc || !fc.upperCanvasEl) return
    if(eyedropperListenerBound){ fc.upperCanvasEl.removeEventListener('mousemove', updateEyedropperOverlayFromEvent); eyedropperListenerBound=false }
  }

  function destroyEyedropper(){ tryUnbindListener() }

  // 缩放或滚动后根据逻辑坐标重新定位
  watch([zoomScale, canvasTopLeft], ()=>{ if(eyedropperActive.value) positionFromLogical() })
  if(typeof window!=='undefined') window.addEventListener('scroll', ()=>{ if(eyedropperActive.value) positionFromLogical() }, { passive:true })

  return { eyedropperActive, eyedropper, handleEyedropperToggle, updateEyedropperOverlayFromEvent, onContainerMouseEnter(){ if(!eyedropperActive.value) return; eyedropper.value.visible=true }, onContainerMouseLeave(){ eyedropper.value.visible=false }, tryBindListener, destroyEyedropper }
}
