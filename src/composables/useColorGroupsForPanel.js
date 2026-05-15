/**
 * 色卡分组状态管理 Composable
 * 用于色卡面板的分组选择和显示
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useColorGroups } from './useColorGroups.js'
import eventBus, { EVENT_TYPES } from '../utils/eventBus.js'

/**
 * 用于色卡面板的分组选择管理
 * @returns {Object} 色卡分组相关的响应式数据和方法
 */
export function useColorGroupsForPanel() {
  // 从色卡分组管理中获取数据
  const {
    colorGroups,
    operationStates,
    loadColorGroups
  } = useColorGroups({
    autoLoad: false // 不自动加载，手动控制
  })

  // 当前选中的分组
  const selectedGroupId = ref(null)
  const showGroupSelector = ref(false)

  // 计算当前选中分组的详细信息
  const selectedGroup = computed(() => {
    if (!selectedGroupId.value) return null
    return colorGroups.value.find(group => group.id === selectedGroupId.value)
  })

  // 当前分组的颜色列表
  const currentGroupColors = computed(() => {
    if (!selectedGroup.value) return []
    return selectedGroup.value.colors || []
  })

  // 是否有可用的分组
  const hasGroups = computed(() => {
    return colorGroups.value.length > 0
  })

  // 加载状态
  const isLoading = computed(() => {
    return operationStates.loading
  })

  // 错误状态
  const error = computed(() => {
    return operationStates.error
  })

  // 初始化加载分组数据
  const initialize = async () => {
    try {
      await loadColorGroups()
      
      // 如果有分组，默认选择第一个
      if (colorGroups.value.length > 0 && !selectedGroupId.value) {
        selectedGroupId.value = colorGroups.value[0].id
      }
    } catch (error) {
      console.error('Failed to initialize color groups for panel:', error)
    }
  }

  // 选择分组
  const selectGroup = (groupId) => {
    selectedGroupId.value = groupId
    showGroupSelector.value = false
  }

  // 切换分组选择器显示状态
  const toggleGroupSelector = () => {
    showGroupSelector.value = !showGroupSelector.value
  }

  // 隐藏分组选择器
  const hideGroupSelector = () => {
    showGroupSelector.value = false
  }

  // 刷新分组数据
  const refresh = async () => {
    await loadColorGroups()
  }

  // 监听选中分组变化
  watch(selectedGroupId, (newGroupId, oldGroupId) => {
    if (newGroupId !== oldGroupId) {
      console.log('Selected group changed:', { old: oldGroupId, new: newGroupId })
    }
  })

  // 监听分组数据变化，自动选择第一个分组
  watch(colorGroups, (newGroups) => {
    if (newGroups.length > 0 && !selectedGroupId.value) {
      selectedGroupId.value = newGroups[0].id
    }
  }, { deep: true })

  // 组件挂载时初始化
  onMounted(() => {
    initialize()
    
    // 监听事件总线中的分组变化
    eventBus.on(EVENT_TYPES.COLOR_GROUPS_CHANGED, handleGroupsChanged)
    eventBus.on(EVENT_TYPES.COLOR_GROUP_CREATED, handleGroupCreated)
    eventBus.on(EVENT_TYPES.COLOR_GROUP_UPDATED, handleGroupUpdated)
    eventBus.on(EVENT_TYPES.COLOR_GROUP_DELETED, handleGroupDeleted)
  })
  
  // 组件卸载时清理
  onUnmounted(() => {
    eventBus.off(EVENT_TYPES.COLOR_GROUPS_CHANGED, handleGroupsChanged)
    eventBus.off(EVENT_TYPES.COLOR_GROUP_CREATED, handleGroupCreated)
    eventBus.off(EVENT_TYPES.COLOR_GROUP_UPDATED, handleGroupUpdated) 
    eventBus.off(EVENT_TYPES.COLOR_GROUP_DELETED, handleGroupDeleted)
  })
  
  // 事件处理函数
  const handleGroupsChanged = async () => {
    console.log('ColorGroupsForPanel: Received groups changed event, refreshing...')
    await refresh()
  }
  
  const handleGroupCreated = async (newGroup) => {
    console.log('ColorGroupsForPanel: New group created:', newGroup)
    await refresh()
  }
  
  const handleGroupUpdated = async (updatedGroup) => {
    console.log('ColorGroupsForPanel: Group updated:', updatedGroup)
    await refresh()
  }
  
  const handleGroupDeleted = async (deletedGroupId) => {
    console.log('ColorGroupsForPanel: Group deleted:', deletedGroupId)
    // 如果删除的是当前选中分组，清除选择
    if (selectedGroupId.value === deletedGroupId) {
      selectedGroupId.value = null
    }
    await refresh()
  }

  return {
    // 响应式数据
    colorGroups: computed(() => colorGroups.value),
    selectedGroupId,
    selectedGroup,
    currentGroupColors,
    hasGroups,
    isLoading,
    error,
    showGroupSelector,

    // 方法
    initialize,
    selectGroup,
    toggleGroupSelector,
    hideGroupSelector,
    refresh
  }
}
