/**
 * 图片相关API接口
 */
class ImageAPI {
  
  /**
   * 获取图片
   * @param {string} imageId - 图片ID
   * @returns {Promise<Object>} 图片数据
   */
  async getImage() {
    return {
      success: false,
      error: 'getImage not supported (backend removed)'
    }
  }
}