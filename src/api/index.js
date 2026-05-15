/**
 * API接口统一导出
 */

import colorAPI from './colorAPI.js'
import * as colorGroupAPI from './colorGroupAPI.js'

// 导出所有API接口
export {
  colorAPI,
  colorGroupAPI
}

// 默认导出包含所有API的对象
export default {
  colorAPI,
  colorGroupAPI
}

/**
 * API使用示例：
 * 
 * // 方式1: 按需导入
 * import { colorAPI, colorGroupAPI } from '@/api'
 * 
 * // 方式2: 导入所有
 * import API from '@/api'
 * API.colorAPI.getColor('color_001')
 * 
 * // 方式3: 解构导入
 * import { colorAPI as clr } from '@/api'
 * clr.getColor('color_001')
 */