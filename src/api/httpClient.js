/**
 * HTTP 请求客户端
 * 统一处理所有API请求，包括错误处理、重试机制、请求拦截等
 */

import { 
  API_CONFIG, 
  HTTP_STATUS, 
  ERROR_CODES, 
  buildApiUrl, 
  getRequestConfig,
  getEnvironmentConfig 
} from '../config/apiConfig.js'
import { ErrorHandler } from '../utils/errorHandler.js'

/**
 * HTTP 客户端类
 */
export class HttpClient {
  constructor() {
    this.config = getEnvironmentConfig()
    this.errorHandler = new ErrorHandler()
    this.interceptors = {
      request: [],
      response: []
    }
  }

  /**
   * 添加请求拦截器
   * @param {Function} interceptor - 拦截器函数
   */
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor)
  }

  /**
   * 添加响应拦截器
   * @param {Function} interceptor - 拦截器函数
   */
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor)
  }

  /**
   * 执行请求拦截器
   * @param {Object} config - 请求配置
   * @returns {Object} 处理后的配置
   */
  async executeRequestInterceptors(config) {
    let processedConfig = config
    
    for (const interceptor of this.interceptors.request) {
      try {
        processedConfig = await interceptor(processedConfig)
      } catch (error) {
        console.warn('Request interceptor error:', error)
      }
    }
    
    return processedConfig
  }

  /**
   * 执行响应拦截器
   * @param {Response} response - 响应对象
   * @returns {Response} 处理后的响应
   */
  async executeResponseInterceptors(response) {
    let processedResponse = response
    
    for (const interceptor of this.interceptors.response) {
      try {
        processedResponse = await interceptor(processedResponse)
      } catch (error) {
        console.warn('Response interceptor error:', error)
      }
    }
    
    return processedResponse
  }

  /**
   * 通用请求方法
   * @param {string} method - HTTP方法
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async request(method, url, options = {}) {
    const fullUrl = buildApiUrl(url)
    let requestConfig = getRequestConfig({
      method: method.toUpperCase(),
      ...options
    })

    // 执行请求拦截器
    requestConfig = await this.executeRequestInterceptors(requestConfig)

    // 如果有请求体，转换为JSON
    if (requestConfig.body && typeof requestConfig.body === 'object') {
      requestConfig.body = JSON.stringify(requestConfig.body)
    }

    // 开发模式日志
    if (this.config.VERBOSE_LOGGING) {
      console.log(`[HTTP] ${method.toUpperCase()} ${fullUrl}`, {
        config: requestConfig,
        timestamp: new Date().toISOString()
      })
    }

    let attempt = 0
    const maxAttempts = this.config.RETRY_ATTEMPTS || 1

    while (attempt < maxAttempts) {
      try {
        // 发送请求
        const response = await fetch(fullUrl, requestConfig)
        
        // 执行响应拦截器
        const processedResponse = await this.executeResponseInterceptors(response)
        
        // 处理响应
        return await this.handleResponse(processedResponse)
        
      } catch (error) {
        attempt++
        
        // 如果是最后一次尝试或不是网络错误，直接抛出
        if (attempt >= maxAttempts || !this.isRetryableError(error)) {
          throw this.handleError(error, method, fullUrl)
        }
        
        // 等待后重试
        if (this.config.RETRY_DELAY) {
          await this.delay(this.config.RETRY_DELAY * attempt)
        }
        
        if (this.config.VERBOSE_LOGGING) {
          console.warn(`[HTTP] Retry attempt ${attempt}/${maxAttempts} for ${method.toUpperCase()} ${fullUrl}`)
        }
      }
    }
  }

  /**
   * 处理响应
   * @param {Response} response - Fetch响应对象
   * @returns {Promise<Object>} 解析后的数据
   */
  async handleResponse(response) {
    const contentType = response.headers.get('content-type')
    
    try {
      let data
      
      // 根据内容类型解析响应
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text()
      }

      // 检查HTTP状态码
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`)
        error.status = response.status
        error.response = response
        error.data = data
        throw error
      }

      // 开发模式日志
      if (this.config.VERBOSE_LOGGING) {
        console.log(`[HTTP] Response:`, {
          status: response.status,
          statusText: response.statusText,
          data,
          timestamp: new Date().toISOString()
        })
      }

      return data
      
    } catch (error) {
      // 如果是解析错误，包装为标准错误
      if (error.name === 'SyntaxError') {
        const parseError = new Error('Failed to parse response')
        parseError.code = ERROR_CODES.PARSE_ERROR
        parseError.originalError = error
        parseError.response = response
        throw parseError
      }
      
      throw error
    }
  }

  /**
   * 处理错误
   * @param {Error} error - 原始错误
   * @param {string} method - HTTP方法
   * @param {string} url - 请求URL
   * @returns {Error} 包装后的错误
   */
  handleError(error, method, url) {
    let wrappedError

    // 根据错误类型进行分类
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      // 网络错误
      wrappedError = new Error('Network connection failed')
      wrappedError.code = ERROR_CODES.NETWORK_ERROR
    } else if (error.name === 'AbortError') {
      // 超时错误
      wrappedError = new Error('Request timeout')
      wrappedError.code = ERROR_CODES.TIMEOUT_ERROR
    } else if (error.status) {
      // HTTP错误
      wrappedError = this.createHttpError(error)
    } else {
      // 未知错误
      wrappedError = new Error('Unknown error occurred')
      wrappedError.code = ERROR_CODES.UNKNOWN_ERROR
    }

    // 保留原始错误信息
    wrappedError.originalError = error
    wrappedError.method = method
    wrappedError.url = url
    wrappedError.timestamp = new Date().toISOString()

    // 使用错误处理器处理
    return this.errorHandler.handleApiError(wrappedError)
  }

  /**
   * 创建HTTP错误
   * @param {Error} error - 原始HTTP错误
   * @returns {Error} 包装后的错误
   */
  createHttpError(error) {
    const { status, data } = error
    let wrappedError

    switch (status) {
      case HTTP_STATUS.BAD_REQUEST:
        wrappedError = new Error(data?.message || 'Bad request')
        wrappedError.code = ERROR_CODES.VALIDATION_ERROR
        break
      case HTTP_STATUS.UNAUTHORIZED:
        wrappedError = new Error('Authentication required')
        wrappedError.code = ERROR_CODES.PERMISSION_ERROR
        break
      case HTTP_STATUS.FORBIDDEN:
        wrappedError = new Error('Access forbidden')
        wrappedError.code = ERROR_CODES.PERMISSION_ERROR
        break
      case HTTP_STATUS.NOT_FOUND:
        wrappedError = new Error('Resource not found')
        wrappedError.code = ERROR_CODES.NOT_FOUND_ERROR
        break
      case HTTP_STATUS.CONFLICT:
        wrappedError = new Error(data?.message || 'Resource conflict')
        wrappedError.code = ERROR_CODES.DUPLICATE_ERROR
        break
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        wrappedError = new Error(data?.message || 'Validation failed')
        wrappedError.code = ERROR_CODES.VALIDATION_ERROR
        break
      case HTTP_STATUS.INTERNAL_SERVER_ERROR:
        wrappedError = new Error('Internal server error')
        wrappedError.code = ERROR_CODES.SERVER_ERROR
        break
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        wrappedError = new Error('Service unavailable')
        wrappedError.code = ERROR_CODES.SERVICE_UNAVAILABLE
        break
      default:
        wrappedError = new Error(`HTTP ${status}: ${error.message}`)
        wrappedError.code = ERROR_CODES.UNKNOWN_ERROR
    }

    wrappedError.status = status
    wrappedError.data = data
    return wrappedError
  }

  /**
   * 检查是否为可重试的错误
   * @param {Error} error - 错误对象
   * @returns {boolean}
   */
  isRetryableError(error) {
    // 网络错误和超时错误可以重试
    if (error.name === 'TypeError' || error.name === 'AbortError') {
      return true
    }
    
    // 某些HTTP状态码可以重试
    if (error.status) {
      const retryableStatuses = [
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        502, // Bad Gateway
        503, // Service Unavailable
        504  // Gateway Timeout
      ]
      return retryableStatuses.includes(error.status)
    }
    
    return false
  }

  /**
   * 延迟函数
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * GET 请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>}
   */
  async get(url, options = {}) {
    return this.request('GET', url, options)
  }

  /**
   * POST 请求
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>}
   */
  async post(url, data = null, options = {}) {
    return this.request('POST', url, {
      ...options,
      body: data
    })
  }

  /**
   * PUT 请求
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>}
   */
  async put(url, data = null, options = {}) {
    return this.request('PUT', url, {
      ...options,
      body: data
    })
  }

  /**
   * PATCH 请求
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>}
   */
  async patch(url, data = null, options = {}) {
    return this.request('PATCH', url, {
      ...options,
      body: data
    })
  }

  /**
   * DELETE 请求
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>}
   */
  async delete(url, options = {}) {
    return this.request('DELETE', url, options)
  }
}

/**
 * 默认HTTP客户端实例
 */
export const httpClient = new HttpClient()

/**
 * 便捷的API调用函数
 */
export const api = {
  get: (url, options) => httpClient.get(url, options),
  post: (url, data, options) => httpClient.post(url, data, options),
  put: (url, data, options) => httpClient.put(url, data, options),
  patch: (url, data, options) => httpClient.patch(url, data, options),
  delete: (url, options) => httpClient.delete(url, options)
}

/**
 * 创建新的HTTP客户端实例
 * @param {Object} config - 自定义配置
 * @returns {HttpClient}
 */
export function createHttpClient(config = {}) {
  const client = new HttpClient()
  Object.assign(client.config, config)
  return client
}
