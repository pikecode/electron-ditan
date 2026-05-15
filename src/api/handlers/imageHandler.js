/**
 * 图片管理API处理器 - 主进程端
 * 负责处理图片相关的API调用并与C++后端通信
 */
class ImageAPIHandler {
  /**
   * 获取图片
   * @param {Object} params - 参数对象
   * @param {string} params.image_id - 图片ID
   * @returns {Promise<Object>} 图片数据
   */
  async getImage(params) {
    return { success:false, error:'Image retrieval not supported (C++ backend removed)' }
  }
}

module.exports = { ImageAPIHandler }