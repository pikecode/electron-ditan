/**
 * 色卡分组管理 Composable
 * 提供响应式状态管理和业务逻辑封装
 */

import { ref, reactive, computed, watch } from 'vue'
import { 
  getColorGroups, 
  getColorGroupById, 
  createColorGroup, 
  updateColorGroup, 
  deleteColorGroup,
  addColorsToGroup,
  removeColorFromGroup,
  updateColorInGroup,
  batchDeleteColorGroups
} from '../api/colorGroupAPI.js'
import { ErrorHandler } from '../utils/errorHandler.js'

/**
 * 色卡分组管理 Composable
 * @param {Object} options - 配置选项
 * @param {boolean} options.autoLoad - 是否自动加载数据
 * @param {Function} options.onError - 错误回调
 * @returns {Object} 响应式状态和方法
 */
export function useColorGroups(options = {}) {
  const {
    autoLoad = true,
    onError = null
  } = options

  // =============================================================================
  // 响应式状态
  // =============================================================================

  // 基础数据状态
  const colorGroups = ref([])
  const selectedGroup = ref(null)
  const selectedColors = ref([])

  // 操作状态
  const operationStates = reactive({
    loading: false,
    creating: false,
    updating: false,
    deleting: false,
    batchDeleting: false,
    addingColors: false,
    removingColor: false,
    error: null
  })

  // 分页状态
  const pagination = reactive({
    currentPage: 1,
    pageSize: 10,
    total: 0
  })

  // 搜索和过滤状态
  const searchKeyword = ref('')
  const filterOptions = reactive({
    sortBy: 'name', // name, createdAt, updatedAt
    sortOrder: 'asc', // asc, desc
    colorCountRange: [0, Infinity]
  })

  // 初始化错误处理器
  const errorHandler = new ErrorHandler()

  // =============================================================================
  // 计算属性
  // =============================================================================

  /**
   * 总分组数量
   */
  const groupCount = computed(() => colorGroups.value.length)

  /**
   * 总色卡数量
   */
  const totalColors = computed(() => {
    return colorGroups.value.reduce((total, group) => {
      return total + (group.colors?.length || 0)
    }, 0)
  })

  /**
   * 过滤后的分组列表
   */
  const filteredGroups = computed(() => {
    let filtered = colorGroups.value

    // 搜索过滤
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      filtered = filtered.filter(group => 
        group.name.toLowerCase().includes(keyword) ||
        group.description?.toLowerCase().includes(keyword)
      )
    }

    // 色卡数量范围过滤
    const [minColors, maxColors] = filterOptions.colorCountRange
    filtered = filtered.filter(group => {
      const colorCount = group.colors?.length || 0
      return colorCount >= minColors && colorCount <= maxColors
    })

    // 排序
    filtered.sort((a, b) => {
      const { sortBy, sortOrder } = filterOptions
      let aValue, bValue

      switch (sortBy) {
        case 'name':
          aValue = a.name
          bValue = b.name
          break
        case 'createdAt':
          aValue = new Date(a.createdAt)
          bValue = new Date(b.createdAt)
          break
        case 'updatedAt':
          aValue = new Date(a.updatedAt)
          bValue = new Date(b.updatedAt)
          break
        case 'colorCount':
          aValue = a.colors?.length || 0
          bValue = b.colors?.length || 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  })

  /**
   * 分页后的分组列表
   */
  const paginatedGroups = computed(() => {
    const start = (pagination.currentPage - 1) * pagination.pageSize
    const end = start + pagination.pageSize
    return filteredGroups.value.slice(start, end)
  })

  /**
   * 是否有选中的色卡
   */
  const hasSelectedColors = computed(() => selectedColors.value.length > 0)

  /**
   * 操作状态汇总
   */
  const isLoading = computed(() => {
    return Object.entries(operationStates)
      .filter(([key]) => key !== 'error')
      .some(([, value]) => value === true)
  })

  // =============================================================================
  // 数据获取方法
  // =============================================================================

  /**
   * 加载所有色卡分组
   */
  async function loadColorGroups() {
    operationStates.loading = true
    operationStates.error = null
    
    try {
      const response = await getColorGroups()
      
      if (response.success) {
        // 转换数据格式，将color_ids字段转换为colors字段
        colorGroups.value = response.data.map(group => ({
          ...group,
          colors: group.color_ids || []
        }))
        updatePagination()
        return response
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to load color groups:', handledError)
      return { success: false, error: handledError.message }
    } finally {
      operationStates.loading = false
    }
  }

  /**
   * 根据ID获取色卡分组
   * @param {number} groupId - 分组ID
   * @returns {Promise<Object|null>}
   */
  async function getGroupById(groupId) {
    try {
      const response = await getColorGroupById(groupId)
      
      if (response.success) {
        return response.data
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error(`Failed to get color group ${groupId}:`, handledError)
      return null
    }
  }

  /**
   * 刷新数据
   */
  async function refresh() {
    await loadColorGroups()
  }

  // =============================================================================
  // 分组操作方法
  // =============================================================================

  /**
   * 创建新分组
   * @param {Object} groupData - 分组数据
   * @returns {Promise<Object|null>}
   */
  async function createGroup(groupData) {
    operationStates.creating = true
    operationStates.error = null

    try {
      const response = await createColorGroup(groupData)
      
      if (response.success) {
        const d = response.data
        colorGroups.value.push({
          ...d,
          colors: d.color_ids || []
        })
        updatePagination()
        return response
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to create color group:', handledError)
      return { success: false, error: handledError.message }
    } finally {
      operationStates.creating = false
    }
  }

  /**
   * 更新分组
   * @param {number} groupId - 分组ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object|null>}
   */
  async function updateGroup(groupId, updateData) {
    operationStates.updating = true
    operationStates.error = null

    try {
      const response = await updateColorGroup(groupId, updateData)
      
      if (response.success) {
        const index = colorGroups.value.findIndex(g => g.id === groupId)
        const normalized = {
          ...response.data,
          colors: response.data.color_ids || []
        }
        if (index !== -1) {
          colorGroups.value[index] = normalized
        }
        
        // 如果是当前选中的分组，也更新选中状态
        if (selectedGroup.value?.id === groupId) {
          selectedGroup.value = normalized
        }
        
        return response
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to update color group:', handledError)
      return { success: false, error: handledError.message }
    } finally {
      operationStates.updating = false
    }
  }

  /**
   * 删除分组
   * @param {number} groupId - 分组ID
   * @returns {Promise<boolean>}
   */
  async function deleteGroup(groupId) {
    operationStates.deleting = true
    operationStates.error = null

    try {
      const response = await deleteColorGroup(groupId)
      
      if (response.success) {
        const index = colorGroups.value.findIndex(g => g.id === groupId)
        if (index !== -1) {
          colorGroups.value.splice(index, 1)
        }
        
        // 如果删除的是当前选中分组，清除选中状态
        if (selectedGroup.value?.id === groupId) {
          selectedGroup.value = null
        }
        
        updatePagination()
        return response
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to delete color group:', handledError)
      return { success: false, error: handledError.message }
    } finally {
      operationStates.deleting = false
    }
  }

  /**
   * 批量删除分组
   * @param {Array<number>} groupIds - 分组ID列表
   * @returns {Promise<Object>}
   */
  async function batchDeleteGroups(groupIds) {
    operationStates.batchDeleting = true
    operationStates.error = null

    try {
      const response = await batchDeleteColorGroups(groupIds)
      
      if (response.success) {
        // 从列表中移除已删除的分组
        response.data.deleted.forEach(deletedGroup => {
          const index = colorGroups.value.findIndex(g => g.id === deletedGroup.id)
          if (index !== -1) {
            colorGroups.value.splice(index, 1)
          }
        })
        
        // 清除选中状态（如果选中的分组被删除）
        if (selectedGroup.value && groupIds.includes(selectedGroup.value.id)) {
          selectedGroup.value = null
        }
        
        updatePagination()
        return response.data
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to batch delete color groups:', handledError)
      return { deleted: [], notFound: groupIds }
    } finally {
      operationStates.batchDeleting = false
    }
  }

  // =============================================================================
  // 色卡操作方法
  // =============================================================================

  /**
   * 向分组添加色卡
   * @param {number} groupId - 分组ID
   * @param {Array<Object>} colors - 色卡数据
   * @returns {Promise<boolean>}
   */
  async function addColors(groupId, colors) {
    operationStates.addingColors = true
    operationStates.error = null

    try {
      const response = await addColorsToGroup(groupId, colors)
      
      if (response.success) {
        const index = colorGroups.value.findIndex(g => g.id === groupId)
        if (index !== -1) {
          colorGroups.value[index] = response.data
        }
        
        // 更新选中分组状态
        if (selectedGroup.value?.id === groupId) {
          selectedGroup.value = response.data
        }
        
        return true
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to add colors to group:', handledError)
      return false
    } finally {
      operationStates.addingColors = false
    }
  }

  /**
   * 从分组移除色卡
   * @param {number} groupId - 分组ID
   * @param {number} colorId - 色卡ID
   * @returns {Promise<boolean>}
   */
  async function removeColor(groupId, colorId) {
    operationStates.removingColor = true
    operationStates.error = null

    try {
      const response = await removeColorFromGroup(groupId, colorId)
      
      if (response.success) {
        const index = colorGroups.value.findIndex(g => g.id === groupId)
        if (index !== -1) {
          colorGroups.value[index] = response.data.group
        }
        
        // 更新选中分组状态
        if (selectedGroup.value?.id === groupId) {
          selectedGroup.value = response.data.group
        }
        
        // 从选中色卡中移除
        const selectedIndex = selectedColors.value.findIndex(c => c.id === colorId)
        if (selectedIndex !== -1) {
          selectedColors.value.splice(selectedIndex, 1)
        }
        
        return true
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to remove color from group:', handledError)
      return false
    } finally {
      operationStates.removingColor = false
    }
  }

  /**
   * 更新分组中的色卡
   * @param {number} groupId - 分组ID
   * @param {number} colorId - 色卡ID
   * @param {Object} colorData - 色卡数据
   * @returns {Promise<boolean>}
   */
  async function updateColor(groupId, colorId, colorData) {
    operationStates.error = null

    try {
      const response = await updateColorInGroup(groupId, colorId, colorData)
      
      if (response.success) {
        const index = colorGroups.value.findIndex(g => g.id === groupId)
        if (index !== -1) {
          colorGroups.value[index] = response.data.group
        }
        
        // 更新选中分组状态
        if (selectedGroup.value?.id === groupId) {
          selectedGroup.value = response.data.group
        }
        
        return true
      } else {
        throw new Error(response.error)
      }
    } catch (error) {
      const handledError = errorHandler.handleApiError(error)
      operationStates.error = handledError.message
      
      if (onError) {
        onError(handledError)
      }
      
      console.error('Failed to update color in group:', handledError)
      return false
    }
  }

  // =============================================================================
  // 选择和分页方法
  // =============================================================================

  /**
   * 选择分组
   * @param {Object} group - 分组对象
   */
  function selectGroup(group) {
    selectedGroup.value = group
    selectedColors.value = []
  }

  /**
   * 清除分组选择
   */
  function clearGroupSelection() {
    selectedGroup.value = null
    selectedColors.value = []
  }

  /**
   * 切换色卡选择
   * @param {Object} color - 色卡对象
   */
  function toggleColorSelection(color) {
    const index = selectedColors.value.findIndex(c => c.id === color.id)
    if (index !== -1) {
      selectedColors.value.splice(index, 1)
    } else {
      selectedColors.value.push(color)
    }
  }

  /**
   * 全选/取消全选当前页色卡
   */
  function toggleAllColorsSelection() {
    if (!selectedGroup.value?.colors) return

    const allSelected = selectedGroup.value.colors.every(color =>
      selectedColors.value.some(selected => selected.id === color.id)
    )

    if (allSelected) {
      selectedColors.value = []
    } else {
      selectedColors.value = [...selectedGroup.value.colors]
    }
  }

  /**
   * 清除色卡选择
   */
  function clearColorSelection() {
    selectedColors.value = []
  }

  /**
   * 更新分页信息
   */
  function updatePagination() {
    pagination.total = filteredGroups.value.length
  }

  /**
   * 跳转到指定页
   * @param {number} page - 页码
   */
  function goToPage(page) {
    if (page >= 1 && page <= Math.ceil(pagination.total / pagination.pageSize)) {
      pagination.currentPage = page
    }
  }

  /**
   * 设置每页显示数量
   * @param {number} size - 每页数量
   */
  function setPageSize(size) {
    pagination.pageSize = size
    pagination.currentPage = 1
    updatePagination()
  }

  // =============================================================================
  // 搜索和过滤方法
  // =============================================================================

  /**
   * 设置搜索关键词
   * @param {string} keyword - 搜索关键词
   */
  function setSearchKeyword(keyword) {
    searchKeyword.value = keyword
    pagination.currentPage = 1
    updatePagination()
  }

  /**
   * 设置排序方式
   * @param {string} sortBy - 排序字段
   * @param {string} sortOrder - 排序顺序
   */
  function setSorting(sortBy, sortOrder = 'asc') {
    filterOptions.sortBy = sortBy
    filterOptions.sortOrder = sortOrder
  }

  /**
   * 设置色卡数量范围过滤
   * @param {Array<number>} range - 范围 [min, max]
   */
  function setColorCountRange(range) {
    filterOptions.colorCountRange = range
    pagination.currentPage = 1
    updatePagination()
  }

  /**
   * 重置所有过滤条件
   */
  function resetFilters() {
    searchKeyword.value = ''
    filterOptions.sortBy = 'name'
    filterOptions.sortOrder = 'asc'
    filterOptions.colorCountRange = [0, Infinity]
    pagination.currentPage = 1
    updatePagination()
  }

  // =============================================================================
  // 工具方法
  // =============================================================================

  /**
   * 清除错误状态
   */
  function clearError() {
    operationStates.error = null
  }

  /**
   * 根据名称查找分组
   * @param {string} name - 分组名称
   * @returns {Object|null}
   */
  function findGroupByName(name) {
    return colorGroups.value.find(group => group.name === name) || null
  }

  /**
   * 获取分组统计信息
   * @returns {Object}
   */
  function getStatistics() {
    return {
      totalGroups: groupCount.value,
      totalColors: totalColors.value,
      averageColorsPerGroup: groupCount.value > 0 ? (totalColors.value / groupCount.value).toFixed(1) : 0,
      selectedColorsCount: selectedColors.value.length,
      filteredGroupsCount: filteredGroups.value.length
    }
  }

  // =============================================================================
  // 监听器
  // =============================================================================

  // 监听搜索关键词变化，自动更新分页
  watch(searchKeyword, () => {
    updatePagination()
  })

  // 监听过滤选项变化，自动更新分页
  watch(() => filterOptions.colorCountRange, () => {
    updatePagination()
  }, { deep: true })

  // =============================================================================
  // 初始化
  // =============================================================================

  // 自动加载数据
  if (autoLoad) {
    loadColorGroups()
  }

  // =============================================================================
  // 返回接口
  // =============================================================================

  return {
    // 响应式状态
    colorGroups,
    selectedGroup,
    selectedColors,
    operationStates,
    pagination,
    searchKeyword,
    filterOptions,

    // 计算属性
    groupCount,
    totalColors,
    filteredGroups,
    paginatedGroups,
    hasSelectedColors,
    isLoading,

    // 数据操作方法
    loadColorGroups,
    getGroupById,
    refresh,

    // 分组操作方法
    createGroup,
    updateGroup,
    deleteGroup,
    batchDeleteGroups,

    // 色卡操作方法
    addColors,
    removeColor,
    updateColor,

    // 选择和分页方法
    selectGroup,
    clearGroupSelection,
    toggleColorSelection,
    toggleAllColorsSelection,
    clearColorSelection,
    goToPage,
    setPageSize,

    // 搜索和过滤方法
    setSearchKeyword,
    setSorting,
    setColorCountRange,
    resetFilters,

    // 工具方法
    clearError,
    findGroupByName,
    getStatistics
  }
}
