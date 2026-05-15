import warnings
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QPushButton, QFileDialog, QMessageBox,
    QGraphicsView, QGraphicsScene, QGraphicsPixmapItem, QHBoxLayout
)
from PySide6.QtGui import QPixmap, QImage, QPainter, QPen, QColor, QCursor, QTransform
from PySide6.QtCore import Qt, QRectF, QRect, QPointF, QTimer, QSizeF, QSettings, QPoint, QSize

# 忽略psd-tools的警告
warnings.filterwarnings("ignore", category=UserWarning, module="psd_tools")




class ImageCanvas(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.base_image = None
        self.overlay_image = None
        self.baseoverlay_image = None
        self.overlay_pos = QPoint(0, 0)
        self.overlay_scale = 1.0
        self.is_dragging = False
        self.last_mouse_pos = QPoint()
        self.setMinimumSize(800, 600)
        self.base_display_pos = None
        self.base_display_size = None
        self.setStyleSheet("background-color: #f0f0f0;")

    def set_base_image(self, image):
        self.base_image = image
        self.adjustSize()
        self.update()

    def set_overlay_image(self, image):
        self.overlay_image = image
        self.baseoverlay_image = image

        self.overlay_scale = 400/self.overlay_image.width()

        self.overlay_pos = QPoint(
            (self.width() - self.overlay_image.width() * self.overlay_scale) // 2,
            (self.height() - self.overlay_image.height() * self.overlay_scale) // 2
        )
        self.update()

    def paintEvent(self, event):
        painter = QPainter(self)
        painter.setRenderHint(QPainter.Antialiasing)
        painter.setRenderHint(QPainter.SmoothPixmapTransform)

        # 绘制背景
        painter.fillRect(self.rect(), Qt.white)

        # 绘制底图
        if self.base_image:
            # base_rect = QRectF(0, 0, self.width(), self.height())
            # source_rect = QRectF(0, 0, self.base_image.width(), self.base_image.height())
            # painter.drawPixmap(base_rect, self.base_image, source_rect)
            # 计算底图和画布的比例
            base_ratio = self.base_image.width() / self.base_image.height()
            canvas_ratio = self.width() / self.height()

            if canvas_ratio > base_ratio:
                # 画布更宽，高度与画布相同
                base_height = self.height()
                base_width = base_height * base_ratio
            else:
                # 画布更高，宽度与画布相同
                base_width = self.width()
                base_height = base_width / base_ratio

            # 计算底图的位置（居中）
            base_x = (self.width() - base_width) / 2
            base_y = (self.height() - base_height) / 2

            # 存储底图实际展示大小
            self.base_display_pos = QPoint(base_x, base_y)
            self.base_display_size = QSizeF(base_width, base_height)


            # 绘制底图
            base_rect = QRectF(base_x, base_y, base_width, base_height)
            source_rect = QRectF(0, 0, self.base_image.width(), self.base_image.height())
            painter.drawPixmap(base_rect, self.base_image, source_rect)

        # 绘制子图
        if self.overlay_image:
            transform = QTransform()
            transform.translate(self.overlay_pos.x(), self.overlay_pos.y())
            transform.scale(self.overlay_scale, self.overlay_scale)
            transform.translate(-self.overlay_image.width() / 2, -self.overlay_image.height() / 2)
            painter.setTransform(transform)
            painter.drawPixmap(0, 0, self.overlay_image)

        # 绘制边框
        # if self.overlay_image:
        #     painter.setTransform(QTransform())
        #     pen = QPen(QColor(255, 0, 0), 2, Qt.DashLine)
        #     painter.setPen(pen)
        #     rect = QRectF(
        #         self.overlay_pos.x() - self.overlay_image.width() * self.overlay_scale / 2,
        #         self.overlay_pos.y() - self.overlay_image.height() * self.overlay_scale / 2,
        #         self.overlay_image.width() * self.overlay_scale,
        #         self.overlay_image.height() * self.overlay_scale
        #     )
        #     painter.drawRect(rect)

    def mousePressEvent(self, event):
        if event.button() == Qt.LeftButton and self.overlay_image:
            # 检查鼠标是否在子图区域内
            rect = QRectF(
                self.overlay_pos.x() - self.overlay_image.width() * self.overlay_scale / 2,
                self.overlay_pos.y() - self.overlay_image.height() * self.overlay_scale / 2,
                self.overlay_image.width() * self.overlay_scale,
                self.overlay_image.height() * self.overlay_scale
            )
            if rect.contains(event.position().toPoint()):  # 修改这里
                self.is_dragging = True
                self.last_mouse_pos = event.position().toPoint()  # 修改这里
                self.setCursor(Qt.ClosedHandCursor)

    def mouseMoveEvent(self, event):
        if self.is_dragging:
            delta = event.position().toPoint() - self.last_mouse_pos  # 修改这里
            self.overlay_pos += delta
            self.last_mouse_pos = event.position().toPoint()  # 修改这里
            self.update()


    def mouseReleaseEvent(self, event):
        if event.button() == Qt.LeftButton and self.is_dragging:
            self.is_dragging = False
            self.setCursor(Qt.ArrowCursor)
            self.update()

    def wheelEvent(self, event):
        if self.overlay_image:
            # 获取鼠标在子图上的相对位置
            center_x = self.overlay_pos.x()
            center_y = self.overlay_pos.y()
            old_scale = self.overlay_scale

            # 根据滚轮方向调整缩放比例
            if event.angleDelta().y() > 0:
                self.overlay_scale *= 1.1
            else:
                self.overlay_scale *= 0.9

            # 限制缩放范围
            self.overlay_scale = max(0.02, min(self.overlay_scale, 10.0))

            # 调整位置以保持鼠标指针下的点不变
            mouse_pos = event.position().toPoint()  # 修改这里
            scale_factor = self.overlay_scale / old_scale
            self.overlay_pos.setX(center_x + (mouse_pos.x() - center_x) * (1 - scale_factor))
            self.overlay_pos.setY(center_y + (mouse_pos.y() - center_y) * (1 - scale_factor))

            self.update()
    def resizeEvent(self, event):
        # 调整子图位置以保持居中
        if self.base_image and self.overlay_image:
            # 计算底图和画布的比例
            base_ratio = self.base_image.width() / self.base_image.height()
            canvas_ratio = self.width() / self.height()

            if canvas_ratio > base_ratio:
                # 画布更宽，高度与画布相同
                base_height = self.height()
                base_width = base_height * base_ratio
            else:
                # 画布更高，宽度与画布相同
                base_width = self.width()
                base_height = base_width / base_ratio

            # 计算底图的位置（居中）
            base_x = (self.width() - base_width) / 2
            base_y = (self.height() - base_height) / 2

            # 调整子图位置
            self.overlay_pos.setX(base_x + base_width / 2)
            self.overlay_pos.setY(base_y + base_height / 2)

        super().resizeEvent(event)

    def get_overlay_pos_relative_to_base(self):
        if not self.base_image or not self.overlay_image:
            return QPoint(0, 0)
        # 计算子图相对于底图原点的位置
        overlay_x = self.overlay_pos.x() - self.base_display_pos.x()
        overlay_y = self.overlay_pos.y() - self.base_display_pos.y()

        return QPoint(overlay_x, overlay_y)



class CoverPage(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.background_item = None
        self.content_item = None

        # 初始化QSettings
        self.settings = QSettings("YourCompany", "CoverPageEditor")

        # 从设置加载保存的值（添加类型转换）
        self.default_content_pos = self.settings.value("default_content_pos", QPointF(0, 0), type=QPointF)
        self.default_content_size = self.settings.value("default_content_size", QSizeF(100, 100), type=QSizeF)
        self.default_content_transform = self.settings.value("default_content_transform", QTransform(), type=QTransform)
        self.has_default_values = self.settings.value("has_default_values", False, type=bool)

        # 加载上次使用的文件路径
        self.last_background_path = self.settings.value("last_background_path", "")
        self.last_content_path = self.settings.value("last_content_path", "")

        print(f"加载保存的设置 - 位置: {self.default_content_pos}, 大小: {self.default_content_size}")
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout()

        btn_layout = QHBoxLayout()
        # Create buttons
        self.background_button = QPushButton("选择封面背景")
        self.background_button.setFixedWidth(120)
        self.background_button.clicked.connect(self.select_background_image)

        self.content_button = QPushButton("选择内容图")
        self.content_button.setFixedWidth(120)
        self.content_button.clicked.connect(self.select_content_image)

        btn_layout.addWidget(self.background_button)
        btn_layout.addWidget(self.content_button)
        btn_layout.addStretch(1)
        layout.addLayout(btn_layout)
        # Graphics view setup
        # self.scene = QGraphicsScene()
        # self.view = QGraphicsView(self.scene)
        # self.view.setRenderHint(QPainter.Antialiasing)
        # self.view.setRenderHint(QPainter.SmoothPixmapTransform)
        # self.view.setDragMode(QGraphicsView.RubberBandDrag)
        # self.view.setRubberBandSelectionMode(Qt.IntersectsItemShape)
        #
        # # Merge button
        self.merge_button = QPushButton("合并")
        self.merge_button.clicked.connect(self.merge_images)
        self.merge_button.setEnabled(True)

        # Add widgets to layout
        # layout.addWidget(self.view)

        # 创建图片画布
        self.canvas = ImageCanvas()

        canvas_layout = QHBoxLayout()

        canvas_layout.setContentsMargins(0, 0, 0, 0)  # 设置布局的边距
        canvas_layout.setSpacing(0)  # 设置布局的间距

        canvas_layout.addWidget(self.canvas)

        layout.addLayout(canvas_layout)
        layout.addWidget(self.merge_button)

        self.setLayout(layout)

    def setSampleImage(self, image):
        # self.load_content_image( image)
        print("setSampleImage")



    def load_psd_image(self, file_path):
        try:
            from psd_tools import PSDImage
            psd = PSDImage.open(file_path)

            # Try to get the composite image first
            if hasattr(psd, 'composite'):
                image = psd.composite()
            else:
                # Fallback to as_PIL() if composite isn't available
                image = psd.as_PIL()

            return image.convert("RGBA")
        except Exception as e:
            print(f"Error loading PSD: {str(e)}")
            return None

    def select_background_image(self):

        # 设置初始目录为上次使用的路径
        initial_dir = self.last_background_path if self.last_background_path else ""

        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择封面背景图片", initial_dir,
            "图片文件 (*.png *.jpg *.jpeg *.bmp *.gif *.psd)"
        )

        if not file_path:
            return

        try:
            self.last_background_path = file_path
            # 保存文件路径
            self.settings.setValue("last_background_path", self.last_background_path)
            self.settings.sync()

            # 清除现有背景
            if self.background_item:
                self.scene.removeItem(self.background_item)

            # 根据文件类型加载
            if file_path.lower().endswith('.psd'):
                pil_image = self.load_psd_image(file_path)
                if pil_image is None:
                    raise ValueError("PSD文件加载失败，可能是不支持的格式")

                try:
                    qimage = QImage(
                        pil_image.tobytes("raw", "RGBA"),
                        pil_image.width,
                        pil_image.height,
                        QImage.Format_ARGB32
                    )
                except Exception as e:
                    # 备用方法：通过临时文件转换
                    from io import BytesIO
                    buffer = BytesIO()
                    pil_image.save(buffer, format="PNG")
                    buffer.seek(0)
                    qimage = QImage.fromData(buffer.getvalue())
            else:
                qimage = QImage(file_path)

            if qimage.isNull():
                raise ValueError("图像加载失败 - 可能是损坏的文件或不支持的格式")

            self.canvas.set_base_image(QPixmap.fromImage(qimage))

        except Exception as e:
            QMessageBox.critical(self, "严重错误",
                                 f"无法加载图像:\n{str(e)}\n\n"
                                 "请确保：\n"
                                 "1. 文件不是损坏的\n"
                                 "2. 是支持的图像格式\n"
                                 "3. PSD文件不包含特殊加密图层"
                                 )


    # def merge_images(self):
    #     if not self.canvas.base_image or not self.canvas.overlay_image:
    #         if hasattr(self, 'status_label'):
    #             self.status_label.setText("请先选择底图和子图")
    #         return
    #
    #     file_path, _ = QFileDialog.getSaveFileName(
    #         self, "保存合成图", "", "PNG图片 (*.png);;JPEG图片 (*.jpg)"
    #     )
    #     if file_path:
    #         # 创建与画布大小相同的QPixmap
    #         result = QPixmap(self.canvas.size())
    #         result.fill(Qt.white)
    #
    #         # 使用QPainter绘制合成图
    #         painter = QPainter(result)
    #         painter.setRenderHint(QPainter.Antialiasing)
    #         painter.setRenderHint(QPainter.SmoothPixmapTransform)
    #
    #         # 绘制底图 - 方案一：使用QRect
    #         base_rect = QRect(0, 0, self.canvas.width(), self.canvas.height())
    #         painter.drawPixmap(base_rect, self.canvas.base_image)
    #
    #         # 绘制子图
    #         if self.canvas.overlay_image:
    #             transform = QTransform()
    #             transform.translate(self.canvas.overlay_pos.x(), self.canvas.overlay_pos.y())
    #             transform.scale(self.canvas.overlay_scale, self.canvas.overlay_scale)
    #             transform.translate(-self.canvas.overlay_image.width() / 2, -self.canvas.overlay_image.height() / 2)
    #             painter.setTransform(transform)
    #             painter.drawPixmap(0, 0, self.canvas.overlay_image)
    #
    #         painter.end()
    #
    #         # 保存图片
    #         if result.save(file_path):
    #             if hasattr(self, 'status_label'):
    #                 self.status_label.setText(f"合成图已保存至: {file_path}")
    #         else:
    #             if hasattr(self, 'status_label'):
    #                 self.status_label.setText(f"保存图片失败: {file_path}")

    def merge_images(self):
        if not self.canvas.base_image or not self.canvas.overlay_image:
            if hasattr(self, 'status_label'):
                self.status_label.setText("请先选择底图和子图")
            return

        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存合成图", "", "PNG图片 (*.png);;JPEG图片 (*.jpg)"
        )
        if file_path:
            # 创建与底图大小相同的QPixmap
            result = QPixmap(self.canvas.base_image.size())
            result.fill(Qt.white)

            # 使用QPainter绘制合成图
            painter = QPainter(result)
            painter.setRenderHint(QPainter.Antialiasing)
            painter.setRenderHint(QPainter.SmoothPixmapTransform)

            # 绘制底图
            base_rect = QRect(0, 0, result.width(), result.height())
            painter.drawPixmap(base_rect, self.canvas.base_image)

            # 绘制子图
            if self.canvas.overlay_image:
                canvas_width = self.canvas.base_display_size.width()
                canvas_height = self.canvas.base_display_size.height()
                base_width = self.canvas.base_image.width()
                base_height = self.canvas.base_image.height()
                scale_x = base_width/canvas_width
                scale_y = base_height/canvas_height
                pos = self.canvas.get_overlay_pos_relative_to_base()


                # 计算子图在最终图像中的位置（考虑底图在画布中的偏移）

                overlay_scale = self.canvas.overlay_scale

                final_x = self.canvas.overlay_pos.x() - self.canvas.overlay_image.width() * self.canvas.overlay_scale / 2
                final_y = self.canvas.overlay_pos.y() - self.canvas.overlay_image.height() * self.canvas.overlay_scale / 2
                x = final_x * scale_x
                y = final_y * scale_y

                print(
                    "final_x:", final_x,
                    "final_y:", final_y,
                    "x:", x,
                    "y:", y,
                    "overlay_scale:", overlay_scale,
                    "scale_x:", scale_x,
                    "scale_y:", scale_y,
                    "pos:", pos,
                    "base_width:", base_width,
                    "base_height:", base_height,
                )


                # 计算子图在最终图像中的大小
                width = self.canvas.overlay_image.width() * overlay_scale * scale_x
                height = self.canvas.overlay_image.height() * overlay_scale * scale_y

                # 创建子图的矩形区域
                target_rect = QRectF(x, y, width, height)

                # 创建源矩形
                source_rect = QRectF(0, 0, self.canvas.overlay_image.width(), self.canvas.overlay_image.height())

                # 绘制子图
                painter.drawPixmap(target_rect, self.canvas.overlay_image, source_rect)

            painter.end()

            # 保存图片
            if result.save(file_path):
                if hasattr(self, 'status_label'):
                    self.status_label.setText(f"合成图已保存至: {file_path}")
            else:
                if hasattr(self, 'status_label'):
                    self.status_label.setText(f"保存图片失败: {file_path}")

    def closeEvent(self, event):
        """窗口关闭时自动保存设置"""
        self.save_settings()
        super().closeEvent(event)

    def save_settings(self):
        """保存当前设置到持久化存储"""
        if self.content_item and self.has_default_values:
            # 获取当前内容图的位置和大小
            pos = self.content_item.pos()
            size = self.content_item.boundingRect().size()
            transform = self.content_item.transform()

            # 保存到QSettings
            self.settings.setValue("default_content_pos", pos)
            self.settings.setValue("default_content_size", size)
            self.settings.setValue("default_content_transform", transform)
            self.settings.setValue("has_default_values", True)

            print(f"保存设置 - 位置: {pos}, 大小: {size}")

        # 确保立即写入磁盘
        self.settings.sync()
    # def select_content_image(self):
    #     if not self.background_item:
    #         QMessageBox.warning(self, "提示", "请先选择封面背景图。")
    #         return
    #
    #     file_path, _ = QFileDialog.getOpenFileName(
    #         self, "选择内容图", "",
    #         "图片文件 (*.png *.jpg *.jpeg *.bmp *.gif *.psd)"
    #     )
    #
    #     if not file_path:
    #         return
    #
    #     try:
    #         # 清除现有内容
    #         if self.content_item:
    #             self.scene.removeItem(self.content_item)
    #
    #         # 加载图像
    #         if file_path.lower().endswith('.psd'):
    #             pil_image = self.load_psd_image(file_path)
    #             if pil_image is None:
    #                 raise ValueError("无法加载PSD文件")
    #             qimage = QImage(
    #                 pil_image.tobytes("raw", "RGBA"),
    #                 pil_image.width,
    #                 pil_image.height,
    #                 QImage.Format_ARGB32
    #             )
    #         else:
    #             qimage = QImage(file_path)
    #
    #         if qimage.isNull():
    #             raise ValueError("无法加载图片")
    #
    #         # 创建可拖动内容项
    #         self.content_image = QPixmap.fromImage(qimage)
    #         self.content_item = DraggablePixmapItem()
    #         self.content_item.setPixmap(self.content_image)
    #
    #         # 设置初始大小 - 优先使用保存的默认值
    #         if self.has_default_values:
    #             # 使用保存的默认大小
    #             scaled_pixmap = self.content_image.scaled(
    #                 int(self.default_content_size.width()),
    #                 int(self.default_content_size.height()),
    #                 Qt.KeepAspectRatio, Qt.SmoothTransformation
    #             )
    #             self.content_item.setPixmap(scaled_pixmap)
    #             # 使用保存的默认位置
    #             self.content_item.setPos(self.default_content_pos)
    #             print(f"default_content_pos:{self.default_content_pos},content_item:{self.content_item.boundingRect().size()}")
    #         else:
    #             # 首次使用时的默认大小（视图宽度的1/3）
    #             view_width = self.view.width()
    #             default_width = max(100, min(view_width // 3, self.content_image.width()))
    #             aspect = self.content_image.width() / self.content_image.height()
    #             default_height = int(default_width / aspect)
    #
    #             scaled_pixmap = self.content_image.scaled(
    #                 default_width, default_height,
    #                 Qt.KeepAspectRatio, Qt.SmoothTransformation
    #             )
    #             self.content_item.setPixmap(scaled_pixmap)
    #
    #             # 首次使用时的默认位置（居中）
    #             if self.background_item:
    #                 bg_rect = self.background_item.boundingRect()
    #                 content_rect = self.content_item.boundingRect()
    #                 self.content_item.setPos(
    #                     (bg_rect.width() - content_rect.width()) / 2,
    #                     (bg_rect.height() - content_rect.height()) / 2
    #                 )
    #
    #         # 存储原始图片数据以便正确缩放
    #         self.content_item.original_pixmap = self.content_image
    #         self.content_item.original_size = self.content_image.size()
    #
    #         self.scene.addItem(self.content_item)
    #         self.update_merge_button_state()
    #
    #     except Exception as e:
    #         QMessageBox.warning(self, "错误", f"加载内容图片时出错: {str(e)}")

    def select_content_image(self):
        # if not self.background_item:
        #     QMessageBox.warning(self, "提示", "请先选择封面背景图。")
        #     return

        # 设置初始目录为上次使用的路径
        initial_dir = self.last_content_path if self.last_content_path else ""

        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择内容图", initial_dir,
            "图片文件 (*.png *.jpg *.jpeg *.bmp *.gif *.psd)"
        )

        if not file_path:
            return

        self.last_content_path = file_path
        self.settings.setValue("last_content_path", self.last_content_path)
        self.settings.sync()


        # 加载图像
        if file_path.lower().endswith('.psd'):
            pil_image = self.load_psd_image(file_path)
            if pil_image is None:
                raise ValueError("无法加载PSD文件")
            qimage = QImage(
                pil_image.tobytes("raw", "RGBA"),
                pil_image.width,
                pil_image.height,
                QImage.Format_ARGB32
            )
        else:
            qimage = QImage(file_path)

        if qimage.isNull():
            raise ValueError("无法加载图片")
        # self.load_content_image(qimage)

        self.canvas.set_overlay_image(QPixmap.fromImage(qimage))
