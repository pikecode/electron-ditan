<template>
  <div class="color-grid">
    <div v-if="loading" class="loading-state">
      {{ $t('colorGrid.loading') }}
    </div>
    <div v-else-if="colors.length === 0" class="empty-state">
      {{ $t('colorGrid.empty') }}
    </div>
    <div v-else class="grid-container">
      <ColorCard
        v-for="color in colors"
        :key="color.id"
        :color="color"
        :show-actions="showActions"
        :selected="isColorSelected(color)"
        :selection-enabled="showSelectionCheckbox"
        @click="$emit('color-click', color)"
        @edit="$emit('color-edit', color)"
        @duplicate="$emit('color-duplicate', color)"
        @delete="$emit('color-delete', color)"
        @toggle-select="$emit('color-select-toggle', color)"
        @mouseenter="handleColorMouseEnter"
        @mouseleave="handleColorMouseLeave"
      />
    </div>
  </div>
</template>

<script>
import ColorCard from './ColorCard.vue'

export default {
  name: 'ColorGrid',
  components: {
    ColorCard
  },
  props: {
    colors: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    showActions: {
      type: Boolean,
      default: true
    },
    selectedColorId: {
      type: [String, Number],
      default: null
    },
    selectedColorIds: {
      type: Array,
      default: () => []
    },
    showSelectionCheckbox: {
      type: Boolean,
      default: false
    }
  },
  emits: ['color-click', 'color-edit', 'color-duplicate', 'color-delete', 'color-mouseenter', 'color-mouseleave', 'color-select-toggle'],
  methods: {
    isColorSelected(color) {
      if (Array.isArray(this.selectedColorIds) && this.selectedColorIds.length > 0) {
        return this.selectedColorIds.includes(color.id)
      }
      return !!this.selectedColorId && color.id === this.selectedColorId
    },
    handleColorMouseEnter(color, event) {
      console.log('ColorGrid handleColorMouseEnter:', { color, event })
      this.$emit('color-mouseenter', color, event)
    },
    handleColorMouseLeave(color, event) {
      console.log('ColorGrid handleColorMouseLeave:', { color, event })
      this.$emit('color-mouseleave', color, event)
    }
  },
  mounted() {
    console.log('ColorGrid mounted with colors:', this.colors)
  },
  watch: {
    colors(newColors) {
      console.log('ColorGrid colors changed:', newColors)
    }
  }
}
</script>

<style scoped>
.color-grid {
  flex: 1;
  overflow: hidden;  
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(55px, 1fr));
  gap: 6px;
  padding: 12px;  
  flex: 1;
  overflow-y: auto;
  align-content: start;  
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: #666;
  font-size: 14px;
}

.empty-state {
  flex-direction: column;
  gap: 8px;
}
</style>
