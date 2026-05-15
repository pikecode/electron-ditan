/**
 * API类型定义文件
 * 提供JSDoc类型注释，改善开发体验
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success - 操作是否成功
 * @property {*} [data] - 成功时返回的数据
 * @property {string} [error] - 失败时的错误信息
 * @property {string} [error_code] - 错误代码
 */

/**
 * @typedef {Object} ImageData
 * @property {string} image_id - 图片ID
 * @property {string} base64 - base64编码的图片数据
 * @property {string} type - 图片类型 (如: image/png)
 * @property {number} width - 图片宽度
 * @property {number} height - 图片高度
 * @property {number} size - 文件大小
 */

/**
 * @typedef {Object} CanvasSettings
 * @property {number} width - 画布宽度(cm)
 * @property {number} height - 画布高度(cm)
 * @property {number} gridSize - 网格大小(cm)
 */

/**
 * @typedef {Object} Position
 * @property {number} x - X坐标
 * @property {number} y - Y坐标
 */

/**
 * @typedef {Object} RgbColor
 * @property {number} r - 红色值 (0-255)
 * @property {number} g - 绿色值 (0-255)
 * @property {number} b - 蓝色值 (0-255)
 */

/**
 * @typedef {Object} ColorPalette
 * @property {string} id - 色卡ID
 * @property {string} name - 色卡名称
 * @property {RgbColor} rgb - RGB颜色值
 * @property {string} hex - 十六进制颜色值
 */

/**
 * @typedef {Object} DiamondImageData
 * @property {string} diamond_image_id - 钻石图ID
 * @property {number} grid_width - 网格宽度
 * @property {number} grid_height - 网格高度
 * @property {number} total_diamonds - 钻石总数
 * @property {Object.<string, number>} color_usage - 色卡使用情况
 * @property {Object} statistics - 统计信息
 */

/**
 * @typedef {Object} PaintResult
 * @property {string} new_diamond_image_id - 新的钻石图ID
 * @property {Object} modified_area - 修改区域信息
 * @property {Object} color_usage_change - 色卡使用变化
 */

/**
 * @typedef {Object} LoadImageParams
 * @property {string} imageId - 图片ID
 * @property {CanvasSettings} canvasSettings - 画布设置
 * @property {string[]} colorPaletteIds - 色卡ID数组
 * @property {Object} [options] - 可选参数
 */

/**
 * @typedef {Object} PaintCanvasParams
 * @property {string} diamondImageId - 钻石图ID
 * @property {Position} startPosition - 开始位置
 * @property {Position} endPosition - 结束位置
 * @property {string} colorId - 色卡ID
 */

/**
 * @typedef {Object} AddColorParams
 * @property {string} name - 色卡名称
 * @property {RgbColor} rgb - RGB颜色值
 * @property {string} hex - 十六进制颜色值
 */

// 导出类型定义（在JavaScript中这只是注释，但对IDE有帮助）
export const Types = {
  // 这个对象实际上是空的，但包含了上面的类型定义
  // 在TypeScript项目中可以转换为真正的类型定义
}

/**
 * 验证RGB颜色值是否有效
 * @param {RgbColor} rgb - RGB对象
 * @returns {boolean} 是否有效
 */
export function isValidRgb(rgb) {
  return rgb && 
         typeof rgb.r === 'number' && rgb.r >= 0 && rgb.r <= 255 &&
         typeof rgb.g === 'number' && rgb.g >= 0 && rgb.g <= 255 &&
         typeof rgb.b === 'number' && rgb.b >= 0 && rgb.b <= 255
}

/**
 * 验证十六进制颜色值是否有效
 * @param {string} hex - 十六进制颜色值
 * @returns {boolean} 是否有效
 */
export function isValidHex(hex) {
  return typeof hex === 'string' && /^#[0-9A-Fa-f]{6}$/.test(hex)
}

/**
 * 验证位置对象是否有效
 * @param {Position} position - 位置对象
 * @returns {boolean} 是否有效
 */
export function isValidPosition(position) {
  return position && 
         typeof position.x === 'number' && 
         typeof position.y === 'number' &&
         position.x >= 0 && position.y >= 0
} 