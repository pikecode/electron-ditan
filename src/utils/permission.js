/**
 * 权限验证工具
 * 提供统一的权限验证接口
 */

import eventBus, { EVENT_TYPES } from './eventBus.js'

// 管理员密码（硬编码）
const ADMIN_PASSWORD = 'shuosigongyi8.'

/** 色卡管理中心打开期间：当前仅“创建色卡”复用一次验证结果；关窗须 clear */
let colorManagementAdminSessionUnlocked = false

/**
 * 关闭色卡管理主窗口时调用，下次进入需重新输入密码
 */
export function clearColorManagementAdminSession() {
  colorManagementAdminSessionUnlocked = false
}

/**
 * 验证密码是否正确
 * @param {string} password - 用户输入的密码
 * @returns {boolean} 是否正确
 */
export function verifyPassword(password) {
  return password === ADMIN_PASSWORD
}

/**
 * 显示密码验证弹窗（返回Promise）
 * @param {Object} options - 配置选项
 * @param {string} options.title - 弹窗标题（可选）
 * @param {string} options.description - 描述文字（可选）
 * @returns {Promise<boolean>} 验证是否通过
 */
export function showPasswordModal(options = {}) {
  return new Promise((resolve) => {
    const handleVerified = () => {
      eventBus.off(EVENT_TYPES.PASSWORD_VERIFIED, handleVerified)
      eventBus.off(EVENT_TYPES.PASSWORD_CANCELLED, handleCancelled)
      resolve(true)
    }

    const handleCancelled = () => {
      eventBus.off(EVENT_TYPES.PASSWORD_VERIFIED, handleVerified)
      eventBus.off(EVENT_TYPES.PASSWORD_CANCELLED, handleCancelled)
      resolve(false)
    }

    eventBus.on(EVENT_TYPES.PASSWORD_VERIFIED, handleVerified)
    eventBus.on(EVENT_TYPES.PASSWORD_CANCELLED, handleCancelled)

    eventBus.emit(EVENT_TYPES.SHOW_PASSWORD_MODAL, options)
  })
}

/**
 * 要求管理员权限（统一入口；当前仅色卡中心“创建色卡”使用：同一会话内只需验证一次）
 * @param {string} actionName - 操作名称（用于提示）
 * @returns {Promise<boolean>} 是否有权限
 */
export async function requireAdminPermission(actionName = '此操作') {
  if (colorManagementAdminSessionUnlocked) return true

  const result = await showPasswordModal({
    title: '权限验证',
    description: `${actionName}需要管理员权限，请输入管理密码`
  })

  if (result) colorManagementAdminSessionUnlocked = true
  return result
}

export default {
  verifyPassword,
  showPasswordModal,
  requireAdminPermission,
  clearColorManagementAdminSession
}
