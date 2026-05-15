<template>
  <div class="project-history">
    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading"><loading /></el-icon>
      <span>{{ t('localProjectHistory.loading') }}</span>
    </div>
    <div v-else-if="!projects || projects.length===0" class="empty-state">
      <el-icon class="empty-icon"><folder-opened /></el-icon>
      <h4>{{ t('localProjectHistory.emptyTitle') }}</h4>
      <p>{{ t('localProjectHistory.emptyHint') }}</p>
    </div>
    <div v-else class="project-list">
      <div class="list-header">
        <div class="header-info">
          <span class="project-count">{{ t('localProjectHistory.projectCount', { n: total }) }}</span>
        </div>
      </div>
      <div class="project-cards">
        <div v-for="project in projects" :key="project.id" class="project-card">
          <div class="card-header">
            <div class="project-icon"><el-icon><document /></el-icon></div>
            <div class="project-info">
              <h5 class="project-name">
                {{ project.name }}
                <el-tag v-if="project.result" size="small" type="success" effect="light" class="saved-tag">{{ t('localProjectHistory.saved') }}</el-tag>
              </h5>
              <p class="project-date">{{ formatDate(project.createdAt) }}</p>
            </div>
          </div>
          <div class="card-content">
            <div v-if="project.result?.palette?.length" class="info-row">
              <el-icon class="info-icon"><brush-filled /></el-icon>
              <span class="info-text">{{ t('localProjectHistory.savedColors', { n: project.result.palette.length }) }}</span>
            </div>
            <div v-if="project.image?.thumbnail" class="image-section">
              <div class="image-preview">
                <img :src="project.image.thumbnail" :alt="project.image.name" class="preview-img" />
              </div>
              <div class="image-info">
                <div class="info-row">
                  <el-icon class="info-icon"><picture-filled /></el-icon>
                  <span class="info-text">{{ project.image.name }} <span class="info-secondary">({{ project.image.size.width }}×{{ project.image.size.height }})</span></span>
                </div>
              </div>
            </div>
            <div v-if="project.grid?.length" class="info-row">
              <el-icon class="info-icon"><grid /></el-icon>
              <span class="info-text">{{ t('localProjectHistory.gridInfo', { cols: project.grid.length, rows: project.grid.width }) }} <span class="info-secondary">, {{ t('localProjectHistory.cellSize', { n: project.grid.cellSize }) }}</span></span>
            </div>
            <div v-if="project.colorConfig?.type" class="info-row">
              <el-icon class="info-icon"><brush-filled /></el-icon>
              <span class="info-text">{{ t('localProjectHistory.colorsPrefix') }} <template v-if="project.colorConfig.type==='group'">{{ getColorGroupName(project) }}</template><template v-else>{{ t('localProjectHistory.colorPickCount', { n: project.colorConfig.colorCount }) }}</template></span>
            </div>
            <div class="info-row">
              <el-icon class="info-icon"><clock /></el-icon>
              <span class="info-text info-secondary">{{ t('localProjectHistory.updated', { date: formatDate(project.updatedAt) }) }}</span>
            </div>
          </div>
          <div class="card-actions">
            <el-button type="success" size="small" @click="$emit('import', project)"><el-icon><download /></el-icon>{{ t('localProjectHistory.import') }}</el-button>
            <el-button type="danger" size="small" @click="$emit('delete', project)"><el-icon><delete /></el-icon>{{ t('localProjectHistory.delete') }}</el-button>
          </div>
        </div>
      </div>
      <div v-if="totalPages>1" class="pagination-container">
        <el-pagination
          v-model:current-page="innerPage"
          :page-size="pageSize"
          :total="total"
          layout="prev, pager, next"
          small
          @current-change="p=>emitPage(p)"
        />
      </div>
    </div>
  </div>
</template>
<script>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Loading, FolderOpened, Document, PictureFilled, Grid, BrushFilled, Clock, Edit, Download, Delete } from '@element-plus/icons-vue'
import { useColorGroups } from '../../composables/useColorGroups.js'

export default {
  name: 'LocalProjectHistory',
  components: { Loading, FolderOpened, Document, PictureFilled, Grid, BrushFilled, Clock, Edit, Download, Delete },
  props: {
    projects: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    currentPage: { type: Number, default: 1 },
    pageSize: { type: Number, default: 6 },
    total: { type: Number, default: 0 }
  },
  emits: ['import','delete','page-change'],
  setup(props, { emit }) {
    const { t, locale } = useI18n()
    const innerPage = ref(props.currentPage)
    watch(()=>props.currentPage, v=> innerPage.value = v)

    const { colorGroups, getGroupById, loadColorGroups } = useColorGroups({ autoLoad: true })

    const totalPages = computed(()=> Math.ceil(props.total / props.pageSize))

    function emitPage(p){ emit('page-change', p) }

    function getColorGroupName(project){
      if (!project.colorConfig || project.colorConfig.type !== 'group') return t('localProjectHistory.unknownGroup')
      const gid = project.colorConfig.colorGroupId || project.colorConfig.color_group_id
      const group = colorGroups.value.find(g=>g.id===gid)
      if (group) return t('localProjectHistory.groupNamed', { name: group.name, n: group.colors?.length || 0 })
      if (Array.isArray(project.colorConfig.selectedColors)) return t('localProjectHistory.groupNColors', { n: project.colorConfig.selectedColors.length })
      return t('localProjectHistory.groupById', { id: gid || '?' })
    }

    function formatDate(dateString){
      if(!dateString) return ''
      try {
        const date = new Date(dateString)
        const now = new Date()
        const diff = (now - date)/1000
        const tag = locale.value === 'zh' ? 'zh-CN' : 'en-US'
        if (diff < 60) return t('localProjectHistory.justNow')
        if (diff < 3600) return t('localProjectHistory.minutesAgo', { n: Math.floor(diff / 60) })
        if (diff < 86400) return t('localProjectHistory.hoursAgo', { n: Math.floor(diff / 3600) })
        if (diff < 2592000) return t('localProjectHistory.daysAgo', { n: Math.floor(diff / 86400) })
        return date.toLocaleString(tag, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      } catch { return dateString }
    }

    return { t, innerPage, totalPages, emitPage, getColorGroupName, formatDate }
  }
}
</script>
<style scoped>
.project-history { min-height:400px; }
.loading-container,.empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:300px; color:#909399; }
.empty-icon { font-size:64px; margin-bottom:16px; color:#c0c4cc; }
.list-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid #f0f0f0; }
.project-cards { display:flex; flex-direction:column; gap:12px; margin-bottom:20px; max-height:480px; overflow-y:auto; padding-right:4px; }
.project-card { border:1px solid #ebeef5; border-radius:6px; padding:12px; background:#fff; transition:.3s; cursor:pointer; }
.project-card:hover { border-color:#c6e2ff; box-shadow:0 2px 8px rgba(0,0,0,0.1); }
.card-header { display:flex; align-items:center; margin-bottom:12px; }
.project-icon { width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:#f0f9ff; border-radius:6px; margin-right:12px; }
.project-icon .el-icon { color:#409eff; font-size:20px; }
.project-name { margin:0 0 4px; font-size:14px; font-weight:600; color:#303133; }
.project-date { margin:0; font-size:12px; color:#909399; }
.image-section { display:flex; gap:12px; margin-bottom:12px; align-items:flex-start; }
.image-preview { width:80px; height:80px; border-radius:6px; overflow:hidden; background:#f5f7fa; border:1px solid #ebeef5; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
.preview-img { width:100%; height:100%; object-fit:cover; }
.image-info { flex:1; display:flex; flex-direction:column; justify-content:center; }
.info-row { display:flex; align-items:center; margin-bottom:8px; }
.info-row:last-child { margin-bottom:0; }
.info-icon { width:16px; height:16px; margin-right:8px; color:#909399; }
.info-text { font-size:13px; color:#606266; }
.info-secondary { color:#909399; }
.card-actions { display:flex; gap:8px; justify-content:flex-end; border-top:1px solid #f0f0f0; padding-top:12px; }
.pagination-container { display:flex; justify-content:center; margin-top:20px; }
.saved-tag { margin-left:6px; }
</style>
