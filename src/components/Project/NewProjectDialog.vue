<template>
  <el-dialog
    v-model="visible"
    :title="t('newProjectDialog.title')"
    width="1200px"
    :before-close="handleClose"
    destroy-on-close
    class="new-project-dialog"
  >
    
    <el-tabs v-model="activeTab" class="project-tabs" tab-position="top">
      
      <el-tab-pane :label="t('newProjectDialog.tabCreate')" name="create">
        <template #label>
          <span class="tab-label">
            <el-icon><document-add /></el-icon>
            {{ t('newProjectDialog.tabCreate') }}
          </span>
        </template>
        
        <div class="tab-content">
          <ProjectForm
            ref="projectFormRef"
            @submit="handleCreateProject"
            @cancel="handleClose"
          />
        </div>
      </el-tab-pane>
      
      
      <el-tab-pane :label="t('newProjectDialog.tabHistory')" name="history">
        <template #label>
          <span class="tab-label">
            <el-icon><folder-opened /></el-icon>
            {{ t('newProjectDialog.tabHistory') }}
          </span>
        </template>
        
        <div class="tab-content">
          <ProjectHistory
            ref="projectHistoryRef"
            @edit="handleEditProject"
            @import="handleImportProject"
            @delete="handleDeleteProject"
          />
        </div>
      </el-tab-pane>
    </el-tabs>
    
    
    <template #footer v-if="activeTab === 'create'">
      <div class="dialog-footer">
        <el-button @click="handleClose">{{ t('common.cancel') }}</el-button>
        <el-button 
          type="primary" 
          @click="handleSubmit"
          :loading="submitting"
        >
          {{ t('newProjectDialog.createProject') }}
        </el-button>
      </div>
    </template>
  </el-dialog>

  
  <el-dialog
    v-model="editDialogVisible"
    :title="t('newProjectDialog.editTitle')"
    width="1000px"
    destroy-on-close
    class="edit-project-dialog"
  >
    <ProjectForm
      ref="editFormRef"
      :initial-data="editingProject"
      :is-edit-mode="true"
      @submit="handleUpdateProject"
      @cancel="editDialogVisible = false"
    />
    
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="editDialogVisible = false">{{ t('common.cancel') }}</el-button>
        <el-button 
          type="primary" 
          @click="handleUpdateSubmit"
          :loading="updating"
        >
          {{ t('newProjectDialog.saveChanges') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script>
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { DocumentAdd, FolderOpened } from '@element-plus/icons-vue'
import ProjectForm from './ProjectForm.vue'
import ProjectHistory from './ProjectHistory.vue'
import { useProjectStorage } from '../../composables/useProjectStorage.js'

export default {
  name: 'NewProjectDialog',
  components: {
    ProjectForm,
    ProjectHistory,
    DocumentAdd,
    FolderOpened
  },
  props: {
    modelValue: {
      type: Boolean,
      default: false
    }
  },
  emits: ['update:modelValue', 'project-created', 'project-imported'],
  setup(props, { emit }) {
    const { t } = useI18n()
    const activeTab = ref('create') // 
    const submitting = ref(false)
    const updating = ref(false)
    const editDialogVisible = ref(false)
    const editingProject = ref(null)
    
    const projectFormRef = ref(null)
    const editFormRef = ref(null)
    const projectHistoryRef = ref(null)
    
    // 
    const { 
      createProject, 
      updateProject, 
      deleteProject,
      validateProjectData 
    } = useProjectStorage()
    
    // 
    const visible = computed({
      get: () => props.modelValue,
      set: (value) => emit('update:modelValue', value)
    })

    const projectHistoryApi = {
      refreshProjects: () => projectHistoryRef.value?.refreshProjects?.()
    }
    
    // 
    const handleCreateProject = async (projectData) => {
      submitting.value = true
      
      try {
        const validation = validateProjectData(projectData)
        if (!validation.isValid) {
          ElMessage.error(validation.errors.join(', '))
          return
        }

        const result = await createProject(projectData)

        if (result.success) {
          ElMessage.success(t('newProjectDialog.createOk'))
          emit('project-created', result.data)
          await projectHistoryApi.refreshProjects()
          handleClose()
        } else {
          ElMessage.error(t('newProjectDialog.createFail', { msg: result.error }))
        }
      } catch (error) {
        console.error('Create project error:', error)
        ElMessage.error(t('newProjectDialog.createFail', { msg: error.message }))
      } finally {
        submitting.value = false
      }
    }
    
    const handleEditProject = (project) => {
      editingProject.value = { ...project }
      editDialogVisible.value = true
    }
    
    const handleUpdateProject = async (projectData) => {
      updating.value = true
      
      try {
        const validation = validateProjectData(projectData)
        if (!validation.isValid) {
          ElMessage.error(validation.errors.join(', '))
          return
        }

        const result = await updateProject(editingProject.value.id, projectData)

        if (result.success) {
          ElMessage.success(t('newProjectDialog.updateOk'))
          editDialogVisible.value = false
          editingProject.value = null
          await projectHistoryApi.refreshProjects()
        } else {
          ElMessage.error(t('newProjectDialog.updateFail', { msg: result.error }))
        }
      } catch (error) {
        console.error('Update project error:', error)
        ElMessage.error(t('newProjectDialog.updateFail', { msg: error.message }))
      } finally {
        updating.value = false
      }
    }
    
    const handleImportProject = (project) => {
      emit('project-imported', project)
      ElMessage.success(t('edit.projectImported', { name: project.name }))
      handleClose()
    }
    
    const handleDeleteProject = async (project) => {
      try {
        await ElMessageBox.confirm(
          t('projectHistory.deleteConfirm', { name: project.name }),
          t('projectHistory.deleteTitle'),
          {
            confirmButtonText: t('templateManager.delete'),
            cancelButtonText: t('common.cancel'),
            type: 'warning',
            confirmButtonClass: 'el-button--danger'
          }
        )
        
        const result = await deleteProject(project.id)
        
        if (result.success) {
          ElMessage.success(t('projectHistory.deletedNamed', { name: project.name }))
          await projectHistoryApi.refreshProjects()
        } else {
          ElMessage.error(t('projectHistory.deleteFailMsg', { msg: result.error }))
        }
      } catch (error) {
        if (error !== 'cancel') {
          console.error('Delete project error:', error)
          ElMessage.error(t('projectHistory.deleteFailMsg', { msg: error.message }))
        }
      }
    }
    
    // 
    const handleSubmit = () => {
      if (projectFormRef.value) {
        projectFormRef.value.submit()
      }
    }
    
    // 
    const handleUpdateSubmit = () => {
      if (editFormRef.value) {
        editFormRef.value.submit()
      }
    }
    
    // 
    const handleClose = () => {
      visible.value = false
      editDialogVisible.value = false
      editingProject.value = null
    }
    
    return {
      t,
      activeTab,
      visible,
      submitting,
      updating,
      editDialogVisible,
      editingProject,
      projectFormRef,
      editFormRef,
      projectHistoryRef,
      
      handleCreateProject,
      handleEditProject,
      handleUpdateProject,
      handleImportProject,
      handleDeleteProject,
      handleSubmit,
      handleUpdateSubmit,
      handleClose
    }
  }
}
</script>

<style scoped>
.new-project-dialog {
  
  .project-tabs {
    height: 100%;
    
    :deep(.el-tabs__header) {
      margin-bottom: 0;
      border-bottom: 1px solid var(--el-border-color-light);
    }
    
    :deep(.el-tabs__content) {
      height: calc(100% - 40px);
      padding: 0;
    }
    
    :deep(.el-tab-pane) {
      height: 100%;
      overflow: auto;
    }
    
    .tab-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      
      .el-icon {
        font-size: 16px;
      }
    }
    
    .tab-content {
      padding: 24px;
      height: calc(100% - 48px);
      overflow: auto;
    }
  }
  
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
}

.edit-project-dialog {
  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
}


:deep(.el-dialog__body) {
  padding: 0;
  height: 600px;
}

:deep(.el-dialog__header) {
  padding: 20px 24px 16px 24px;
}

:deep(.el-dialog__footer) {
  padding: 16px 24px 20px 24px;
}
</style>
