<template>
  <div class="creation-panel">
    <div class="creation-header">
      <h5>{{ $t('colorManagement.quickCreate') }}</h5>
    </div>
    
    <div class="creation-content">
      <div class="form-group">
        <label>{{ $t('colorManagement.colorPicker') }}</label>
        <div class="color-picker-container">
          <ColorPicker
            v-model:pureColor="selectedColor"
            format="hex"
            :isWidget="true"
            :disableHistory="false"
            :disableAlpha="true"
            :roundHistory="true"
            :useType="'pure'"
            @update:pureColor="onColorChange"
          />
        </div>
      </div>
    </div>

    <div class="creation-footer">
      <button 
        class="btn btn-create" 
        @click="handleCreate" 
        :disabled="!canCreate"
      >
        <span class="btn-icon">+</span>
        <span class="btn-text">{{ $t('colorManagement.create') }}</span>
      </button>
    </div>
  </div>
</template>

<script>
import { useI18n } from 'vue-i18n'
import { ColorPicker } from 'vue3-colorpicker'
import 'vue3-colorpicker/style.css'

export default {
  name: 'ColorCreationPanel',
  components: {
    ColorPicker
  },
  setup() {
    const { t } = useI18n()
    return { t }
  },
  emits: ['create-color'],
  data() {
    return {
      selectedColor: '#FF0000'
    }
  },
  computed: {
    canCreate() {
      return this.selectedColor && this.selectedColor.length === 7
    },
    colorName() {
      // 16
      return this.selectedColor ? this.selectedColor.toUpperCase() : ''
    }
  },
  methods: {
    onColorChange(color) {
      console.log('Color changed to:', color)
      this.selectedColor = color.hex || color
      console.log('Selected color updated to:', this.selectedColor)
    },
    
    handleCreate() {
      console.log('Create button clicked!') // 
      console.log('canCreate:', this.canCreate)
      console.log('selectedColor:', this.selectedColor)
      
      if (!this.canCreate) {
        console.log('Cannot create - canCreate is false')
        return
      }
      
      const colorData = {
        name: this.colorName, // 16
        hex: this.selectedColor,
        rgb: this.getRgbFromHex(this.selectedColor)
      }
      
      console.log('Emitting create-color with data:', colorData)
      this.$emit('create-color', colorData)
      this.resetForm()
    },
    
    resetForm() {
      this.selectedColor = '#FF0000'
    },
    
    getRgbFromHex(hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }
  }
}
</script>

<style scoped>
.creation-panel {
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.creation-header {
  padding: 16px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
  flex-shrink: 0;
}

.creation-header h5 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.creation-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
}

.creation-footer {
  padding: 16px;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
  flex-shrink: 0;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s, box-shadow 0.2s;
  background: white;
}

.form-input:focus {
  outline: none;
  border-color: #007ACC;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}

.form-input::placeholder {
  color: #999;
}

.color-picker-container {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.btn-create {
  padding: 12px 20px;
  background: linear-gradient(135deg, #007ACC, #005a9e);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s ease;
  flex-shrink: 0;
  width: 100%;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.2);
}

.btn-create:hover:not(:disabled) {
  background: linear-gradient(135deg, #005a9e, #004080);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 122, 204, 0.3);
}

.btn-create:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.2);
}

.btn-create:disabled {
  background: #e9ecef;
  color: #6c757d;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
}

.btn-icon {
  font-size: 16px;
  line-height: 1;
}

.btn-text {
  font-weight: 600;
}
</style>
