/**
 * 项目管理API处理器 - 主进程端
 * 负责处理项目相关的API调用并与C++后端通信
 */
class ProjectAPIHandler {
  /**
   * 获取项目列表
   * @param {Object} params - 参数对象
   * @returns {Promise<Object>} 项目列表
   */
  async getProjects(params = {}) {
    return { success:true, data:[], message:'C++ backend removed' }
  }

  /**
   * 添加项目
   * @param {Object} params - 项目数据
   * @returns {Promise<Object>} 添加结果
   */
  async addProject(params) {
    return { success:false, error:'Add project not supported (C++ backend removed)' }
  }

  /**
   * 更新项目
   * @param {Object} params - 项目数据
   * @returns {Promise<Object>} 更新结果
   */
  async updateProject(params) {
    return { success:false, error:'Update project not supported (C++ backend removed)' }
  }

  /**
   * 删除项目
   * @param {Object} params - 删除参数
   * @returns {Promise<Object>} 删除结果
   */
  async deleteProject(params) {
    return { success:false, error:'Delete project not supported (C++ backend removed)' }
  }

  /**
   * 根据ID获取项目
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 项目数据
   */
  async getProjectById(params) {
    return { success:false, error:'Get project not supported (C++ backend removed)' }
  }
}

module.exports = { ProjectAPIHandler }
