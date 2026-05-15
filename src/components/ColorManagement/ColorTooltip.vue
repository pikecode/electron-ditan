<template>
  <transition name="tooltip-fade" @before-enter="onBeforeEnter" @enter="onEnter" @leave="onLeave">
    <div 
      v-if="visible && colorInfo" 
      class="color-tooltip"
      :style="tooltipStyle"
      ref="tooltip"
    >
      <div class="tooltip-arrow" :style="arrowStyle"></div>
      
      
      <div class="tooltip-color-preview" :style="{ backgroundColor: colorInfo.color }"></div>
      
      
      <div class="tooltip-content">
        <div class="color-name">{{ colorInfo.name || $t('colorTooltip.unnamed') }}</div>
        
        
        <div class="color-values">
          <div class="color-value-item">
            <span class="value-label">HEX:</span>
            <span class="value-text">
              {{ colorInfo.color }}
            </span>
          </div>
          
          <div v-if="rgbValue" class="color-value-item">
            <span class="value-label">RGB:</span>
            <span class="value-text">
              {{ rgbValue }}
            </span>
          </div>
          
          <div v-if="hslValue" class="color-value-item">
            <span class="value-label">HSL:</span>
            <span class="value-text">
              {{ hslValue }}
            </span>
          </div>
        </div>
        
        
        <div v-if="hasExtendedInfo" class="extended-info">
          <div v-if="colorInfo.thread_brand" class="info-item">
            <span class="info-label">{{ $t('colorTooltip.brand') }}:</span>
            <span class="info-value">{{ colorInfo.thread_brand }}</span>
          </div>
          
          <div v-if="colorInfo.thread_id" class="info-item">
            <span class="info-label">{{ $t('colorTooltip.threadId') }}:</span>
            <span class="info-value">{{ colorInfo.thread_id }}</span>
          </div>
          
          <div v-if="colorInfo.group_name" class="info-item">
            <span class="info-label">{{ $t('colorTooltip.group') }}:</span>
            <span class="info-value">{{ colorInfo.group_name }}</span>
          </div>
          
          <div v-if="colorInfo.usage_count !== undefined" class="info-item">
            <span class="info-label">{{ $t('colorTooltip.usageCount') }}:</span>
            <span class="info-value">{{ colorInfo.usage_count }}</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'ColorTooltip',
  props: {
    visible: {
      type: Boolean,
      default: false
    },
    colorInfo: {
      type: Object,
      default: null
    },
    targetElement: {
      type: [Element, Object],
      default: null
    },
    position: {
      type: String,
      default: 'top', // top, bottom, left, right
      validator: value => ['top', 'bottom', 'left', 'right'].includes(value)
    },
    offset: {
      type: Object,
      default: () => ({ x: 0, y: 8 })
    },
    customPosition: {
      type: Object,
      default: null // { x: number, y: number }
    }
  },
  data() {
    return {
      tooltipPosition: { x: 0, y: 0 },
      arrowPosition: 'top'
    }
  },
  computed: {
    rgbValue() {
      if (!this.colorInfo?.color) return null
      return this.hexToRgb(this.colorInfo.color)
    },
    hslValue() {
      if (!this.colorInfo?.color) return null
      return this.hexToHsl(this.colorInfo.color)
    },
    hasExtendedInfo() {
      if (!this.colorInfo) return false
      return !!(this.colorInfo.thread_brand || this.colorInfo.thread_id || 
               this.colorInfo.group_name || this.colorInfo.usage_count !== undefined)
    },
    tooltipStyle() {
      return {
        left: `${this.tooltipPosition.x}px`,
        top: `${this.tooltipPosition.y}px`,
        position: 'fixed',
        zIndex: 1000
      }
    },
    arrowStyle() {
      const baseStyle = {
        position: 'absolute'
      }
      
      switch (this.arrowPosition) {
        case 'top':
          return { ...baseStyle, top: '-6px', left: '50%', transform: 'translateX(-50%)' }
        case 'bottom':
          return { ...baseStyle, bottom: '-6px', left: '50%', transform: 'translateX(-50%) rotate(180deg)' }
        case 'left':
          return { ...baseStyle, left: '-6px', top: '50%', transform: 'translateY(-50%) rotate(-90deg)' }
        case 'right':
          return { ...baseStyle, right: '-6px', top: '50%', transform: 'translateY(-50%) rotate(90deg)' }
        default:
          return baseStyle
      }
    }
  },
  watch: {
    visible(newVal) {
      console.log('Tooltip visible changed:', newVal)
      if (newVal) {
        this.$nextTick(() => {
          console.log('Updating position because visible changed to true')
          this.updatePosition()
        })
      }
    },
    targetElement(newElement, oldElement) {
      console.log('Target element changed:', { old: oldElement, new: newElement })
      if (this.visible && newElement) {
        this.$nextTick(() => {
          console.log('Updating position because target element changed')
          this.updatePosition()
        })
      }
    },
    colorInfo(newInfo) {
      console.log('Color info changed:', newInfo)
      if (this.visible && this.targetElement) {
        this.$nextTick(() => {
          console.log('Updating position because color info changed')
          this.updatePosition()
        })
      }
    }
  },
  methods: {
    updatePosition() {
      console.log('=== TOOLTIP POSITION DEBUG START ===')
      console.log('targetElement:', this.targetElement)
      console.log('tooltip ref:', this.$refs.tooltip)
      
      if (!this.targetElement || !this.$refs.tooltip) {
        console.log('Missing targetElement or tooltip ref')
        return
      }
      
      if (this.customPosition) {
        console.log('Using custom position:', this.customPosition)
        this.tooltipPosition = { ...this.customPosition }
        return
      }
      
      const targetRect = this.targetElement.getBoundingClientRect()
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight
      }
      
      console.log('Target element:', this.targetElement)
      console.log('Target rect:', targetRect)
      console.log('Viewport:', viewport)
      console.log('Position prop:', this.position)
      console.log('Offset prop:', this.offset)
      
      //  tooltip 0
      let tooltipRect
      const tooltipEl = this.$refs.tooltip
      if (tooltipEl.offsetWidth === 0 || tooltipEl.offsetHeight === 0) {
        // 
        tooltipRect = {
          width: 280,  // max-width
          height: 150  // 
        }
        console.log('Using estimated tooltip size:', tooltipRect)
      } else {
        tooltipRect = tooltipEl.getBoundingClientRect()
        console.log('Using actual tooltip size:', tooltipRect)
      }
      
      let position = { x: 0, y: 0 }
      let arrowPos = this.position
      
      switch (this.position) {
        case 'top':
          position.x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
          position.y = targetRect.top - tooltipRect.height - this.offset.y
          break
        case 'bottom':
          position.x = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2
          position.y = targetRect.bottom + this.offset.y
          break
        case 'left':
          position.x = targetRect.left - tooltipRect.width - this.offset.x
          position.y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
          break
        case 'right':
          position.x = targetRect.right + this.offset.x
          position.y = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2
          break
      }
      
      console.log('Initial calculated position:', position)
      
      // 
      if (position.x < 8) {
        console.log('Adjusting X: too far left')
        position.x = 8
      } else if (position.x + tooltipRect.width > viewport.width - 8) {
        console.log('Adjusting X: too far right')
        position.x = viewport.width - tooltipRect.width - 8
      }
      
      if (position.y < 8) {
        console.log('Adjusting Y: too far up, moving to bottom')
        position.y = targetRect.bottom + this.offset.y
        arrowPos = 'top'
      } else if (position.y + tooltipRect.height > viewport.height - 8) {
        console.log('Adjusting Y: too far down, moving to top')
        position.y = targetRect.top - tooltipRect.height - this.offset.y
        arrowPos = 'bottom'
      }
      
      console.log('Final position:', position)
      console.log('Final arrow position:', arrowPos)
      
      this.tooltipPosition = position
      this.arrowPosition = arrowPos
      
      console.log('=== TOOLTIP POSITION DEBUG END ===')
      
      // 
      if (tooltipEl.offsetWidth === 0 || tooltipEl.offsetHeight === 0) {
        console.log('Will recalculate position in next tick')
        this.$nextTick(() => {
          this.updatePosition()
        })
      }
    },
    
    hexToRgb(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? 
        `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : 
        null
    },
    
    hexToHsl(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      if (!result) return null
      
      let r = parseInt(result[1], 16) / 255
      let g = parseInt(result[2], 16) / 255
      let b = parseInt(result[3], 16) / 255
      
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      let h, s, l = (max + min) / 2
      
      if (max === min) {
        h = s = 0
      } else {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break
          case g: h = (b - r) / d + 2; break
          case b: h = (r - g) / d + 4; break
        }
        h /= 6
      }
      
      return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
    },
    
    // 
    onBeforeEnter(el) {
      el.style.opacity = '0'
      el.style.transform = 'scale(0.8) translateY(-10px)'
    },
    
    onEnter(el, done) {
      el.offsetHeight // 
      el.style.transition = 'opacity 0.2s ease, transform 0.2s ease'
      el.style.opacity = '1'
      el.style.transform = 'scale(1) translateY(0)'
      setTimeout(done, 200)
    },
    
    onLeave(el, done) {
      el.style.transition = 'opacity 0.15s ease, transform 0.15s ease'
      el.style.opacity = '0'
      el.style.transform = 'scale(0.8) translateY(-10px)'
      setTimeout(done, 150)
    }
  },
  
  beforeUnmount() {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout)
    }
  }
}
</script>

<style scoped>
.color-tooltip {
  background: white;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  overflow: hidden;
  min-width: 200px;
  max-width: 280px;
  font-size: 12px;
  pointer-events: auto;
}

.tooltip-arrow {
  width: 0;
  height: 0;
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-bottom: 6px solid white;
  filter: drop-shadow(0 -1px 1px rgba(0, 0, 0, 0.1));
}

.tooltip-color-preview {
  height: 4px;
  width: 100%;
}

.tooltip-content {
  padding: 12px;
}

.color-name {
  font-weight: 600;
  font-size: 13px;
  color: #333;
  margin-bottom: 8px;
  word-break: break-word;
}

.color-values {
  margin-bottom: 8px;
}

.color-value-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
  gap: 8px;
}

.color-value-item:last-child {
  margin-bottom: 0;
}

.value-label {
  font-weight: 500;
  color: #666;
  min-width: 35px;
}

.value-text {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  justify-content: space-between;
}

.extended-info {
  border-top: 1px solid #f0f0f0;
  padding-top: 8px;
  margin-top: 8px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  gap: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-label {
  color: #666;
  font-size: 11px;
}

.info-value {
  color: #333;
  font-weight: 500;
  font-size: 11px;
  text-align: right;
}


.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(-10px);
}
</style>
