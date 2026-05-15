<template>
  <div 
    class="color-card" 
    :class="{ selected: selected }"
    @click="handleClick"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <button
      v-if="selectionEnabled"
      class="selection-toggle"
      :class="{ checked: selected }"
      type="button"
      @click.stop="$emit('toggle-select', color)"
      :aria-label="$t('colorManagement.selected')"
    >
      <span class="selection-mark">{{ selected ? '✓' : '' }}</span>
    </button>
    <div class="color-swatch" :style="{ backgroundColor: color.hex || color.color || '#000000' }"></div>
    <div class="color-info">
      <div class="color-name">{{ displayName }}</div>
      <div class="color-id">{{ color.id || color.hex }}</div>
      <div class="color-meta" v-if="color.createdAt">
        <span class="created-time">{{ formatTime(color.createdAt) }}</span>
      </div>
    </div>
    <div class="color-actions" v-if="showActions">
      <button class="color-action-btn danger" @click.stop="$emit('delete', color)" :title="$t('colorManagement.delete')">
        🗑️
      </button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ColorCard',
  props: {
    color: {
      type: Object,
      required: true
    },
    showActions: {
      type: Boolean,
      default: true
    },
    selectable: {
      type: Boolean,
      default: false
    },
    selected: {
      type: Boolean,
      default: false
    },
    selectionEnabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['click', 'delete', 'mouseenter', 'mouseleave', 'toggle-select'],
  computed: {
    displayName() {
      if (!this.color) return 'Unknown Color'
      
      //  name hex id
      if (this.color.name && this.color.name !== 'unknown' && this.color.name.trim()) {
        return this.color.name
      }
      if (this.color.hex) {
        return this.color.hex
      }
      if (this.color.id) {
        return this.color.id
      }
      return 'Unknown Color'
    }
  },
  methods: {
    handleClick() {
      console.log('ColorCard clicked:', this.color)
      this.$emit('click', this.color)
    },
    handleMouseEnter(event) {
      this.$emit('mouseenter', this.color, event)
    },
    handleMouseLeave(event) {
      this.$emit('mouseleave', this.color, event)
    },
    formatTime(timeString) {
      return new Date(timeString).toLocaleDateString('zh-CN', {
        month: 'short',
        day: 'numeric'
      })
    }
  },
  mounted() {
    // 
    console.log('ColorCard mounted with color:', this.color)
  }
}
</script>

<style scoped>
.color-card {
  position: relative;
  border: 1px solid #e1e5e9;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  background: white;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.selection-toggle {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 2;
  width: 18px;
  height: 18px;
  border: 1px solid rgba(15, 23, 42, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
  backdrop-filter: blur(4px);
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

.color-card:hover {
  border-color: #007ACC;
  box-shadow: 0 4px 12px rgba(0, 122, 204, 0.15);
  transform: translateY(-2px);
}

.color-card.selected {
  border-color: #007ACC;
  background: #e6f3ff;
  border-width: 2px;
  box-shadow: 0 2px 4px rgba(0, 122, 204, 0.2);
}

.color-swatch {
  width: 100%;
  height: 40px;
  border-bottom: 1px solid #e1e5e9;
}

.color-info {
  padding: 6px;
}

.color-name {
  font-weight: 500;
  font-size: 10px;
  margin-bottom: 2px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.color-id {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 9px;
  color: #666;
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}


.color-meta {
  font-size: 8px;
  color: #999;
}

.color-actions {
  position: absolute;
  top: 2px;
  right: 2px;
  display: none;
  gap: 2px;
}

.color-card:hover .color-actions {
  display: flex;
}

.color-action-btn {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
  transition: background-color 0.2s;
  backdrop-filter: blur(4px);
}

.color-action-btn:hover {
  background: rgba(255, 255, 255, 1);
}

.color-action-btn.danger:hover {
  background: #ff4444;
  color: white;
}
</style>
