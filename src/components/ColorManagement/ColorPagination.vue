<template>
  <div class="color-pagination">
    <button 
      class="page-btn" 
      @click="$emit('page-change', 1)" 
      :disabled="currentPage === 1"
      :title="$t('colorPagination.first')"
    >
      ⪸
    </button>
    <button 
      class="page-btn" 
      @click="$emit('page-change', currentPage - 1)" 
      :disabled="currentPage === 1"
      :title="$t('colorPagination.prev')"
    >
      ❮
    </button>
    <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
    <button 
      class="page-btn" 
      @click="$emit('page-change', currentPage + 1)" 
      :disabled="currentPage === totalPages"
      :title="$t('colorPagination.next')"
    >
      ❯
    </button>
    <button 
      class="page-btn" 
      @click="$emit('page-change', totalPages)" 
      :disabled="currentPage === totalPages"
      :title="$t('colorPagination.last')"
    >
      ⪸
    </button>
  </div>
</template>

<script>
export default {
  name: 'ColorPagination',
  props: {
    currentPage: {
      type: Number,
      required: true
    },
    totalPages: {
      type: Number,
      required: true
    }
  },
  emits: ['page-change']
}
</script>

<style scoped>
.color-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 16px;
  border-top: 1px solid #e1e5e9;
  background: #f8f9fa;
  flex-shrink: 0;
}

.page-btn {
  width: 32px;
  height: 32px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: #f0f6ff;
  border-color: #007ACC;
  color: #007ACC;
}

.page-btn:disabled {
  background: #f5f5f5;
  color: #ccc;
  cursor: not-allowed;
}

.page-info {
  padding: 0 16px;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}
</style>
