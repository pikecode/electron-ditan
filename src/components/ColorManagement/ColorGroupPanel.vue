<template>
  <div class="color-group-panel">
    <div class="panel-header">
      <div class="header-left">
        <h4>{{ $t('colorManagement.groupsTitle') }}</h4>
      </div>
      <div class="header-actions">
        <button 
          class="action-btn" 
          @click="() => { console.log('Button clicked directly'); handleCreateGroup(); }"
          :title="$t('colorManagement.createGroup')"
        >
          <span class="btn-icon">+</span>
          <span class="btn-label">{{ $t('colorManagement.newGroup') }}</span>
        </button>
        <button class="action-btn" @click="handleImportGroups" :title="$t('colorManagement.importGroups')">
          <span class="btn-icon">📥</span>
          <span class="btn-label">{{ $t('colorManagement.importGroups') }}</span>
        </button>
        <button class="action-btn" @click="handleExportAll" :title="$t('colorManagement.exportAll')">
          <span class="btn-icon">📤</span>
          <span class="btn-label">{{ $t('colorManagement.exportAll') }}</span>
        </button>
      </div>
    </div>

    <div class="groups-content">
      <div class="groups-left">
        <div class="groups-list">
          <div v-if="loading" class="loading-state">
            {{ $t('colorManagement.loadingGroups') }}
          </div>
          <div v-else-if="groups.length === 0" class="empty-state">
            <h4>{{ $t('colorManagement.noGroups') }}</h4>
            <p>{{ $t('colorManagement.createFirstGroup') }}</p>
          </div>
          <div v-else class="group-items">
            <div 
              v-for="group in groups" 
              :key="group.id"
              class="group-item"
              :class="{ active: selectedGroup?.id === group.id }"
              @click="selectGroup(group)"
            >
              <div class="group-header">
                <div class="group-info">
                  <h5 class="group-name">{{ group.name }}</h5>
                  <span class="group-count">{{ $t('colorManagement.groupColorCount', { count: group.colors?.length || 0 }) }}</span>
                </div>
                                <div class="group-actions">
                  <button class="action-btn-small" @click.stop="handleEditGroup(group)" :title="$t('colorManagement.edit')">
                    ✏️
                  </button>
                  <button class="action-btn-small danger" @click.stop="$emit('delete-group', group)" :title="$t('colorManagement.delete')">
                    🗑️
                  </button>
                </div>
              </div>
              <div class="group-preview" v-if="group.colors && group.colors.length > 0">
                <div 
                  v-for="(color, index) in group.colors.slice(0, 5)" 
                  :key="index"
                  class="preview-color"
                  :style="{ backgroundColor: color.hex }"
                ></div>
                <span v-if="group.colors.length > 5" class="more-indicator">
                  +{{ group.colors.length - 5 }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="groups-right">
        <div v-if="!selectedGroup" class="no-selection">
          <h4>{{ $t('colorManagement.selectGroup') }}</h4>
          <p>{{ $t('colorManagement.selectGroupPrompt') }}</p>
        </div>
        <div v-else class="group-details">
          <div class="details-header">
            <h4>{{ selectedGroup.name }}</h4>
            <span class="color-count">{{ $t('colorManagement.groupColorCount', { count: selectedGroup.colors?.length || 0 }) }}</span>
          </div>
          
          <div class="group-colors-container">
            <div v-if="selectedGroup.colors && selectedGroup.colors.length === 0" class="empty-group">
              <div class="empty-content">
                <h5>{{ $t('colorManagement.noColorsInGroup') }}</h5>
                <p>{{ $t('colorManagement.addColorsToGroup') }}</p>
                <button class="btn btn-primary" @click="handleAddToGroup">
                  + {{ $t('colorManagement.addColorsToThisGroup') }}
                </button>
              </div>
            </div>
            <div v-else class="colors-with-actions">
              <div class="group-colors-grid">
                <div 
                  v-for="color in selectedGroup.colors" 
                  :key="color.id"
                  class="group-color-card"
                  @click="$emit('color-click', color)"
                >
                  <div class="color-swatch" :style="{ backgroundColor: color.hex }"></div>
                  <div class="color-info">
                    <div class="color-name">{{ color.name !== 'unknown' && color.name ? color.name : color.hex.toUpperCase() }}</div>
                    <div class="color-hex">{{ color.id }}</div>
                  </div>
                  <div class="color-actions">
                    <button class="action-btn-small danger" @click.stop="handleRemoveFromGroup(color)" :title="$t('colorManagement.removeFromGroup')">
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
              <div class="add-more-section">
                <button class="btn btn-secondary add-more-btn" @click="handleAddToGroup">
                  + {{ $t('colorManagement.addMoreColors') }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useI18n } from 'vue-i18n'
import ColorGrid from './ColorGrid.vue'

export default {
  name: 'ColorGroupPanel',
  components: {
    ColorGrid
  },
  setup() {
    const { t } = useI18n()
    return { t }
  },
  props: {
    groups: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    }
  },
  emits: [
    'create-group', 
    'edit-group', 
    'delete-group', 
    'export-all',
    'add-to-group',
    'remove-from-group',
    'color-click', 
    'color-delete',
    'load-groups'
  ],
  data() {
    return {
      selectedGroup: null
    }
  },
  mounted() {
    console.log('ColorGroupPanel: Mounted with groups:', this.groups.length, 'groups')
    //  mounted  load-groups 
    //  props 
  },
  methods: {
    selectGroup(group) {
      this.selectedGroup = group
    },
    
    handleCreateGroup() {
      console.log('ColorGroupPanel: Create group button clicked')
      try {
        this.$emit('create-group')
        console.log('ColorGroupPanel: Event emitted successfully')
      } catch (error) {
        console.error('ColorGroupPanel: Error emitting event:', error)
      }
    },
    
    handleEditGroup(group) {
      console.log('ColorGroupPanel: Edit group button clicked', group)
      try {
        this.$emit('edit-group', group)
        console.log('ColorGroupPanel: Edit event emitted successfully')
      } catch (error) {
        console.error('ColorGroupPanel: Error emitting edit event:', error)
      }
    },
    
    handleExportAll() {
      console.log('ColorGroupPanel: Export all button clicked')  
      this.$emit('export-all')
    },
    
    handleImportGroups() {
      console.log('ColorGroupPanel: Import groups button clicked')
      // 
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json'
      input.onchange = (event) => {
        const file = event.target.files[0]
        if (file) {
          this.processImportFile(file)
        }
      }
      input.click()
    },
    
    async processImportFile(file) {
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        
        // 
        if (!data.groups || !Array.isArray(data.groups)) {
          throw new Error(this.t('colorManagement.importInvalidGroupsFile'))
        }
        
        // 
        this.$emit('import-groups', data.groups)
        
      } catch (error) {
        console.error('Import error:', error)
        this.$emit('import-error', error.message)
      }
    },
    
    handleAddToGroup() {
      console.log('ColorGroupPanel: Add to group clicked for:', this.selectedGroup)
      this.$emit('add-to-group', this.selectedGroup)
    },
    
    handleRemoveFromGroup(color) {
      console.log('ColorGroupPanel: Remove color from group:', color)
      this.$emit('remove-from-group', { group: this.selectedGroup, color })
    }
  }
}
</script>

<style scoped>
.color-group-panel {
  flex: 1 1 auto;
  width: 100%;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
}

.header-left h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #f0f6ff;
  border-color: #007ACC;
  color: #007ACC;
}

.groups-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.groups-left {
  width: 300px;
  border-right: 1px solid #e1e5e9;
  overflow-y: auto;
}

.groups-right {
  flex: 1;
  overflow-y: auto;
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: #666;
}

.empty-state h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.group-items {
  padding: 16px;
}

.group-item {
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}

.group-item:hover {
  border-color: #007ACC;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.1);
}

.group-item.active {
  border-color: #007ACC;
  background: #f0f6ff;
}

.group-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.group-info h5 {
  margin: 0 0 4px 0;
  color: #333;
  font-size: 14px;
  font-weight: 600;
}

.group-count {
  font-size: 12px;
  color: #666;
}

.group-actions {
  display: flex;
  gap: 4px;
}

.action-btn-small {
  width: 24px;
  height: 24px;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: all 0.2s;
}

.action-btn-small:hover {
  background: white;
}

.action-btn-small.danger:hover {
  background: #ff4444;
  color: white;
}

.group-preview {
  display: flex;
  align-items: center;
  gap: 4px;
}

.preview-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid #ddd;
}

.more-indicator {
  font-size: 11px;
  color: #666;
  margin-left: 4px;
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #666;
  text-align: center;
}

.no-selection h4 {
  margin: 0 0 8px 0;
  color: #333;
}

.group-details {
  padding: 16px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e1e5e9;
}

.details-header h4 {
  margin: 0;
  color: #333;
  font-size: 16px;
}

.group-colors {
  flex: 1;
  overflow-y: auto;
}

.empty-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  text-align: center;
  color: #666;
}

.btn {
  padding: 8px 16px;
  border: 1px solid #007ACC;
  background: #007ACC;
  color: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}

.btn:hover {
  background: #005a9e;
}

.btn.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
}

.btn.btn-primary {
  background: #007ACC;
  border-color: #007ACC;
}

.btn.btn-secondary {
  background: white;
  border-color: #007ACC;
  color: #007ACC;
}

.btn.btn-secondary:hover {
  background: #f0f6ff;
}

.add-more-section {
  padding: 16px;
  text-align: center;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
  flex-shrink: 0;
}

.add-more-btn {
  min-width: 160px;
}


.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
  gap: 12px;
}

.color-count {
  font-size: 12px;
  color: #666;
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #e1e5e9;
}

.group-colors-container {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.colors-with-actions {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.group-colors-grid {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  align-content: start;
}

.group-color-card {
  position: relative;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  min-height: 160px;
}

.group-color-card:hover {
  border-color: #007ACC;
  box-shadow: 0 4px 12px rgba(0, 122, 204, 0.15);
  transform: translateY(-2px);
}

.group-color-card .color-swatch {
  width: 100%;
  height: 80px;
  border-bottom: 1px solid #e1e5e9;
}

.group-color-card .color-info {
  padding: 12px;
  padding-right: 16px; 
  min-height: 70px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.group-color-card .color-name {
  font-weight: 500;
  font-size: 14px;
  margin-bottom: 6px;
  color: #333;
  word-break: break-word;
  line-height: 1.3;
}

.group-color-card .color-hex {
  font-size: 12px;
  color: #666;
  word-break: break-word;
  line-height: 1.2;
}

.group-color-card .color-actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: none;
  gap: 4px;
  background: rgba(255, 255, 255, 0.95);
  padding: 6px;
  border-radius: 6px;
  backdrop-filter: blur(4px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.group-color-card:hover .color-actions {
  display: flex;
}

.action-btn-small {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  transition: background-color 0.2s;
}

.action-btn-small:hover {
  background: rgba(255, 255, 255, 1);
}

.action-btn-small.danger:hover {
  background: #ff4444;
  color: white;
}

.empty-content {
  text-align: center;
  max-width: 300px;
}

.empty-content h5 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 16px;
}

.empty-content p {
  margin: 0 0 20px 0;
  color: #666;
  font-size: 14px;
  line-height: 1.5;
}
</style>
