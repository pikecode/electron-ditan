<template>
  <div class="rulers-wrapper" v-if="show" :style="wrapperStyle">
    <div class="corner"></div>
    <!-- Horizontal ruler (fixed) -->
    <div class="ruler horizontal">
      <div class="ticks-layer horizontal" :style="hTicksStyle">
        <div v-for="tick in xTicks" :key="'x-'+tick.index" class="tick" :class="{ major: tick.isMajor, first: tick.index===0 }" :style="{ left: tick.pos+'px' }">
          <span v-if="tick.isMajor" class="label">{{ tick.index }}</span>
        </div>
      </div>
    </div>
    <!-- Vertical ruler (fixed) -->
    <div class="ruler vertical">
      <div class="ticks-layer vertical" :style="vTicksStyle">
        <div v-for="tick in yTicks" :key="'y-'+tick.index" class="tick" :class="{ major: tick.isMajor, first: tick.index===0 }" :style="{ top: tick.pos+'px' }">
          <span v-if="tick.isMajor" class="label">{{ tick.index }}</span>
        </div>
      </div>
    </div>
    <!-- Crosshair (converted to container coords) -->
    <div v-if="mouseIndicator.visible" class="crosshair x" :style="{ left: crosshairX + 'px' }"></div>
    <div v-if="mouseIndicator.visible" class="crosshair y" :style="{ top: crosshairY + 'px' }"></div>
  </div>
</template>
<script setup>
import { computed } from 'vue'

const props = defineProps({
  show: { type: Boolean, default: true },
  canvasWidth: { type: Number, default: 0 },
  canvasHeight: { type: Number, default: 0 },
  cellWidth: { type: Number, default: 10 },
  cellHeight: { type: Number, default: 10 },
  mouseIndicator: { type: Object, default: () => ({ visible:false, canvasX:0, canvasY:0 }) },
  containerWidth: { type: Number, default: 0 },
  containerHeight: { type: Number, default: 0 },
  scrollLeft: { type: Number, default: 0 },
  scrollTop: { type: Number, default: 0 },
  canvasTopLeft: { type: Object, default: () => ({ x:0, y:0 }) }
})

const RULER_THICK = 24

const wrapperStyle = computed(() => ({ width: (props.containerWidth||0)+'px', height: (props.containerHeight||0)+'px' }))

function nextNiceInterval(raw){
  const candidates=[1,2,5,10,20,25,50,100,200,500,1000]
  for(const c of candidates) if(c>=raw) return c
  return candidates[candidates.length-1]
}

function buildTicks(originOffset, totalSizePx, cellSize, visibleSpanPx){
  if(cellSize<=0) return []
  const minLabelSpacing=30
  const rawEvery=Math.ceil(minLabelSpacing/cellSize)
  const majorEvery=nextNiceInterval(rawEvery)
  // originOffset = canvasLeftRelativeToVisible (: , : )
  const firstIndex = originOffset<0 ? Math.floor(-originOffset/cellSize) : 0
  const firstPixel = originOffset + firstIndex*cellSize
  const totalCells = Math.floor(totalSizePx/cellSize)
  const cellsVisible = Math.min(totalCells-firstIndex, Math.ceil((visibleSpanPx-firstPixel)/cellSize)+1)
  const arr=[]
  for(let i=0;i<=cellsVisible;i++){
    const idx=firstIndex+i
    const pos=firstPixel + i*cellSize
    const isMajor = idx % majorEvery === 0
    arr.push({ index: idx, pos, isMajor })
  }
  return arr
}

const drawableWidth = computed(()=> Math.max(0,(props.containerWidth||0)-RULER_THICK))
const drawableHeight = computed(()=> Math.max(0,(props.containerHeight||0)-RULER_THICK))

//  = canvasTopLeft - scroll =>  index0 

const originOffsetX = computed(()=> (props.canvasTopLeft?.x||0) - props.scrollLeft)
const originOffsetY = computed(()=> (props.canvasTopLeft?.y||0) - props.scrollTop)

const xTicks = computed(()=> buildTicks(originOffsetX.value, props.canvasWidth, props.cellWidth, drawableWidth.value))
const yTicks = computed(()=> buildTicks(originOffsetY.value, props.canvasHeight, props.cellHeight, drawableHeight.value))

// RULER_THICK + originOffset + canvasX
const crosshairX = computed(()=> RULER_THICK + originOffsetX.value + (props.mouseIndicator?.canvasX||0))
const crosshairY = computed(()=> RULER_THICK + originOffsetY.value + (props.mouseIndicator?.canvasY||0))

const hTicksStyle = computed(()=> ({ width: drawableWidth.value+'px' }))
const vTicksStyle = computed(()=> ({ height: drawableHeight.value+'px' }))
</script>
<style scoped>
.rulers-wrapper { position:absolute; top:0; left:0; pointer-events:none; z-index:15; }
.corner { position:absolute; top:0; left:0; width:24px; height:24px; background:#fafafa; border-right:1px solid #dcdfe6; border-bottom:1px solid #dcdfe6; }
.ruler { position:absolute; background:#fafafa; font-size:10px; color:#555; font-family:Menlo,monospace; overflow:hidden; }
.ruler.horizontal { left:24px; top:0; height:24px; right:0; border-bottom:1px solid #dcdfe6; }
.ruler.vertical   { top:24px; left:0; width:24px; bottom:0; border-right:1px solid #dcdfe6; }
.ticks-layer.horizontal { position:absolute; top:0; left:0; height:100%; }
.ticks-layer.vertical   { position:absolute; top:0; left:0; width:100%; }
.tick { position:absolute; opacity:0.6; }
.ruler.horizontal .tick { top:0; width:1px; background:#bbb; height:8px; }
.ruler.horizontal .tick.major { height:14px; background:#888; }
.ruler.vertical .tick { left:0; height:1px; background:#bbb; width:8px; }
.ruler.vertical .tick.major { width:14px; background:#888; }
.label { position:absolute; white-space:nowrap; background:rgba(250,250,250,0.9); padding:0 2px; border-radius:2px; line-height:1; }

.ruler.horizontal .label { top:2px; transform:translateX(-50%); }
.ruler.vertical   .label { left:2px; transform:translateY(-50%); }

.ruler.horizontal .tick.first .label { transform:none; left:2px; }
.ruler.vertical   .tick.first .label { transform:none; top:2px; }
.crosshair { position:absolute; background:rgba(0, 0, 0, 0.856); pointer-events:none; z-index:5; }
.crosshair.x { top:24px; width:1px; height:calc(100% - 24px); }
.crosshair.y { left:24px; height:1px; width:calc(100% - 24px); }
.ticks-layer.horizontal, .ticks-layer.vertical { overflow:visible; }
</style>
