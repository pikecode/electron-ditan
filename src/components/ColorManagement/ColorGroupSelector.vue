<template>
  <div class="group-selector-section">
    <div class="group-selector-header">
      <span class="selector-label">{{ label || $t('colorPanel.selectGroup') }}</span>
    </div>
    
    
    <div v-if="loading" class="loading-state">
      <span class="loading-spinner">⏳</span>
      <span>{{ loadingText || $t('colorPanel.loadingGroups') }}</span>
    </div>
    
    
    <div v-else-if="error" class="error-state">
      <span class="error-icon">⚠️</span>
      <span class="error-message">{{ error }}</span>
      <button class="retry-btn" @click="$emit('retry')">
        {{ retryText || $t('common.retry') }}
      </button>
    </div>
    
    
    <div v-else-if="hasGroups" class="group-selector-container">
      <div class="group-dropdown" :class="{ active: isOpen }">
        <button 
          class="dropdown-trigger" 
          @click="toggleDropdown"
          :disabled="!hasGroups"
        >
          <span class="selected-group-info">
            <span class="group-name">
              {{ selectedGroup ? selectedGroup.name : (placeholder || $t('colorPanel.selectGroup')) }}
            </span>
            <span v-if="selectedGroup" class="group-color-count">
              ({{ currentGroupColors.length }} {{ colorsText || $t('colorPanel.colors') }})
            </span>
          </span>
          <span class="dropdown-arrow" :class="{ rotated: isOpen }">▼</span>
        </button>
        
        <div v-if="isOpen" class="dropdown-menu" @click.stop>
          <div 
            v-for="group in groups" 
            :key="group.id"
            class="dropdown-item"
            :class="{ selected: group.id === selectedGroupId }"
            @click="selectGroup(group.id)"
          >
            <div class="group-item-info">
              <span class="group-item-name">{{ group.name }}</span>
              <span class="group-item-count">{{ group.colors?.length || 0 }} {{ colorsText || $t('colorPanel.colors') }}</span>
            </div>
            <span v-if="group.id === selectedGroupId" class="selected-indicator">✓</span>
          </div>
        </div>
      </div>
    </div>
    
    
    <div v-if="isOpen" class="dropdown-overlay" @click="closeDropdown"></div>
  </div>
</template>

<script>
export default {
  name: 'ColorGroupSelector',
  props: {
    groups: {
      type: Array,
      default: () => []
    },
    selectedGroupId: {
      type: [String, Number],
      default: null
    },
    currentGroupColors: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    },
    isOpen: {
      type: Boolean,
      default: false
    },
    // 
    label: {
      type: String,
      default: ''
    },
    placeholder: {
      type: String,
      default: ''
    },
    loadingText: {
      type: String,
      default: ''
    },
    retryText: {
      type: String,
      default: ''
    },
    colorsText: {
      type: String,
      default: ''
    }
  },
  emits: ['select', 'toggle', 'close', 'retry'],
  computed: {
    hasGroups() {
      return this.groups && this.groups.length > 0
    },
    selectedGroup() {
      return this.groups.find(group => group.id === this.selectedGroupId) || null
    }
  },
  methods: {
    selectGroup(groupId) {
      this.$emit('select', groupId)
      this.closeDropdown()
    },
    toggleDropdown() {
      this.$emit('toggle')
    },
    closeDropdown() {
      this.$emit('close')
    }
  }
}
</script>

<style scoped>
.group-selector-section {
  padding: 16px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.group-selector-header {
  margin-bottom: 12px;
}

.selector-label {
  font-size: 12px;
  font-weight: 600;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.loading-state,
.error-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  flex-direction: column;
  gap: 8px;
  color: #666;
  font-size: 13px;
}

.error-state {
  color: #dc3545;
}

.error-icon {
  font-size: 20px;
}

.loading-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.retry-btn {
  background: #007acc;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  margin-top: 4px;
}

.retry-btn:hover {
  background: #005999;
}

.group-selector-container {
  position: relative;
}

.group-dropdown {
  position: relative;
}

.dropdown-trigger {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  font-size: 13px;
}

.dropdown-trigger:hover {
  border-color: #007acc;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.dropdown-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.group-dropdown.active .dropdown-trigger {
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.selected-group-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.group-name {
  font-weight: 500;
  color: #333;
}

.group-color-count {
  font-size: 11px;
  color: #666;
}

.dropdown-arrow {
  transition: transform 0.2s ease;
  color: #666;
  font-size: 12px;
}

.dropdown-arrow.rotated {
  transform: rotate(180deg);
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  margin-top: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.dropdown-item {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #f0f0f0;
}

.dropdown-item:last-child {
  border-bottom: none;
}

.dropdown-item:hover {
  background: #f8f9fa;
}

.dropdown-item.selected {
  background: #e6f3ff;
  color: #007acc;
}

.group-item-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.group-item-name {
  font-size: 13px;
  font-weight: 500;
}

.group-item-count {
  font-size: 11px;
  color: #666;
}

.selected-indicator {
  color: #007acc;
  font-weight: bold;
}

.dropdown-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 50;
}
</style>
