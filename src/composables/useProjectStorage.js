import { ref, computed, onMounted } from 'vue'
import { convertToBackendFormat, convertToFrontendFormat, validateProjectData, generateDefaultProjectName } from '../utils/projectDataConverter.js'
import { projectAPI } from '../utils/projectAPI.js'

export function useProjectStorage() {
  const projects = ref([])
  const loading = ref(false)
  const error = ref(null)

  const toFrontendProject = (rawProject) => {
    const frontendData = convertToFrontendFormat(rawProject)
    if (!frontendData) {
      throw new Error('Failed to convert project data to frontend format')
    }
    return frontendData
  }

  // 初始化（C++后端不需要特殊初始化）
  const initializeBackend = async () => {
    try {
      return { success: true }
    } catch (err) {
      console.error('Failed to initialize backend:', err)
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  // 加载所有项目
  const loadProjects = async () => {
    loading.value = true
    error.value = null
    
    try {
      const result = await projectAPI.getProjects()
      if (result.success) {
        const backendProjects = result.projects || result.data || []
        const validProjects = backendProjects
          .map(project => {
            try {
              return toFrontendProject(project)
            } catch {
              return null
            }
          })
          .filter(project => project !== null)

        projects.value = validProjects
        return { success: true, data: projects.value }
      } else {
        throw new Error(result.error || 'Failed to load projects')
      }
    } catch (err) {
      console.error('Failed to load projects:', err)
      error.value = err.message
      return { success: false, error: err.message }
    } finally {
      loading.value = false
    }
  }

  // 创建项目
  const createProject = async (projectData) => {
    try {
      const backendData = convertToBackendFormat(projectData)
      const result = await projectAPI.addProject(backendData)

      if (result.success) {
        const projectResult = result.project || result.data
        if (!projectResult) {
          throw new Error('No project data returned from backend')
        }

        const frontendData = toFrontendProject(projectResult)
        projects.value.unshift(frontendData)
        return { success: true, data: frontendData }
      } else {
        throw new Error(result.error || 'Failed to create project')
      }
    } catch (err) {
      console.error('Failed to create project:', err)
      return { success: false, error: err.message }
    }
  }

  // 更新项目
  const updateProject = async (projectId, projectData) => {
    try {
      const originalProject = projects.value.find(p => p.id === projectId || p.uuid === projectId)
      if (!originalProject) {
        throw new Error(`Project with ID ${projectId} not found`)
      }

      const backendData = {
        ...convertToBackendFormat(projectData),
        uuid: originalProject.uuid
      }

      const result = await projectAPI.updateProject(projectId, backendData)
      if (result.success) {
        const frontendData = toFrontendProject(result.data)
        const index = projects.value.findIndex(p => p.id === projectId || p.uuid === projectId)
        if (index !== -1) {
          projects.value[index] = frontendData
        }
        return { success: true, data: frontendData }
      } else {
        throw new Error(result.error || 'Failed to update project')
      }
    } catch (err) {
      console.error('Failed to update project:', err)
      return { success: false, error: err.message }
    }
  }

  // 删除项目
  const deleteProject = async (projectId) => {
    try {
      const result = await projectAPI.deleteProject(projectId)
      if (result.success) {
        const index = projects.value.findIndex(p => p.id === projectId || p.uuid === projectId)
        if (index !== -1) {
          projects.value.splice(index, 1)
        }
        return { success: true }
      } else {
        throw new Error(result.error || 'Failed to delete project')
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
      return { success: false, error: err.message }
    }
  }

  // 获取项目详情
  const getProject = async (projectId) => {
    try {
      const result = await projectAPI.getProjectById(projectId)
      if (result.success) {
        const frontendData = toFrontendProject(result.data)
        return { success: true, data: frontendData }
      } else {
        throw new Error(result.error || 'Failed to get project')
      }
    } catch (err) {
      console.error('Failed to get project:', err)
      return { success: false, error: err.message }
    }
  }

  // 搜索项目
  const searchProjects = async (keyword) => {
    try {
      const result = await loadProjects()
      if (!result.success) {
        throw new Error(result.error || 'Failed to load projects for search')
      }

      const filteredProjects = projects.value.filter(project => 
        project.name.toLowerCase().includes(keyword.toLowerCase()) ||
        (project.uuid && project.uuid.toLowerCase().includes(keyword.toLowerCase()))
      )

      return { success: true, data: filteredProjects }
    } catch (err) {
      console.error('Failed to search projects:', err)
      return { success: false, error: err.message }
    }
  }

  // 生成默认项目名称
  const generateDefaultName = generateDefaultProjectName

  // 项目数据验证  
  const validateProject = validateProjectData

  // 批量操作
  const batchOperation = async (projectIds, operation, options = {}) => {
    try {
      const result = await projectAPI.batchOperation(projectIds, operation, options)
      
      if (result.success) {
        if (operation === 'delete') {
          const successfulDeletes = projectIds.filter((projectId, index) => result.results?.[index]?.success)
          
          projects.value = projects.value.filter(
            p => !successfulDeletes.includes(p.id) && !successfulDeletes.includes(p.uuid)
          )
        }
        return result
      } else {
        throw new Error(result.error || `Failed to perform batch ${operation}`)
      }
    } catch (err) {
      console.error(`Failed to perform batch ${operation}:`, err)
      return { success: false, error: err.message }
    }
  }

  // 计算属性
  const projectCount = computed(() => projects.value.length)
  
  const recentProjects = computed(() => 
    [...projects.value]
      .sort((a, b) => {
        const bTime = new Date(b.updatedAt || b.updated_at || b.createdAt || b.created_at || 0).getTime()
        const aTime = new Date(a.updatedAt || a.updated_at || a.createdAt || a.created_at || 0).getTime()
        return bTime - aTime
      })
      .slice(0, 5) // 最近5个项目
  )

  const hasProjects = computed(() => projects.value.length > 0)

  // 在组件挂载时初始化
  onMounted(async () => {
    await initializeBackend()
    await loadProjects()
  })

  return {
    // 响应式数据
    projects: computed(() => projects.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    
    // 计算属性
    projectCount,
    recentProjects,
    hasProjects,
    
    // 方法
    initializeBackend,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    getProject,
    searchProjects,
    generateDefaultProjectName: generateDefaultName,
    validateProjectData: validateProject,
    batchOperation
  }
}
