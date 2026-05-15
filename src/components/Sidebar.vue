<template>
  <div class="sidebar">
    
    <div class="section">
      <h3>{{ $t('sidebar.file') }}</h3>
      <button @click="$emit('load-images')" class="btn full-width">{{ $t('sidebar.openImage') }}</button>
      <button @click="$emit('save-result')" class="btn full-width" :disabled="!canSave">{{ $t('sidebar.save') }}</button>
    </div>

    
    <div class="section">
      <h3>{{ $t('sidebar.canvas') }}</h3>
      <div class="input-group">
        <label>{{ $t('sidebar.canvasSize') }}</label>
        <select 
          :value="selectedSizeKey"
          @change="handleSizeChange($event.target.value)"
          class="size-select"
        >
          <option 
            v-for="(size, key) in presetSizes" 
            :key="key" 
            :value="key"
          >
            {{ size.width }}cm × {{ size.height }}cm
          </option>
        </select>
      </div>


    </div>



    
    <div class="section">
      <button 
        @click="$emit('generate-diamond-art')" 
        class="btn primary full-width" 
        :disabled="!canGenerate"
      >
        {{ $t('sidebar.generateDiamond') }}
      </button>
      
      
      <button 
        @click="$emit('smart-adjust-layout')" 
        class="btn secondary full-width layout-btn" 
        :title="$t('sidebar.smartAdjustLayout')"
      >
        <span class="layout-icon">⚖️</span>
        {{ $t('sidebar.adjustLayout') }}
      </button>
    </div>


  </div>
</template>

<script>
export default {
  name: 'Sidebar',
  props: {
    canvasWidth: { type: Number, default: 30.0 },
    canvasHeight: { type: Number, default: 30.0 },
    imageLoaded: { type: Boolean, default: false },
    canSave: { type: Boolean, default: false }
  },
  data() {
    return {
      presetSizes: {
        '30x30': { width: 30, height: 30 },
        '43x43': { width: 43, height: 43 },
        '50x50': { width: 50, height: 50 },
        '52x38': { width: 52, height: 38 },
        '38x52': { width: 38, height: 52 },
        '60x40': { width: 60, height: 40 },
        '40x60': { width: 40, height: 60 }
      }
    }
  },
  computed: {
    canGenerate() {
      return this.imageLoaded
    },
    selectedSizeKey() {
      // 
      for (const [key, size] of Object.entries(this.presetSizes)) {
        if (size.width === this.canvasWidth && size.height === this.canvasHeight) {
          return key
        }
      }
      // 
      return Object.keys(this.presetSizes)[0]
    }
  },
  methods: {
    handleSizeChange(sizeKey) {
      const size = this.presetSizes[sizeKey]
      if (size) {
        this.$emit('update-canvas-width', size.width)
        this.$emit('update-canvas-height', size.height)
      }
    }
  },

  emits: [
    'load-images', 'save-result', 'update-canvas-width', 'update-canvas-height', 
    'generate-diamond-art', 'smart-adjust-layout'
  ]
}
</script>

<style scoped>
.sidebar {
  min-width: 200px;
  max-width: 600px;
  background: #fff;
  border-right: none; 
  padding: 20px;
  height: 100%;
  overflow-y: auto;
  flex-shrink: 0;
  box-sizing: border-box;
}



.info {
  background: #f9f9f9;
  border: 1px solid #eee;
  padding: 8px;
  border-radius: 3px;
  font-size: 12px;
  color: #666;
  text-align: center;
}

.color-management {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.color-list-container {
  position: relative;
}

.color-list {
  border: 1px solid #f0f0f0;
  border-radius: 4px;
  padding: 6px;
  background: #fafafa;
  overflow-y: auto;
  max-height: 300px;
  min-height: 100px;
}

.color-list::-webkit-scrollbar {
  width: 6px;
}

.color-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.color-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.color-list::-webkit-scrollbar-thumb:hover {
  background: #999;
}





.color-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border: 1px solid #eee;
  border-radius: 4px;
  cursor: pointer;
  background: #fff;
  transition: all 0.2s ease;
  position: relative;
  margin-bottom: 4px;
}

.color-item:hover {
  border-color: #007acc;
  background: #f8f9fa;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.color-item.active {
  border-color: #007acc;
  background: #e6f3ff;
  border-width: 2px;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.2);
}

.color-swatch {
  width: 24px;
  height: 24px;
  border: 1px solid #ddd;
  border-radius: 3px;
  margin-right: 12px;
  flex-shrink: 0;
}

.color-info {
  flex: 1;
  min-width: 0;
}

.color-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 2px;
}

.color-id {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.color-name {
  font-size: 11px;
  color: #666;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.color-usage {
  font-size: 10px;
  color: #999;
  font-weight: 500;
}

.delete-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(255, 255, 255, 0.8);
  border: none;
  color: #999;
  font-size: 12px;
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all 0.2s ease;
}

.color-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: #ff4757;
  color: white;
}


.size-select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.size-select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.size-select option {
  padding: 8px;
}


.layout-btn {
  margin-top: 8px;
  background: #f8f9fa;
  border: 1px solid #ddd;
  color: #495057;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 13px;
}

.layout-btn:hover {
  background: #e9ecef;
  border-color: #adb5bd;
  color: #343a40;
}

.layout-icon {
  font-size: 14px;
}


</style> 