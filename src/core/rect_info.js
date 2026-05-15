import { Canvas, Rect, FabricImage, Group, Line,Text } from 'fabric'
import { isCutoutCellId, isDefaultCellId } from './cellState.js'

export class RectInfo {

  constructor(option) {
    this.type = option.type || "full";
    this.color = option.color || "black";
    this.stroke = option.stroke || "black";  // 添加 stroke 属性
    this.rect = null;
    this.left = option.left || 0;
    this.top = option.top || 0;
    this.width = option.width || 100;
    this.height = option.height || 100;
    this.x_group = null;
    this.strokeWidth = option.strokeWidth || 1;
    this.opacity = option.opacity || 1;
    this.color_id = option.color_id || null;
    this.chart = option.chart || null; // 添加 chart 属性
    this.last_strokeWidth = null;
    this.text = null;
    this.row = option.row || 0; // 添加 row 属性
    this.col = option.col || 0; // 添加 col 属性
    this.strokeVisible = true; // 添加 strokeVisible 属性
    this.new_rect()
  }

  new_rect() {
    //  if (this.type == "full") {
    //   const rect = new Rect({
    //     left: this.left,
    //     top: this.top,
    //     width: this.width,
    //     height: this.height,
    //     fill: this.color,
    //     stroke: this.color,  // 添加 stroke 属性
    //     strokeWidth: 1,
    //     selectable: false,
    //     hasControls: false,
    //     hasBorders: false,
    //     hoverCursor: 'pointer',
      
    //   });
    //   this.rect = rect;  // 修复：将创建的 rect 赋值给 this.rect

    // } else if (this.type == 'x') {

    //   let diag1 = new Line([0, 0, this.width, this.height], {
    //     stroke: this.color,
    //     strokeWidth: this.width / 5,
    //     selectable: false,
    //     hasControls: false,
    //     hasBorders: false,  // 线条本身不需要边框
    //     evented: false      // 禁用事件响应
    //   });
    //   diag1.set('opacity', this.opacity)

    //   // 对角线2（右上到左下）
    //   let diag2 = new Line([this.width, 0, 0, this.height], {
    //     stroke: this.color,
    //     strokeWidth: this.width / 5,
    //     selectable: false,
    //     hasControls: false,
    //     hasBorders: false,  // 线条本身不需要边框
    //     evented: false      // 禁用事件响应
    //   });
    //   diag2.set('opacity', this.opacity);
      
    //   // 将背景和线条组合在一起
    //   let group = new Group([diag1, diag2], {
    //     left: this.left,
    //     top: this.top,
    //     selectable: false,     // 整个组不可选择
    //     hasControls: false,    // 无控制点
    //     hasBorders: false,     // 组本身不需要边框，因为我们有背景矩形
    //     hoverCursor: 'pointer',// 鼠标悬停样式
    //     moveCursor: 'pointer', // 鼠标移动样式
    //     evented: true          // 允许事件响应（用于点击）
    //   });
    //   this.x_group = group;
    //   this.x_group.set('opacity', this.opacity)
    // }
    // this.text = new Text('', {
    //   left: this.left + this.width / 2,
    //   top: this.top + this.height / 2,
    //   originX: 'center',
    //   originY: 'center',
    //   fontSize: Math.min(this.width, this.height) / 4,
    //   fill: 'white',
    //   stroke: 'black',
    //   strokeWidth: 0.5,
    //   fontWeight: 'bold',
    //   selectable: false,
    //   evented: false
    // });

  }

  update_rect_with_text(text) {
    if (text === null || text === undefined) {
      return;
    }
    if (this.text) {
      this.text.set('text', text);
      const textColor = this.getTextColor(this.color);
      this.text.set({
        left: this.left + this.width / 2,
        top: this.top + this.height / 2,
        originX: 'center',
        originY: 'center',
        fontSize: Math.min(this.width, this.height) / 2,
        fill: textColor,
        fontWeight: 'bold',
        opacity: 1,
        visible: text !== ''
      });
    }
  }

  // 根据背景色返回白色或黑色文字
  getTextColor(bgColor) {
    // 如果没有颜色或者是transparent，使用黑色文字
    if (!bgColor || bgColor === 'transparent') {
      return 'black';
    }
    
    // 移除 # 号
    const color = bgColor.replace('#', '');
    
    // 如果不是有效的16进制颜色，使用黑色
    if (color.length !== 6) {
      return 'black';
    }
    
    // 转换为RGB
    const r = parseInt(color.substr(0, 2), 16);
    const g = parseInt(color.substr(2, 2), 16);
    const b = parseInt(color.substr(4, 2), 16);
    
    // 计算亮度 (使用简化的亮度公式)
    const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
    
    // 如果亮度大于128，使用黑色文字，否则使用白色文字
    return brightness > 60 ? 'black' : 'white';
  }

  update_rect(clera_text = false) {
    if (this.type == "full") {  // 修复：full 需要加引号
      if (this.rect) {
        this.rect.set("opacity", this.opacity)
        this.rect.set("fill", this.color)
       this.rect.set("stroke", this.color)
       this.rect.set("strokeWidth", 1)
        this.rect.set("left", this.left)
        this.rect.set("top", this.top)
        this.rect.set("width", this.width)
        this.rect.set("height", this.height)
        this.rect.set('strokeDashArray', []);
        this.rect.set({
          stroke: this.strokeVisible ? this.stroke : 'transparent',
          strokeWidth: this.strokeVisible ? this.strokeWidth : 0
        })
      }
        
    
    } else if (this.type == "x") {
      if (this.x_group) {
        this.x_group.set("opacity", this.opacity)
        this.x_group.set("left", this.left)
        this.x_group.set("top", this.top)
        this.x_group.set("selectable", false)     // 确保不可选择
        this.x_group.set("hasControls", false)    // 确保无控制点
        this.x_group.set("hoverCursor", "pointer") // 确保鼠标样式
        this.x_group.set("moveCursor", "pointer")  // 确保移动样式
        // 更新组内的所有对象
        this.x_group.forEachObject((obj, index) => {
            // 其他对象是线条
            obj.set("stroke", this.color)
           // obj.set("strokeWidth", this.strokeWidth)
            obj.set("opacity", this.opacity)
            obj.set("selectable", false)
            obj.set("evented", false)
  
        })
      }
    }
    if (clera_text) {
      this.update_rect_with_text("")
    }
   
  }
  
  set_type(type) {
    this.type = type
    this.new_rect()
  
  }
  get_rect () {
    if (this.type == "full") {  // 修复：条件从 "fill" 改为 "full"
      return this.rect;
    } else {
      return this.x_group;
    }
  }

  get_text() {
    return this.text;
  }


  set_color(color, color_id) {
    this.color_id = color_id; // 设置颜色ID
    this.color = color 
    this.update_rect();  // 使用 update_rect 而不是 new_rect
  }

  set_opacity(opacity) {
    this.opacity = opacity
    this.update_rect()  // 使用 update_rect 而不是 new_rect
  }

  // 设置位置
  set_position(left, top) {
    this.left = left
    this.top = top
    this.update_rect()
  }

  // 设置尺寸
  set_size(width, height) {
    this.width = width
    this.height = height
    this.update_rect()
  }

  // 设置边框可见性
  set_border_visible(visible) {
    this.strokeVisible = visible; // 更新 strokeVisible 属性
    this.update_rect(); // 更新矩形以反映新的边框可见性
  }

  // 获取当前配置
  get_config() {
    return {
      type: this.type,
      color: this.color,
      stroke: this.stroke,
      left: this.left,
      top: this.top,
      width: this.width,
      height: this.height,
      strokeWidth: this.strokeWidth,
      opacity: this.opacity
    }
  }

  MouseoverRectShow() {
    if (isDefaultCellId(this.color_id) || isCutoutCellId(this.color_id)) {
      return; // 如果颜色ID是默认值，直接返回
    }
    console.log("color id", this.color_id)
    this.update_rect_with_text(this.color_id)
  }

  MouseoutRectShow () {
    // 清空文本显示
    this.update_rect(true);
  }


}
