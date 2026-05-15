<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog dialog-large" @click.stop>
      <div class="dialog-header">
        <h4>{{ $t('colorManagement.addColorsToGroupTitle', { name: targetGroup?.name || '' }) }}</h4>
        <button class="close-btn" @click="cancel">×</button>
      </div>
      <div class="dialog-body">
        <div v-if="availableColors.length === 0" class="empty-state">
          <h5>{{ $t('colorManagement.noAvailableColors') }}</h5>
          <p>{{ $t('colorManagement.allColorsInGroup') }}</p>
        </div>
        <div v-else>
          <div class="color-selection-info">
            <p>{{ $t('colorManagement.selectColorsToAdd', { count: selectedColors.length }) }}</p>
          </div>
          <div class="color-selection-grid">
            <div 
              v-for="color in availableColors" 
              :key="color.id"
              class="selectable-color-card"
              :class="{ selected: isColorSelected(color) }"
              @click="toggleColorSelection(color)"
            >
              <div class="color-swatch" :style="{ backgroundColor: color.hex }"></div>
              <div class="color-info">
                <div class="color-name">{{ color.name !== 'unknown' && color.name ? color.name : color.hex.toUpperCase() }}</div>
                <div class="color-name">{{ color.id }}</div>
              </div>
              <div class="selection-indicator" v-if="isColorSelected(color)">
                ✓
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="cancel">{{ $t('colorManagement.cancel') }}</button>
        <button 
          class="btn btn-primary" 
          @click="confirm" 
          :disabled="selectedColors.length === 0"
        >
          {{ $t('colorManagement.addColorsCount', { count: selectedColors.length }) }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AddColorDialog',
  props: {
    visible: { type: Boolean, default: false },
    targetGroup: { type: Object, default: null },
    colors: { type: Array, default: () => [] }
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      selectedColors: []
    }
  },
  computed: {
    availableColors() {
      if (!this.targetGroup) {
        return this.colors.filter((color, index, array) => 
          array.findIndex(c => c.id === color.id) === index
        )
      }
      
      const filtered = this.colors.filter(color => 
        !this.targetGroup.colors?.some(c => c.id === color.id)
      )
      
      return filtered.filter((color, index, array) => 
        array.findIndex(c => c.id === color.id) === index
      )
    }
  },
  watch: {
    visible(newVal) {
      if (!newVal) {
        this.selectedColors = []
      }
    }
  },
  methods: {
    toggleColorSelection(color) {
      const index = this.selectedColors.findIndex(c => c.id === color.id)
      
      if (index > -1) {
        this.selectedColors.splice(index, 1)
      } else {
        this.selectedColors.push(color)
      }
    },
    isColorSelected(color) {
      return this.selectedColors.some(c => c.id === color.id)
    },
    confirm() {
      if (this.selectedColors.length === 0) return
      this.$emit('confirm', this.selectedColors)
    },
    cancel() {
      this.$emit('cancel')
    },
    handleOverlayClick() {
      this.cancel()
    }
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.dialog-large {
  width: 80vw;
  max-width: 800px;
  height: 70vh;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
  border-radius: 8px 8px 0 0;
}

.dialog-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: background-color 0.2s;
}

.close-btn:hover {
  background: #e9ecef;
  color: #333;
}

.dialog-body {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
  border-radius: 0 0 8px 8px;
}

.color-selection-info {
  padding-bottom: 16px;
  border-bottom: 1px solid #e1e5e9;
  margin-bottom: 16px;
}

.color-selection-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.color-selection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.selectable-color-card {
  position: relative;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  overflow: hidden;
}

.selectable-color-card:hover {
  border-color: #007ACC;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.15);
}

.selectable-color-card.selected {
  border-color: #007ACC;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
  transform: scale(1.02);
}

.selectable-color-card .color-swatch {
  width: 100%;
  height: 60px;
  border-bottom: 1px solid #e1e5e9;
}

.selectable-color-card .color-info {
  padding: 8px;
}

.selectable-color-card .color-name {
  font-weight: 500;
  font-size: 12px;
  margin-bottom: 4px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.selection-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: #007ACC;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: #666;
}

.empty-state h5 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-secondary {
  background: white;
  color: #666;
}

.btn-secondary:hover {
  background: #f0f6ff;
  border-color: #007ACC;
  color: #007ACC;
}

.btn-primary {
  background: #007ACC;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #005a9e;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
