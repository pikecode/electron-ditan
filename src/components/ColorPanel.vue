<template>

<div class="header-buttons">
  <el-button
    class="ios-btn"
    @click="handleManageCenterClick"
    :disabled="loadingPassword"
    :title="$t('colorPanel.colorManagementCenter')"
  >
    {{ $t('colorPanel.manage') }}
  </el-button>
</div>
    

    
    <!-- <ColorGroupSelector
      v-if="hasGroups || isLoadingGroups || groupsError"
      :groups="colorGroups"
      :selectedGroupId="selectedGroupId"
      :currentGroupColors="currentGroupColors"
      :loading="isLoadingGroups"
      :error="groupsError"
      :isOpen="showGroupSelector"
      :label="$t('colorPanel.selectGroup')"
      :placeholder="$t('colorPanel.selectGroup')"
      :loadingText="$t('colorPanel.loadingGroups')"
      :retryText="$t('common.retry')"
      :colorsText="$t('colorPanel.colors')"
      @select="selectGroup"
      @toggle="toggleGroupSelector"
      @close="hideGroupSelector"
      @retry="refreshGroups"
    /> -->
    
    
    <!-- <div v-if="hasGroups" class="color-display-section"> -->
      
      <!-- <div 
        v-if="selectedGroup && currentGroupColors.length > 0"
        @mouseenter="handleGridMouseEnter"
        @mouseleave="handleGridMouseLeave"
      >
        <ColorGrid
          :colors="formattedColors"
          :selectedColorId="getSelectedColorId()"
          @color-click="handleColorClick"
          @color-mouseenter="handleColorMouseEnter"
          @color-mouseleave="handleColorMouseLeave"
        />
      </div> -->
      
      
      <!-- <div v-else class="no-selection-state">
        <span class="select-icon">👆</span>
        <span class="select-message">{{ $t('colorPanel.selectGroupToView') }}</span>
      </div>
    </div> -->

    
    <!-- <ColorTooltip
      :visible="!!hoveredColor"
      :colorInfo="hoveredColorInfo"
      :targetElement="hoveredTargetElement"
      position="bottom"
      :offset="{ x: 0, y: 10 }"
      :showActions="true"
      @copy-success="handleCopySuccess"
      @copy-error="handleCopyError"
    /> -->

    
    <!-- <div v-if="showGroupSelector" class="dropdown-overlay" @click="hideGroupSelector"></div> -->
</template>

<script>
import ColorGroupSelector from './ColorManagement/ColorGroupSelector.vue'
import ColorGrid from './ColorManagement/ColorGrid.vue'
import ColorTooltip from './ColorManagement/ColorTooltip.vue'
import { colorAPI } from '../api'
import { useColorGroupsForPanel } from '../composables/useColorGroupsForPanel.js'

export default {
  name: 'ColorPanel',
  components: {
    ColorGroupSelector,
    ColorGrid,
    ColorTooltip
  },
  props: {
    colorPalette: { type: Array, required: true },
    selectedColorIndex: { type: Number, default: -1 }
  },
  setup() {
    // 
    const {
      colorGroups,
      selectedGroupId,
      selectedGroup,
      currentGroupColors,
      hasGroups,
      isLoading: isLoadingGroups,
      error: groupsError,
      showGroupSelector,
      selectGroup,
      toggleGroupSelector,
      hideGroupSelector,
      refresh: refreshGroups
    } = useColorGroupsForPanel()

    return {
      // 
      colorGroups,
      selectedGroupId,
      selectedGroup,
      currentGroupColors,
      hasGroups,
      isLoadingGroups,
      groupsError,
      showGroupSelector,
      
      // 
      selectGroup,
      toggleGroupSelector,
      hideGroupSelector,
      refreshGroups
    }
  },
  data() {
    return {
      hoveredColor: null,
      hoveredTargetElement: null,
      hoverTimeout: null
    }
  },
  computed: {
    //  ColorGrid 
    formattedColors() {
      if (!this.selectedGroup || !this.currentGroupColors.length) return []
      
      console.log('=== FORMATTING COLORS DEBUG ===')
      console.log('currentGroupColors:', this.currentGroupColors)
      console.log('colorPalette sample:', this.colorPalette.slice(0, 3))
      
      // currentGroupColors ID
      return this.currentGroupColors.map((colorItem, index) => {
        let colorId, globalColor
        
        // ID
        if (typeof colorItem === 'string') {
          // ID
          colorId = colorItem
          console.log(`Processing color ID: ${colorId}`)
          
          // 
          globalColor = this.colorPalette.find(color => 
            color.id === colorId || 
            color.hex === colorId ||
            color.hex === colorId.toUpperCase() ||
            color.hex === colorId.toLowerCase()
          )
        } else if (colorItem && typeof colorItem === 'object') {
          // 
          colorId = colorItem.id || colorItem.hex
          globalColor = colorItem
          console.log(`Processing color object:`, colorItem)
        } else {
          console.warn('Invalid color item:', colorItem)
          return null
        }
        
        if (!globalColor) {
          console.warn('Color not found in palette:', colorId)
          // 
          return {
            id: colorId,
            hex: colorId.startsWith('#') ? colorId : '#000000',
            name: 'Unknown Color'
          }
        }
        
        console.log('Found global color:', globalColor)
        
        return {
          id: globalColor.id || globalColor.hex,
          hex: globalColor.hex,
          name: globalColor.name && globalColor.name !== 'unknown' ? globalColor.name : '',
          // 
          thread_brand: globalColor.thread_brand,
          thread_id: globalColor.thread_id,
          group_name: this.selectedGroup?.name,
          usage_count: globalColor.usage_count,
          createdAt: globalColor.createdAt
        }
      }).filter(Boolean) // 
    },
    
    // 
    hoveredColorInfo() {
      if (!this.hoveredColor) return null
      
      return {
        name: this.hoveredColor.name || this.$t('colorPanel.unnamedColor'),
        color: this.hoveredColor.hex, //  hex 
        thread_brand: this.hoveredColor.thread_brand,
        thread_id: this.hoveredColor.thread_id,
        group_name: this.selectedGroup?.name,
        usage_count: this.hoveredColor.usage_count
      }
    }
  },
  
  mounted() {
    this.loadPassword()
  },
  
  methods: {
    // IDColorGrid
    getSelectedColorId() {
      if (this.selectedColorIndex === -1) return null
      
      const selectedColor = this.colorPalette[this.selectedColorIndex]
      if (!selectedColor) return null
      
      // 
      const matchedColor = this.formattedColors.find(color => 
        color.hex === selectedColor.hex || color.id === selectedColor.id
      )
      
      return matchedColor ? matchedColor.id : null
    },
    
    // ColorGrid
    handleColorClick(colorData) {
      console.log('=== COLOR CLICK DEBUG ===')
      console.log('Clicked color data:', colorData)
      
      // 
      const formattedColor = this.formattedColors.find(color => 
        color.id === colorData.id
      )
      
      if (!formattedColor) {
        console.warn('Formatted color not found for:', colorData.id)
        return
      }
      
      // 
      const globalIndex = this.colorPalette.findIndex(globalColor => 
        globalColor.hex === formattedColor.hex || globalColor.id === formattedColor.id
      )
      
      console.log('Found global index:', globalIndex)
      
      if (globalIndex !== -1) {
        console.log('Emitting select-color with global index:', globalIndex)
        this.$emit('select-color', globalIndex)
      } else {
        console.log('Global index not found, emitting color-selected with color object')
        this.$emit('color-selected', formattedColor)
      }
    },
    
    // ColorGrid
    handleColorMouseEnter(colorData, event) {
      console.log('=== MOUSE ENTER DEBUG ===')
      console.log('colorData:', colorData)
      console.log('event.target:', event.target)
      console.log('event.currentTarget:', event.currentTarget)
      
      // 
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout)
      }
      
      // 
      let targetElement = event.target
      
      // 
      if (!targetElement.classList.contains('color-card')) {
        targetElement = targetElement.closest('.color-card')
      }
      
      //  currentTarget
      if (!targetElement && event.currentTarget) {
        targetElement = event.currentTarget
      }
      
      console.log('Immediately captured target element:', targetElement)
      console.log('Target element classList:', targetElement?.classList)
      
      // 0.5
      this.hoverTimeout = setTimeout(() => {
        // 
        const formattedColor = this.formattedColors.find(color => 
          color.id === colorData.id
        )
        
        if (formattedColor && targetElement) {
          this.hoveredColor = formattedColor
          this.hoveredTargetElement = targetElement
          
          console.log('Setting hoveredTargetElement:', targetElement)
          console.log('Target element rect:', targetElement.getBoundingClientRect())
        } else {
          console.warn('Missing formattedColor or targetElement:', { formattedColor, targetElement })
        }
      }, 500) // 0.5
    },

    // 
    handleGridMouseEnter(event) {
      const colorCard = event.target.closest('.color-card')
      if (colorCard) {
        // DOM
        const colorHex = colorCard.querySelector('.color-swatch')?.style.backgroundColor
        const colorId = colorCard.querySelector('.color-id')?.textContent
        
        if (colorId) {
          const colorData = this.formattedColors.find(c => c.id.toString() === colorId.toString())
          if (colorData) {
            this.handleColorMouseEnterDirect(colorData, event, colorCard)
          }
        }
      }
    },

    handleGridMouseLeave(event) {
      const colorCard = event.target.closest('.color-card')
      if (colorCard) {
        this.handleColorMouseLeave()
      }
    },

    // 
    handleColorMouseEnterDirect(colorData, event, targetElement) {
      console.log('=== DIRECT MOUSE ENTER DEBUG ===')
      console.log('colorData:', colorData)
      console.log('targetElement:', targetElement)
      
      // 
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout)
      }
      
      // 0.5
      this.hoverTimeout = setTimeout(() => {
        this.hoveredColor = colorData
        this.hoveredTargetElement = targetElement
        
        console.log('Setting hoveredTargetElement (direct):', targetElement)
        console.log('Target element rect (direct):', targetElement.getBoundingClientRect())
      }, 500)
    },
    
    // ColorGrid
    handleColorMouseLeave() {
      // 
      if (this.hoverTimeout) {
        clearTimeout(this.hoverTimeout)
        this.hoverTimeout = null
      }
      // 
      this.hoveredColor = null
      this.hoveredTargetElement = null
    },
    
    // 
    handleCopySuccess(text) {
      console.log('Color value copied:', text)
      // 
    },
    
    // 
    handleCopyError(error) {
      console.error('Copy failed:', error)
      // 
    },
    
    // 
    handleSelectClick(index) {
      this.$emit('select-color', index)
    },
    
    handleManageCenterClick() {
      console.log('Color Management Center button clicked')
      this.$emit('manage-color-center')
    }
  },
  
  mounted() {
    // 移除 loadPassword 调用
  },

  beforeUnmount() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout)
    }
  },
  
  emits: ['select-color', 'manage-colors', 'manage-color-center', 'color-selected']
}
</script>

<style scoped>
.color-panel {
  min-width: 200px;
  max-width: 500px;
  background: #fff;
  border-left: none;
  display: flex;
  flex-direction: column;
  height: 100%;
  flex-shrink: 0;
  box-sizing: border-box;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}

.management-center-btn {
  background: none;
  border: none;
  padding: 8px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #007acc;
  font-size: 18px;
}

.management-center-btn:hover {
  background-color: rgba(0, 122, 204, 0.1);
  transform: scale(1.1);
}

.center-icon {
  font-size: 18px;
}

.panel-header h3 {
  color: #333;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 12px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}


.color-display-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}


.no-selection-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #666;
  gap: 12px;
}

.select-icon {
  font-size: 32px;
  opacity: 0.5;
}

.select-message {
  font-size: 13px;
  line-height: 1.4;
}


.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
}
.ios-btn {background:#ffffff; border:1px solid #d9d9de; border-radius:18px; padding:6px 16px; font-size:14px; font-weight:500; line-height:20px; color:#0071e3; cursor:pointer; box-shadow:0 1px 2px rgba(0,0,0,0.08),0 0 0 1px rgba(0,0,0,0.02); backdrop-filter:saturate(180%) blur(20px); transition:background .2s, box-shadow .2s; -webkit-font-smoothing:antialiased;}
.ios-btn:hover {background:#f2f2f7;}
.ios-btn:active {background:#e5e5ea; box-shadow:0 0 0 1px rgba(0,0,0,0.1) inset;}
.ios-btn:focus {outline:none; box-shadow:0 0 0 3px rgba(0,113,227,0.3);}
</style> 