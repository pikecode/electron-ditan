/**
 * 错误处理工具
 * 统一处理和翻译各种类型的错误消息
 */

/**
 * 错误类型枚举
 */
export const ERROR_TYPES = {
  NETWORK: 'NETWORK',
  VALIDATION: 'VALIDATION',
  DUPLICATE: 'DUPLICATE',
  NOT_FOUND: 'NOT_FOUND',
  PERMISSION: 'PERMISSION',
  SERVER: 'SERVER',
  UNKNOWN: 'UNKNOWN'
}

/**
 * 错误模式匹配规则
 */
const ERROR_PATTERNS = [
  {
    pattern: /Color with RGB\((\d+),(\d+),(\d+)\) already exists/,
    type: ERROR_TYPES.DUPLICATE,
    handler: (match, t) => {
      const [, r, g, b] = match
      return t('colorManagement.colorAlreadyExists', { r, g, b })
    }
  },
  {
    pattern: /Group name .+ already exists/,
    type: ERROR_TYPES.DUPLICATE,
    handler: (match, t) => t('colorManagement.groupNameAlreadyExists')
  },
  {
    pattern: /Network Error|fetch failed/i,
    type: ERROR_TYPES.NETWORK,
    handler: (match, t) => t('errors.networkError')
  },
  {
    pattern: /404|not found/i,
    type: ERROR_TYPES.NOT_FOUND,
    handler: (match, t) => t('errors.notFound')
  },
  {
    pattern: /401|unauthorized/i,
    type: ERROR_TYPES.PERMISSION,
    handler: (match, t) => t('errors.unauthorized')
  },
  {
    pattern: /500|internal server error/i,
    type: ERROR_TYPES.SERVER,
    handler: (match, t) => t('errors.serverError')
  }
]

/**
 * 错误处理类
 */
export class ErrorHandler {
  constructor(t) {
    this.t = t // i18n 翻译函数
  }

  /**
   * 翻译错误消息
   * @param {string} errorMessage - 原始错误消息
   * @param {string} context - 错误上下文 ('color', 'group', 'general')
   * @returns {string} 翻译后的错误消息
   */
  translateError(errorMessage, context = 'general') {
    if (!errorMessage) {
      return this.t('errors.unknown')
    }

    // 尝试匹配已知错误模式
    for (const { pattern, handler } of ERROR_PATTERNS) {
      const match = errorMessage.match(pattern)
      if (match) {
        try {
          return handler(match, this.t)
        } catch (err) {
          console.warn('Error in error handler:', err)
          break
        }
      }
    }

    // 如果没有匹配到特定模式，返回通用错误消息
    return this.getContextualError(errorMessage, context)
  }

  /**
   * 根据上下文获取错误消息
   * @param {string} errorMessage - 原始错误消息
   * @param {string} context - 错误上下文
   * @returns {string}
   */
  getContextualError(errorMessage, context) {
    const contextKey = `errors.${context}.generic`
    
    // 尝试获取上下文相关的错误消息
    try {
      const contextualMessage = this.t(contextKey)
      if (contextualMessage !== contextKey) {
        return `${contextualMessage}: ${errorMessage}`
      }
    } catch (err) {
      // 如果上下文翻译失败，继续使用通用错误
    }

    // 返回通用错误格式
    return `${this.t('errors.operationFailed')}: ${errorMessage}`
  }

  /**
   * 获取错误类型
   * @param {string} errorMessage - 错误消息
   * @returns {string} 错误类型
   */
  getErrorType(errorMessage) {
    for (const { pattern, type } of ERROR_PATTERNS) {
      if (pattern.test(errorMessage)) {
        return type
      }
    }
    return ERROR_TYPES.UNKNOWN
  }

  /**
   * 创建标准化的错误响应
   * @param {string} errorMessage - 错误消息
   * @param {string} context - 错误上下文
   * @returns {Object} 标准化错误响应
   */
  createErrorResponse(errorMessage, context = 'general') {
    const translatedMessage = this.translateError(errorMessage, context)
    const errorType = this.getErrorType(errorMessage)
    
    return {
      success: false,
      error: translatedMessage,
      errorType,
      originalError: errorMessage
    }
  }

  /**
   * 处理 API 响应错误
   * @param {Object} response - API响应
   * @param {string} context - 错误上下文
   * @returns {Object} 处理后的响应
   */
  handleApiResponse(response, context = 'general') {
    if (response.success) {
      return response
    }

    return this.createErrorResponse(response.error || 'Unknown error', context)
  }
}

/**
 * 创建错误处理器实例
 * @param {Function} t - i18n 翻译函数
 * @returns {ErrorHandler}
 */
export function createErrorHandler(t) {
  return new ErrorHandler(t)
}

/**
 * 验证工具函数
 */
export const ValidationUtils = {
  /**
   * 验证色卡名称
   * @param {string} name - 色卡名称
   * @returns {{valid: boolean, error?: string}}
   */
  validateColorName(name) {
    if (!name || !name.trim()) {
      return { valid: false, error: 'colorManagement.nameRequired' }
    }
    if (name.trim().length > 50) {
      return { valid: false, error: 'colorManagement.nameTooLong' }
    }
    return { valid: true }
  },

  /**
   * 验证十六进制颜色值
   * @param {string} hex - 十六进制颜色值
   * @returns {{valid: boolean, error?: string}}
   */
  validateHexColor(hex) {
    if (!hex) {
      return { valid: false, error: 'colorManagement.hexRequired' }
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      return { valid: false, error: 'colorManagement.invalidHex' }
    }
    return { valid: true }
  },

  /**
   * 验证分组名称
   * @param {string} name - 分组名称
   * @returns {{valid: boolean, error?: string}}
   */
  validateGroupName(name) {
    if (!name || !name.trim()) {
      return { valid: false, error: 'colorManagement.groupNameRequired' }
    }
    if (name.trim().length > 100) {
      return { valid: false, error: 'colorManagement.groupNameTooLong' }
    }
    return { valid: true }
  }
}

/**
 * 通用操作结果处理
 */
export const OperationUtils = {
  /**
   * 创建成功响应
   * @param {any} data - 成功数据
   * @param {string} message - 成功消息
   * @returns {Object}
   */
  createSuccessResponse(data, message) {
    return {
      success: true,
      data,
      message
    }
  },

  /**
   * 创建失败响应
   * @param {string} error - 错误消息
   * @param {string} errorType - 错误类型
   * @returns {Object}
   */
  createErrorResponse(error, errorType = ERROR_TYPES.UNKNOWN) {
    return {
      success: false,
      error,
      errorType
    }
  },

  /**
   * 安全执行异步操作
   * @param {Function} operation - 异步操作函数
   * @param {string} context - 操作上下文
   * @param {ErrorHandler} errorHandler - 错误处理器
   * @returns {Promise<Object>}
   */
  async safeExecute(operation, context, errorHandler) {
    try {
      const result = await operation()
      return result
    } catch (error) {
      console.error(`Operation failed in context ${context}:`, error)
      return errorHandler.createErrorResponse(error.message, context)
    }
  }
}
