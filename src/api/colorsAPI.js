/**
 * 色卡 API 接口
 * 统一管理所有与单个色卡相关的后端接口调用
 */

// API 基础配置
const API_BASE_URL = '/api/colors'

/**
 * 统一的 API 响应格式
 * @typedef {Object} ApiResponse
 * @property {boolean} success - 请求是否成功
 * @property {any} [data] - 成功时返回的数据
 * @property {string} [error] - 失败时的错误信息
 */

/**
 * 色卡数据结构
 * @typedef {Object} Color
 * @property {number} id - 色卡ID
 * @property {string} name - 色卡名称
 * @property {string} hex - 十六进制颜色值
 * @property {number} rgb_r - RGB红色值
 * @property {number} rgb_g - RGB绿色值
 * @property {number} rgb_b - RGB蓝色值
 * @property {string} createdAt - 创建时间
 * @property {string} updatedAt - 更新时间
 */

/**
 * 模拟 API 调用延迟
 * @param {number} ms - 延迟毫秒数
 */
const mockDelay = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 获取所有色卡
 * @param {Object} options - 查询选项
 * @param {number} [options.page] - 页码
 * @param {number} [options.limit] - 每页数量
 * @param {string} [options.search] - 搜索关键词
 * @returns {Promise<ApiResponse>}
 */
export async function getAllColors(options = {}) {
  try {
    await mockDelay()
    
    // TODO: 替换为真实的后端API调用
    // const queryParams = new URLSearchParams(options).toString()
    // const response = await fetch(`${API_BASE_URL}?${queryParams}`)
    // const data = await response.json()
    
    console.log('Fetching colors with options:', options)
    
    // 临时返回空数据，实际数据由 useSimpleColorManagement 提供
    return { success: true, data: [] }
  } catch (error) {
    console.error('Failed to fetch colors:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 根据ID获取单个色卡
 * @param {number} colorId - 色卡ID
 * @returns {Promise<ApiResponse>}
 */
export async function getColorById(colorId) {
  try {
    await mockDelay()
    
    // TODO: 替换为真实的后端API调用
    // const response = await fetch(`${API_BASE_URL}/${colorId}`)
    // const data = await response.json()
    
    console.log(`Getting color with ID: ${colorId}`)
    return { success: false, error: 'Not implemented yet' }
  } catch (error) {
    console.error('Failed to fetch color:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 创建新色卡
 * @param {Object} colorData - 色卡数据
 * @param {string} colorData.name - 色卡名称
 * @param {string} colorData.hex - 十六进制颜色值
 * @returns {Promise<ApiResponse>}
 */
export async function createColor(colorData) {
  try {
    await mockDelay()
    
    // TODO: 替换为真实的后端API调用
    // const response = await fetch(`${API_BASE_URL}`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(colorData)
    // })
    // const data = await response.json()
    
    console.log('Creating color:', colorData)
    
    // 这里应该调用实际的创建逻辑，暂时返回成功
    return { success: true, data: { id: Date.now(), ...colorData } }
  } catch (error) {
    console.error('Failed to create color:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 更新色卡信息
 * @param {number} colorId - 色卡ID
 * @param {Object} updateData - 要更新的数据
 * @returns {Promise<ApiResponse>}
 */
export async function updateColor(colorId, updateData) {
  try {
    await mockDelay()
    
    // TODO: 替换为真实的后端API调用
    // const response = await fetch(`${API_BASE_URL}/${colorId}`, {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(updateData)
    // })
    // const data = await response.json()
    
    console.log(`Updating color ${colorId}:`, updateData)
    return { success: true, data: { id: colorId, ...updateData } }
  } catch (error) {
    console.error('Failed to update color:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 删除色卡
 * @param {number} colorId - 色卡ID
 * @returns {Promise<ApiResponse>}
 */
export async function deleteColor(colorId) {
  try {
    await mockDelay()
    
    // TODO: 替换为真实的后端API调用
    // const response = await fetch(`${API_BASE_URL}/${colorId}`, {
    //   method: 'DELETE'
    // })
    
    console.log(`Deleting color: ${colorId}`)
    return { success: true, data: { deletedId: colorId } }
  } catch (error) {
    console.error('Failed to delete color:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 复制色卡
 * @param {number} colorId - 要复制的色卡ID
 * @returns {Promise<ApiResponse>}
 */
export async function duplicateColor(colorId) {
  try {
    await mockDelay()
    
    // TODO: 替换为真实的后端API调用
    // const response = await fetch(`${API_BASE_URL}/${colorId}/duplicate`, {
    //   method: 'POST'
    // })
    // const data = await response.json()
    
    console.log(`Duplicating color: ${colorId}`)
    return { success: true, data: { originalId: colorId, newId: Date.now() } }
  } catch (error) {
    console.error('Failed to duplicate color:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 导出色卡数据
 * @param {Array<number>} colorIds - 要导出的色卡ID列表，如果为空则导出全部
 * @param {string} format - 导出格式 ('json', 'csv', 'excel')
 * @returns {Promise<ApiResponse>}
 */
export async function exportColors(colorIds = [], format = 'json') {
  try {
    await mockDelay()
    
    // TODO: 替换为真实的后端API调用
    // const queryParams = new URLSearchParams({ format })
    // if (colorIds.length) queryParams.append('ids', colorIds.join(','))
    // const response = await fetch(`${API_BASE_URL}/export?${queryParams}`)
    // const data = await response.json()
    
    console.log('Exporting colors:', { colorIds, format })
    return { success: true, data: { exportUrl: '/mock-colors-export.json' } }
  } catch (error) {
    console.error('Failed to export colors:', error)
    return { success: false, error: error.message }
  }
}
