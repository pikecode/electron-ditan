/**
 * API 配置文件
 * 统一管理所有 API 端点和配置
 */

// 环境变量配置
const isDevelopment = process.env.NODE_ENV === 'development'
const isProduction = process.env.NODE_ENV === 'production'

/**
 * API 基础配置
 */
export const API_CONFIG = {
  // 基础URL配置
  BASE_URL: process.env.VUE_APP_API_BASE_URL || (isDevelopment ? 'http://localhost:3000' : ''),
  
  // 超时配置
  TIMEOUT: 10000, // 10秒
  
  // 重试配置
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1秒
  
  // 请求头配置
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}

/**
 * API 端点配置
 */
export const API_ENDPOINTS = {
  // 色卡相关接口
  COLORS: {
    BASE: '/api/colors',
    LIST: '/api/colors',
    CREATE: '/api/colors',
    GET_BY_ID: (id) => `/api/colors/${id}`,
    UPDATE: (id) => `/api/colors/${id}`,
    DELETE: (id) => `/api/colors/${id}`,
    DUPLICATE: (id) => `/api/colors/${id}/duplicate`,
    BATCH_DELETE: '/api/colors/batch',
    SEARCH: '/api/colors/search',
    EXPORT: '/api/colors/export',
    IMPORT: '/api/colors/import'
  },
  
  // 色卡分组相关接口
  COLOR_GROUPS: {
    BASE: '/api/color-groups',
    LIST: '/api/color-groups',
    CREATE: '/api/color-groups',
    GET_BY_ID: (id) => `/api/color-groups/${id}`,
    UPDATE: (id) => `/api/color-groups/${id}`,
    DELETE: (id) => `/api/color-groups/${id}`,
    ADD_COLORS: (id) => `/api/color-groups/${id}/colors`,
    REMOVE_COLOR: (groupId, colorId) => `/api/color-groups/${groupId}/colors/${colorId}`,
    EXPORT: '/api/color-groups/export',
    IMPORT: '/api/color-groups/import'
  },
  
  // 用户相关接口 (预留)
  USER: {
    BASE: '/api/user',
    PROFILE: '/api/user/profile',
    PREFERENCES: '/api/user/preferences',
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    REFRESH: '/api/auth/refresh'
  },
  
  // 系统相关接口 (预留)
  SYSTEM: {
    INFO: '/api/system/info',
    HEALTH: '/api/system/health',
    VERSION: '/api/system/version'
  }
}

/**
 * 错误码配置
 */
export const ERROR_CODES = {
  // 通用错误
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  PARSE_ERROR: 'PARSE_ERROR',
  
  // 业务错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  DUPLICATE_ERROR: 'DUPLICATE_ERROR',
  NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  
  // 服务器错误
  SERVER_ERROR: 'SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
}

/**
 * HTTP 状态码映射
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
}

/**
 * 请求方法枚举
 */
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE'
}

/**
 * 开发模式配置
 */
export const DEV_CONFIG = {
  // 是否启用模拟延迟
  ENABLE_MOCK_DELAY: true,
  
  // 模拟延迟时间（毫秒）
  MOCK_DELAY: 300,
  
  // 是否打印详细日志
  VERBOSE_LOGGING: true,
  
  // 是否启用API模拟
  ENABLE_API_MOCK: true
}

/**
 * 生产模式配置
 */
export const PROD_CONFIG = {
  // 是否启用错误上报
  ENABLE_ERROR_REPORTING: true,
  
  // 是否启用性能监控
  ENABLE_PERFORMANCE_MONITORING: true,
  
  // 日志级别
  LOG_LEVEL: 'warn'
}

/**
 * 根据环境获取配置
 */
export function getEnvironmentConfig() {
  if (isDevelopment) {
    return {
      ...API_CONFIG,
      ...DEV_CONFIG,
      environment: 'development'
    }
  }
  
  if (isProduction) {
    return {
      ...API_CONFIG,
      ...PROD_CONFIG,
      environment: 'production'
    }
  }
  
  return {
    ...API_CONFIG,
    environment: 'unknown'
  }
}

/**
 * 构建完整的API URL
 * @param {string} endpoint - API端点
 * @returns {string} 完整的URL
 */
export function buildApiUrl(endpoint) {
  const config = getEnvironmentConfig()
  const baseUrl = config.BASE_URL
  
  // 如果端点已经是完整URL，直接返回
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint
  }
  
  // 确保端点以 / 开头
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  
  // 组合基础URL和端点
  return `${baseUrl}${normalizedEndpoint}`
}

/**
 * 获取请求配置
 * @param {Object} options - 额外配置选项
 * @returns {Object} 请求配置
 */
export function getRequestConfig(options = {}) {
  const config = getEnvironmentConfig()
  
  return {
    timeout: config.TIMEOUT,
    headers: {
      ...config.DEFAULT_HEADERS,
      ...options.headers
    },
    ...options
  }
}

/**
 * API 特性开关
 */
export const FEATURE_FLAGS = {
  // 色卡相关特性
  ENABLE_COLOR_GROUPS: true,
  ENABLE_COLOR_EXPORT: true,
  ENABLE_COLOR_IMPORT: true,
  ENABLE_COLOR_SEARCH: true,
  ENABLE_BULK_OPERATIONS: true,
  
  // 用户相关特性
  ENABLE_USER_PREFERENCES: false,
  ENABLE_USER_AUTHENTICATION: false,
  
  // 高级特性
  ENABLE_REAL_TIME_SYNC: false,
  ENABLE_OFFLINE_MODE: false,
  ENABLE_COLLABORATION: false
}

/**
 * 检查特性是否启用
 * @param {string} featureName - 特性名称
 * @returns {boolean}
 */
export function isFeatureEnabled(featureName) {
  return FEATURE_FLAGS[featureName] === true
}
