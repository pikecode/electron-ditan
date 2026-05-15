import warnings
from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QPushButton, QFileDialog, QMessageBox,
    QGraphicsView, QGraphicsScene, QGraphicsPixmapItem, QHBoxLayout
)
from PySide6.QtGui import QPixmap, QImage, QPainter, QPen, QColor, QCursor, QTransform
from PySide6.QtCore import Qt, QRectF, QRect, QPointF, QTimer, QSizeF, QSettings, QPoint, QSize

# 忽略psd-tools的警告
warnings.filterwarnings("ignore", category=UserWarning, module="psd_tools")


class SKImageCanvas(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.base_image = None
        self.overlay_image1 = None
        self.overlay_image2 = None
        self.overlay_pos1 = QPoint(0, 0)
        self.overlay_pos2 = QPoint(0, 0)
        self.overlay_scale1 = 1.0
        self.overlay_scale2 = 1.0
        self.is_dragging1 = False
        self.is_dragging2 = False
        self.last_mouse_pos = QPoint()
        self.setMinimumSize(800, 600)
        self.base_display_pos = None
        self.base_display_size = None
        self.setStyleSheet("background-color: #f0f0f0;")
        self.clickState = 0

    def set_base_image(self, image):
        self.base_image = image
        self.adjustSize()
        self.update()

    def set_overlay_image1(self, image):
        self.overlay_image1 = image
        self.overlay_scale1 = 400 / self.overlay_image1.width()
        self.overlay_pos1 = QPoint(
            (self.width() - self.overlay_image1.width() * self.overlay_scale1) // 2,
            (self.height() - self.overlay_image1.height() * self.overlay_scale1) // 2
        )
        self.update()

    def set_overlay_image2(self, image):
        self.overlay_image2 = image
        self.overlay_scale2 = 200 / self.overlay_image2.width()
        self.overlay_pos2 = QPoint(
            (self.width() - self.overlay_image2.width() * self.overlay_scale2) // 2,
            (self.height() - self.overlay_image2.height() * self.overlay_scale2) // 2
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
            base_ratio = self.base_image.width() / self.base_image.height()
            canvas_ratio = self.width() / self.height()

            if canvas_ratio > base_ratio:
                base_height = self.height()
                base_width = base_height * base_ratio
            else:
                base_width = self.width()
                base_height = base_width / base_ratio

            base_x = (self.width() - base_width) / 2
            base_y = (self.height() - base_height) / 2

            self.base_display_pos = QPoint(base_x, base_y)
            self.base_display_size = QSizeF(base_width, base_height)

            base_rect = QRectF(base_x, base_y, base_width, base_height)
            source_rect = QRectF(0, 0, self.base_image.width(), self.base_image.height())
            painter.drawPixmap(base_rect, self.base_image, source_rect)

        # 绘制第一个子图
        if self.overlay_image1:
            transform = QTransform()
            transform.translate(self.overlay_pos1.x(), self.overlay_pos1.y())
            transform.scale(self.overlay_scale1, self.overlay_scale1)
            transform.translate(-self.overlay_image1.width() / 2, -self.overlay_image1.height() / 2)
            painter.setTransform(transform)
            painter.drawPixmap(0, 0, self.overlay_image1)

        # 绘制第二个子图
        if self.overlay_image2:
            transform = QTransform()
            transform.translate(self.overlay_pos2.x(), self.overlay_pos2.y())
            transform.scale(self.overlay_scale2, self.overlay_scale2)
            transform.translate(-self.overlay_image2.width() / 2, -self.overlay_image2.height() / 2)
            painter.setTransform(transform)
            painter.drawPixmap(0, 0, self.overlay_image2)

        if self.clickState == 2 and self.overlay_image1:
            painter.setTransform(QTransform())
            pen = QPen(QColor(100, 100, 100), 2, Qt.DashLine)
            painter.setPen(pen)
            rect = QRectF(
                self.overlay_pos1.x() - self.overlay_image1.width() * self.overlay_scale1 / 2,
                self.overlay_pos1.y() - self.overlay_image1.height() * self.overlay_scale1 / 2,
                self.overlay_image1.width() * self.overlay_scale1,
                self.overlay_image1.height() * self.overlay_scale1
            )
            painter.drawRect(rect)
        if self.clickState == 3 and self.overlay_image2:
            painter.setTransform(QTransform())
            pen = QPen(QColor(100, 100, 100), 2, Qt.DashLine)
            painter.setPen(pen)
            rect = QRectF(
                self.overlay_pos2.x() - self.overlay_image2.width() * self.overlay_scale2 / 2,
                self.overlay_pos2.y() - self.overlay_image2.height() * self.overlay_scale2 / 2,
                self.overlay_image2.width() * self.overlay_scale2,
                self.overlay_image2.height() * self.overlay_scale2
            )
            painter.drawRect(rect)



    def mousePressEvent(self, event):
        print(
            "鼠标按下：",
            event.button(),
            "位置：",
            event.position().toPoint()
        )
        if event.button() == Qt.LeftButton:
            # 检查鼠标是否在第一个子图区域内

            if self.clickState == 0:
                self.clickState = 1
            if self.overlay_image1:
                rect1 = QRectF(
                    self.overlay_pos1.x() - self.overlay_image1.width() * self.overlay_scale1 / 2,
                    self.overlay_pos1.y() - self.overlay_image1.height() * self.overlay_scale1 / 2,
                    self.overlay_image1.width() * self.overlay_scale1,
                    self.overlay_image1.height() * self.overlay_scale1
                )
                if rect1.contains(event.position().toPoint()):
                    self.is_dragging1 = True
                    self.is_dragging2 = False
                    self.last_mouse_pos = event.position().toPoint()
                    self.setCursor(Qt.ClosedHandCursor)
                    self.clickState = 1
                    return
                else:
                    self.clickState = 0
            # 检查鼠标是否在第二个子图区域内
            if self.overlay_image2:
                rect2 = QRectF(
                    self.overlay_pos2.x() - self.overlay_image2.width() * self.overlay_scale2 / 2,
                    self.overlay_pos2.y() - self.overlay_image2.height() * self.overlay_scale2 / 2,
                    self.overlay_image2.width() * self.overlay_scale2,
                    self.overlay_image2.height() * self.overlay_scale2
                )
                if rect2.contains(event.position().toPoint()):
                    self.is_dragging2 = True
                    self.is_dragging1 = False
                    self.last_mouse_pos = event.position().toPoint()
                    self.setCursor(Qt.ClosedHandCursor)
                    self.clickState = 1
                else:
                    self.clickState = 0

    def mouseMoveEvent(self, event):
        # print("鼠标移动：", event.position().toPoint())
        # self.clickState = 0
        if self.is_dragging1:
            delta = event.position().toPoint() - self.last_mouse_pos
            self.overlay_pos1 += delta
            self.last_mouse_pos = event.position().toPoint()
            self.update()
        elif self.is_dragging2:
            delta = event.position().toPoint() - self.last_mouse_pos
            self.overlay_pos2 += delta
            self.last_mouse_pos = event.position().toPoint()
            self.update()

    def mouseReleaseEvent(self, event):
        # print("鼠标释放：", event.button())
        if event.button() == Qt.LeftButton:
            if self.is_dragging1:
                self.is_dragging1 = False
                self.setCursor(Qt.ArrowCursor)
                if self.clickState  == 1:
                    self.clickState = 2
                else:
                    self.clickState = 0
                self.update()
            elif self.is_dragging2:
                self.is_dragging2 = False
                self.setCursor(Qt.ArrowCursor)
                if self.clickState  == 1:
                    self.clickState = 3
                else:
                    self.clickState = 0
                self.update()
            else:
                self.clickState = 0

    def wheelEvent(self, event):
        # print("鼠标滚轮：", event.angleDelta().y())
        if self.clickState == 2 and self.overlay_image1:
            center_x = self.overlay_pos1.x()
            center_y = self.overlay_pos1.y()
            old_scale = self.overlay_scale1
            if event.angleDelta().y() > 0:
                self.overlay_scale1 *= 1.1
            else:
                self.overlay_scale1 *= 0.9
            self.overlay_scale1 = max(0.02, min(self.overlay_scale1, 10.0))
            mouse_pos = event.position().toPoint()
            scale_factor = self.overlay_scale1 / old_scale
            self.overlay_pos1.setX(center_x + (mouse_pos.x() - center_x) * (1 - scale_factor))
            self.overlay_pos1.setY(center_y + (mouse_pos.y() - center_y) * (1 - scale_factor))
            self.update()
        if self.clickState == 3 and self.overlay_image2:
            center_x = self.overlay_pos2.x()
            center_y = self.overlay_pos2.y()
            old_scale = self.overlay_scale2
            if event.angleDelta().y() > 0:
                self.overlay_scale2 *= 1.1
            else:
                self.overlay_scale2 *= 0.9
            self.overlay_scale2 = max(0.02, min(self.overlay_scale2, 10.0))
            mouse_pos = event.position().toPoint()
            scale_factor = self.overlay_scale2 / old_scale
            self.overlay_pos2.setX(center_x + (mouse_pos.x() - center_x) * (1 - scale_factor))
            self.overlay_pos2.setY(center_y + (mouse_pos.y() - center_y) * (1 - scale_factor))
            self.update()

    def resizeEvent(self, event):
        if self.base_image and self.overlay_image1:
            base_ratio = self.base_image.width() / self.base_image.height()
            canvas_ratio = self.width() / self.height()
            if canvas_ratio > base_ratio:
                base_height = self.height()
                base_width = base_height * base_ratio
            else:
                base_width = self.width()
                base_height = base_width / base_ratio
            base_x = (self.width() - base_width) / 2
            base_y = (self.height() - base_height) / 2
            self.overlay_pos1.setX(base_x + base_width / 2)
            self.overlay_pos1.setY(base_y + base_height / 2)
        if self.base_image and self.overlay_image2:
            base_ratio = self.base_image.width() / self.base_image.height()
            canvas_ratio = self.width() / self.height()
            if canvas_ratio > base_ratio:
                base_height = self.height()
                base_width = base_height * base_ratio
            else:
                base_width = self.width()
                base_height = base_width / base_ratio
            base_x = (self.width() - base_width) / 2
            base_y = (self.height() - base_height) / 2
            self.overlay_pos2.setX(base_x + base_width / 2)
            self.overlay_pos2.setY(base_y + base_height / 2)
        super().resizeEvent(event)

    def get_overlay_pos_relative_to_base1(self):
        if not self.base_image or not self.overlay_image1:
            return QPoint(0, 0)
        overlay_x = self.overlay_pos1.x() - self.base_display_pos.x()
        overlay_y = self.overlay_pos1.y() - self.base_display_pos.y()
        return QPoint(overlay_x, overlay_y)

    def get_overlay_pos_relative_to_base2(self):
        if not self.base_image or not self.overlay_image2:
            return QPoint(0, 0)
        overlay_x = self.overlay_pos2.x() - self.base_display_pos.x()
        overlay_y = self.overlay_pos2.y() - self.base_display_pos.y()
        return QPoint(overlay_x, overlay_y)


class SKCoverPage(QWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.parent = parent
        self.background_item = None
        self.content_item1 = None
        self.content_item2 = None

        # 初始化QSettings
        self.settings = QSettings("YourCompany", "CoverPageEditor")

        # 从设置加载保存的值（添加类型转换）
        self.default_content_pos1 = self.settings.value("default_content_pos1", QPointF(0, 0), type=QPointF)
        self.default_content_size1 = self.settings.value("default_content_size1", QSizeF(100, 100), type=QSizeF)
        self.default_content_transform1 = self.settings.value("default_content_transform1", QTransform(), type=QTransform)
        self.has_default_values1 = self.settings.value("has_default_values1", False, type=bool)

        self.default_content_pos2 = self.settings.value("default_content_pos2", QPointF(0, 0), type=QPointF)
        self.default_content_size2 = self.settings.value("default_content_size2", QSizeF(100, 100), type=QSizeF)
        self.default_content_transform2 = self.settings.value("default_content_transform2", QTransform(), type=QTransform)
        self.has_default_values2 = self.settings.value("has_default_values2", False, type=bool)

        # 加载上次使用的文件路径
        self.last_background_path = self.settings.value("last_background_path", "")
        self.last_content_path1 = self.settings.value("last_content_path1", "")
        self.last_content_path2 = self.settings.value("last_content_path2", "")

        print(f"加载保存的设置 - 位置1: {self.default_content_pos1}, 大小1: {self.default_content_size1}")
        print(f"加载保存的设置 - 位置2: {self.default_content_pos2}, 大小2: {self.default_content_size2}")
        self.init_ui()

    def init_ui(self):
        layout = QVBoxLayout()

        btn_layout = QHBoxLayout()
        # Create buttons
        self.background_button = QPushButton("选择封面背景")
        self.background_button.setFixedWidth(120)
        self.background_button.clicked.connect(self.select_background_image)

        # self.content_button1 = QPushButton("选择内容图1")
        # self.content_button1.setFixedWidth(120)
        # self.content_button1.clicked.connect(self.select_content_image1)
        #
        # self.content_button2 = QPushButton("选择内容图2")
        # self.content_button2.setFixedWidth(120)
        # self.content_button2.clicked.connect(self.select_content_image2)

        btn_layout.addWidget(self.background_button)
        # btn_layout.addWidget(self.content_button1)
        # btn_layout.addWidget(self.content_button2)
        btn_layout.addStretch(1)
        layout.addLayout(btn_layout)

        self.merge_button = QPushButton("合并")
        self.merge_button.clicked.connect(self.merge_images)
        self.merge_button.setEnabled(True)

        # 创建图片画布
        self.canvas = SKImageCanvas()

        canvas_layout = QHBoxLayout()

        canvas_layout.setContentsMargins(0, 0, 0, 0)  # 设置布局的边距
        canvas_layout.setSpacing(0)  # 设置布局的间距

        canvas_layout.addWidget(self.canvas)

        layout.addLayout(canvas_layout)
        layout.addWidget(self.merge_button)

        self.setLayout(layout)

    def setSampleImage(self, type, image):
        if image:
            if type == 1:
                self.canvas.set_overlay_image1(QPixmap.fromImage(image))
            elif type == 2:
                self.canvas.set_overlay_image2(QPixmap.fromImage(image))
            # self.select_background_image()

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

    def merge_images(self):
        if not self.canvas.base_image or (not self.canvas.overlay_image1 and not self.canvas.overlay_image2):
            if hasattr(self, 'status_label'):
                self.status_label.setText("请先选择底图和至少一个子图")
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

            # 绘制第一个子图
            if self.canvas.overlay_image1:
                canvas_width = self.canvas.base_display_size.width()
                canvas_height = self.canvas.base_display_size.height()
                base_width = self.canvas.base_image.width()
                base_height = self.canvas.base_image.height()
                scale_x = base_width / canvas_width
                scale_y = base_height / canvas_height
                pos = self.canvas.get_overlay_pos_relative_to_base1()

                overlay_scale = self.canvas.overlay_scale1

                final_x = self.canvas.overlay_pos1.x() - self.canvas.overlay_image1.width() * self.canvas.overlay_scale1 / 2
                final_y = self.canvas.overlay_pos1.y() - self.canvas.overlay_image1.height() * self.canvas.overlay_scale1 / 2
                x = final_x * scale_x
                y = final_y * scale_y

                width = self.canvas.overlay_image1.width() * overlay_scale * scale_x
                height = self.canvas.overlay_image1.height() * overlay_scale * scale_y

                target_rect = QRectF(x, y, width, height)
                source_rect = QRectF(0, 0, self.canvas.overlay_image1.width(), self.canvas.overlay_image1.height())
                painter.drawPixmap(target_rect, self.canvas.overlay_image1, source_rect)

            # 绘制第二个子图
            if self.canvas.overlay_image2:
                canvas_width = self.canvas.base_display_size.width()
                canvas_height = self.canvas.base_display_size.height()
                base_width = self.canvas.base_image.width()
                base_height = self.canvas.base_image.height()
                scale_x = base_width / canvas_width
                scale_y = base_height / canvas_height
                pos = self.canvas.get_overlay_pos_relative_to_base2()

                overlay_scale = self.canvas.overlay_scale2

                final_x = self.canvas.overlay_pos2.x() - self.canvas.overlay_image2.width() * self.canvas.overlay_scale2 / 2
                final_y = self.canvas.overlay_pos2.y() - self.canvas.overlay_image2.height() * self.canvas.overlay_scale2 / 2
                x = final_x * scale_x
                y = final_y * scale_y

                width = self.canvas.overlay_image2.width() * overlay_scale * scale_x
                height = self.canvas.overlay_image2.height() * overlay_scale * scale_y

                target_rect = QRectF(x, y, width, height)
                source_rect = QRectF(0, 0, self.canvas.overlay_image2.width(), self.canvas.overlay_image2.height())
                painter.drawPixmap(target_rect, self.canvas.overlay_image2, source_rect)

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
        if self.content_item1 and self.has_default_values1:
            # 获取当前内容图1的位置和大小
            pos = self.content_item1.pos()
            size = self.content_item1.boundingRect().size()
            transform = self.content_item1.transform()

            # 保存到QSettings
            self.settings.setValue("default_content_pos1", pos)
            self.settings.setValue("default_content_size1", size)
            self.settings.setValue("default_content_transform1", transform)
            self.settings.setValue("has_default_values1", True)

            print(f"保存设置 - 位置1: {pos}, 大小1: {size}")

        if self.content_item2 and self.has_default_values2:
            # 获取当前内容图2的位置和大小
            pos = self.content_item2.pos()
            size = self.content_item2.boundingRect().size()
            transform = self.content_item2.transform()

            # 保存到QSettings
            self.settings.setValue("default_content_pos2", pos)
            self.settings.setValue("default_content_size2", size)
            self.settings.setValue("default_content_transform2", transform)
            self.settings.setValue("has_default_values2", True)

            print(f"保存设置 - 位置2: {pos}, 大小2: {size}")

        # 确保立即写入磁盘
        self.settings.sync()

    def select_content_image1(self):
        # 设置初始目录为上次使用的路径
        initial_dir = self.last_content_path1 if self.last_content_path1 else ""

        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择内容图1", initial_dir,
            "图片文件 (*.png *.jpg *.jpeg *.bmp *.gif *.psd)"
        )

        if not file_path:
            return

        self.last_content_path1 = file_path
        self.settings.setValue("last_content_path1", self.last_content_path1)
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

        self.canvas.set_overlay_image1(QPixmap.fromImage(qimage))

    def select_content_image2(self):
        # 设置初始目录为上次使用的路径
        initial_dir = self.last_content_path2 if self.last_content_path2 else ""

        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择内容图2", initial_dir,
            "图片文件 (*.png *.jpg *.jpeg *.bmp *.gif *.psd)"
        )

        if not file_path:
            return

        self.last_content_path2 = file_path
        self.settings.setValue("last_content_path2", self.last_content_path2)
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

        self.canvas.set_overlay_image2(QPixmap.fromImage(qimage))
