<template>
  <div v-if="visible" class="dialog-overlay" @click="handleOverlayClick">
    <div class="dialog dialog-large" @click.stop>
      <div class="dialog-header">
        <h4>{{ $t('colorManagement.editColorTitle', { label: (editingColor && (editingColor.name !== 'unknown' && editingColor.name)) ? editingColor.name : (editingColor?.hex || '').toUpperCase() }) }}</h4>
        <button class="close-btn" @click="cancel">×</button>
      </div>
      <div class="dialog-body">
        <div class="form-group">
          <label>{{ $t('colorManagement.colorName') }}</label>
          <input 
            ref="nameInput"
            type="text" 
            v-model="colorName" 
            :placeholder="$t('colorManagement.colorNameInputPh')"
            maxlength="50"
            @keyup.enter="confirm"
            @keyup.esc="cancel"
          />
          <small class="help-text">{{ $t('colorManagement.nameOptional') }}</small>
        </div>
        
        <div class="form-group">
          <label>{{ $t('colorManagement.colorValue') }}</label>
          <div class="color-input-group">
            <div class="color-preview" :style="{ backgroundColor: colorHex }"></div>
            <input 
              type="text" 
              v-model="colorHex" 
              placeholder="#FFFFFF"
              @input="validateHex"
              maxlength="7"
            />
          </div>
          <small class="help-text error" v-if="!isValidHex">
            {{ $t('colorManagement.invalidHexFormat') }}
          </small>
        </div>

        <div class="form-group">
          <label>{{ $t('colorManagement.groupMembership') }}</label>
          <div class="group-selection">
            <div v-if="colorGroups.length === 0" class="no-groups">
              {{ $t('colorManagement.noGroupsAvailable') }}
            </div>
            <div v-else class="group-grid">
              <div 
                v-for="group in colorGroups" 
                :key="group.id"
                class="group-option"
                :class="{ 
                  selected: selectedGroupIds.includes(group.id),
                  'in-group': isColorInGroup(group.id)
                }"
                @click="toggleGroupSelection(group.id)"
              >
                <div class="group-name">{{ group.name }}</div>
                <div class="group-colors-count">{{ $t('colorManagement.groupColorCount', { count: group.colors?.length || 0 }) }}</div>
                <div class="selection-indicator" v-if="selectedGroupIds.includes(group.id)">
                  ✓
                </div>
              </div>
            </div>
          </div>
          <small class="help-text">
            {{ $t('colorManagement.canSelectMultipleGroups') }}
          </small>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" @click="cancel">{{ $t('colorManagement.cancel') }}</button>
        <button 
          class="btn btn-primary" 
          @click="confirm" 
          :disabled="!canSave"
        >
          {{ $t('colorManagement.saveChanges') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'EditColorDialog',
  props: {
    visible: { type: Boolean, default: false },
    editingColor: { type: Object, default: null },
    colorGroups: { type: Array, default: () => [] }
  },
  emits: ['confirm', 'cancel'],
  data() {
    return {
      colorName: '',
      colorHex: '',
      selectedGroupIds: [],
      isValidHex: true
    }
  },
  computed: {
    canSave() {
      return this.colorHex && this.isValidHex
    }
  },
  watch: {
    visible(newVal) {
      if (newVal && this.editingColor) {
        this.initializeForm()
        this.$nextTick(() => {
          this.$refs.nameInput?.focus()
        })
      }
    },
    editingColor(newVal) {
      if (newVal && this.visible) {
        this.initializeForm()
      }
    }
  },
  methods: {
    initializeForm() {
      if (!this.editingColor) return
      
      this.colorName = this.editingColor.name === 'unknown' ? '' : (this.editingColor.name || '')
      this.colorHex = this.editingColor.hex || ''
      this.selectedGroupIds = this.getColorGroupIds()
      this.validateHex()
    },
    getColorGroupIds() {
      if (!this.editingColor) return []
      
      const groupIds = []
      this.colorGroups.forEach(group => {
        if (group.colors?.some(color => color.id === this.editingColor.id)) {
          groupIds.push(group.id)
        }
      })
      return groupIds
    },
    isColorInGroup(groupId) {
      if (!this.editingColor) return false
      const group = this.colorGroups.find(g => g.id === groupId)
      return group?.colors?.some(color => color.id === this.editingColor.id) || false
    },
    toggleGroupSelection(groupId) {
      const index = this.selectedGroupIds.indexOf(groupId)
      if (index > -1) {
        this.selectedGroupIds.splice(index, 1)
      } else {
        this.selectedGroupIds.push(groupId)
      }
    },
    validateHex() {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/
      this.isValidHex = hexRegex.test(this.colorHex)
    },
    confirm() {
      if (!this.canSave) return
      
      const updatedColor = {
        ...this.editingColor,
        name: this.colorName.trim() || 'unknown',
        hex: this.colorHex.toUpperCase()
      }
      
      this.$emit('confirm', {
        color: updatedColor,
        groupIds: [...this.selectedGroupIds]
      })
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
  width: 70vw;
  max-width: 600px;
  max-height: 80vh;
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
  overflow-y: auto;
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

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
  font-size: 14px;
}

.form-group input[type="text"] {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-group input[type="text"]:focus {
  outline: none;
  border-color: #007ACC;
  box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.1);
}

.color-input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-preview {
  width: 40px;
  height: 40px;
  border: 2px solid #ddd;
  border-radius: 6px;
  flex-shrink: 0;
}

.color-input-group input {
  flex: 1;
}

.help-text {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #666;
}

.help-text.error {
  color: #dc3545;
}

.group-selection {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 12px;
  max-height: 200px;
  overflow-y: auto;
}

.no-groups {
  text-align: center;
  color: #666;
  font-size: 14px;
  padding: 20px;
}

.group-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 8px;
}

.group-option {
  position: relative;
  padding: 12px;
  border: 1px solid #e1e5e9;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.group-option:hover {
  border-color: #007ACC;
  background: #f8f9fa;
}

.group-option.selected {
  border-color: #007ACC;
  background: #e7f3ff;
}

.group-option.in-group {
  background: #e8f5e8;
  border-color: #28a745;
}

.group-option.in-group.selected {
  background: #d4edda;
  border-color: #007ACC;
}

.group-name {
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.group-colors-count {
  font-size: 12px;
  color: #666;
}

.selection-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 16px;
  height: 16px;
  background: #007ACC;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
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
