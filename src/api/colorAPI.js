import {
  getAllColorPalettes,
  addColorPalette as addColorPaletteStore,
  deleteColorPalette as deleteColorPaletteStore,
  batchDeleteColorPalettes as batchDeleteColorPalettesStore,
  updateColorPaletteInternal as updateColorPaletteStore
} from '../database/indexeddb/colorStore.js'

const COLOR_MANAGEMENT_ADMIN_PASSWORD = 'shuosigongyi8.'

/**
 * 色卡管理API接口
 */
class ColorAPI {
  
  /**
   * 检查后端库状态
   * @private
   */
  async _checkBackendStatus() {
    return { libraryAvailable: true, initialized: true }
  }

  /**
   * 统一的错误处理
   * @private
   */
  _handleError(operation, error) {
    console.error(`ColorAPI.${operation} error:`, error)
    return { success: false, error: error.message, error_code: 'DATABASE_ERROR' }
  }
  
  /**
   * 获取色卡列表
   * @returns {Promise<Object>} 色卡列表数据
   */
  async getColorPalettes() {
    try {
      const palettes = await getAllColorPalettes()
      const color_palettes = palettes.map(p => ({
        id: p.id, // numeric id without prefix
        name: p.name,
        rgb: { r: p.rgb_r, g: p.rgb_g, b: p.rgb_b },
        hex: p.hex_color
      }))
      return { success: true, data: { color_palettes, total_count: color_palettes.length } }
    } catch (e) { return this._handleError('getColorPalettes', e) }
  }

  /**
   * 添加色卡
   * @param {Object} params - 色卡参数
   * @param {string} params.name - 色卡名称
   * @param {Object} params.rgb - RGB颜色值 {r, g, b}
   * @param {string} params.hex - 十六进制颜色值
   * @returns {Promise<Object>} 添加结果
   */
  async addColorPalette(params) {
    try {
      if (!params || typeof params !== 'object') throw new Error('Invalid parameters')
      const { name, rgb, hex } = params
      if (name !== undefined && name !== null && typeof name !== 'string') throw new Error('Invalid name parameter')
      if (!rgb || typeof rgb !== 'object' || typeof rgb.r !== 'number' || typeof rgb.g !== 'number' || typeof rgb.b !== 'number') throw new Error('Invalid rgb parameter')
      if (!hex || typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error('Invalid hex parameter')
      const created = await addColorPaletteStore({ name: (name && name.trim()) || 'unknown', rgb_r: Math.floor(rgb.r), rgb_g: Math.floor(rgb.g), rgb_b: Math.floor(rgb.b), hex_color: hex.toUpperCase() })
      return { success: true, data: { id: created.id, name: created.name, rgb: { r: created.rgb_r, g: created.rgb_g, b: created.rgb_b }, hex: created.hex_color, created_at: created.created_at } }
    } catch (e) { return this._handleError('addColorPalette', e) }
  }

  /**
   * 更新色卡
   * @param {string|number} colorId - 色卡ID
   * @param {Object} params - 色卡参数
   * @returns {Promise<Object>} 更新结果
   */
  async updateColorPalette(colorId, params) {
    try {
      if (colorId === undefined || colorId === null) throw new Error('Invalid color_id parameter')
      if (!params || typeof params !== 'object') throw new Error('Invalid parameters')
      let idNum
      if (typeof colorId === 'string') {
        if (colorId.startsWith('color_')) idNum = parseInt(colorId.slice(6), 10)
        else idNum = parseInt(colorId, 10)
      } else if (typeof colorId === 'number') {
        idNum = colorId
      } else {
        throw new Error('Invalid color_id format')
      }
      if (isNaN(idNum)) throw new Error('Invalid color_id format')

      const patch = {}
      if (params.name !== undefined) {
        if (params.name !== null && typeof params.name !== 'string') throw new Error('Invalid name parameter')
        patch.name = (params.name && params.name.trim()) || 'unknown'
      }

      let rgb = params.rgb
      let hex = params.hex
      if (!rgb && hex) {
        rgb = this.hexToRgb(hex)
      }
      if (rgb) {
        if (typeof rgb !== 'object' || typeof rgb.r !== 'number' || typeof rgb.g !== 'number' || typeof rgb.b !== 'number') {
          throw new Error('Invalid rgb parameter')
        }
        patch.rgb_r = Math.floor(rgb.r)
        patch.rgb_g = Math.floor(rgb.g)
        patch.rgb_b = Math.floor(rgb.b)
      }
      if (hex !== undefined) {
        if (!hex || typeof hex !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(hex)) throw new Error('Invalid hex parameter')
        patch.hex_color = hex.toUpperCase()
      } else if (rgb) {
        patch.hex_color = this.rgbToHex(patch.rgb_r, patch.rgb_g, patch.rgb_b)
      }

      const updated = await updateColorPaletteStore(idNum, patch)
      return {
        success: true,
        data: {
          id: updated.id,
          name: updated.name,
          rgb: { r: updated.rgb_r, g: updated.rgb_g, b: updated.rgb_b },
          hex: updated.hex_color,
          updated_at: updated.updated_at
        }
      }
    } catch (e) { return this._handleError('updateColorPalette', e) }
  }

  /**
   * 删除色卡
   * @param {string} colorId - 色卡ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteColorPalette(colorId) {
    try {
      if (colorId === undefined || colorId === null) throw new Error('Invalid color_id parameter')
      let idNum
      if (typeof colorId === 'string') {
        if (colorId.startsWith('color_')) idNum = parseInt(colorId.slice(6), 10)
        else idNum = parseInt(colorId, 10)
      } else if (typeof colorId === 'number') { idNum = colorId } else { throw new Error('Invalid color_id format') }
      if (isNaN(idNum)) throw new Error('Invalid color_id format')
      const result = await deleteColorPaletteStore(idNum)
      return {
        success: true,
        data: {
          deleted_color_id: idNum,
          deleted_at: new Date().toISOString(),
          remaining_count: result.remainingCount
        }
      }
    } catch (e) { return this._handleError('deleteColorPalette', e) }
  }

  /**
   * 批量删除色卡
   * @param {Array<string|number>} colorIds - 色卡ID列表
   * @returns {Promise<Object>} 删除结果
   */
  async batchDeleteColorPalettes(colorIds) {
    try {
      if (!Array.isArray(colorIds) || colorIds.length === 0) {
        throw new Error('Invalid color_ids parameter')
      }

      const normalizedIds = colorIds.map(colorId => {
        if (typeof colorId === 'string') {
          return colorId.startsWith('color_') ? parseInt(colorId.slice(6), 10) : parseInt(colorId, 10)
        }
        if (typeof colorId === 'number') return colorId
        return NaN
      }).filter(id => !isNaN(id))

      if (!normalizedIds.length) {
        throw new Error('Invalid color_ids parameter')
      }

      const result = await batchDeleteColorPalettesStore(normalizedIds)
      return {
        success: true,
        data: {
          deleted_color_ids: result.deleted,
          not_found_color_ids: result.notFound,
          deleted_count: result.deleted.length,
          remaining_count: result.remainingCount,
          deleted_at: new Date().toISOString()
        }
      }
    } catch (e) { return this._handleError('batchDeleteColorPalettes', e) }
  }

  /**
   * 根据RGB值自动生成色卡数据
   * @param {number} r - 红色值 (0-255)
   * @param {number} g - 绿色值 (0-255)
   * @param {number} b - 蓝色值 (0-255)
   * @returns {Object} 色卡数据格式
   */
  createColorData(r, g, b) {
    // 确保RGB值在有效范围内
    r = Math.max(0, Math.min(255, Math.floor(r)))
    g = Math.max(0, Math.min(255, Math.floor(g)))
    b = Math.max(0, Math.min(255, Math.floor(b)))

    // 生成十六进制值
    const hex = '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()

    return {
      rgb: { r, g, b },
      hex: hex
    }
  }

  /**
   * 十六进制转RGB
   * @param {string} hex - 十六进制颜色值 (如: #FF0000)
   * @returns {Object} RGB对象 {r, g, b}
   */
  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  /**
   * RGB转十六进制
   * @param {number} r - 红色值
   * @param {number} g - 绿色值
   * @param {number} b - 蓝色值
   * @returns {string} 十六进制颜色值
   */
  rgbToHex(r, g, b) {
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  }

  /**
   * 获取色卡管理密码
   * @returns {Promise<Object>} API响应
   */
  async getColorPalettePassword() {
    // 前端固定密码，不返回明文
    return { success:true, data:{ password_set:true } }
  }

  /**
   * 验证色卡管理密码
   * @param {string} password - 用户输入的密码
   * @returns {Promise<Object>} 验证结果
   */
  async verifyColorPalettePassword(password) {
    if (password === COLOR_MANAGEMENT_ADMIN_PASSWORD) {
      return { success:true, data:{ verified:true } }
    }
    return { success:false, error:'Invalid password', error_code:'COLOR_PASSWORD_VERIFY_FAILED' }
  }

  /**
   * 导出色卡数据
   * @returns {Promise<Object>} 导出结果
   */
  async exportColorPalettes() {
    try {
      const palettes = await getAllColorPalettes()
      return { success:true, data:{ version:'1.0', exported_at:new Date().toISOString(), colors: palettes.map(p=>({ id:p.id, name:p.name, rgb:{ r:p.rgb_r,g:p.rgb_g,b:p.rgb_b }, hex:p.hex_color, protected:!!p.protected, created_at:p.created_at, updated_at:p.updated_at })) } }
    } catch(e){ return this._handleError('exportColorPalettes', e) }
  }

  /**
   * 导入色卡数据
   * @param {Object} payload - 导入的色卡数据
   * @param {Array} payload.colors - 色卡颜色数组
   * @returns {Promise<Object>} 导入结果
   */
  async importColorPalettes(payload) {
    try {
      if (!payload || !Array.isArray(payload.colors)) throw new Error('Invalid import payload')
      const preserveGroups = payload.preserveGroups !== false // default true
      const { replaceAllPalettesAndGroups } = await import('../database/indexeddb/colorStore.js')
      const result = await replaceAllPalettesAndGroups(payload.colors, { preserveGroups })
      const palettes = await getAllColorPalettes()
      return { success:true, data:{ summary: result, total_after: palettes.length } }
    } catch(e){ return this._handleError('importColorPalettes', e) }
  }
}

// 导出单例实例
const colorAPI = new ColorAPI()
export default colorAPI
