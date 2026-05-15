/**
 * 事件总线 - 用于组件间通信
 * 特别是管理中心和面板之间的数据同步
 */

import mitt from 'mitt'

// 创建事件总线实例
const eventBus = mitt()

// 定义事件常量
export const EVENT_TYPES = {
  // 色卡分组相关事件
  COLOR_GROUP_CREATED: 'color-group-created',
  COLOR_GROUP_UPDATED: 'color-group-updated', 
  COLOR_GROUP_DELETED: 'color-group-deleted',
  COLOR_GROUPS_CHANGED: 'color-groups-changed',
  
  // 色卡相关事件
  COLOR_CREATED: 'color-created',
  COLOR_DELETED: 'color-deleted',
  COLORS_CHANGED: 'colors-changed',
  
  // 权限验证相关事件
  SHOW_PASSWORD_MODAL: 'show-password-modal',
  PASSWORD_VERIFIED: 'password-verified',
  PASSWORD_CANCELLED: 'password-cancelled'
}

export default eventBus
