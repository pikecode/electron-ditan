import { ref, computed, onMounted } from 'vue'

export function useProjectStorage() {
  const projects = ref([])
  const loading = ref(false)
  const error = ref(null)

  // 通过IPC与主进程通信来访问数据库
  const ipcRenderer = window.electronAPI || window.electron

  // 初始化数据库
  const initializeDatabase = async () => {
    try {
      // 数据库初始化在主进程中处理
      return { success: true }
    } catch (err) {
      console.error('Failed to initialize database:', err)
      error.value = err.message
      return { success: false, error: err.message }
    }
  }

  // 加载所有项目
  const loadProjects = async () => {
    loading.value = true
    error.value = null
    
    try {
      console.log('Loading projects from database...')
      
      if (ipcRenderer && ipcRenderer.projects && ipcRenderer.projects.getAll) {
        const result = await ipcRenderer.projects.getAll()
        if (result.success) {
          projects.value = result.data
          console.log(`Loaded ${projects.value.length} projects`)
          return { success: true, data: projects.value }
        } else {
          throw new Error(result.error || 'Failed to load projects')
        }
      } else {
        // 降级到localStorage
        console.warn('IPC not available, falling back to localStorage')
        const stored = localStorage.getItem('easystitch_projects')
        projects.value = stored ? JSON.parse(stored) : []
        return { success: true, data: projects.value }
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
      console.log('Creating project:', projectData.name)
      
      if (ipcRenderer && ipcRenderer.projects && ipcRenderer.projects.create) {
        // 通过IPC调用主进程创建项目
        const result = await ipcRenderer.projects.create(projectData)
        if (result.success) {
          // 添加到本地数组开头(用于UI响应式更新)
          projects.value.unshift(result.data)
          console.log('Project created successfully:', result.data.id)
          return { success: true, data: result.data }
        } else {
          throw new Error(result.error || 'Failed to create project')
        }
      } else {
        // 降级到localStorage
        console.warn('IPC not available, falling back to localStorage')
        const newProject = {
          id: generateUUID(),
          name: projectData.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          image: projectData.image || {},
          grid: projectData.grid || {},
          colorConfig: projectData.colorConfig || {},
          processData: projectData.processData || {},
          metadata: projectData.metadata || {}
        }
        
        projects.value.unshift(newProject)
        localStorage.setItem('easystitch_projects', JSON.stringify(projects.value))
        
        console.log('Project created successfully:', newProject.id)
        return { success: true, data: newProject }
      }
    } catch (err) {
      console.error('Failed to create project:', err)
      return { success: false, error: err.message }
    }
  }

  // 更新项目
  const updateProject = async (uuid, projectData) => {
    try {
      console.log('Updating project:', uuid)
      
      if (ipcRenderer && ipcRenderer.projects && ipcRenderer.projects.update) {
        // 通过IPC调用主进程更新项目
        const result = await ipcRenderer.projects.update(uuid, projectData)
        if (result.success) {
          // 更新本地数组中的项目
          const index = projects.value.findIndex(p => p.id === uuid)
          if (index !== -1) {
            projects.value[index] = result.data
          }
          console.log('Project updated successfully:', uuid)
          return { success: true, data: result.data }
        } else {
          throw new Error(result.error || 'Failed to update project')
        }
      } else {
        // 降级到localStorage
        console.warn('IPC not available, falling back to localStorage')
        const index = projects.value.findIndex(p => p.id === uuid)
        if (index === -1) {
          throw new Error(`Project with UUID ${uuid} not found`)
        }
        
        const updatedProject = {
          ...projects.value[index],
          ...projectData,
          updatedAt: new Date().toISOString()
        }
        
        projects.value[index] = updatedProject
        localStorage.setItem('easystitch_projects', JSON.stringify(projects.value))
        
        console.log('Project updated successfully:', uuid)
        return { success: true, data: updatedProject }
      }
    } catch (err) {
      console.error('Failed to update project:', err)
      return { success: false, error: err.message }
    }
  }

  // 删除项目
  const deleteProject = async (uuid) => {
    try {
      console.log('Deleting project:', uuid)
      
      if (ipcRenderer && ipcRenderer.projects && ipcRenderer.projects.delete) {
        // 通过IPC调用主进程删除项目
        const result = await ipcRenderer.projects.delete(uuid)
        if (result.success) {
          // 从本地数组中移除
          const index = projects.value.findIndex(p => p.id === uuid)
          if (index !== -1) {
            projects.value.splice(index, 1)
          }
          console.log('Project deleted successfully:', uuid)
          return { success: true }
        } else {
          throw new Error(result.error || 'Failed to delete project')
        }
      } else {
        // 降级到localStorage
        console.warn('IPC not available, falling back to localStorage')
        const index = projects.value.findIndex(p => p.id === uuid)
        if (index === -1) {
          throw new Error(`Project with UUID ${uuid} not found`)
        }
        
        projects.value.splice(index, 1)
        localStorage.setItem('easystitch_projects', JSON.stringify(projects.value))
        
        console.log('Project deleted successfully:', uuid)
        return { success: true }
      }
    } catch (err) {
      console.error('Failed to delete project:', err)
      return { success: false, error: err.message }
    }
  }

  // 获取项目详情
  const getProject = async (uuid) => {
    try {
      console.log('Getting project:', uuid)
      
      if (ipcRenderer && ipcRenderer.projects && ipcRenderer.projects.getById) {
        // 通过IPC调用主进程获取项目
        const result = await ipcRenderer.projects.getById(uuid)
        if (result.success) {
          return { success: true, data: result.data }
        } else {
          throw new Error(result.error || 'Project not found')
        }
      } else {
        // 降级到localStorage
        console.warn('IPC not available, falling back to localStorage')
        const project = projects.value.find(p => p.id === uuid)
        if (!project) {
          throw new Error(`Project with UUID ${uuid} not found`)
        }
        return { success: true, data: project }
      }
    } catch (err) {
      console.error('Failed to get project:', err)
      return { success: false, error: err.message }
    }
  }

  // 搜索项目
  const searchProjects = async (keyword) => {
    try {
      console.log('Searching projects with keyword:', keyword)
      
      if (ipcRenderer && ipcRenderer.projects && ipcRenderer.projects.search) {
        // 通过IPC调用主进程搜索
        const result = await ipcRenderer.projects.search(keyword)
        if (result.success) {
          return { success: true, data: result.data }
        } else {
          throw new Error(result.error || 'Search failed')
        }
      } else {
        // 降级到localStorage
        console.warn('IPC not available, falling back to localStorage')
        const searchResults = projects.value.filter(project => 
          project.name.toLowerCase().includes(keyword.toLowerCase()) ||
          (project.image.name && project.image.name.toLowerCase().includes(keyword.toLowerCase()))
        )
        return { success: true, data: searchResults }
      }
    } catch (err) {
      console.error('Failed to search projects:', err)
      return { success: false, error: err.message }
    }
  }

  // 生成默认项目名称
  const generateDefaultProjectName = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    
    return `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`
  }

  // 生成UUID (用于localStorage降级)
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  // 验证项目数据
  const validateProjectData = (projectData) => {
    const errors = []
    
    if (!projectData.name || projectData.name.trim() === '') {
      errors.push('项目名称不能为空')
    }
    
    if (projectData.image && !projectData.image.name) {
      errors.push('图片信息不完整')
    }
    
    if (projectData.grid) {
      if (!projectData.grid.length || projectData.grid.length <= 0) {
        errors.push('网格长度必须大于0')
      }
      if (!projectData.grid.cellSize || projectData.grid.cellSize <= 0) {
        errors.push('格子大小必须大于0')
      }
    }
    
    if (projectData.colorConfig) {
      if (!['group', 'count'].includes(projectData.colorConfig.type)) {
        errors.push('颜色配置类型无效')
      }
      
      if (projectData.colorConfig.type === 'count' && 
          (!projectData.colorConfig.colorCount || projectData.colorConfig.colorCount <= 0)) {
        errors.push('颜色数量必须大于0')
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }

  // 计算属性
  const projectCount = computed(() => projects.value.length)
  
  const recentProjects = computed(() => 
    projects.value.slice(0, 5) // 最近5个项目
  )

  const hasProjects = computed(() => projects.value.length > 0)

  // 在组件挂载时初始化
  onMounted(async () => {
    await initializeDatabase()
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
    initializeDatabase,
    loadProjects,
    createProject,
    updateProject,
    deleteProject,
    getProject,
    searchProjects,
    generateDefaultProjectName,
    validateProjectData
  }
}
