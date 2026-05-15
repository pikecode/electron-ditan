# EasyStitch Electron 快速开始指南

## ✅ 安装完成

恭喜！您的Electron前端已经成功创建并运行。

## 🚀 当前状态

- ✅ Electron应用已创建
- ✅ 依赖安装成功（使用koffi替代ffi-napi）
- ✅ 应用可以正常启动
- ✅ Mock模式已启用（C++库不存在时的开发模式）

## 🎯 运行命令

```bash
# 开发模式（带调试工具）
npm run dev

# 生产模式
npm start

# 打包应用
npm run pack

# 生成发布版本
npm run dist
```

## 📁 项目结构

```
electron/
├── package.json          # 项目配置
├── main.js              # Electron主进程
├── src/renderer/        # UI界面
│   ├── index.html       # 主页面
│   ├── style.css        # 样式
│   └── renderer.js      # 前端逻辑
├── native/addon.js      # C++库接口
├── temp/                # 临时文件
└── assets/              # 资源文件
```

## 🔧 下一步：集成C++后端

### 1. 编译C++库

在项目根目录运行：
```bash
mkdir -p build
cd build
cmake ..
make
```

这会生成 `libeasystitch.so` 文件。

### 2. 实现C++接口

在您的C++代码中实现以下函数：

```cpp
extern "C" {
    // 初始化
    int init_library();
    
    // 图像拼接 (图片路径用换行符分隔)
    int stitch_images(const char* image_paths, int count, 
                     const char* output_path, float confidence, int blend_mode);
    
    // 保存结果
    int save_result(const char* input_path, const char* output_path);
    
    // 错误信息
    const char* get_last_error();
    
    // 清理资源
    void cleanup_library();
    
    // 参数设置
    void set_confidence_threshold(float threshold);
    void set_blend_mode(int mode);
    
    // 进度查询
    float get_progress();
}
```

### 3. 混合模式参数

- `0`: 无混合
- `1`: 羽化混合  
- `2`: 多频段混合

## 🎨 UI功能

- **拖拽加载**: 支持拖拽图片到界面
- **参数调节**: 置信度阈值、混合模式
- **实时预览**: 显示加载的图片
- **进度显示**: 拼接过程进度条
- **结果保存**: 保存拼接结果

## 🐛 当前是Mock模式

由于C++库尚未编译，应用运行在Mock模式下：
- 可以加载图片
- 模拟拼接过程（2秒延时）
- 生成模拟结果文件
- UI功能完全可用

## 📝 开发提示

1. **修改库路径**: 如果.so文件位置不同，修改 `native/addon.js` 中的 `libPath`
2. **调试**: 开发模式会打开Chrome开发者工具
3. **错误处理**: 所有C++调用都有完整的错误处理
4. **日志**: 检查控制台输出了解运行状态

## 🔧 故障排除

### C++库加载失败
- 检查 `build/libeasystitch.so` 是否存在
- 验证库文件路径是否正确
- 确保所有C++函数都已实现

### UI问题
- 检查浏览器控制台错误
- 验证文件路径权限
- 确保图片格式支持

## 📞 支持

如有问题，检查：
1. 控制台日志输出
2. C++库编译错误
3. 文件权限问题

---

现在您可以开始使用这个现代化的图像拼接工具了！🎉 