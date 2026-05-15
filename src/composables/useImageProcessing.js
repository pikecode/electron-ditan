import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'

export function useImageProcessing() {
  const { t } = useI18n()
  
  // 图片和钻石数据
  const originalImage = ref(null)
  const diamondData = ref(null)
  const imageLoaded = ref(false)
  const imageInfo = ref({})
  const canSave = ref(false)

  // 状态
  const status = reactive({
    text: t('canvas.status.ready'),
    type: 'info'
  })
  const progress = ref(0)
  const showProgress = ref(false)

  // 加载图片
  const loadImages = async () => {
    try {
      const { dialog } = require('@electron/remote') || require('electron').remote
      const path = require('path')
      
      const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [
          { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif'] }
        ]
      })

      if (!result.canceled && result.filePaths.length > 0) {
        const files = result.filePaths.map(filePath => ({
          name: path.basename(filePath),
          path: filePath
        }))
        
        handleImageFiles(files)
        
        return {
          success: true,
          message: '图片加载成功'
        }
      }
      
      return {
        success: false,
        message: '图片加载取消'
      }
    } catch (error) {
      console.error('Error loading images:', error)
      return {
        success: false,
        message: '加载图片失败: ' + error.message
      }
    }
  }

  // 处理图片文件
  const handleImageFiles = (files) => {
    if (files && files.length > 0) {
      const file = files[0]
      originalImage.value = file
      imageLoaded.value = true
      imageInfo.value = {
        name: file.name,
        path: file.path
      }
      updateStatus('图片已加载: ' + file.name, 'success')
    }
  }

  // 生成钻石图 - 目前是模拟实现，后续可以接入真实的图片处理算法
  const generateDiamondArt = async (canvasSettings, colorPalette) => {
    if (!originalImage.value) {
      const message = t('validation.noImage') || '请先加载图片'
      updateStatus(message, 'error')
      return {
        success: false,
        message: message
      }
    }

    if (!colorPalette || colorPalette.length === 0) {
      const message = '请先添加色卡'
      updateStatus(message, 'error')
      return {
        success: false,
        message: message
      }
    }

    try {
      showProgress.value = true
      updateStatus(t('canvas.status.generating') || '正在生成钻石图...')

      const params = {
        imagePath: originalImage.value.path,
        gridCountX: canvasSettings.gridCountX,
        gridCountY: canvasSettings.gridCountY,
        colorPalette: colorPalette,
        colorCount: canvasSettings.colorCount,
        ditherMode: canvasSettings.ditherMode
      }

      console.log('Generating diamond art with params:', params)

      // 这里应该调用真实的图片处理算法
      // 目前使用模拟数据
      const result = await processImageToDiamondArt(params)

      if (result.success) {
        diamondData.value = result.data
        canSave.value = true
        updateStatus(t('canvas.status.completed') || '钻石图生成完成', 'success')
        
        return {
          success: true,
          message: '钻石图生成成功',
          data: result.data
        }
      } else {
        throw new Error(result.error || '生成失败')
      }

    } catch (error) {
      console.error('Generate error:', error)
      const message = '生成钻石图失败: ' + error.message
      updateStatus(message, 'error')
      
      return {
        success: false,
        message: message
      }
    } finally {
      showProgress.value = false
    }
  }

  // 模拟钻石图生成 - 这里应该替换为真实的图片处理算法
  const processImageToDiamondArt = async (params) => {
    return new Promise((resolve) => {
      // 模拟处理时间
      let currentProgress = 0
      const progressInterval = setInterval(() => {
        currentProgress += 10
        progress.value = currentProgress
        
        if (currentProgress >= 100) {
          clearInterval(progressInterval)
          
          // 创建模拟钻石数据
          const data = []
          for (let y = 0; y < params.gridCountY; y++) {
            const row = []
            for (let x = 0; x < params.gridCountX; x++) {
              row.push({
                colorIndex: Math.floor(Math.random() * params.colorPalette.length),
                x, 
                y
              })
            }
            data.push(row)
          }
          
          resolve({
            success: true,
            data: {
              grid: data,
              width: params.gridCountX,
              height: params.gridCountY,
              palette: params.colorPalette,
              settings: {
                colorCount: params.colorCount,
                ditherMode: params.ditherMode
              }
            }
          })
        }
      }, 200)
    })
  }

  // 处理单元格点击
  const onCellClick = (x, y, selectedColorIndex) => {
    if (selectedColorIndex >= 0 && diamondData.value) {
      diamondData.value.grid[y][x].colorIndex = selectedColorIndex
      updateStatus(`已修改 (${x}, ${y}) 的颜色`)
      
      return {
        success: true,
        message: `已修改 (${x}, ${y}) 的颜色`
      }
    }
    
    return {
      success: false,
      message: '请先选择颜色'
    }
  }

  // 保存结果
  const saveResult = async (canvasSettings, colorPalette) => {
    if (!diamondData.value) {
      const message = t('validation.noData') || '没有可保存的数据'
      updateStatus(message, 'error')
      return {
        success: false,
        message: message
      }
    }

    try {
      const { dialog } = require('@electron/remote') || require('electron').remote
      const fs = require('fs')
      
      const result = await dialog.showSaveDialog({
        defaultPath: 'diamond_art.json',
        filters: [
          { name: 'Diamond Art', extensions: ['json'] },
          { name: 'PNG Image', extensions: ['png'] }
        ]
      })

      if (!result.canceled) {
        const data = {
          diamondData: diamondData.value,
          settings: {
            canvasWidth: canvasSettings.canvasWidth,
            canvasHeight: canvasSettings.canvasHeight,
            gridSize: canvasSettings.gridSize
          },
          colorPalette: colorPalette,
          metadata: {
            createdAt: new Date().toISOString(),
            version: '1.0.0'
          }
        }
        
        fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2))
        updateStatus('钻石图已保存到: ' + result.filePath, 'success')
        
        return {
          success: true,
          message: '钻石图已保存到: ' + result.filePath
        }
      }
      
      return {
        success: false,
        message: '保存取消'
      }
    } catch (error) {
      console.error('Save error:', error)
      const message = '保存失败: ' + error.message
      updateStatus(message, 'error')
      
      return {
        success: false,
        message: message
      }
    }
  }

  // 更新状态
  const updateStatus = (message, type = 'info') => {
    status.text = message
    status.type = type
  }

  return {
    // 响应式数据
    originalImage,
    diamondData,
    imageLoaded,
    imageInfo,
    canSave,
    status,
    progress,
    showProgress,
    
    // 方法
    loadImages,
    handleImageFiles,
    generateDiamondArt,
    onCellClick,
    saveResult,
    updateStatus
  }
}
