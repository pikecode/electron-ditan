<template>
  <div class="color-library-panel">
    <div class="panel-header">
      <div class="header-left">
        <h4>{{ $t('colorManagement.libraryTitle') }}</h4>
        <div class="header-stats">
          <span class="stat-number">{{ colors.length }}</span>
          <span class="stat-label">{{ $t('colorManagement.totalColors') }}</span>
        </div>
        <div v-if="selectedCount > 0" class="header-stats selected-stats">
          <span class="stat-number">{{ selectedCount }}</span>
          <span class="stat-label">{{ $t('colorManagement.selected') }}</span>
        </div>
      </div>
      <div class="header-actions">
        <button
          class="action-btn"
          :disabled="colors.length === 0"
          :title="allSelected ? $t('colorManagement.deselectAll') : $t('colorManagement.selectAll')"
          @click="toggleSelectAll"
        >
          <span class="btn-icon">{{ allSelected ? '☑️' : '☐' }}</span>
          <span class="btn-label">{{ allSelected ? $t('colorManagement.deselectAll') : $t('colorManagement.selectAll') }}</span>
        </button>
        <button
          class="action-btn"
          :disabled="selectedCount === 0"
          :title="$t('colorManagement.clearSelection')"
          @click="clearSelection"
        >
          <span class="btn-icon">🧹</span>
          <span class="btn-label">{{ $t('colorManagement.clearSelection') }}</span>
        </button>
        <button
          class="action-btn danger"
          :disabled="selectedCount === 0"
          :title="$t('colorManagement.bulkDelete')"
          @click="handleBatchDelete"
        >
          <span class="btn-icon">🗑️</span>
          <span class="btn-label">{{ $t('colorManagement.bulkDelete') }}</span>
        </button>
        <button class="action-btn" :title="$t('colorManagement.import')" @click="$emit('import')">
          <span class="btn-icon">📁</span>
          <span class="btn-label">{{ $t('colorManagement.import') }}</span>
        </button>
        <button class="action-btn" :title="$t('colorManagement.export')" @click="$emit('export')">
          <span class="btn-icon">📤</span>
          <span class="btn-label">{{ $t('colorManagement.export') }}</span>
        </button>
      </div>
    </div>

    <div class="library-content">
      <div v-if="loading" class="state-block">
        {{ $t('colorGrid.loading') }}
      </div>
      <div v-else-if="colors.length === 0" class="state-block">
        {{ $t('colorGrid.empty') }}
      </div>
      <div v-else class="library-grid">
        <div
          v-for="color in visibleColors"
          :key="color.id"
          class="library-color-card"
          :class="{ selected: isColorSelected(color.id) }"
          @click="$emit('color-click', color)"
        >
          <button
            class="selection-toggle"
            :class="{ checked: isColorSelected(color.id) }"
            type="button"
            :aria-label="$t('colorManagement.selected')"
            @click.stop="toggleColorSelection(color.id)"
          >
            <span class="selection-mark">{{ isColorSelected(color.id) ? '✓' : '' }}</span>
          </button>

          <div class="card-actions">
            <button
              class="card-action-btn"
              type="button"
              :title="$t('colorManagement.edit')"
              @click.stop="$emit('color-edit', color)"
            >
              ✏️
            </button>
            <button
              class="card-action-btn danger"
              type="button"
              :title="$t('colorManagement.delete')"
              @click.stop="$emit('color-delete', color)"
            >
              🗑️
            </button>
          </div>

          <div
            class="color-swatch"
            :style="{ backgroundColor: color.hex || color.color || '#000000' }"
          ></div>
          <div class="color-info">
            <div class="color-name">{{ getDisplayName(color) }}</div>
            <div class="color-id">{{ color.id || color.hex }}</div>
            <div v-if="color.createdAt" class="color-meta">{{ formatTime(color.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
export default {
  name: 'ColorLibraryPanel',
  props: {
    colors: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    itemsPerPage: {
      type: Number,
      default: 100
    }
  },
  emits: ['import', 'export', 'color-click', 'color-edit', 'color-delete', 'batch-delete'],
  data() {
    return {
      selectedColorIds: []
    }
  },
  computed: {
    visibleColors() {
      return this.colors
    },
    selectedCount() {
      return this.selectedColorIds.length
    },
    allSelected() {
      return this.colors.length > 0 && this.selectedColorIds.length === this.colors.length
    }
  },
  watch: {
    colors: {
      handler(newColors) {
        const validIds = new Set(newColors.map(color => color.id))
        this.selectedColorIds = this.selectedColorIds.filter(id => validIds.has(id))
      },
      immediate: true
    }
  },
  methods: {
    isColorSelected(colorId) {
      return this.selectedColorIds.includes(colorId)
    },
    toggleColorSelection(colorId) {
      if (this.isColorSelected(colorId)) {
        this.selectedColorIds = this.selectedColorIds.filter(id => id !== colorId)
        return
      }
      this.selectedColorIds = [...this.selectedColorIds, colorId]
    },
    toggleSelectAll() {
      this.selectedColorIds = this.allSelected ? [] : this.colors.map(color => color.id)
    },
    clearSelection() {
      this.selectedColorIds = []
    },
    handleBatchDelete() {
      const selectedColors = this.colors.filter(color => this.selectedColorIds.includes(color.id))
      if (!selectedColors.length) return
      this.$emit('batch-delete', selectedColors)
    },
    getDisplayName(color) {
      if (!color) return 'Unknown Color'
      if (color.name && color.name !== 'unknown' && color.name.trim()) {
        return color.name
      }
      return color.hex || color.id || 'Unknown Color'
    },
    formatTime(timeString) {
      return new Date(timeString).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric'
      })
    }
  }
}
</script>

<style scoped>
.color-library-panel {
  position: relative;
  flex: 1 1 auto;
  height: 100%;
  width: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  background: white;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  overflow: hidden;
  isolation: isolate;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid #e1e5e9;
  background: #f8f9fa;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.header-left h4 {
  margin: 0;
  color: #333;
  font-size: 18px;
  font-weight: 600;
}

.header-stats {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
  border: 1px solid #e1e5e9;
}

.selected-stats {
  border-color: #cfe7ff;
  background: #f0f6ff;
}

.stat-number {
  font-weight: 600;
  color: #007acc;
}

.stat-label {
  font-size: 12px;
  color: #666;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
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
  border-color: #007acc;
  color: #007acc;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.danger:not(:disabled):hover {
  background: #fff1f0;
  border-color: #d9363e;
  color: #d9363e;
}

.btn-icon {
  font-size: 14px;
}

.btn-label {
  font-weight: 500;
}

.library-content {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
  background: #fff;
  isolation: isolate;
}

.library-grid {
  position: relative;
  flex: 1 1 auto;
  height: 100%;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 12px;
  padding: 12px;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  align-content: start;
  background: #fff;
  isolation: isolate;
}

.library-grid::-webkit-scrollbar {
  width: 10px;
}

.library-grid::-webkit-scrollbar-track {
  background: #f3f5f7;
  border-left: 1px solid #eef1f4;
}

.library-grid::-webkit-scrollbar-thumb {
  background: #c5ced8;
  border-radius: 999px;
  border: 2px solid #f3f5f7;
}

.library-grid::-webkit-scrollbar-thumb:hover {
  background: #aeb9c6;
}

.state-block {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 14px;
  padding: 24px;
  background: #fff;
}

.library-color-card {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 116px;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: white;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  z-index: 0;
}

.library-color-card:hover {
  border-color: #007acc;
  box-shadow: 0 8px 20px rgba(0, 122, 204, 0.12);
  transform: translateY(-1px);
}

.library-color-card.selected {
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.12);
  background: #f7fbff;
}

.selection-toggle {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
  width: 18px;
  height: 18px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.96);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
}

.selection-toggle.checked {
  background: #007acc;
  border-color: #007acc;
  color: #fff;
}

.selection-mark {
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
}

.card-actions {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 2;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.library-color-card:hover .card-actions,
.library-color-card.selected .card-actions {
  opacity: 1;
}

.card-action-btn {
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.96);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 10px;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.card-action-btn:hover {
  background: #eaf4ff;
  color: #007acc;
}

.card-action-btn.danger:hover {
  background: #fff1f0;
  color: #d9363e;
}

.color-swatch {
  height: 56px;
  border-bottom: 1px solid #e1e5e9;
  flex-shrink: 0;
}

.color-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  min-height: 0;
}

.color-name {
  font-weight: 600;
  font-size: 12px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.color-id {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 10px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.color-meta {
  font-size: 10px;
  color: #999;
}
</style>
