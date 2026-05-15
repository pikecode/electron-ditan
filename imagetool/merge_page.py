from PySide6.QtWidgets import (QWidget, QVBoxLayout, QTabWidget, QMessageBox, QInputDialog,
                               QToolBar, QToolButton, QHBoxLayout, QPushButton, QLabel, QComboBox,
                               QSpinBox, QApplication, QFileDialog, QCheckBox, QSizePolicy)
from PySide6.QtGui import QPen, QIcon, QAction, QPixmap, QImageReader, QPainter, QBrush, QColor, QImage, QImageWriter, QBitmap
from PySide6.QtCore import Qt, QSize, Signal, QObject
import sys
import os

import math
import random


class MergePage(QWidget):

    # 定义信号（示例：传递合并后的图片 QImage 对象）
    image_merged = Signal(QImage)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self._init_variables()
        self._setup_ui()

    def setOriginalDrawing(self, originalDrawing):
        self.originalDrawing = originalDrawing
        self.set_select_image("left", self.originalDrawing)

    def setSampleImage(self, sampleImage):
        self.sampleImage = sampleImage
        self.set_select_image("right", self.sampleImage)

    def _init_variables(self):
        """初始化所有变量"""
        self.last_background_path = ""
        self.originalDrawing = None  # 原图
        self.sampleImage = None  # 样图
        self.left_image = None
        self.right_image = None
        self.result_image = None
        self.opacity = 0.7
        self.blend_mode = "linear_light"
        self.target_size = QSize(800, 600)  # 使用QSize而不是QPoint
        self.threshold = 128
        self.output_size = QSize(800, 600)
        self.bg_aspect_ratio = 4 / 3  # 默认4:3比例
        self._processing = False
        self.brightness_factor = 1.0  # 亮度调整因子，1.0为原始亮度
        self.contrast_factor = 1.0  # 对比度调整因子，1.0为原始对比度
        self.original_mask = None  # 原始蒙版图片
        self.spray_stroke_enabled = True  # 是否启用喷色描边
        self.stroke_length = 20  # 描边长度
        self.spray_radius = 7  # 喷色半径
        self.edge_threshold = 50  # 边缘检测阈值
        self.stroke_opacity = 1.0  # 描边不透明度

    def _setup_ui(self):
        """设置界面布局"""
        layout = QVBoxLayout()
        self.setLayout(layout)
        #
        # # 图片信息区域
        # image_info_layout = QHBoxLayout()
        #
        # # 背景图片信息
        # left_info_layout = QVBoxLayout()
        # self.left_info_label = QLabel("背景图片: 未选择")
        # left_info_layout.addWidget(self.left_info_label)
        #
        # # 蒙版图片信息
        # right_info_layout = QVBoxLayout()
        # self.right_info_label = QLabel("蒙版图片: 未选择")
        # right_info_layout.addWidget(self.right_info_label)
        #
        # image_info_layout.addLayout(left_info_layout)
        # image_info_layout.addLayout(right_info_layout)
        # layout.addLayout(image_info_layout)



        # 操作按钮区域
        self._setup_action_buttons(layout)
        # 控制参数区域
        self._setup_controls(layout)

        # 结果显示区域
        self._setup_result_display(layout)

    def _setup_controls(self, parent_layout):
        """设置控制参数区域"""
        # 混合模式
        blend_layout = QHBoxLayout()
        blend_label = QLabel("混合模式:")
        blend_label.setStyleSheet("font-size: 14px;")  # 设置字体大小
        blend_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 靠右对齐
        self.blend_combo = QComboBox()
        self.blend_combo.addItems(["正常", "线性光", "叠加", "柔光"])
        self.blend_combo.setCurrentIndex(1)
        self.blend_combo.currentTextChanged.connect(self._update_blend_mode)

        # blend_layout.addWidget(blend_label)
        # blend_layout.addWidget(self.blend_combo)
        # parent_layout.addLayout(blend_layout)

        # 透明度控制
        # opacity_layout = QHBoxLayout()
        # opacity_label = QLabel("蒙版透明度:")
        # opacity_label.setStyleSheet("font-size: 14px;")  # 设置字体大小
        # opacity_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 靠右对齐
        # self.opacity_spin = QSpinBox()
        # self.opacity_spin.setRange(50, 100)
        # self.opacity_spin.setValue(70)
        # self.opacity_spin.setSuffix("%")
        # self.opacity_spin.valueChanged.connect(self._update_opacity)
        # blend_layout.addWidget(opacity_label)
        # blend_layout.addWidget(self.opacity_spin)

        # parent_layout.addLayout(opacity_layout)

        # # 亮度控制
        # # brightness_layout = QHBoxLayout()
        # brightness_label = QLabel("亮度调整:")
        # brightness_label.setStyleSheet("font-size: 14px;")  # 设置字体大小
        # brightness_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 靠右对齐
        # self.brightness_spin = QSpinBox()
        # self.brightness_spin.setRange(50, 200)
        # self.brightness_spin.setValue(100)
        # self.brightness_spin.setSuffix("%")
        # self.brightness_spin.valueChanged.connect(self._update_brightness)
        # blend_layout.addWidget(brightness_label)
        # blend_layout.addWidget(self.brightness_spin)
        # # parent_layout.addLayout(brightness_layout)
        #
        # # 对比度控制
        # # contrast_layout = QHBoxLayout()
        # contrast_label = QLabel("对比度调整:")
        # contrast_label.setStyleSheet("font-size: 14px;")  # 设置字体大小
        # contrast_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 靠右对齐
        # self.contrast_spin = QSpinBox()
        # self.contrast_spin.setRange(50, 200)
        # self.contrast_spin.setValue(100)
        # self.contrast_spin.setSuffix("%")
        # self.contrast_spin.valueChanged.connect(self._update_contrast)
        # blend_layout.addWidget(contrast_label)
        # blend_layout.addWidget(self.contrast_spin)
        # # parent_layout.addLayout(contrast_layout)
        #
        # # 阈值控制
        # # threshold_layout = QHBoxLayout()
        # threshold_label = QLabel("剪切阈值:")
        # threshold_label.setStyleSheet("font-size: 14px;")  # 设置字体大小
        # threshold_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 靠右对齐
        # self.threshold_spin = QSpinBox()
        # self.threshold_spin.setRange(0, 255)
        # self.threshold_spin.setValue(128)
        # self.threshold_spin.valueChanged.connect(self._update_threshold)
        # blend_layout.addWidget(threshold_label)
        # blend_layout.addWidget(self.threshold_spin)
        # # parent_layout.addLayout(threshold_layout)

        # 输出尺寸控制
        # size_layout = QHBoxLayout()
        width_label = QLabel("宽度:")
        width_label.setStyleSheet("font-size: 14px;")  # 设置字体大小
        width_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 靠右对齐
        self.width_spin = QSpinBox()
        self.width_spin.setRange(100, 4000)
        self.width_spin.setValue(800)
        self.width_spin.valueChanged.connect(self._update_output_size)

        height_label = QLabel("高度:")
        height_label.setStyleSheet("font-size: 14px;")  # 设置字体大小
        height_label.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 靠右对齐
        self.height_spin = QSpinBox()
        self.height_spin.setRange(100, 4000)
        self.height_spin.setValue(600)
        self.height_spin.valueChanged.connect(self._update_output_size)

        blend_layout.addWidget(width_label)
        blend_layout.addWidget(self.width_spin)
        blend_layout.addWidget(height_label)
        blend_layout.addWidget(self.height_spin)
        blend_layout.addStretch(1)
        parent_layout.addLayout(blend_layout)

    def _setup_action_buttons(self, parent_layout):
        """设置操作按钮"""
        btn_layout = QHBoxLayout()


        self.originalDrawing_button = QPushButton("添加原图")
        self.originalDrawing_button.setFixedWidth(120)
        self.originalDrawing_button.clicked.connect(lambda: self.select_image("left"))

        self.sample_button = QPushButton("添加效果图")
        self.sample_button.setFixedWidth(120)
        self.sample_button.clicked.connect(lambda: self.select_image("right"))

        # self.preview_button = QPushButton("生成预览")
        # self.preview_button.setFixedWidth(120)
        # self.preview_button.clicked.connect(self.generate_preview)
        # self.preview_button.setEnabled(False)

        self.save_button = QPushButton("保存结果")
        self.save_button.setFixedWidth(120)
        self.save_button.clicked.connect(self.save_result)
        self.save_button.setEnabled(False)

        btn_layout.addWidget(self.originalDrawing_button)
        btn_layout.addWidget(self.sample_button)
        # btn_layout.addWidget(self.preview_button)
        btn_layout.addWidget(self.save_button)

        # 在右侧添加弹性空间（关键步骤）
        btn_layout.addStretch(1)
        parent_layout.addLayout(btn_layout)

    def _setup_result_display(self, parent_layout):
        """设置结果显示区域"""
        self.result_label = QLabel('请先选择原图和效果图片')
        self.result_label.setAlignment(Qt.AlignCenter)
        self.result_label.setStyleSheet("""
            border: 2px solid gray;
            background-color: #ffffff;
            min-height: 400px;
        """)
        self.result_label.setSizePolicy(QSizePolicy.Expanding, QSizePolicy.Expanding)
        parent_layout.addWidget(self.result_label)

    def _update_opacity(self, value):
        """更新透明度值"""
        self.opacity = value / 100.0  # 转换为0~1范围
        if self.left_image and self.right_image:
            self.generate_preview()

    def _update_brightness(self, value):
        """更新亮度值"""
        self.brightness_factor = value / 100.0
        if self.left_image and self.right_image:
            self.generate_preview()

    def _update_contrast(self, value):
        """更新对比度值"""
        self.contrast_factor = value / 100.0
        if self.left_image and self.right_image:
            self.generate_preview()

    def _update_threshold(self, value):
        """更新阈值"""
        self.threshold = value
        if self.left_image and self.right_image:
            self.generate_preview()

    def _update_output_size(self, value):
        """更新输出尺寸"""
        sender = self.sender()
        if sender == self.width_spin:
            self.output_size.setWidth(value)
            # 保持宽高比调整高度
            if self.left_image and self.bg_aspect_ratio > 0:
                height = int(value / self.bg_aspect_ratio)
                self.height_spin.setValue(height)
        elif sender == self.height_spin:
            self.output_size.setHeight(value)
            # 保持宽高比调整宽度
            if self.left_image and self.bg_aspect_ratio > 0:
                width = int(value * self.bg_aspect_ratio)
                self.width_spin.setValue(width)

        if self.left_image and self.right_image:
            self.generate_preview()

    def _update_blend_mode(self, mode):
        """更新混合模式"""
        self.blend_mode = {
            "正常": "normal",
            "线性光": "linear_light",
            "叠加": "overlay",
            "柔光": "soft_light"
        }.get(mode, "linear_light")

        if self.left_image and self.right_image:
            self.generate_preview()

    def select_image(self, side):

        # 设置初始目录为上次使用的路径
        initial_dir = self.last_background_path if self.last_background_path else ""

        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择封面背景图片", initial_dir,
            "图片文件 (*.png *.jpg *.jpeg *.bmp *.gif *.psd)"
        )

        if not file_path:
            return

        self.last_background_path = file_path
        self.set_select_image(side, file_path)



    def set_select_image(self, side, path):
        """选择图片"""
        if self._processing:
            print("正在处理中，请稍后...")
            return
        print(f"选择{'背景' if side == 'left' else '蒙版'}图片：{path}")

        if not path or not os.path.exists(path):
            QMessageBox.warning(self, "错误", "图片路径无效！")
            return

        try:
            QApplication.setOverrideCursor(Qt.WaitCursor)

            # 使用QImageReader加载图片
            reader = QImageReader(path)
            if not reader.canRead():
                QMessageBox.warning(self, "错误", "无法读取图片文件！")
                return

            image = reader.read()
            if image.isNull():
                QMessageBox.warning(self, "错误", "图片加载失败！")
                return

            # 转换为标准格式
            image = image.convertToFormat(QImage.Format_ARGB32)
            # 调整图像大小（宽度不超过1000，保持比例）
            max_width = 1000
            if image.width() > max_width:
                scale_factor = max_width / image.width()
                new_height = int(image.height() * scale_factor)
                image = image.scaled(max_width, new_height, Qt.KeepAspectRatio, Qt.SmoothTransformation)

            pixmap = QPixmap.fromImage(image)

            # 清理旧图片资源
            if side == "left" and self.left_image:
                self.left_image = None
            elif side == "right" and self.right_image:
                self.right_image = None
                self.original_mask = None  # 清理原始蒙版副本

            # 处理图片
            if side == "left":
                self._handle_left_image(pixmap)
                # self.left_info_label.setText(f"背景图片: {os.path.basename(path)} ({pixmap.width()}×{pixmap.height()})")
            else:
                # 保存原始蒙版副本
                self.original_mask = pixmap.copy()
                self._handle_right_image(pixmap)
                # self.right_info_label.setText(
                #     f"蒙版图片: {os.path.basename(path)} ({pixmap.width()}×{pixmap.height()})")

            # 检查是否两张图片都已加载
            if self.left_image and self.right_image:
                # self.preview_button.setEnabled(True)
                # self.result_label.setText('点击"生成预览"查看结果')
                print( "两张图片已加载，可以生成预览了")
                self.generate_preview()

        except Exception as e:
            print(f"操作失败：{str(e)}")
            if "UnidentifiedImageError" in str(e):  # 兼容PIL错误信息
                QMessageBox.warning(self, "错误", "不支持的图片格式")
            else:
                QMessageBox.warning(self, "错误", f"操作失败：{str(e)}\n详细日志已记录")

        finally:
            self._processing = False
            QApplication.restoreOverrideCursor()

    def _handle_left_image(self, pixmap):
        """处理背景图片"""
        self.left_image = pixmap
        self.target_size = pixmap.size()
        self.bg_aspect_ratio = pixmap.width() / max(1, pixmap.height())  # 避免除零错误

        # 更新输出尺寸
        self.width_spin.setValue(pixmap.width())
        self.height_spin.setValue(pixmap.height())

    def _handle_right_image(self, pixmap):
        """处理蒙版图片"""
        if not pixmap or pixmap.isNull():
            return

        # 如果有背景图，使用背景图尺寸；否则使用当前目标尺寸
        target_size = self.left_image.size() if self.left_image else self.target_size

        # 确保目标尺寸有效
        if target_size.width() <= 0 or target_size.height() <= 0:
            target_size = QSize(512, 512)  # 默认尺寸

        # 缩放蒙版图片
        scaled = pixmap.scaled(
            target_size,
            Qt.IgnoreAspectRatio,
            Qt.SmoothTransformation
        )
        self.right_image = scaled

    def adjust_brightness(self, pixmap, factor):
        """调整图片亮度"""
        if factor == 1.0:
            return pixmap

        image = pixmap.toImage()
        width = image.width()
        height = image.height()

        # 创建一个临时图像用于处理
        result = QImage(width, height, QImage.Format_ARGB32)

        for y in range(height):
            for x in range(width):
                color = QColor.fromRgba(image.pixel(x, y))
                r = min(255, max(0, int(color.red() * factor)))
                g = min(255, max(0, int(color.green() * factor)))
                b = min(255, max(0, int(color.blue() * factor)))
                result.setPixelColor(x, y, QColor(r, g, b, color.alpha()))

        return QPixmap.fromImage(result)

    def adjust_contrast(self, pixmap, factor):
        """调整图片对比度"""
        if factor == 1.0:
            return pixmap

        image = pixmap.toImage()
        width = image.width()
        height = image.height()

        # 创建一个临时图像用于处理
        result = QImage(width, height, QImage.Format_ARGB32)

        for y in range(height):
            for x in range(width):
                color = QColor.fromRgba(image.pixel(x, y))
                r = min(255, max(0, int(127 + factor * (color.red() - 127))))
                g = min(255, max(0, int(127 + factor * (color.green() - 127))))
                b = min(255, max(0, int(127 + factor * (color.blue() - 127))))
                result.setPixelColor(x, y, QColor(r, g, b, color.alpha()))

        return QPixmap.fromImage(result)

    # def generate_preview(self):
    #     """生成预览图片 - 使用自定义混合模式实现"""
    #     if self._processing or not self.left_image or not self.right_image:
    #         return
    #
    #     try:
    #         self._processing = True
    #         QApplication.setOverrideCursor(Qt.WaitCursor)
    #         QApplication.processEvents()
    #
    #         # 创建结果图像
    #         result = QImage(
    #             self.output_size,
    #             QImage.Format_ARGB32
    #         )
    #         result.fill(Qt.transparent)
    #
    #         # 准备源图像
    #         bg = self.left_image.scaled(
    #             self.output_size,
    #             Qt.IgnoreAspectRatio,
    #             Qt.SmoothTransformation
    #         ).toImage()
    #
    #         mask = self.right_image.scaled(
    #             self.output_size,
    #             Qt.IgnoreAspectRatio,
    #             Qt.SmoothTransformation
    #         ).toImage()
    #
    #
    #         # 使用QPainter进行混合
    #         painter = QPainter(result)
    #         painter.drawImage(0, 0, bg)
    #
    #         # 根据指定的混合模式获取对应的混合函数，如果未找到，则默认使用线性光混合模式
    #         blend_function = getattr(self, f"_blend_{self.blend_mode}", self._blend_linear_light)
    #
    #         # 遍历输出图像的每一个像素点
    #         for y in range(self.output_size.height()):
    #             for x in range(self.output_size.width()):
    #                 # 获取背景图像和遮罩图像在当前像素点的颜色
    #                 bg_color = QColor.fromRgba(bg.pixel(x, y))
    #                 mask_color = QColor.fromRgba(mask.pixel(x, y))
    #
    #                 # 计算遮罩图像在当前像素点的透明度
    #                 mask_alpha = bg_color.alpha() * self.opacity
    #
    #                 # 如果计算后的透明度大于设定的阈值，则执行颜色混合操作
    #                 if mask_alpha > self.threshold:
    #                     # 使用选定的混合函数进行颜色混合
    #                     blended = blend_function(bg_color, mask_color)
    #                     # 保留背景颜色的透明度
    #                     blended.setAlpha(bg_color.alpha())
    #                     # 设置画笔颜色为混合后的颜色并绘制当前像素点
    #                     painter.setPen(blended)
    #                     painter.drawPoint(x, y)
    #                 else:
    #                     # 如果透明度未达标，则直接使用背景颜色绘制当前像素点
    #                     painter.setPen(QColor(0,0,0,0))
    #                     painter.drawPoint(x, y)
    #
    #         # 结束绘制操作
    #         painter.end()
    #
    #         # 转换为QPixmap
    #         self.result_image = QPixmap.fromImage(result)
    #
    #         # 应用对比度调整
    #         if self.contrast_factor != 1.0:
    #             self.result_image = self.adjust_contrast(self.result_image, self.contrast_factor)
    #
    #         # 应用亮度调整
    #         if self.brightness_factor != 1.0:
    #             self.result_image = self.adjust_brightness(self.result_image, self.brightness_factor)
    #
    #         # 显示结果
    #         self._display_result()
    #         self.save_button.setEnabled(True)
    #
    #     except Exception as e:
    #         QMessageBox.warning(self, "错误", f"生成预览失败: {str(e)}")
    #     finally:
    #         QApplication.restoreOverrideCursor()
    #         self._processing = False

    """合并图片"""
    # def generate_preview(self):
    #     """生成预览图片"""
    #     if self._processing or self.left_image == None or self.right_image == None:
    #         print(
    #             "self._processing:", self._processing,
    #             "self.left_image:", self.left_image,
    #             "self.right_image:", self.right_image,
    #         )
    #         print( "生成预览图片失败")
    #         return
    #
    #     try:
    #         self._processing = True
    #         # self._show_loading(True)
    #         QApplication.processEvents()
    #
    #         # 创建结果图像
    #         result = QImage(
    #             self.output_size,
    #             QImage.Format_ARGB32
    #         )
    #         result.fill(Qt.transparent)
    #
    #         # 准备源图像
    #         bg = self.left_image.scaled(
    #             self.output_size,
    #             Qt.IgnoreAspectRatio,
    #             Qt.SmoothTransformation
    #         ).toImage()
    #
    #         mask = self.right_image.scaled(
    #             self.output_size,
    #             Qt.IgnoreAspectRatio,
    #             Qt.SmoothTransformation
    #         ).toImage()
    #
    #         # 获取蒙版位置偏移
    #         # pos = self.right_thumbnail.current_pos
    #
    #         # 使用QPainter进行绘制
    #         painter = QPainter(result)
    #         painter.setRenderHint(QPainter.Antialiasing)
    #         painter.setRenderHint(QPainter.SmoothPixmapTransform)
    #
    #         # 混合处理
    #         for y in range(self.output_size.height()):
    #             for x in range(self.output_size.width()):
    #                 bg_color = QColor.fromRgba(bg.pixel(x, y))
    #                 mask_x = x
    #                 mask_y = y
    #
    #                 if 0 <= mask_x < self.output_size.width() and 0 <= mask_y < self.output_size.height():
    #                     mask_color = QColor.fromRgba(mask.pixel(mask_x, mask_y))
    #                     mask_alpha = mask_color.alpha() * self.opacity
    #
    #                     if mask_alpha > self.threshold:
    #                         if self.blend_mode == "normal":
    #                             blended = self._blend_normal(bg_color, mask_color)
    #                         elif self.blend_mode == "linear_light":
    #                             blended = self._blend_linear_light(bg_color, mask_color)
    #                         elif self.blend_mode == "overlay":
    #                             blended = self._blend_overlay(bg_color, mask_color)
    #                         else:  # soft_light
    #                             blended = self._blend_soft_light(bg_color, mask_color)
    #
    #                         blended.setAlpha(bg_color.alpha())
    #                         result.setPixelColor(x, y, blended)
    #                     else:
    #                         result.setPixelColor(x, y, Qt.transparent)
    #                 else:
    #                     result.setPixelColor(x, y, Qt.transparent)
    #
    #         painter.end()
    #
    #         # 显示结果
    #         self.result_image = QPixmap.fromImage(result)
    #         self._display_result()
    #         self.save_button.setEnabled(True)
    #         self._processing = False
    #
    #     except Exception as e:
    #         self._processing = False
    #         QMessageBox.warning(self, "错误", f"生成预览失败: {str(e)}")
    #     finally:
    #         # self._show_loading(False)
    #         self._processing = False


    def generate_preview(self):
        """生成预览图片（含暗处亮度增强）"""
        if self._processing or self.left_image is None or self.right_image is None:
            print(
                "self._processing:", self._processing,
                "self.left_image:", self.left_image,
                "self.right_image:", self.right_image,
            )
            print("生成预览图片失败")
            return

        try:
            self._processing = True
            QApplication.processEvents()

            # 新增亮度调整参数（可根据需求设为可配置）
            self.dark_threshold = 100  # 亮度阈值（0-255），低于此值视为暗处
            self.brightness_factor = 1.3  # 亮度增益系数（>1增亮，<1变暗）

            # 创建结果图像
            result = QImage(
                self.output_size,
                QImage.Format_ARGB32
            )
            result.fill(Qt.transparent)

            # 准备源图像
            bg = self.left_image.scaled(
                self.output_size,
                Qt.IgnoreAspectRatio,
                Qt.SmoothTransformation
            ).toImage()

            mask = self.right_image.scaled(
                self.output_size,
                Qt.IgnoreAspectRatio,
                Qt.SmoothTransformation
            ).toImage()

            painter = QPainter(result)
            painter.setRenderHints(QPainter.Antialiasing | QPainter.SmoothPixmapTransform)

            for y in range(self.output_size.height()):
                for x in range(self.output_size.width()):
                    # 获取背景颜色
                    bg_color = QColor.fromRgba(bg.pixel(x, y))
                    r, g, b, _ = bg_color.getRgb()

                    # 计算背景亮度（加权平均法）
                    bg_brightness = 0.299 * r + 0.587 * g + 0.114 * b

                    # 处理蒙版颜色
                    mask_x, mask_y = x, y
                    if 0 <= mask_x < self.output_size.width() and 0 <= mask_y < self.output_size.height():
                        mask_color = QColor.fromRgba(mask.pixel(mask_x, mask_y))
                        mask_alpha = mask_color.alpha() * self.opacity

                        if mask_alpha > self.threshold:
                            # 执行混合模式
                            if self.blend_mode == "normal":
                                blended = self._blend_normal(bg_color, mask_color)
                            elif self.blend_mode == "linear_light":
                                blended = self._blend_linear_light(bg_color, mask_color)
                            elif self.blend_mode == "overlay":
                                blended = self._blend_overlay(bg_color, mask_color)
                            else:  # soft_light
                                blended = self._blend_soft_light(bg_color, mask_color)

                            # 新增：暗处亮度增强处理
                            blended_r, blended_g, blended_b, _ = blended.getRgb()
                            blended_brightness = 0.299 * blended_r + 0.587 * blended_g + 0.114 * blended_b

                            if blended_brightness < self.dark_threshold:
                                # 应用亮度增益并限制最大值
                                new_r = min(int(blended_r * self.brightness_factor), 255)
                                new_g = min(int(blended_g * self.brightness_factor), 255)
                                new_b = min(int(blended_b * self.brightness_factor), 255)
                                blended = QColor(new_r, new_g, new_b, blended.alpha())

                            result.setPixelColor(x, y, blended)
                        else:
                            result.setPixelColor(x, y, Qt.transparent)
                    else:
                        result.setPixelColor(x, y, Qt.transparent)

            painter.end()
            self.result_image = QPixmap.fromImage(result)
            self._display_result()
            self.save_button.setEnabled(True)

        except Exception as e:
            QMessageBox.warning(self, "错误", f"生成预览失败: {str(e)}")
        finally:
            self._processing = False


    def adjust_saturation(self, pixmap, factor):
        """调整图片饱和度"""
        if factor == 1.0:
            return pixmap

        image = pixmap.toImage()
        width = image.width()
        height = image.height()

        # 创建一个临时图像用于处理
        result = QImage(width, height, QImage.Format_ARGB32)

        for y in range(height):
            for x in range(width):
                color = QColor.fromRgba(image.pixel(x, y))
                h, s, v, a = color.getHsvF()

                # 调整饱和度
                s = min(1.0, max(0.0, s * factor))

                # 转回RGB
                color.setHsvF(h, s, v, a)
                result.setPixelColor(x, y, color)

        return QPixmap.fromImage(result)

    def _apply_splash_effect(self, image, intensity=10, density=0.2):
        """
        应用喷溅效果滤镜
        :param image: 输入图像
        :param intensity: 喷溅强度 (0-20)
        :param density: 喷溅密度 (0.0-1.0)
        :return: 处理后的图像
        """
        if intensity <= 0 or density <= 0:
            return image

        width, height = image.width(), image.height()
        result = QImage(width, height, QImage.Format_ARGB32)

        # 创建一个随机数生成器，固定种子以便结果可重现
        rng = random.Random(42)

        # 处理每个像素
        for y in range(height):
            for x in range(width):
                # 根据密度决定是否对该像素应用喷溅效果
                if rng.random() < density:
                    # 随机选择一个偏移量
                    dx = rng.randint(-intensity, intensity)
                    dy = rng.randint(-intensity, intensity)

                    # 确保偏移后的坐标在图像范围内
                    nx = max(0, min(width - 1, x + dx))
                    ny = max(0, min(height - 1, y + dy))

                    # 从偏移位置获取颜色
                    color = QColor.fromRgba(image.pixel(nx, ny))
                    result.setPixelColor(x, y, color)
                else:
                    # 保持原始像素
                    result.setPixelColor(x, y, QColor.fromRgba(image.pixel(x, y)))

        return result



    def _apply_spray_stroke(self, image, stroke_length=20, spray_radius=7):
        """应用喷色描边效果 - 在图像边缘创建艺术化的描边"""
        if not self.spray_stroke_enabled or stroke_length <= 0 or spray_radius <= 0:
            return image

        width, height = image.width(), image.height()
        result = QImage(width, height, QImage.Format_ARGB32)
        result.fill(Qt.transparent)

        # 转换为灰度图进行边缘检测
        gray_image = image.convertToFormat(QImage.Format_Grayscale8)

        # 使用Sobel算子进行边缘检测
        sobel_x = [
            -1, 0, 1,
            -2, 0, 2,
            -1, 0, 1
        ]

        sobel_y = [
            -1, -2, -1,
            0, 0, 0,
            1, 2, 1
        ]

        # 创建边缘强度图和方向图
        edge_strength = [[0 for _ in range(width)] for _ in range(height)]
        edge_direction = [[0 for _ in range(width)] for _ in range(height)]

        # 计算边缘强度和方向
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                gx = 0
                gy = 0

                # 应用Sobel算子
                for ky in range(-1, 2):
                    for kx in range(-1, 2):
                        idx = (ky + 1) * 3 + (kx + 1)
                        pixel = gray_image.pixel(x + kx, y + ky) & 0xFF
                        gx += pixel * sobel_x[idx]
                        gy += pixel * sobel_y[idx]

                # 计算梯度幅值和方向
                g = math.sqrt(gx * gx + gy * gy)
                edge_strength[y][x] = min(255, int(g))

                # 计算梯度方向并量化为4个方向
                if gx == 0:
                    angle = 90 if gy > 0 else 270
                else:
                    angle = math.degrees(math.atan2(gy, gx))
                    angle = (angle + 360) % 360

                # 量化方向为4个可能的值
                if (angle >= 337.5 or angle < 22.5) or (angle >= 157.5 and angle < 202.5):
                    edge_direction[y][x] = 0  # 水平
                elif (angle >= 22.5 and angle < 67.5) or (angle >= 202.5 and angle < 247.5):
                    edge_direction[y][x] = 1  # 对角线
                elif (angle >= 67.5 and angle < 112.5) or (angle >= 247.5 and angle < 292.5):
                    edge_direction[y][x] = 2  # 垂直
                else:
                    edge_direction[y][x] = 3  # 反对角线

        # 非极大值抑制，细化边缘
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                current_strength = edge_strength[y][x]
                direction = edge_direction[y][x]

                # 根据方向检查相邻像素
                if direction == 0:  # 水平
                    if current_strength < edge_strength[y][x - 1] or current_strength < edge_strength[y][x + 1]:
                        edge_strength[y][x] = 0
                elif direction == 1:  # 对角线
                    if current_strength < edge_strength[y - 1][x - 1] or current_strength < edge_strength[y + 1][x + 1]:
                        edge_strength[y][x] = 0
                elif direction == 2:  # 垂直
                    if current_strength < edge_strength[y - 1][x] or current_strength < edge_strength[y + 1][x]:
                        edge_strength[y][x] = 0
                else:  # 反对角线
                    if current_strength < edge_strength[y - 1][x + 1] or current_strength < edge_strength[y + 1][x - 1]:
                        edge_strength[y][x] = 0

        # 创建画笔并设置喷色效果
        painter = QPainter(result)
        painter.setRenderHint(QPainter.Antialiasing)

        # 为每个边缘点创建喷色效果
        for y in range(1, height - 1):
            for x in range(1, width - 1):
                if edge_strength[y][x] > self.edge_threshold:  # 只处理强度高于阈值的边缘
                    original_color = QColor.fromRgba(image.pixel(x, y))

                    # 使用边缘强度来确定描边颜色的强度
                    stroke_alpha = min(255, int(edge_strength[y][x] * self.stroke_opacity))

                    # 根据原始像素颜色创建描边颜色
                    stroke_color = QColor(
                        original_color.red(),
                        original_color.green(),
                        original_color.blue(),
                        stroke_alpha
                    )

                    # 随机生成多个点来创建喷色效果
                    num_points = int(stroke_length * 0.7)  # 描边长度决定点的数量
                    for _ in range(num_points):
                        # 在指定半径内随机位置
                        rx = random.gauss(0, spray_radius / 2)
                        ry = random.gauss(0, spray_radius / 2)
                        px = int(x + rx)
                        py = int(y + ry)

                        # 确保点在图像范围内
                        if 0 <= px < width and 0 <= py < height:
                            # 点的大小随距离中心的距离衰减
                            distance = math.sqrt(rx * rx + ry * ry)
                            point_size = max(0.5, spray_radius - distance * 0.5)

                            # 设置画笔和绘制点
                            painter.setPen(QPen(stroke_color, point_size, Qt.SolidLine, Qt.RoundCap))
                            painter.drawPoint(px, py)

        painter.end()
        return result





    def _blend_normal(self, base, blend):
        """正常混合模式"""
        ratio = blend.alphaF() * self.opacity
        r = int(base.red() * (1 - ratio) + blend.red() * ratio)
        g = int(base.green() * (1 - ratio) + blend.green() * ratio)
        b = int(base.blue() * (1 - ratio) + blend.blue() * ratio)
        return QColor(r, g, b, base.alpha())

    def _blend_linear_light(self, base, blend):
        """线性光混合模式"""

        def blend_channel(b, c):
            return min(255, max(0, b + 2 * c - 255))

        r = blend_channel(base.red(), blend.red())
        g = blend_channel(base.green(), blend.green())
        b = blend_channel(base.blue(), blend.blue())

        # 修正 alpha 值计算的括号问题
        alpha = int(base.alpha() * (1 - self.opacity) + blend.alpha() * self.opacity)
        return QColor(r, g, b, alpha)

    def _blend_overlay(self, base, blend):
        """叠加混合模式"""

        def blend_channel(b, c):
            if b < 128:
                return min(255, 2 * b * c / 255)
            else:
                return min(255, 255 - 2 * (255 - b) * (255 - c) / 255)

        r = int(blend_channel(base.red(), blend.red()))
        g = int(blend_channel(base.green(), blend.green()))
        b = int(blend_channel(base.blue(), blend.blue()))
        return QColor(r, g, b, base.alpha())

    def _blend_soft_light(self, base, blend):
        """柔光混合模式"""

        def blend_channel(b, c):
            c = c / 255.0
            if c < 0.5:
                return int(b * (2 * c + (1 - 2 * c) * (b / 255.0) ** 2))
            else:
                return int(b * (2 * (1 - c) + (2 * c - 1) * (b / 255.0) ** 0.5))

        r = blend_channel(base.red(), blend.red())
        g = blend_channel(base.green(), blend.green())
        b = blend_channel(base.blue(), blend.blue())
        return QColor(r, g, b, base.alpha())

    def _display_result(self):
        """显示结果图片"""
        if not self.result_image:
            return

        # 缩放图片以适应标签
        scaled = self.result_image.scaled(
            self.result_label.width(),
            self.result_label.height(),
            Qt.KeepAspectRatio,
            Qt.SmoothTransformation
        )
        self.result_label.setPixmap(scaled)
        self.result_label.setText("")  # 清除文本
        # 发送信号传递数据
        # self.image_merged.emit(self.result_image.toImage())

    def save_result(self):
        """保存结果图片"""
        if not self.result_image:
            return

        try:
            # 设置文件过滤器
            filters = [
                "PNG图片 (*.png)",
                "JPEG图片 (*.jpg *.jpeg)",
                "BMP位图 (*.bmp)",
                "TIFF图片 (*.tif *.tiff)"
            ]

            # 获取保存路径
            file_path, selected_filter = QFileDialog.getSaveFileName(
                self,
                "保存合成结果",
                "",
                ";;".join(filters))

            if not file_path:
                return

            # 根据选择的过滤器确定格式
            if "PNG" in selected_filter:
                format = "PNG"
                if not file_path.lower().endswith('.png'):
                    file_path += '.png'
            elif "JPEG" in selected_filter:
                format = "JPEG"
                if not file_path.lower().endswith(('.jpg', '.jpeg')):
                    file_path += '.jpg'
            elif "BMP" in selected_filter:
                format = "BMP"
                if not file_path.lower().endswith('.bmp'):
                    file_path += '.bmp'
            else:  # TIFF
                format = "TIFF"
                if not file_path.lower().endswith(('.tif', '.tiff')):
                    file_path += '.tif'

            # 保存图片
            if self.result_image.save(file_path, format):
                QMessageBox.information(self, "成功", "图片保存成功！")
            else:
                QMessageBox.warning(self, "错误", "图片保存失败！")

        except Exception as e:
            QMessageBox.warning(self, "错误", f"保存图片时出错: {str(e)}")
