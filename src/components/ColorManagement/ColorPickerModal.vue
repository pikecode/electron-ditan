<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h3>{{ $t('colorManagement.groupsTitle') }}</h3>
        <button class="close-btn" @click="close">×</button>
      </div>
      

      <div class="modal-footer">
        <button class="btn btn-close" @click="close">
          {{ $t('common.close') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { colorAPI } from '../../api'

export default {
  name: 'ColorPickerModal',
  data() {
    return {
      // 
      showAddColor: false,
      globalColors: [],
      availableColors: [],
      selectedColors: [],
      loadingGlobalColors: false,
      globalColorError: null
    }
  },
  computed: {
    // 
    getGroupColorCount() {
      return (group) => {
        return group.colors ? group.colors.length : 0
      }
    }
  },
  mounted() {
    this.loadGlobalColors()
  },
  methods: {
    // ====================  ====================
    showAddColorModal() {
      if (!this.currentGroup) return
      
      this.showAddColor = true
      this.selectedColors = []
      this.updateAvailableColors()
    },

    hideAddColorModal() {
      this.showAddColor = false
      this.selectedColors = []
    },

    toggleColorSelection(color) {
      const index = this.selectedColors.indexOf(color.id)
      if (index > -1) {
        this.selectedColors.splice(index, 1)
      } else {
        this.selectedColors.push(color.id)
      }
    },


    // ====================  ====================
    normalizeHexColor(hex) {
      if (!hex) return '#FF0000'
      
      let color = hex.toString().trim()
      if (color.startsWith('#')) {
        color = color.substring(1)
      }
      
      if (color.length === 3) {
        color = color.split('').map(c => c + c).join('')
      } else if (color.length !== 6) {
        console.warn('Invalid hex color:', hex, 'using default red')
        return '#FF0000'
      }
      
      if (!/^[0-9A-Fa-f]{6}$/.test(color)) {
        console.warn('Invalid hex format:', hex, 'using default red')
        return '#FF0000'
      }
      
      return '#' + color.toUpperCase()
    },

    handleOverlayClick() {
      this.close()
    },

    close() {
      this.$emit('close')
    },

    // ==================== API ====================
    // API
    
  },
  emits: ['close']
}
</script>

<style scoped>

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 800;
}

.modal {
  background: white;
  border-radius: 8px;
  width: 900px;
  max-width: 95vw;
  max-height: 85vh;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #eee;
  flex-shrink: 0;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #666;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
  flex: 1;
  overflow: hidden;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 20px;
  border-top: 1px solid #eee;
  background: #fafafa;
  flex-shrink: 0;
}



.edit-btn, .delete-btn {
  background: none;
  border: none;
  padding: 4px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s ease;
}

.edit-btn:hover {
  background: rgba(25, 118, 210, 0.1);
}

.delete-btn:hover {
  background: rgba(244, 67, 54, 0.1);
}


.action-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 70px;
}

.action-btn .btn-icon {
  font-size: 14px;
}

.action-btn .btn-label {
  font-size: 11px;
  font-weight: 500;
}

.action-btn:hover {
  background: #e0e0e0;
  border-color: #007acc;
  transform: translateY(-1px);
}

.add-color-btn {
  background: #e8f5e8;
  border-color: #4CAF50;
  color: #2e7d32;
}

.add-color-btn:hover {
  background: #c8e6c9;
  border-color: #388e3c;
}

.export-btn {
  background: #e3f2fd;
  border-color: #2196F3;
  color: #1565c0;
}

.export-btn:hover {
  background: #bbdefb;
  border-color: #1976d2;
}

.group-colors {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  padding: 4px;
}

.color-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 10px;
  transition: all 0.2s ease;
  position: relative;
}

.color-card:hover {
  border-color: #007acc;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.color-card .color-swatch {
  width: 100%;
  height: 40px;
  border-radius: 4px;
  border: 1px solid #ddd;
  margin-bottom: 8px;
}

.color-card .color-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.color-card .color-name {
  font-size: 12px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-card .color-code {
  font-size: 10px;
  color: #666;
  font-family: 'Courier New', monospace;
}

.remove-from-group-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 12px;
  color: #ff4757;
  font-weight: bold;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.color-card:hover .remove-from-group-btn {
  opacity: 1;
}

.remove-from-group-btn:hover {
  background: #ff4757;
  color: white;
}

.no-group-selected {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  text-align: center;
}

.prompt-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.prompt-text {
  font-size: 14px;
  line-height: 1.5;
}


.sub-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
}

.sub-modal {
  background: white;
  border-radius: 8px;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

.sub-modal.large {
  width: 600px;
  max-height: 70vh;
}

.sub-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
}

.sub-modal-header h4 {
  margin: 0;
  font-size: 14px;
  color: #333;
  font-weight: 600;
}

.sub-modal-body {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.sub-modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #eee;
  background: #fafafa;
}

.selected-count {
  font-size: 12px;
  color: #666;
  flex: 1;
}


.global-colors-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.section-header h5 {
  margin: 0;
  font-size: 13px;
  color: #333;
  font-weight: 600;
}

.color-count {
  font-size: 11px;
  color: #666;
}

.global-color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
  max-height: 300px;
  overflow-y: auto;
  padding: 4px;
}

.global-color-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.global-color-card:hover {
  border-color: #007acc;
  transform: translateY(-1px);
}

.global-color-card.selected {
  border-color: #4CAF50;
  background: #f1f8e9;
}

.global-color-card .color-swatch {
  width: 100%;
  height: 30px;
  border-radius: 4px;
  border: 1px solid #ddd;
  margin-bottom: 6px;
}

.global-color-card .color-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.global-color-card .color-name {
  font-size: 11px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-color-card .color-code {
  font-size: 9px;
  color: #666;
  font-family: 'Courier New', monospace;
}

.selection-indicator {
  position: absolute;
  top: 4px;
  right: 4px;
  background: #4CAF50;
  color: white;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: bold;
}


.input-group {
  margin-bottom: 16px;
}

.input-group label {
  display: block;
  font-size: 12px;
  color: #333;
  margin-bottom: 6px;
  font-weight: 500;
}

.input-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.input-group input:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}


.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
  border: 1px solid #ddd;
}

.btn-cancel:hover {
  background: #e0e0e0;
  border-color: #bbb;
}

.btn-confirm {
  background: #4CAF50;
  color: white;
  border: 1px solid #4CAF50;
}

.btn-confirm:hover:not(:disabled) {
  background: #45a049;
  border-color: #45a049;
}

.btn-confirm:disabled {
  background: #cccccc;
  color: #666;
  border-color: #cccccc;
  cursor: not-allowed;
}

.btn-close {
  background: #6c757d;
  color: white;
  border: 1px solid #6c757d;
}

.btn-close:hover {
  background: #5a6268;
  border-color: #545b62;
}


.loading-message, .error-message, .empty-message {
  text-align: center;
  padding: 20px;
  font-size: 13px;
  border-radius: 4px;
  margin: 10px 0;
}

.loading-message {
  color: #666;
  background: #f8f9fa;
}

.error-message {
  color: #d32f2f;
  background: #ffebee;
  border: 1px solid #ffcdd2;
}

.empty-message {
  color: #757575;
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
}

.retry-btn {
  margin-left: 8px;
  padding: 2px 6px;
  background: #d32f2f;
  color: white;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
}

.retry-btn:hover {
  background: #b71c1c;
}


.groups-list::-webkit-scrollbar,
.group-colors::-webkit-scrollbar,
.global-color-grid::-webkit-scrollbar {
  width: 6px;
}

.groups-list::-webkit-scrollbar-track,
.group-colors::-webkit-scrollbar-track,
.global-color-grid::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.groups-list::-webkit-scrollbar-thumb,
.group-colors::-webkit-scrollbar-thumb,
.global-color-grid::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.groups-list::-webkit-scrollbar-thumb:hover,
.group-colors::-webkit-scrollbar-thumb:hover,
.global-color-grid::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}


@media (max-width: 768px) {
  .modal {
    width: 95vw;
    max-height: 90vh;
  }
  
  .group-management-container {
    flex-direction: column;
    gap: 15px;
  }
  
  .color-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 8px;
  }
  
  .global-color-grid {
    grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
    gap: 8px;
  }
}
</style>