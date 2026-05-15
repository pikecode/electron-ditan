<template>
  <div class="project-history">
    
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><loading /></el-icon>
      <span>{{ t('localProjectHistory.loading') }}</span>
    </div>
    
    
    <div v-else-if="error" class="error-container">
      <el-icon class="error-icon"><warning-filled /></el-icon>
      <span class="error-message">{{ error }}</span>
      <el-button type="primary" size="small" @click="refreshProjects">
        {{ t('projectHistory.reload') }}
      </el-button>
    </div>
    
    
    <div v-else-if="hasProjects" class="project-list">
      <div class="list-header">
        <div class="header-info">
          <span class="project-count">{{ t('localProjectHistory.projectCount', { n: projectCount }) }}</span>
        </div>
        <el-input
          v-model="searchKeyword"
          :placeholder="t('projectHistory.searchPh')"
          clearable
          size="small"
          style="width: 180px;"
          @input="handleSearch"
        >
          <template #prefix>
            <el-icon><search /></el-icon>
          </template>
        </el-input>
      </div>
      
      <div class="project-cards">
        <div 
          v-for="project in displayProjects" 
          :key="project.id"
          class="project-card"
        >
          
          <div class="card-header">
            <div class="project-icon">
              <el-icon><document /></el-icon>
            </div>
            <div class="project-info">
              <h5 class="project-name">{{ project.name }}</h5>
              <p class="project-date">{{ formatDate(project.createdAt) }}</p>
            </div>
          </div>
          
          
          <div class="card-content">
            
            <div v-if="project.image && project.image.name" class="image-section">
              <div class="image-preview" v-if="project.image.thumbnail">
                <img 
                  :src="project.image.thumbnail" 
                  :alt="project.image.name"
                  class="preview-img"
                  @error="handleImageError($event, project)"
                  @load="handleImageLoad($event, project)"
                />
              </div>
              <div v-else class="image-placeholder">
                <el-icon class="placeholder-icon"><picture-filled /></el-icon>
                <span class="placeholder-text">{{ t('projectHistory.previewUnavailable') }}</span>
              </div>
              <div class="image-info">
                <div class="info-row">
                  <el-icon class="info-icon"><picture-filled /></el-icon>
                  <span class="info-text">
                    {{ project.image.name }} 
                    <span class="info-secondary">
                      ({{ project.image.size.width }}×{{ project.image.size.height }})
                    </span>
                  </span>
                </div>
              </div>
            </div>
            
            
            <div v-if="project.grid.length" class="info-row">
              <el-icon class="info-icon"><grid /></el-icon>
              <span class="info-text">
                {{ t('localProjectHistory.gridInfo', { cols: project.grid.length, rows: project.grid.width }) }}
                <span class="info-secondary">
                  , {{ t('localProjectHistory.cellSize', { n: project.grid.cellSize }) }}
                </span>
              </span>
            </div>
            
            
            <div v-if="project.colorConfig.type" class="info-row">
              <el-icon class="info-icon"><brush-filled /></el-icon>
              <span class="info-text">
                {{ t('localProjectHistory.colorsPrefix') }}
                <span v-if="project.colorConfig.type === 'group'">
                  {{ getColorGroupName(project) }}
                </span>
                <span v-else>
                  {{ t('localProjectHistory.colorPickCount', { n: project.colorConfig.colorCount }) }}
                </span>
              </span>
            </div>
            
            
            <div class="info-row">
              <el-icon class="info-icon"><clock /></el-icon>
              <span class="info-text info-secondary">
                {{ t('localProjectHistory.updated', { date: formatDate(project.updatedAt) }) }}
              </span>
            </div>
          </div>
          
          
          <div class="card-actions">
            <el-button 
              type="primary" 
              size="small" 
              @click="handleEdit(project)"
            >
              <el-icon><edit /></el-icon>
              {{ t('projectHistory.edit') }}
            </el-button>
            
            <el-button 
              type="success" 
              size="small" 
              @click="handleImport(project)"
            >
              <el-icon><download /></el-icon>
              {{ t('localProjectHistory.import') }}
            </el-button>
            
            <el-button 
              type="danger" 
              size="small" 
              @click="handleDelete(project)"
            >
              <el-icon><delete /></el-icon>
              {{ t('localProjectHistory.delete') }}
            </el-button>
          </div>
        </div>
      </div>
      
      
      <div v-if="totalPages > 1" class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredProjects.length"
          layout="prev, pager, next"
          small
        />
      </div>
    </div>
    
    
    <div v-else class="empty-state">
      <el-icon class="empty-icon"><folder-opened /></el-icon>
      <h4>{{ t('localProjectHistory.emptyTitle') }}</h4>
      <p>{{ t('projectHistory.emptyHintLong') }}</p>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  Loading, 
  WarningFilled, 
  Search, 
  Document, 
  PictureFilled, 
  Grid, 
  BrushFilled, 
  Clock, 
  Edit, 
  Download, 
  Delete, 
  FolderOpened 
} from '@element-plus/icons-vue'
import { useProjectStorage } from '../../composables/useProjectStorage.js'
import { useColorGroups } from '../../composables/useColorGroups.js'

export default {
  name: 'ProjectHistory',
  components: {
    Loading,
    WarningFilled,
    Search,
    Document,
    PictureFilled,
    Grid,
    BrushFilled,
    Clock,
    Edit,
    Download,
    Delete,
    FolderOpened
  },
  emits: ['edit', 'import', 'delete'],
  setup(props, { emit }) {
    const { t, locale } = useI18n()
    const searchKeyword = ref('')
    const currentPage = ref(1)
    const pageSize = ref(6) // 6
    
    // 
    const { 
      projects, 
      loading, 
      error, 
      loadProjects,
      searchProjects
    } = useProjectStorage()
    
    // 
    const { 
      colorGroups
    } = useColorGroups({ autoLoad: true })
    
    // 
    const searchResults = ref([])
    const isSearching = ref(false)
    
    // 
    const filteredProjects = computed(() => {
      if (isSearching.value) {
        return searchResults.value
      }
      return projects.value
    })
    
    const displayProjects = computed(() => {
      const start = (currentPage.value - 1) * pageSize.value
      const end = start + pageSize.value
      return filteredProjects.value.slice(start, end)
    })
    
    const projectCount = computed(() => filteredProjects.value.length)
    const hasProjects = computed(() => projectCount.value > 0)
    const totalPages = computed(() => Math.ceil(filteredProjects.value.length / pageSize.value))
    
    // 
    const handleSearch = async (keyword) => {
      if (!keyword || keyword.trim() === '') {
        isSearching.value = false
        searchResults.value = []
        currentPage.value = 1
        return
      }
      
      try {
        const result = await searchProjects(keyword.trim())
        if (result.success) {
          isSearching.value = true
          searchResults.value = result.data
          currentPage.value = 1
        }
      } catch (error) {
        console.error('Search failed:', error)
      }
    }
    
    // 
    const refreshProjects = async () => {
      await loadProjects()
    }
    
    // 
    const handleEdit = (project) => {
      emit('edit', project)
    }
    
    const handleImport = (project) => {
      emit('import', project)
    }
    
    const handleDelete = (project) => {
      emit('delete', project)
    }
    
    // 
    const handleImageError = (event) => {
      event.target.style.display = 'none'
    }

    const handleImageLoad = () => {}

    // 
    const getColorCount = (project) => {
      if (!project.colorConfig) return 0
      
      if (project.colorConfig.type === 'group') {
        //  selectedColors 
        if (project.colorConfig.selectedColors && Array.isArray(project.colorConfig.selectedColors)) {
          return project.colorConfig.selectedColors.length
        }
        
        //  selectedColors colorGroups 
        if (project.colorConfig.colorGroupId && colorGroups.value) {
          const colorGroup = colorGroups.value.find(group => group.id === project.colorConfig.colorGroupId)
          if (colorGroup && colorGroup.colors) {
            return colorGroup.colors.length
          }
        }
        
        // 
        return t('projectHistory.unknownColorCount')
      } else if (project.colorConfig.type === 'count') {
        return project.colorConfig.colorCount || 0
      }
      
      return 0
    }

    // 
    const getColorGroupName = (project) => {
      if (!project.colorConfig || project.colorConfig.type !== 'group') return t('localProjectHistory.unknownGroup')
      const gid = project.colorConfig.colorGroupId || project.colorConfig.color_group_id
      const group = colorGroups.value.find(g => g.id === gid)
      if (group) return t('localProjectHistory.groupNamed', { name: group.name, n: group.colors?.length || 0 })
      if (Array.isArray(project.colorConfig.selectedColors)) return t('localProjectHistory.groupNColors', { n: project.colorConfig.selectedColors.length })
      return t('localProjectHistory.groupById', { id: gid || '?' })
    }
    // 
    const formatDate = (dateString) => {
      if (!dateString) return ''
      try {
        const date = new Date(dateString)
        const now = new Date()
        const diff = (now - date) / 1000
        const tag = locale.value === 'zh' ? 'zh-CN' : 'en-US'
        if (diff < 60) return t('localProjectHistory.justNow')
        if (diff < 3600) return t('localProjectHistory.minutesAgo', { n: Math.floor(diff / 60) })
        if (diff < 86400) return t('localProjectHistory.hoursAgo', { n: Math.floor(diff / 3600) })
        if (diff < 2592000) return t('localProjectHistory.daysAgo', { n: Math.floor(diff / 86400) })
        return date.toLocaleString(tag, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      } catch (error) {
        console.error('Date formatting error:', error)
        return dateString
      }
    }
    
    // 
    watch(searchKeyword, (newKeyword) => {
      if (newKeyword.trim() === '') {
        handleSearch('')
      }
    })
    
    onMounted(async () => {
      await refreshProjects()
    })
    
    return {
      t,
      searchKeyword,
      currentPage,
      pageSize,
      loading,
      error,
      filteredProjects,
      displayProjects,
      projectCount,
      hasProjects,
      totalPages,
      
      handleSearch,
      refreshProjects,
      handleEdit,
      handleImport,
      handleDelete,
      handleImageError,
      handleImageLoad,
      getColorCount,
      getColorGroupName,
      formatDate
    }
  }
}
</script>

<style scoped>
.project-history {
  min-height: 400px;
}

.loading-container,
.error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
}

.error-container {
  gap: 12px;
}

.error-icon {
  color: #f56c6c;
  font-size: 24px;
}

.error-message {
  color: #606266;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f0f0f0;
}

.header-info {
  display: flex;
  align-items: center;
}

.project-count {
  color: #606266;
  font-size: 14px;
  font-weight: 500;
}

.project-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
}


.project-cards::-webkit-scrollbar {
  width: 6px;
}

.project-cards::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.project-cards::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.project-cards::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.project-card {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px;
  background: #fff;
  transition: all 0.3s;
  cursor: pointer;
}

.project-card:hover {
  border-color: #c6e2ff;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.project-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f0f9ff;
  border-radius: 6px;
  margin-right: 12px;
}

.project-icon .el-icon {
  color: #409eff;
  font-size: 20px;
}

.project-info {
  flex: 1;
}

.project-name {
  margin: 0 0 4px 0;
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.2;
}

.project-date {
  margin: 0;
  color: #909399;
  font-size: 12px;
}

.card-content {
  margin-bottom: 16px;
}

.image-section {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  align-items: flex-start;
}

.image-preview {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f7fa;
  border: 1px solid #ebeef5;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s;
}

.preview-img:hover {
  transform: scale(1.05);
}

.image-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 6px;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
}

.placeholder-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.placeholder-text {
  font-size: 11px;
  text-align: center;
  line-height: 1.2;
}

.image-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.info-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.info-row:last-child {
  margin-bottom: 0;
}

.info-icon {
  width: 16px;
  height: 16px;
  margin-right: 8px;
  color: #909399;
  flex-shrink: 0;
}

.info-text {
  color: #606266;
  font-size: 13px;
  line-height: 1.4;
}

.info-secondary {
  color: #909399;
}

.card-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  border-top: 1px solid #f0f0f0;
  padding-top: 12px;
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 300px;
  color: #909399;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 16px;
  color: #c0c4cc;
}

.empty-state h4 {
  margin: 0 0 8px 0;
  color: #606266;
  font-size: 16px;
}

.empty-state p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

:deep(.el-button + .el-button) {
  margin-left: 0;
}
</style>
