/**
 * 项目数据转换工具
 * 在前端UI数据格式和C++后端数据格式之间进行转换
 */

import {
  buildPersistedXsdParsed,
  extractPersistedXsdSource
} from './xsdProjectPersistence.js'

/**
 * 将前端项目数据转换为C++后端格式
 * @param {Object} frontendData - 前端项目数据
 * @returns {Object} C++后端格式的项目数据
 */
export function convertToBackendFormat(frontendData) {
  // 清理 selectedColors 数组，确保移除响应式代理
  const cleanSelectedColors = frontendData.colorConfig?.selectedColors ? 
    JSON.parse(JSON.stringify(frontendData.colorConfig.selectedColors)) : [];
  const cleanAllColors = frontendData.colorConfig?.allColors ?
    JSON.parse(JSON.stringify(frontendData.colorConfig.allColors)) : [];
  const storedPaletteColors = frontendData.colorConfig?.type === 'count' && cleanAllColors.length
    ? cleanAllColors
    : cleanSelectedColors;

  // 分开保存真原图和预览图，避免后续把 thumbnail 当 original 导出/合图
  let imageThumbnail = ''
  let imageData = ''

  if (frontendData.imageThumbnail) {
    imageThumbnail = frontendData.imageThumbnail
  }
  if (frontendData.imageData) {
    imageData = frontendData.imageData
  }
  if (frontendData.image) {
    imageThumbnail =
      imageThumbnail ||
      frontendData.image.thumbnail ||
      frontendData.image.src ||
      frontendData.image.base64 ||
      frontendData.image.data ||
      ''
    imageData =
      imageData ||
      frontendData.image.data ||
      frontendData.image.original ||
      frontendData.image.base64 ||
      frontendData.image.base64Data ||
      frontendData.image.base64_image ||
      ''
  }

  if (!imageThumbnail && imageData) {
    imageThumbnail = imageData
  }

  if (imageThumbnail && !imageThumbnail.startsWith('data:image/')) {
    imageThumbnail = `data:image/png;base64,${imageThumbnail}`
  }
  if (imageData && !imageData.startsWith('data:image/')) {
    imageData = `data:image/png;base64,${imageData}`
  }

  const backendData = {
    name: frontendData.name || '',
    import_type: frontendData.importType || (frontendData.xsdParsed ? 'xsd' : 'image'),
    image_path: frontendData.imagePath || frontendData.image?.path || '',
    image_name: frontendData.imageName || frontendData.image?.name || '',
    image_width: frontendData.imageWidth || frontendData.image?.size?.width || frontendData.image?.width || 0,
    image_height: frontendData.imageHeight || frontendData.image?.size?.height || frontendData.image?.height || 0,
    image_thumbnail: imageThumbnail,
    image_data: imageData,
    grid_length: frontendData.gridLength || frontendData.grid?.length || 0,
    grid_width: frontendData.gridWidth || frontendData.grid?.width || 0,
    cell_size: frontendData.cellSize || frontendData.grid?.cellSize || 1.0,
    color_type: frontendData.colorType || frontendData.colorConfig?.type || 'count',
    color_group_id: frontendData.colorGroupId || frontendData.colorConfig?.colorGroupId || 0,
    color_count: frontendData.colorCount || frontendData.colorConfig?.colorCount || 10,
    selected_colors: JSON.stringify(storedPaletteColors),
    process_data: JSON.stringify(frontendData.processData || {}),
    metadata: JSON.stringify(frontendData.metadata || {}),
    cells_matrix: JSON.stringify(frontendData.cellsMatrix || []),
    xsd_parsed: JSON.stringify(buildPersistedXsdParsed(frontendData.xsdParsed || null))
  }
  // 追加 result 原样（无需序列化由调用方决定）
  if (frontendData.result !== undefined) backendData.result = frontendData.result

  return backendData
}

/**
 * 将C++后端数据转换为前端格式
 * @param {Object} backendData - C++后端项目数据
 * @returns {Object} 前端格式的项目数据
 */
export function convertToFrontendFormat(backendData) {
  // 安全检查
  if (!backendData || typeof backendData !== 'object') {
    console.warn('Invalid backend data provided to convertToFrontendFormat:', backendData)
    return null
  }

  const fallbackId = generateDefaultId()

  // 安全解析辅助
  const safeParseJSON = (value, fallback) => {
    if (value == null) return fallback
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return fallback
      try { return JSON.parse(trimmed) } catch (e) {
        console.warn('Failed to parse JSON field:', e, 'value=', value.slice(0,120))
        return fallback
      }
    } else if (Array.isArray(value)) {
      // 已经是数组
      return value
    } else if (typeof value === 'object') {
      return value
    }
    return fallback
  }

  // 使用安全解析
  const processData = safeParseJSON(backendData.process_data, {})
  const metadata = safeParseJSON(backendData.metadata, {})
  const selectedColors = safeParseJSON(backendData.selected_colors, [])
  const cellsMatrix = safeParseJSON(backendData.cells_matrix, [])
  const xsdParsed = safeParseJSON(backendData.xsd_parsed, null)
  const xsdSource = extractPersistedXsdSource(xsdParsed)
  const colorType = backendData.color_type || backendData.color_config_type || 'count'
  const colorGroupId = backendData.color_group_id || 0
  const colorCount = backendData.color_count || 0
  const scopedColors = Array.isArray(selectedColors) ? selectedColors : []

  const imageThumbnail = backendData.image_thumbnail || backendData.image_data || ''
  const imageData = backendData.image_data || ''

  return {
    id: backendData.id || backendData.uuid || fallbackId,
    uuid: backendData.uuid || backendData.id || fallbackId,
    name: backendData.name || '',
    importType: backendData.import_type || (xsdParsed ? 'xsd' : 'image'),
    createdAt: backendData.created_at || new Date().toISOString(),
    updatedAt: backendData.updated_at || new Date().toISOString(),
    image: {
      path: backendData.image_path || '',
      name: backendData.image_name || '',
      size: {
        width: backendData.image_width || 0,
        height: backendData.image_height || 0
      },
      thumbnail: imageThumbnail,
      data: imageData
    },
    grid: {
      length: backendData.grid_length || 0,
      width: backendData.grid_width || 0,
      cellSize: backendData.cell_size || backendData.grid_cell_size || 0.0
    },
    colorConfig: {
      type: colorType,
      colorGroupId: colorGroupId,
      colorCount: colorCount,
      selectedColors: colorType === 'group' ? scopedColors : [],
      allColors: scopedColors
    },
    processData: processData,
    metadata: metadata,
    result: backendData.result ? (typeof backendData.result === 'string' ? safeParseJSON(backendData.result, null) : backendData.result) : null,
    cellsMatrix: Array.isArray(cellsMatrix) ? cellsMatrix : [],
    xsdParsed: xsdParsed,
    xsd: xsdSource
      ? {
          path: xsdSource.path || '',
          name: xsdSource.name || '',
          size: xsdSource.size || 0
        }
      : {
          path: '',
          name: '',
          size: 0
        }
  }
}

/**
 * 生成默认ID
 */
function generateDefaultId() {
  return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

/**
 * 验证项目数据
 * @param {Object} projectData - 项目数据
 * @returns {Object} 验证结果
 */
export function validateProjectData(projectData) {
  const errors = []
  
  if (!projectData) {
    errors.push('项目数据不能为空')
    return { isValid: false, errors }
  }

  if (!projectData.name || typeof projectData.name !== 'string' || projectData.name.trim().length === 0) {
    errors.push('项目名称是必需的且不能为空')
  }

  if (projectData.name && projectData.name.length > 255) {
    errors.push('项目名称不能超过255个字符')
  }

  // 可选字段验证
  if (projectData.image) {
    if (projectData.image.path && typeof projectData.image.path !== 'string') {
      errors.push('图片路径必须是字符串')
    }
    
    if (projectData.image.size) {
      if (projectData.image.size.width && typeof projectData.image.size.width !== 'number') {
        errors.push('图片宽度必须是数字')
      }
      if (projectData.image.size.height && typeof projectData.image.size.height !== 'number') {
        errors.push('图片高度必须是数字')
      }
    }
  }

  if (projectData.grid) {
    if (projectData.grid.length && typeof projectData.grid.length !== 'number') {
      errors.push('网格长度必须是数字')
    }
    if (projectData.grid.width && typeof projectData.grid.width !== 'number') {
      errors.push('网格宽度必须是数字')
    }
    if (projectData.grid.cellSize && typeof projectData.grid.cellSize !== 'number') {
      errors.push('单元格大小必须是数字')
    }
  }

  if (projectData.colorConfig) {
    if (projectData.colorConfig.selectedColors && !Array.isArray(projectData.colorConfig.selectedColors)) {
      errors.push('选中的颜色必须是数组')
    }
    if (projectData.colorConfig.allColors && !Array.isArray(projectData.colorConfig.allColors)) {
      errors.push('颜色范围必须是数组')
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  }
}

/**
 * 生成默认项目名称
 * @returns {string} 默认项目名称
 */
export function generateDefaultProjectName() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('zh-CN').replace(/\//g, '-')
  const timeStr = now.toLocaleTimeString('zh-CN', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  })
  return `新项目 ${dateStr} ${timeStr}`
}

/**
 * 创建空项目数据模板
 * @param {string} name - 项目名称
 * @returns {Object} 项目数据模板
 */
export function createEmptyProject(name) {
  return {
    name: name || generateDefaultProjectName(),
    image: {
      path: '',
      name: '',
      size: { width: 0, height: 0 },
      thumbnail: '',
      data: ''
    },
    grid: {
      length: 0,
      width: 0,
      cellSize: 0.0
    },
    colorConfig: {
      type: 'RGB',
      colorGroupId: 0,
      colorCount: 0,
      selectedColors: [],
      allColors: []
    },
    processData: {},
    metadata: {}
  }
}
