import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { colorAPI } from '../api'
import i18n from '../i18n/index.js'
import eventBus, { EVENT_TYPES } from '../utils/eventBus'

// 全局色卡库：各组件必须共用同一份列表，否则「项目表单 / 画布色条」会出现一边有数据、一边为空（尤其在生产包与 IndexedDB 首启场景下）
const colorPalette = ref([])
const loadingColors = ref(false)
const colorLoadError = ref(null)
let colorsChangedListenerRegistered = false

const loadColorPalettes = async () => {
    console.log('=== LOAD COLOR PALETTES START ===')
    loadingColors.value = true
    colorLoadError.value = null
    const t = i18n.global.t

    try {
      console.log('Loading color palettes from backend API...')
      const result = await colorAPI.getColorPalettes()
      
      console.log('Load API result:', result)
      
      if (result.success && result.data && result.data.color_palettes) {
        console.log('Raw backend data:', result.data.color_palettes)
        
        // 转换后端数据格式为前端格式
        const newColorPalette = result.data.color_palettes.map((color, index) => ({
          hex: color.hex,
          code: String(color.id), // 直接使用数字ID字符串
          name: color.name,
          usage: 0,
          id: color.id
        }))
        
        console.log('Converted color palette:', newColorPalette)
        colorPalette.value = newColorPalette
        
        console.log(`Successfully loaded ${colorPalette.value.length} colors from backend`)
        
        return {
          success: true,
          message: t('canvas.status.colorsLoaded') || `已从后端加载 ${colorPalette.value.length} 个色卡`
        }
      } else {
        throw new Error(result.error || 'Invalid API response format')
      }
    } catch (error) {
      console.error('Failed to load color palettes from backend:', error)
      
      // 对于 API 调用的结果，我们需要检查响应对象
      const result = error.response || error.result || {}
      
      // 检查是否是后端不可用错误
      if (result.error_code === 'BACKEND_UNAVAILABLE') {
        colorLoadError.value = result.userMessage || result.error
        return {
          success: false,
          message: result.userMessage || result.error,
          isSystemError: true
        }
      }
      
      colorLoadError.value = `${t('validation.loadColorsFailed') || '无法从后端加载色卡'}: ${error.message}`

      return {
        success: false,
        message: `${t('validation.loadColorsFailed') || '色卡加载失败'}: ${error.message}`
      }
    } finally {
      loadingColors.value = false
      console.log('=== LOAD COLOR PALETTES END ===')
    }
}

const handleColorsChanged = async () => {
  try {
    await loadColorPalettes()
  } catch (error) {
    console.error('Failed to sync color palettes after colors-changed event:', error)
  }
}

const ensureColorsChangedListener = () => {
  if (colorsChangedListenerRegistered) return
  colorsChangedListenerRegistered = true
  eventBus.on(EVENT_TYPES.COLORS_CHANGED, handleColorsChanged)
}

export function useColorManagement() {
  const { t } = useI18n()
  ensureColorsChangedListener()

  const selectedColorIndex = ref(-1)
  const showColorPicker = ref(false)
  const showColorManagementCenter = ref(false)

  const nextColorCode = computed(() => {
    return colorPalette.value.length.toString()
  })

  // 添加颜色
  const addColor = async (colorData) => {
    try {
      console.log('=== ADD COLOR DEBUG ===')
      console.log('addColor called with:', colorData)
      
      // 验证输入数据
      if (!colorData) {
        throw new Error('No color data provided')
      }
      if (!colorData.hex) {
        throw new Error('No hex color provided')
      }
      if (!colorData.rgb) {
        throw new Error('No RGB color provided')
      }
      
      // 准备API调用参数
      const apiParams = {
        name: colorData.name || 'unknown',
        rgb: colorData.rgb,
        hex: colorData.hex
      }
      
      console.log('Calling colorAPI.addColorPalette with:', apiParams)
      
      // 调用后端API添加色卡
      const result = await colorAPI.addColorPalette(apiParams)
      
      console.log('Add API result:', result)
      
      if (result.success) {
        console.log('Add successful, reloading color palettes...')
        // 重新加载色卡数据以获取最新的数据
        await loadColorPalettes()
        
        return {
          success: true,
          message: t('canvas.status.colorAdded') || `已添加色卡: ${colorData.code}${colorData.name ? ` - ${colorData.name}` : ''}`
        }
      } else {
        throw new Error(result.error || 'Backend returned failure')
      }
    } catch (error) {
      console.error('Failed to add color:', error)
      return {
        success: false,
        message: `${t('validation.addColorFailed') || 'Failed to add color'}: ${error.message}`
      }
    }
  }

  // 删除颜色
  const deleteColor = async (colorId) => {
    try {
      loadingColors.value = true
      console.log('Deleting color with ID:', colorId)
      
      const result = await colorAPI.deleteColorPalette(colorId)
      
      if (result.success) {
        console.log('Color deleted successfully:', result)
        
        // 如果删除的是当前选中的颜色，重置选中状态
        const deletedColorIndex = colorPalette.value.findIndex(color => color.id === colorId)
        if (deletedColorIndex === selectedColorIndex.value) {
          selectedColorIndex.value = -1
        } else if (deletedColorIndex < selectedColorIndex.value) {
          selectedColorIndex.value--
        }
        
        // 重新加载颜色数据
        await loadColorPalettes()
        
        return {
          success: true,
          message: t('canvas.status.colorDeleted') || '颜色删除成功'
        }
      } else {
        throw new Error(result.error || 'Failed to delete color')
      }
    } catch (error) {
      console.error('Delete color error:', error)
      colorLoadError.value = (t('validation.deleteColorFailed') || 'Failed to delete color') + ': ' + error.message
      
      return {
        success: false,
        message: (t('validation.deleteColorFailed') || 'Failed to delete color') + ': ' + error.message
      }
    } finally {
      loadingColors.value = false
    }
  }

  // 选择颜色
  const selectColor = (index) => {
    console.log('=== SELECT COLOR DEBUG ===')
    console.log('selectColor called with index:', index)
    console.log('Previous selectedColorIndex:', selectedColorIndex.value)
    selectedColorIndex.value = selectedColorIndex.value === index ? -1 : index
    console.log('New selectedColorIndex:', selectedColorIndex.value)
  }

  // 管理颜色弹窗
  const handleManageColors = () => {
    console.log('=== MANAGE COLORS DEBUG ===')
    console.log('Current showColorPicker state:', showColorPicker.value)
    showColorPicker.value = !showColorPicker.value
    console.log('New showColorPicker state:', showColorPicker.value)
  }

  // 管理色卡管理中心
  const handleColorManagementCenter = () => {
    console.log('=== COLOR MANAGEMENT CENTER DEBUG ===')
    console.log('Current showColorManagementCenter state:', showColorManagementCenter.value)
    showColorManagementCenter.value = !showColorManagementCenter.value
    console.log('New showColorManagementCenter state:', showColorManagementCenter.value)
  }

  // 更新颜色使用计数
  const updateColorUsage = (diamondData) => {
    if (!diamondData) return
    
    // 重置使用计数
    colorPalette.value.forEach(color => color.usage = 0)
    
    // 计算使用计数
    diamondData.grid.forEach(row => {
      row.forEach(cell => {
        if (cell.colorIndex >= 0 && cell.colorIndex < colorPalette.value.length) {
          colorPalette.value[cell.colorIndex].usage++
        }
      })
    })
  }

  // 导入色卡
  const importPalette = async () => {
    try {
      const { dialog } = require('@electron/remote') || require('electron').remote
      const fs = require('fs')
      
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Color Palette', extensions: ['json', 'pal'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const fileContent = fs.readFileSync(result.filePaths[0], 'utf8')
        const importedPalette = JSON.parse(fileContent)
        
        if (Array.isArray(importedPalette) && importedPalette.length > 0) {
          colorPalette.value = importedPalette
          return {
            success: true,
            message: '成功导入色卡'
          }
        }
      }
      
      return {
        success: false,
        message: '导入取消或文件无效'
      }
    } catch (error) {
      console.error('Import palette error:', error)
      return {
        success: false,
        message: '导入色卡失败: ' + error.message
      }
    }
  }

  return {
    // 响应式数据
    colorPalette,
    loadingColors,
    colorLoadError,
    selectedColorIndex,
    showColorPicker,
    showColorManagementCenter,
    
    // 计算属性
    nextColorCode,
    
    // 方法
    loadColorPalettes,
    addColor,
    deleteColor,
    selectColor,
    handleManageColors,
    handleColorManagementCenter,
    updateColorUsage,
    importPalette
  }
}
