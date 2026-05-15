import sys
import os

import math
import numpy as np
from PySide6.QtWidgets import (QLayout,
    QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QPushButton, QSpinBox, QColorDialog, QTableWidget,
    QTableWidgetItem, QFileDialog, QScrollArea, QSizePolicy, QFrame,
    QDialog, QMessageBox, QMenu, QCheckBox, QSlider, QRadioButton,
    QGraphicsView, QGraphicsScene, QGraphicsPixmapItem, QGraphicsRectItem,
    QGridLayout, QHeaderView, QGraphicsProxyWidget, QListWidget, QListWidgetItem, QMenuBar, QApplication
)
from PySide6.QtGui import (
    QPixmap, QPainter, QPen, QColor, QFont, QImage, QAction, QMouseEvent,
    QBrush, QMouseEvent, QIcon, QPalette
)
from PySide6.QtCore import Qt, QRect, QRectF, QFile, QSaveFile, QXmlStreamWriter, QXmlStreamReader, QPointF, \
    QStandardPaths, QSize, QPoint, Signal, QByteArray, QBuffer
from skimage.color import deltaE_ciede2000
from skimage.color import rgb2lab
from skimage.color.rgb_colors import green
import builtins
from datetime import datetime
# from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
# from cryptography.hazmat.primitives import hashes
from PySide6.QtCore import QIODevice

import base64
import zlib

# 保存原始 print 函数
original_print = builtins.print

def timestamped_print(*args, **kwargs):
    """全局替换 print 函数，自动添加时间戳"""
    now = datetime.now()
    # 格式化为带毫秒的字符串（取前3位微秒作为毫秒）
    formatted_time = now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    original_print(formatted_time, *args, **kwargs)

# 替换内置 print 函数
builtins.print = timestamped_print

class FlowLayout(QLayout):
    """自定义流式布局，支持自动换行"""

    def __init__(self, parent=None, margin=0, spacing=5):
        super().__init__(parent)
        self.setContentsMargins(margin, margin, margin, margin)
        self.setSpacing(spacing)
        self.item_list = []

    def addItem(self, item):
        self.item_list.append(item)

    def count(self):
        return len(self.item_list)

    def itemAt(self, index):
        if 0 <= index < len(self.item_list):
            return self.item_list[index]
        return None

    def takeAt(self, index):
        if 0 <= index < len(self.item_list):
            return self.item_list.pop(index)
        return None

    def expandingDirections(self):
        return Qt.Orientation(0)

    def hasHeightForWidth(self):
        return True

    def heightForWidth(self, width):
        height = self.do_layout(QRect(0, 0, width, 0), True)
        return height

    def setGeometry(self, rect):
        super().setGeometry(rect)
        self.do_layout(rect, False)

    def sizeHint(self):
        return self.minimumSize()

    def minimumSize(self):
        size = QSize()
        for item in self.item_list:
            size = size.expandedTo(item.minimumSize())
        left, top, right, bottom = self.getContentsMargins()
        size += QSize(left + right, top + bottom)
        return size

    def do_layout(self, rect, test_only):
        left, top, right, bottom = self.getContentsMargins()
        effective_rect = rect.adjusted(left, top, -right, -bottom)
        x = effective_rect.x()
        y = effective_rect.y()
        line_height = 0

        for item in self.item_list:
            widget = item.widget()
            space_x = self.spacing()
            space_y = self.spacing()

            next_x = x + item.sizeHint().width() + space_x
            if next_x - space_x > effective_rect.right() and line_height > 0:
                x = effective_rect.x()
                y = y + line_height + space_y
                next_x = x + item.sizeHint().width() + space_x
                line_height = 0

            if not test_only:
                item.setGeometry(QRect(QPoint(x, y), item.sizeHint()))

            x = next_x
            line_height = max(line_height, item.sizeHint().height())

        return y + line_height - rect.y() + bottom




class ColorPaletteManager:
    # 使用魔法标记标识加密文件
    ENCRYPTION_MAGIC = b"ENCRYPTED"
    COMPRESSION_MAGIC = b"COMPRESSED"

    @staticmethod
    def _simple_xor_encrypt(data: bytes, key: bytes) -> bytes:
        """简单的XOR加密/解密函数"""
        key_len = len(key)
        # 确保所有操作数都是整数
        return bytes([data[i] ^ key[i % key_len] for i in range(len(data))])

    @staticmethod
    def encrypt_data(data: QByteArray, password: str) -> QByteArray:
        """加密数据"""
        if not password:
            return data

        # 生成基于密码的密钥
        key = (password * 32)[:32].encode('utf-8')

        # 压缩数据
        compressed = zlib.compress(data.data(), level=9)
        encrypted = ColorPaletteManager._simple_xor_encrypt(compressed, key)

        # 添加魔法标记
        result = QByteArray()
        result.append(ColorPaletteManager.ENCRYPTION_MAGIC)
        result.append(ColorPaletteManager.COMPRESSION_MAGIC)
        result.append(encrypted)
        return result

    @staticmethod
    def decrypt_data(data: QByteArray, password: str) -> QByteArray:
        """解密数据"""
        # 检查是否有加密标记
        if not data.startsWith(ColorPaletteManager.ENCRYPTION_MAGIC):
            return data

        # 移除加密标记
        encrypted_data = data.mid(len(ColorPaletteManager.ENCRYPTION_MAGIC))

        # 检查是否有压缩标记
        is_compressed = encrypted_data.startsWith(ColorPaletteManager.COMPRESSION_MAGIC)
        if is_compressed:
            encrypted_data = encrypted_data.mid(len(ColorPaletteManager.COMPRESSION_MAGIC))

        if not password:
            raise ValueError("文件已加密，需要密码")

        # 生成基于密码的密钥
        key = (password * 32)[:32].encode('utf-8')

        # 将QByteArray转换为bytes
        encrypted_bytes = bytes(encrypted_data)

        # 解密数据
        decrypted = ColorPaletteManager._simple_xor_encrypt(encrypted_bytes, key)

        # 解压数据
        if is_compressed:
            return QByteArray(zlib.decompress(decrypted))
        return QByteArray(decrypted)

    @staticmethod
    def save_to_xsd(file_path, color_palette, password="qazWSX"):
        """将色卡保存到XSD文件，可选择加密"""
        # 首先将数据写入到内存中的XML
        xml_data = QByteArray()
        buffer = QBuffer(xml_data)
        buffer.open(QIODevice.WriteOnly)

        writer = QXmlStreamWriter(buffer)
        writer.setAutoFormatting(True)
        writer.writeStartDocument()
        writer.writeStartElement("ColorPalette")

        for key, color in color_palette.items():
            writer.writeStartElement("Color")
            writer.writeAttribute("id", key)
            writer.writeAttribute("value", color.name())
            writer.writeAttribute("alpha", str(color.alpha()))
            writer.writeEndElement()

        writer.writeEndElement()
        writer.writeEndDocument()
        buffer.close()

        # 如果需要加密，则加密数据
        if password:
            save_data = ColorPaletteManager.encrypt_data(xml_data, password)
        else:
            save_data = xml_data

        # 保存到文件
        file = QSaveFile(file_path)
        if not file.open(QSaveFile.WriteOnly):
            return False

        file.write(save_data)
        return file.commit()

    @staticmethod
    def load_from_xsd(file_path, password="qazWSX"):
        """从XSD文件加载色卡，如果需要则解密"""
        file = QFile(file_path)
        if not file.open(QFile.ReadOnly):
            return None

        file_data = file.readAll()
        file.close()

        # 检查是否需要解密
        if file_data.startsWith(ColorPaletteManager.ENCRYPTION_MAGIC):
            print("检测到加密文件，尝试解密...")
            try:
                xml_data = ColorPaletteManager.decrypt_data(file_data, password)
            except Exception as e:
                print(f"解密错误: {str(e)}")
                return None
        else:
            print("未加密文件，直接解析")
            xml_data = file_data

        # 解析XML数据
        buffer = QBuffer(xml_data)
        if not buffer.open(QIODevice.ReadOnly):
            return None

        reader = QXmlStreamReader(buffer)
        color_palette = {}

        while not reader.atEnd():
            reader.readNext()

            if reader.isStartElement() and reader.name() == "Color":
                attributes = reader.attributes()
                key = attributes.value("id")
                color_value = attributes.value("value")
                alpha_str = attributes.value("alpha", "255")

                # 创建颜色对象
                color = QColor(color_value)
                if not color.isValid():
                    print(f"无效的颜色值: {color_value}")
                    continue

                # 设置alpha值
                try:
                    alpha = int(alpha_str) if alpha_str else 255
                except ValueError:
                    alpha = 255
                color.setAlpha(alpha)

                if key:
                    color_palette[key] = color

        if reader.hasError():
            print(f"XML解析错误: {reader.errorString()}")
            return None
        print(color_palette)
        return color_palette



# class ColorPaletteEditDialog(QDialog):
#     def __init__(self, color_palette, parent=None):
#         super().__init__(parent)
#         self.setWindowTitle("编辑色卡")
#         self.setMinimumSize(800, 350)  # 宽度调整（移除Alpha列）
#         self.color_palette = {k: QColor(v) for k, v in color_palette.items()}
#         self.original_ids = list(self.color_palette.keys())
#
#         self.init_ui()
#         self.load_palette()
#
#     def init_ui(self):
#         layout = QVBoxLayout()
#
#         # 表格显示现有色卡（调整为4列）
#         self.table = QTableWidget(0, 4)
#         self.table.setHorizontalHeaderLabels(["ID（可编辑）", "颜色预览", "16进制色值", "操作"])
#         self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
#         self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Fixed)
#         self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
#         self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
#         self.table.setColumnWidth(1, 80)
#         layout.addWidget(self.table)
#
#         # 添加"新增颜色"按钮
#         add_color_btn = QPushButton("新增颜色")
#         add_color_btn.clicked.connect(self.add_new_color)
#         layout.addWidget(add_color_btn)
#
#         # 连接表格item修改信号
#         self.table.itemChanged.connect(self.on_item_edited)
#
#         # 底部提示
#         layout.addWidget(QLabel("注：ID需唯一；16进制格式支持#RRGGBB（如#FF0000表示红色）"))
#
#         # 确认/取消按钮
#         btn_layout = QHBoxLayout()
#         ok_btn = QPushButton("确定")
#         ok_btn.clicked.connect(self.accept)
#         cancel_btn = QPushButton("取消")
#         cancel_btn.clicked.connect(self.reject)
#         btn_layout.addStretch()
#         btn_layout.addWidget(ok_btn)
#         btn_layout.addWidget(cancel_btn)
#         layout.addLayout(btn_layout)
#
#         self.setLayout(layout)
#
#     def add_new_color(self):
#         new_id = self.generate_unique_id()
#         new_color = QColor("#FFFFFF")  # 默认白色
#         self.color_palette[new_id] = new_color  # 确保添加到色卡
#
#         row = self.table.rowCount()
#         self.table.insertRow(row)  # 插入新行
#
#         # ID列（可编辑）
#         id_item = QTableWidgetItem(new_id)
#         id_item.setFlags(id_item.flags() | Qt.ItemIsEditable)
#         self.table.setItem(row, 0, id_item)
#
#         # 颜色预览列（关键修复：强制更新样式）
#         color_label = QLabel()
#         color_label.setFixedSize(70, 30)
#         color_style = f"background-color: {new_color.name()}; border: 1px solid #666; border-radius: 4px"
#         color_label.setStyleSheet(color_style)
#         color_label.update()  # 强制刷新样式
#         self.table.setCellWidget(row, 1, color_label)
#
#         # 16进制色值列（可编辑）
#         hex_item = QTableWidgetItem(new_color.name())
#         hex_item.setFlags(hex_item.flags() | Qt.ItemIsEditable)
#         self.table.setItem(row, 2, hex_item)
#
#         # 操作列（删除按钮）
#         del_btn = QPushButton("删除")
#         del_btn.clicked.connect(lambda _, r=row: self.delete_row(r))
#         self.table.setCellWidget(row, 3, del_btn)
#
#     def generate_unique_id(self):
#         existing_ids = set(self.color_palette.keys())
#         # 扩展支持小写字母和更多符号（如a-z）
#         chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
#
#         # 单字符ID
#         for c in chars:
#             if c not in existing_ids:
#                 return c
#
#         # 双字符ID（覆盖更多组合）
#         for c1 in chars:
#             for c2 in chars:
#                 new_id = c1 + c2
#                 if new_id not in existing_ids:
#                     return new_id
#
#         # 三字符ID（极端情况）
#         for c1 in chars:
#             for c2 in chars:
#                 for c3 in chars:
#                     new_id = c1 + c2 + c3
#                     if new_id not in existing_ids:
#                         return new_id
#
#         # 最终 fallback（理论上不会执行）
#         return f"ID_{len(existing_ids)}"
#
#     """加载色卡数据到表格"""
#
#     def load_palette(self):
#         """加载色卡数据到表格"""
#         self.table.setRowCount(len(self.color_palette))
#         for row, (key, color) in enumerate(sorted(self.color_palette.items())):
#             # ID列（可编辑）
#             id_item = QTableWidgetItem(key)
#             id_item.setFlags(id_item.flags() | Qt.ItemIsEditable)
#             self.table.setItem(row, 0, id_item)
#
#             # 颜色预览列
#             color_label = QLabel()
#             color_label.setFixedSize(70, 30)
#             color_style = f"background-color: {color.name()}; border: 1px solid #666; border-radius: 4px"
#             color_label.setStyleSheet(color_style)
#             self.table.setCellWidget(row, 1, color_label)
#
#             # 绑定点击事件
#             color_label.mousePressEvent = lambda event, r=row, k=key: on_color_clicked(event, r, k)
#
#             # 添加悬停效果（可选）
#             color_label.setProperty("color_key", key)
#             color_label.setCursor(Qt.PointingHandCursor)
#
#             def on_color_clicked(event, row, key):
#                 # 获取当前颜色
#                 color = self.color_palette[key]
#                 # 显示颜色选择对话框
#                 color_dialog = QColorDialog(color, self)
#                 color_dialog.setOption(QColorDialog.ShowAlphaChannel)
#
#                 if color_dialog.exec_() == QColorDialog.Accepted:
#                     # 更新颜色
#                     new_color = color_dialog.selectedColor()
#                     self.color_palette[key] = new_color
#                     # 更新表格中的颜色预览
#                     color_label = self.table.cellWidget(row, 1)
#                     new_color_style = f"background-color: {new_color.name()}; border: 1px solid #666; border-radius: 4px"
#                     color_label.setStyleSheet(new_color_style)
#                     # 更新十六进制色值列
#                     hex_item = self.table.item(row, 2)
#                     hex_item.setText(new_color.name())
#                     self.update_block(key, new_color)
#
#                     print("update_legend6")
#                     self.update_legend()
#
#             # 16进制色值列（可编辑）
#             hex_item = QTableWidgetItem(color.name())  # 显示#RRGGBB格式
#             hex_item.setFlags(hex_item.flags() | Qt.ItemIsEditable)
#             self.table.setItem(row, 2, hex_item)
#
#             # 操作列（删除按钮）
#             del_btn = QPushButton("删除")
#             del_btn.clicked.connect(lambda _, r=row: self.delete_row(r))
#             self.table.setCellWidget(row, 3, del_btn)
#
#     def on_item_edited(self, item):
#         """处理表格内容修改"""
#         row = item.row()
#         current_id = self.table.item(row, 0).text().strip()
#         current_color = self.color_palette[current_id]
#
#         if item.column() == 0:
#             # ID编辑校验（保持唯一）
#             new_id = item.text().strip()
#             if new_id in self.color_palette and new_id != current_id:
#                 QMessageBox.warning(self, "错误", "ID已存在，请使用唯一ID！")
#                 item.setText(current_id)  # 恢复原ID
#                 return
#             # 更新color_palette的键
#             self.color_palette[new_id] = self.color_palette.pop(current_id)
#
#         elif item.column() == 2:
#             # 16进制色值编辑校验
#             new_hex = item.text().strip()
#             if not self.validate_hex_color(new_hex):
#                 QMessageBox.warning(self, "错误", "无效的16进制色值！\n正确格式：#RRGGBB（如#FF0000）")
#                 item.setText(current_color.name())  # 恢复原始色值
#                 return
#
#             # 更新颜色值
#             new_color = QColor(new_hex)
#             if not new_color.isValid():
#                 QMessageBox.warning(self, "错误", "无效的颜色值！")
#                 item.setText(current_color.name())
#                 return
#
#             # 更新颜色预览
#             color_label = self.table.cellWidget(row, 1)
#             color_style = f"background-color: {new_color.name()}; border: 1px solid #666; border-radius: 4px"
#             color_label.setStyleSheet(color_style)
#
#             # 更新color_palette
#             self.color_palette[current_id] = new_color
#
#     @staticmethod
#     def validate_hex_color(hex_str):
#         """验证#RRGGBB格式"""
#         if not hex_str.startswith('#') or len(hex_str) != 7:
#             return False
#         hex_body = hex_str[1:]
#         try:
#             int(hex_body, 16)  # 验证是否为有效16进制数
#             return True
#         except ValueError:
#             return False
#
#     def delete_row(self, row):
#         """删除行"""
#         if self.table.rowCount() <= 1:
#             QMessageBox.warning(self, "提示", "至少保留一个颜色！")
#             return
#         deleted_id = self.table.item(row, 0).text()
#         del self.color_palette[deleted_id]
#         self.table.removeRow(row)
#
#     def get_updated_palette(self):
#         """返回更新后的色卡"""
#         return self.color_palette

class ColorPaletteEditDialog(QDialog):
    def __init__(self, color_palette, parent=None):
        super().__init__(parent)
        self.setWindowTitle("编辑色卡")
        self.setMinimumSize(800, 350)  # 宽度调整（移除Alpha列）
        self.color_palette = {k: QColor(v) for k, v in color_palette.items()}
        self.original_ids = list(self.color_palette.keys())

        self.init_ui()
        self.load_palette()

    def init_ui(self):
        layout = QVBoxLayout()

        # 表格显示现有色卡（调整为4列）
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["ID（可编辑）", "颜色预览", "16进制色值", "操作"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Fixed)
        self.table.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeToContents)
        self.table.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeToContents)
        self.table.setColumnWidth(1, 80)
        layout.addWidget(self.table)

        # 添加"新增颜色"按钮
        add_color_btn = QPushButton("新增颜色")
        add_color_btn.clicked.connect(self.add_new_color)
        layout.addWidget(add_color_btn)

        # 连接表格item修改信号
        self.table.itemChanged.connect(self.on_item_edited)

        # 底部提示
        layout.addWidget(QLabel("注：ID需唯一；16进制格式支持#RRGGBB（如#FF0000表示红色）"))

        # 确认/取消按钮
        btn_layout = QHBoxLayout()
        ok_btn = QPushButton("确定")
        ok_btn.clicked.connect(self.accept)
        cancel_btn = QPushButton("取消")
        cancel_btn.clicked.connect(self.reject)
        btn_layout.addStretch()
        btn_layout.addWidget(ok_btn)
        btn_layout.addWidget(cancel_btn)
        layout.addLayout(btn_layout)

        self.setLayout(layout)

    def add_new_color(self):
        new_id = self.generate_unique_id()
        new_color = QColor("#FFFFFF")  # 默认白色
        self.color_palette[new_id] = new_color  # 确保添加到色卡

        row = self.table.rowCount()
        self.table.insertRow(row)  # 插入新行

        # ID列（可编辑）
        id_item = QTableWidgetItem(new_id)
        id_item.setFlags(id_item.flags() | Qt.ItemIsEditable)
        self.table.setItem(row, 0, id_item)

        # 颜色预览列（关键修复：强制更新样式）
        color_label = QLabel()
        color_label.setFixedSize(70, 30)
        color_style = f"background-color: {new_color.name()}; border: 1px solid #666; border-radius: 4px"
        color_label.setStyleSheet(color_style)
        color_label.update()  # 强制刷新样式
        self.table.setCellWidget(row, 1, color_label)

        # 16进制色值列（可编辑）
        hex_item = QTableWidgetItem(new_color.name())
        hex_item.setFlags(hex_item.flags() | Qt.ItemIsEditable)
        self.table.setItem(row, 2, hex_item)

        # 操作列（删除按钮）
        del_btn = QPushButton("删除")
        del_btn.clicked.connect(lambda _, r=row: self.delete_row(r))
        self.table.setCellWidget(row, 3, del_btn)

    def generate_unique_id(self):
        existing_ids = set(self.color_palette.keys())
        # 扩展支持小写字母和更多符号（如a-z）
        chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

        # 单字符ID
        for c in chars:
            if c not in existing_ids:
                return c

        # 双字符ID（覆盖更多组合）
        for c1 in chars:
            for c2 in chars:
                new_id = c1 + c2
                if new_id not in existing_ids:
                    return new_id

        # 三字符ID（极端情况）
        for c1 in chars:
            for c2 in chars:
                for c3 in chars:
                    new_id = c1 + c2 + c3
                    if new_id not in existing_ids:
                        return new_id

        # 最终 fallback（理论上不会执行）
        return f"ID_{len(existing_ids)}"

    """加载色卡数据到表格"""

    def load_palette(self):
        """加载色卡数据到表格"""
        self.table.setRowCount(len(self.color_palette))
        for row, (key, color) in enumerate(sorted(self.color_palette.items())):
            # ID列（可编辑）
            id_item = QTableWidgetItem(key)
            id_item.setFlags(id_item.flags() | Qt.ItemIsEditable)
            self.table.setItem(row, 0, id_item)

            # 颜色预览列
            color_label = QLabel()
            color_label.setFixedSize(70, 30)
            color_style = f"background-color: {color.name()}; border: 1px solid #666; border-radius: 4px"
            color_label.setStyleSheet(color_style)
            self.table.setCellWidget(row, 1, color_label)

            # 绑定点击事件
            color_label.mousePressEvent = lambda event, r=row, k=key: on_color_clicked(event, r, k)

            # 添加悬停效果（可选）
            color_label.setProperty("color_key", key)
            color_label.setCursor(Qt.PointingHandCursor)

            def on_color_clicked(event, row, key):
                # 获取当前颜色
                color = self.color_palette[key]
                # 显示颜色选择对话框
                color_dialog = QColorDialog(color, self)
                color_dialog.setOption(QColorDialog.ShowAlphaChannel)

                if color_dialog.exec_() == QColorDialog.Accepted:
                    # 更新颜色
                    new_color = color_dialog.selectedColor()
                    self.color_palette[key] = new_color
                    # 更新表格中的颜色预览
                    color_label = self.table.cellWidget(row, 1)
                    new_color_style = f"background-color: {new_color.name()}; border: 1px solid #666; border-radius: 4px"
                    color_label.setStyleSheet(new_color_style)
                    # 更新十六进制色值列
                    hex_item = self.table.item(row, 2)
                    hex_item.setText(new_color.name())
                    self.update_block(key, new_color)

                    print("update_legend6")
                    self.update_legend()

            # 16进制色值列（可编辑）
            hex_item = QTableWidgetItem(color.name())  # 显示#RRGGBB格式
            hex_item.setFlags(hex_item.flags() | Qt.ItemIsEditable)
            self.table.setItem(row, 2, hex_item)

            # 操作列（删除按钮）
            del_btn = QPushButton("删除")
            del_btn.clicked.connect(lambda _, r=row: self.delete_row(r))
            self.table.setCellWidget(row, 3, del_btn)

    def on_item_edited(self, item):
        """处理表格内容修改"""
        row = item.row()
        current_id = self.table.item(row, 0).text().strip()
        current_color = self.color_palette[current_id]

        if item.column() == 0:
            # ID编辑校验（保持唯一）
            new_id = item.text().strip()
            if new_id in self.color_palette and new_id != current_id:
                QMessageBox.warning(self, "错误", "ID已存在，请使用唯一ID！")
                item.setText(current_id)  # 恢复原ID
                return
            # 更新color_palette的键
            self.color_palette[new_id] = self.color_palette.pop(current_id)

        elif item.column() == 2:
            # 16进制色值编辑校验
            new_hex = item.text().strip()
            if not self.validate_hex_color(new_hex):
                QMessageBox.warning(self, "错误", "无效的16进制色值！\n正确格式：#RRGGBB（如#FF0000）")
                item.setText(current_color.name())  # 恢复原始色值
                return

            # 更新颜色值
            new_color = QColor(new_hex)
            if not new_color.isValid():
                QMessageBox.warning(self, "错误", "无效的颜色值！")
                item.setText(current_color.name())
                return

            # 更新颜色预览
            color_label = self.table.cellWidget(row, 1)
            color_style = f"background-color: {new_color.name()}; border: 1px solid #666; border-radius: 4px"
            color_label.setStyleSheet(color_style)

            # 更新color_palette
            self.color_palette[current_id] = new_color

    @staticmethod
    def validate_hex_color(hex_str):
        """验证#RRGGBB格式"""
        if not hex_str.startswith('#') or len(hex_str) != 7:
            return False
        hex_body = hex_str[1:]
        try:
            int(hex_body, 16)  # 验证是否为有效16进制数
            return True
        except ValueError:
            return False

    def delete_row(self, row):
        """删除行"""
        if self.table.rowCount() <= 1:
            QMessageBox.warning(self, "提示", "至少保留一个颜色！")
            return
        deleted_id = self.table.item(row, 0).text()
        del self.color_palette[deleted_id]
        self.table.removeRow(row)

    def get_updated_palette(self):
        """返回更新后的色卡"""
        return self.color_palette


class ColorBlockPage(QWidget):


    number_image = Signal(int, QImage)

    def __init__(self, parent=None):
        super().__init__(parent)
        # 初始化变量
        self.image_path = None
        # 原始图
        self.original_pixmap = None
        # 修改后
        # self.processed_pixmap = None
        self.original_pixmapWidth = 770  # 图片宽
        self.original_pixmapHeight = 770
        self.horizontal_blocks = 70  # 水平块数
        self.vertical_blocks = 70  # 垂直块数
        self.block_width = 10  # 块宽
        self.block_height = 10  # 块高
        self.save_scale = 10  # 保存图片时
        self.boxNumber = 100

        self.color_palette = {}
        self.image_data = None
        self.show_grid = True
        self.show_ColorCode = True
        self.show_selectLayer = False
        self.change_ColorCode = False
        self.palette_array = None
        self.use_dithering = False
        self.current_scale = 1.0
        self.grid_visible = True
        self._palette_lab_cache = None
        self.block_labels = []  # 存储所有色块信息
        self.select_current_rect = None
        self.selected_color_data = {}
        self.legend_table_data = []

        # 区域选择相关变量 - 保留变量定义，但移除对 scene 的操作
        self.is_selecting = False
        self.selection_start = None
        self.selection_end = None
        self.selected_blocks = []
        self.selected_data = []

        self.is_dragging = False
        self.drag_start_pos = None
        self.drag_start_rect_pos = None

        self.drag_start_scene_pos = None
        # 保存选择框的场景坐标（初始位置）
        self.drag_start_rect_scene_pos = None
        # 保存操作栏的场景坐标（初始位置）
        self.drag_start_opbar_scene_pos = None
        self.fileName = ""

        self.hspinbox_being_edited = False  # 添加标志位

        self.vspinbox_being_edited = False  # 添加标志位


        # 不再在这里初始化 selection_rect

        # 创建主界面
        # self.main_widget = QWidget()
        # self.setCentralWidget(self.main_widget)
        self.main_layout = QVBoxLayout()
        self.content_layout = QHBoxLayout()
        self.setLayout(self.main_layout)

        # 设置界面组件
        # self.setup_menubar()
        self.setup_control_panel()
        self.setup_preview_area()  # 确保在 setup_preview_area 之后再使用 scene
        self.setup_color_legend()
        self.init_mixed_palette()
        self.main_layout.addLayout(self.content_layout)

        # 修改初始化色卡逻辑
        self.default_palette_path = self.get_palette_config_path()
        self.load_palette_config()  # 替换原来的 init_mixed_palette

    """获取色卡配置文件路径"""
    def get_palette_config_path(self):
        config_dir = QStandardPaths.writableLocation(QStandardPaths.AppDataLocation)
        if not os.path.exists(config_dir):
            os.makedirs(config_dir)
        return os.path.join(config_dir, "last_palette.xsd")

    """加载色卡配置（启动时自动调用）"""
    def load_palette_config(self):
        """加载色卡配置（启动时自动调用）"""
        if os.path.exists(self.default_palette_path):
            loaded = ColorPaletteManager.load_from_xsd(self.default_palette_path)
            if loaded:
                self.color_palette = loaded
                self.update_palette_array()

                print("update_legend7")
                self.update_legend()
                self._palette_lab_cache = None
                print("已加载上次保存的色卡配置")
                return

        # 加载失败时使用默认色卡
        print("使用默认色卡配置")
        self.init_mixed_palette()

    """设置菜单栏"""
    def setup_menubar(self):
        menubar = QMenuBar(self)

        # 文件菜单
        file_menu = menubar.addMenu("文件")

        open_action = QAction("打开图像", self)
        open_action.triggered.connect(self.upload_image)
        file_menu.addAction(open_action)

        save_action = QAction("保存结果", self)
        save_action.triggered.connect(self.save_result)
        file_menu.addAction(save_action)

        save_xsd_action = QAction("保存色块信息为XSD", self)
        save_xsd_action.triggered.connect(self.save_blocks_to_xsd)
        file_menu.addAction(save_xsd_action)

        open_xsd_action = QAction("打开XSD文件", self)
        open_xsd_action.triggered.connect(self.open_blocks_from_xsd)
        file_menu.addAction(open_xsd_action)

        file_menu.addSeparator()

        exit_action = QAction("退出", self)
        exit_action.triggered.connect(self.close)
        file_menu.addAction(exit_action)

        # 视图菜单
        view_menu = menubar.addMenu("视图")

        self.toggle_grid_action = QAction("切换网格", self, checkable=True)
        self.toggle_grid_action.setChecked(True)
        self.toggle_grid_action.triggered.connect(self.toggle_grid)
        view_menu.addAction(self.toggle_grid_action)

    """初始化默认色卡"""
    def init_mixed_palette(self):
        """初始化默认色卡"""
        self.color_palette = {

            "1": QColor("#fba3af"),
            "2": QColor("#e382ad"),
            "3": QColor("#dc5787"),
            "4": QColor("#db1923"),
            "5": QColor("#c31e10"),
            "6": QColor("#ac1c0c"),
            "7": QColor("#e94380"),
            "8": QColor("#e869ed"),
            "9": QColor("#ffe0de"),
            "10": QColor("#e5d7b6"),
            "11": QColor("#f6f7e6"),
            "12": QColor("#fffdc7"),
            "13": QColor("#ffe34c"),
            "14": QColor("#ffc52c"),
            "15": QColor("#efb30d"),
            "16": QColor("#c45a34"),
            "17": QColor("#fd7500"),
            "18": QColor("#f92f2f"),
            "19": QColor("#d795a9"),
            "20": QColor("#a362c9"),
            "21": QColor("#7324a1"),
            "22": QColor("#a8f8f4"),
            "23": QColor("#71c2fd"),
            "24": QColor("#0b7da2"),
            "25": QColor("#1010bb"),
            "26": QColor("#0172c8"),
            "27": QColor("#57508c"),
            "28": QColor("#060653"),
            "29": QColor("#8fff79"),
            "30": QColor("#5db59a"),
            "31": QColor("#878761"),
            "32": QColor("#475538"),
            "33": QColor("#c7a877"),
            "34": QColor("#ad845a"),
            "35": QColor("#6e361b"),
            "36": QColor("#371c15"),
            "37": QColor("#ffffff"),
            "38": QColor("#d8d6e9"),
            "39": QColor("#676961"),
            "40": QColor("#3b3641"),
            "41": QColor("#000000"),
            "42": QColor("#007d29"),
            "43": QColor("#1ebd46"),
            "44": QColor("#f85e34"),
            "45": QColor("#8eb22c"),
            "46": QColor("#78de7d"),
            "47": QColor("#d1ed04"),
            "48": QColor("#16438c"),
            "49": QColor("#016557"),
            "50": QColor("#ff9624"),
            "51": QColor("#e4622a"),
            "52": QColor("#da8c58"),
            "53": QColor("#cd7d2b"),
            "54": QColor("#ffa588"),
            "55": QColor("#ff9688"),
            "56": QColor("#a0a297"),
            "57": QColor("#cd5725"),
            "58": QColor("#ad4323"),
            "59": QColor("#a15b25"),
            "60": QColor("#ffc87c"),
            "61": QColor("#985d4b")
        }
        self.update_palette_array()
        print("update_legend8")
        self.update_legend()

    """设置控制面板"""
    def setup_control_panel(self):
        """设置控制面板"""
        control_panel = QWidget()
        control_layout = QHBoxLayout()
        control_panel.setLayout(control_layout)

        # 上传图像按钮
        self.upload_btn = QPushButton("打开图像")
        self.upload_btn.clicked.connect(self.upload_image)
        control_layout.addWidget(self.upload_btn)

        # 加载色块信息按钮
        self.load_blocks_btn = QPushButton("加载色块信息")
        self.load_blocks_btn.clicked.connect(self.open_blocks_from_xsd)
        control_layout.addWidget(self.load_blocks_btn)

        # 水平色块数量
        h_spinTitle = QLabel("宽(格):")
        h_spinTitle.setAlignment(Qt.AlignRight| Qt.AlignVCenter)
        h_spinTitle.setFixedWidth(40)
        control_layout.addWidget(h_spinTitle)

        self.h_spin = QSpinBox()
        self.h_spin.setFixedWidth(60)
        self.h_spin.setRange(1, 1000)
        self.h_spin.setValue(self.horizontal_blocks)
        self.h_spin.editingFinished.connect(self.changed_hSpinValue)
        control_layout.addWidget(self.h_spin)

        # 垂直色块数量
        v_spinTitle = QLabel("高(格):")
        v_spinTitle.setAlignment(Qt.AlignRight| Qt.AlignVCenter)
        v_spinTitle.setFixedWidth(40)
        control_layout.addWidget(v_spinTitle)

        self.v_spin = QSpinBox()
        self.v_spin.setFixedWidth(60)
        self.v_spin.setRange(1, 1000)
        self.v_spin.setValue(self.vertical_blocks)
        self.v_spin.editingFinished.connect(self.changed_vSpinValue)
        control_layout.addWidget(self.v_spin)

        # 抖动复选框
        self.dither_check = QCheckBox("抖动")
        self.dither_check.stateChanged.connect(self.toggle_dithering)
        # control_layout.addWidget(self.dither_check)

        # # 显示线条复选框
        # self.showColorCode_check = QCheckBox("显示色块")
        # self.showColorCode_check.setChecked(self.show_ColorCode)
        # self.showColorCode_check.stateChanged.connect(self.toggle_sColorCode)
        # control_layout.addWidget(self.showColorCode_check)

        # # 显示线条复选框
        # self.showGrid_check = QCheckBox("显示线条")
        # self.showGrid_check.setChecked(self.show_grid)
        # self.showGrid_check.stateChanged.connect(self.toggle_showGrid)
        # control_layout.addWidget(self.showGrid_check)
        #
        #
        # 显示线条复选框
        self.showSelect_check = QCheckBox("修改色块")
        self.showSelect_check.setChecked(self.change_ColorCode)
        self.showSelect_check.stateChanged.connect(self.toggle_changeColorCode)
        control_layout.addWidget(self.showSelect_check)

        # 显示线条复选框
        self.showSelect_check = QCheckBox("框选")
        self.showSelect_check.setChecked(self.show_selectLayer)
        self.showSelect_check.stateChanged.connect(self.toggle_showSelectLayer)
        control_layout.addWidget(self.showSelect_check)

        # 色卡菜单按钮
        self.btn_menu = QPushButton("色卡")
        self.btn_menu.setMenu(self.create_palette_menu())
        control_layout.addWidget(self.btn_menu)

        # # 缩放按钮
        # self.zoom_in_btn = QPushButton("放大")
        # self.zoom_in_btn.setFixedWidth(60)
        # self.zoom_in_btn.clicked.connect(self.zoom_in)
        # control_layout.addWidget(self.zoom_in_btn)
        #
        # self.zoom_out_btn = QPushButton("缩小")
        # self.zoom_out_btn.setFixedWidth(60)
        # self.zoom_out_btn.clicked.connect(self.zoom_out)
        # control_layout.addWidget(self.zoom_out_btn)

        # 保存按钮
        self.save_btn = QPushButton("保存打印图")
        self.save_btn.clicked.connect(self.save_result)
        control_layout.addWidget(self.save_btn)

        # 保存按钮
        self.save_wgbtn = QPushButton("设计图封面")
        self.save_wgbtn.clicked.connect(self.save_wgresult)
        control_layout.addWidget(self.save_wgbtn)

        control_layout.addStretch(1)


        self.main_layout.addWidget(control_panel)

    """设置图像预览区域"""

    def setup_preview_area(self):
        """设置图像预览区域"""
        self.scene = QGraphicsScene(self)
        # 主视图
        self.view = QGraphicsView(self.scene)
        self.view.setRenderHint(QPainter.Antialiasing)
        self.view.setRenderHint(QPainter.SmoothPixmapTransform)
        self.view.setDragMode(QGraphicsView.ScrollHandDrag)
        self.view.setTransformationAnchor(QGraphicsView.AnchorUnderMouse)
        self.view.setResizeAnchor(QGraphicsView.AnchorUnderMouse)

        # 关键设置：拖动模式和光标
        self.view.setDragMode(QGraphicsView.ScrollHandDrag)
        # 初始光标设置
        self.view.setCursor(Qt.ArrowCursor)
        # 设置边距
        self.margin = 30  # back_widget 与 pixmap_item 的间距

        # 创建背景项作为容器
        self.back_widget = QGraphicsRectItem()
        self.back_widget.setPos(self.margin, self.margin)  # 设置边距
        self.scene.addItem(self.back_widget)

        # 图像项 - 添加到 back_widget 中
        self.pixmap_item = QGraphicsPixmapItem()
        self.pixmap_item.setParentItem(self.back_widget)
        self.pixmap_item.setPos(0, 0)  # 相对于 back_widget 的位置

        # 网格图层项 - 添加到 back_widget 中，间距为0
        self.grid_layer = QGraphicsPixmapItem()
        self.grid_layer.setZValue(2)  # 确保网格显示在图像上方
        self.grid_layer.setParentItem(self.back_widget)
        self.grid_layer.setPos(0, 0)  # 相对于 back_widget 的位置

        # 区域选择视觉反馈
        self.selection_rect = QGraphicsRectItem()
        # self.selection_rect = QGraphicsPixmapItem()
        self.selection_rect.setPen(QPen(QColor(255, 0, 0, 150), 2, Qt.DashLine))
        self.selection_rect.setParentItem(self.back_widget)
        self.selection_rect.hide()

        # 预览布局部件
        self.preview_widget = QWidget()
        self.preview_layout = QGridLayout(self.preview_widget)
        self.preview_layout.setContentsMargins(0, 0, 0, 0)
        self.preview_layout.setSpacing(0)

        # 使用 QGraphicsProxyWidget 将 QWidget 添加到场景
        self.proxy_widget = QGraphicsProxyWidget()
        self.proxy_widget.setWidget(self.preview_widget)
        self.proxy_widget.setParentItem(self.back_widget)
        self.proxy_widget.setPos(0, 0)  # 与图像项对齐
        self.proxy_widget.setZValue(1)  # 确保标签显示在图像上方但在网格下方

        # 选择层 - 修改为可交互
        self.preview_selectWidget = QWidget()
        self.preview_selectWidget.setStyleSheet("background-color: rgba(0, 0, 0, 5);")
        self.preview_selectLayout = QGridLayout(self.preview_selectWidget)
        self.preview_selectLayout.setContentsMargins(0, 0, 0, 0)
        self.preview_selectLayout.setSpacing(0)

        # 添加鼠标事件处理
        self.preview_selectWidget.mousePressEvent = self.on_select_layer_press
        self.preview_selectWidget.mouseMoveEvent = self.on_select_layer_move
        self.preview_selectWidget.mouseReleaseEvent = self.on_select_layer_release

        # 选择框可视化
        self.select_rect = QWidget(self.preview_selectWidget)
        # self.select_rect.setStyleSheet("background-color: rgba(255, 255, 255, 50); ")

        self.select_rect.setStyleSheet("""
            background-color: rgba(255, 255, 255, 50); 
        """)
        self.select_rect.hide()
        self.select_layout = QVBoxLayout(self.select_rect)  # 垂直布局或流式布局
        self.select_layout.setContentsMargins(2, 2, 2, 2)
        self.select_layout.setSpacing(0)

        self.proxy_selectWidget = QGraphicsProxyWidget()
        self.proxy_selectWidget.setWidget(self.preview_selectWidget)
        self.proxy_selectWidget.setParentItem(self.back_widget)
        self.proxy_selectWidget.setPos(0, 0)
        self.proxy_selectWidget.setZValue(3)  # 确保在最上层
        self.proxy_selectWidget.setVisible(self.show_selectLayer)

        # 操作栏
        self.operation_bar = QWidget()
        self.operation_bar.setStyleSheet("background-color: rgba(30, 30, 30, 255);")  # 半透明蓝色
        self.operation_bar.setFixedSize(130, 25)  # 宽度 250，高度 50
        self.operation_layout = QHBoxLayout()

        # 关键修改：设置布局水平 + 垂直居中
        self.operation_layout.setAlignment(Qt.AlignCenter)  # 替代原 Qt.AlignVCenter
        self.operation_layout.setContentsMargins(0, 0, 0, 0)
        self.operation_layout.setSpacing(5)

        self.vLayout = QVBoxLayout()
        self.vLayout.setAlignment(Qt.AlignVCenter)
        self.vLayout.addLayout(self.operation_layout)
        self.vLayout.setContentsMargins(0, 0, 0, 0)
        self.operation_bar.setLayout(self.vLayout)

        # 统一按钮样式
        button_style = "QPushButton {background-color: rgba(40,40,40,255); padding: 0px; margin: 0px; }"

        # 添加按钮前先加左侧伸缩
        self.operation_layout.addStretch()  # 左侧伸缩

        # 拖动按钮
        self.drag_btn = QPushButton()
        self.drag_btn.setIcon(QIcon("image/move.png"))
        self.drag_btn.setIconSize(QSize(15, 15))
        self.drag_btn.setFixedSize(20, 20)
        self.drag_btn.setStyleSheet(button_style)
        self.operation_layout.addWidget(self.drag_btn)
        # self.drag_btn.clicked.connect(self.start_drag_mode)  # 添加点击事件处理函数

        self.drag_btn.mousePressEvent = self.start_drag_mode  # 按下时触发
        self.drag_btn.mouseMoveEvent = self.on_drag_move
        self.drag_btn.mouseReleaseEvent = self.on_drag_release

        # 左右反转按钮
        self.flip_horizontal_btn = QPushButton()
        self.flip_horizontal_btn.setIcon(QIcon("image/LRMirroring.png"))
        self.flip_horizontal_btn.setIconSize(QSize(15, 15))
        self.flip_horizontal_btn.setFixedSize(20, 20)  # 调整宽度以适应文本
        self.flip_horizontal_btn.setStyleSheet(button_style)
        self.operation_layout.addWidget(self.flip_horizontal_btn)
        self.flip_horizontal_btn.clicked.connect(self.flip_horizontal_selection)  # 添加点击事件处理函数

        # 上下反转按钮
        self.flip_vertical_btn = QPushButton()
        self.flip_vertical_btn.setIcon(QIcon("image/UDMirroring.png"))
        self.flip_vertical_btn.setIconSize(QSize(15, 15))
        self.flip_vertical_btn.setFixedSize(20, 20)
        self.flip_vertical_btn.setStyleSheet(button_style)
        self.operation_layout.addWidget(self.flip_vertical_btn)
        self.flip_vertical_btn.clicked.connect(self.flip_vertical_selection)  # 添加点击事件处理函数
        # 选择色卡
        self.seka_btn = QPushButton()
        self.seka_btn.setIcon(QIcon("image/sk_icon.png"))
        self.seka_btn.setIconSize(QSize(15, 15))
        self.seka_btn.setFixedSize(20, 20)
        self.seka_btn.setStyleSheet(button_style)
        self.operation_layout.addWidget(self.seka_btn)
        self.seka_btn.clicked.connect(self.openskView)  # 添加点击事件处理函数

        # 保存按钮
        self.drag_saveBtn = QPushButton()
        self.drag_saveBtn.setIcon(QIcon("image/save.png"))
        self.drag_saveBtn.setIconSize(QSize(15, 15))
        self.drag_saveBtn.setFixedSize(20, 20)
        self.drag_saveBtn.setStyleSheet(button_style)
        self.operation_layout.addWidget(self.drag_saveBtn)
        self.drag_saveBtn.clicked.connect(self.drag_saveAction)  # 添加点击事件处理函数

        # 取消按钮
        self.exit_btn = QPushButton()
        self.exit_btn.setIcon(QIcon("image/exit.png"))
        self.exit_btn.setIconSize(QSize(15, 15))
        self.exit_btn.setFixedSize(20, 20)
        self.exit_btn.setStyleSheet(button_style)
        self.operation_layout.addWidget(self.exit_btn)
        self.exit_btn.clicked.connect(self.exit_tabbar)  # 添加点击事件处理函数

        # 添加右侧伸缩
        self.operation_layout.addStretch(1)  # 右侧伸缩

        self.operation_bar.hide()
        self.proxy_operation_bar = QGraphicsProxyWidget()
        self.proxy_operation_bar.setWidget(self.operation_bar)
        self.proxy_operation_bar.setParentItem(self.back_widget)
        self.proxy_operation_bar.setZValue(3)

        # 主容器
        container = QWidget()
        layout = QVBoxLayout(container)
        layout.setContentsMargins(0, 0, 0, 0)  # view 与 back_widget 间距为0
        layout.addWidget(self.view)

        # 滚动区域
        scroll_area = QScrollArea()
        scroll_area.setWidgetResizable(True)
        scroll_area.setWidget(container)

        self.content_layout.addWidget(scroll_area)


    """设置色卡图例显示"""
    def setup_color_legend(self):
        """设置色卡图例显示（自定义流式布局版）"""

        self.control_panel = QWidget()
        self.control_panel.setFixedWidth(220)
        self.control_layout = QVBoxLayout()
        self.control_panel.setLayout(self.control_layout)
        # 创建色卡框架
        # self.legend_frame = QFrame()
        # self.legend_frame.setFixedWidth(220)
        # self.legend_frame.setFrameShape(QFrame.StyledPanel)
        # self.legend_frame.setFrameShadow(QFrame.Raised)
        # self.legend_frame.setContentsMargins(5, 10, 10, 5)

        # 创建色卡框架 - 使用QWidget替代QFrame
        self.legend_frame = QWidget()
        self.legend_frame.setFixedWidth(220)
        self.legend_frame.setContentsMargins(5, 10, 10, 5)

        self.legend_frame.setStyleSheet("QTableWidget { border: none; }")
        self.legend_frame.setStyleSheet("QFrame { border: none; }")

        tool_layout = QHBoxLayout()

        # 设置布局边距（左, 上, 右, 下）
        tool_layout.setContentsMargins(10, 0, 10, 5)  # 外边距
        # 设置布局内所有控件的对齐方式
        tool_layout.setAlignment(Qt.AlignVCenter)  # 添加垂直居中对齐

        h_unitTitle = QLabel("每包数量:")
        h_unitTitle.setAlignment(Qt.AlignRight | Qt.AlignVCenter)  # 同时设置水平和垂直居中
        h_unitTitle.setFixedWidth(60)
        tool_layout.addWidget(h_unitTitle)

        self.h_unitSpin = QSpinBox()
        self.h_unitSpin.setFixedWidth(60)
        self.h_unitSpin.setRange(1, 1000)
        self.h_unitSpin.setValue(self.boxNumber)
        self.h_unitSpin.valueChanged.connect(self.changed_boxNumberValue)
        tool_layout.addWidget(self.h_unitSpin)
        tool_layout.addStretch(1)

        self.control_layout.addLayout(tool_layout)

        self.control_layout.addWidget(self.legend_frame)

        # 添加到主布局
        self.content_layout.addWidget(self.control_panel)

    def keyPressEvent(self, event):
        if event.key() == Qt.Key_F2:
            print("F2 键被按下！")
            self.show_ColorCode != self.show_ColorCode
            self.show_grid = self.show_ColorCode

            self.preview_widget.setVisible(self.show_ColorCode)

            self.grid_layer.setVisible(self.show_grid)
            if self.show_grid and self.original_pixmap:
                self.draw_grid()

            event.accept()  # 接受事件，防止被父类处理
    """更新预计算的色卡数组时清空缓存"""
    def update_palette_array(self):
        """更新预计算的色卡数组时清空缓存"""
        self._palette_lab_cache = None  # 确保色卡更新后缓存失效
        """更新预计算的色卡数组"""
        self.palette_array = np.array([[c.red(), c.green(), c.blue(), c.alpha()]
                                       for c in self.color_palette.values()])

    """更新色卡图例显示"""

    # def update_legend(self):
    #     """更新色卡图例，显示颜色使用数量"""
    #
    #     # 强制处理所有待处理的UI事件，确保界面立即更新
    #     QApplication.processEvents()
    #     self.legend_table_data = []
    #     # 清除旧图例
    #     if hasattr(self, 'legend_table'):
    #         self.legend_table.setRowCount(0)
    #     else:
    #         # 创建表格
    #         self.legend_table = QTableWidget()
    #         self.legend_table.setColumnCount(4)  # 设置为4列
    #         self.legend_table.setHorizontalHeaderLabels(["", "Code", "No.", "Bag."])
    #
    #         self.legend_table.setStyleSheet(f"""
    #             QTableWidget {{ border: none; }}
    #         """)
    #
    #         # QTableWidget::item
    #         # {{
    #         #     border: none;
    #         # border - right: 1
    #         # px
    #         # solid  # CCCCCC;  /* 右侧边框 */
    #         # border - bottom: 1
    #         # px
    #         # solid  # CCCCCC; /* 底部边框 */
    #         # }}
    #
    #         # 设置列宽和调整模式
    #         self.legend_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Interactive)
    #         self.legend_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Interactive)
    #         self.legend_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Interactive)
    #         self.legend_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Interactive)
    #
    #         self.legend_table.setColumnWidth(0, 50)
    #         self.legend_table.setColumnWidth(1, 50)  # 色样列宽度
    #         self.legend_table.setColumnWidth(2, 50)  # Bag.列宽度
    #         self.legend_table.setColumnWidth(3, 50)  # 数量列宽度
    #
    #         # 隐藏顶部和左侧标签
    #         self.legend_table.horizontalHeader().setVisible(False)  # 隐藏顶部标签
    #         self.legend_table.verticalHeader().setVisible(False)  # 隐藏左侧标签
    #
    #         # 去除表格外框
    #         # self.legend_table.setStyleSheet("QTableWidget { border: none; }")
    #
    #         # 替换原来的图例布局
    #         if hasattr(self, 'legend_frame'):
    #             # 清除现有布局
    #             layout = self.legend_frame.layout()
    #             if layout:
    #                 layout.setStyleSheet("QTableWidget { border: none; }")
    #                 for i in reversed(range(layout.count())):
    #                     item = layout.itemAt(i)
    #                     if item.widget():
    #                         item.widget().deleteLater()
    #                     else:
    #                         layout.removeItem(item)
    #             else:
    #                 layout = QVBoxLayout(self.legend_frame)
    #                 layout.setContentsMargins(5, 0, 0, 5)
    #
    #                 # layout.setStyleSheet("QTableWidget { border: none; }")
    #
    #             # 添加表格到布局
    #             layout.addWidget(self.legend_table)
    #         else:
    #             # 如果没有legend_frame，创建它
    #             self.legend_frame = QFrame()
    #             layout = QVBoxLayout(self.legend_frame)
    #             layout.setContentsMargins(5, 0, 0, 5)
    #             layout.addWidget(self.legend_table)
    #             layout.setStyleSheet("QTableWidget { border: none; }  QFrame { border: none; }")
    #
    #             # 确保legend_frame被添加到主布局中
    #             if hasattr(self, 'main_layout') and isinstance(self.main_layout, QLayout):
    #                 self.main_layout.addWidget(self.legend_frame)
    #
    #     # 添加标题行
    #     self.legend_table.insertRow(0)
    #
    #     # 标题行样式
    #     header_bg = QBrush(QColor(240, 240, 240))
    #
    #     # 标题行 - ID
    #     header_item0 = QTableWidgetItem("    ")
    #     header_item0.setFlags(header_item0.flags() & ~Qt.ItemIsEditable)
    #     header_item0.setTextAlignment(Qt.AlignCenter)
    #     # header_item0.setBackground(header_bg)
    #     self.legend_table.setItem(0, 0, header_item0)
    #
    #     # 标题行 - Code
    #     header_item1 = QTableWidgetItem("Code")
    #     header_item1.setFlags(header_item1.flags() & ~Qt.ItemIsEditable)
    #     header_item1.setTextAlignment(Qt.AlignCenter)
    #     # header_item1.setBackground(header_bg)
    #     self.legend_table.setItem(0, 1, header_item1)
    #
    #     # 标题行 - Bag.
    #     header_item2 = QTableWidgetItem("No.")
    #     header_item2.setFlags(header_item2.flags() & ~Qt.ItemIsEditable)
    #     header_item2.setTextAlignment(Qt.AlignCenter)
    #     # header_item2.setBackground(header_bg)
    #     self.legend_table.setItem(0, 2, header_item2)
    #
    #     # 标题行 - No.
    #     header_item3 = QTableWidgetItem("Bag.")
    #     header_item3.setFlags(header_item3.flags() & ~Qt.ItemIsEditable)
    #     header_item3.setTextAlignment(Qt.AlignCenter)
    #     # header_item3.setBackground(header_bg)
    #     self.legend_table.setItem(0, 3, header_item3)
    #
    #     self.legend_table_data.append([
    #         {"title": None, "color": "black", "background": None},
    #         {"title": "Code", "color": "black", "background": None},
    #         {"title": "No.", "color": "black", "background": None},
    #         {"title": "Bag.", "color": "black", "background": None}])
    #
    #     # 获取颜色使用计数
    #     color_counts = self.count_color_usage()
    #
    #     # 排序逻辑（数字优先，字母在后）
    #     def sort_key(item):
    #         key = item[0]
    #         try:
    #             return (0, int(key))  # 数字键排序
    #         except ValueError:
    #             return (1, key)  # 字母键排序
    #
    #     # 遍历排序后的色卡
    #     sorted_items = sorted(self.color_palette.items(), key=sort_key)
    #     table_row = 1
    #     for row, (key, color) in enumerate(sorted_items):
    #         # 数量列（可编辑）
    #         count = color_counts.get(key, 0)
    #         if count == 0:
    #             continue  # 跳过计数为0的颜色
    #         count = count // self.boxNumber +1
    #
    #
    #         # 插入新行
    #         self.legend_table.insertRow(table_row)
    #
    #         # ID列 - 使用key作为ID
    #         id_item = QTableWidgetItem(str(table_row))
    #         id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)
    #         id_item.setTextAlignment(Qt.AlignCenter)
    #         self.legend_table.setItem(table_row, 0, id_item)
    #
    #         # 色样列 - 使用布局确保居中
    #         if key in self.selected_color_data:
    #             dic = self.selected_color_data[key]
    #             title = dic["title"]
    #             text_color = dic["text_color"]
    #         else:
    #             title = self._num_to_alphabet(len(self.selected_color_data)+1)
    #             brightness = (color.red() * 299 +
    #                           color.green() * 587 +
    #                           color.blue() * 114) / 1000
    #             text_color = "white" if brightness < 128 else "black"
    #             self.selected_color_data[key] = {"title": title, "text_color": text_color, "color": color, "key": key,
    #                                                      "count": 1, "back_color": color}
    #
    #         color_label = QLabel(title)
    #         color_label.setFixedSize(20, 20)  # 调整色样大小
    #         color_style = f"color:{text_color}; background-color: {color.name()}; border: 1px solid #666; border-radius: 4px"
    #         color_label.setStyleSheet(color_style)
    #         color_label.setAlignment(Qt.AlignCenter)
    #
    #         # 创建容器并使用布局居中
    #         color_widget = QWidget()
    #         color_layout = QHBoxLayout(color_widget)
    #         color_layout.setAlignment(Qt.AlignCenter)
    #         color_layout.setContentsMargins(0, 0, 0, 0)
    #         color_layout.addWidget(color_label)
    #
    #         self.legend_table.setCellWidget(table_row, 1, color_widget)
    #
    #         # Bag.列 - 使用key作为Bag.内容
    #         bag_item = QTableWidgetItem(key)
    #         bag_item.setFlags(bag_item.flags() & ~Qt.ItemIsEditable)
    #         bag_item.setTextAlignment(Qt.AlignCenter)
    #         self.legend_table.setItem(table_row, 2, bag_item)
    #
    #         # 数量列（可编辑）
    #         count_item = QTableWidgetItem(str(count))
    #         count_item.setFlags(count_item.flags() | Qt.ItemIsEditable)
    #         count_item.setTextAlignment(Qt.AlignCenter)
    #         self.legend_table.setItem(table_row, 3, count_item)
    #
    #         # 增加行计数器
    #         table_row += 1
    #
    #         self.legend_table_data.append([
    #             {"title": str(table_row), "color": "black", "background": None},
    #             {"title": title, "color": text_color, "background": color},
    #             {"title": key, "color": "black", "background": None},
    #             {"title": str(count), "color": "black", "background": None}])
    #
    #
    #
    #     sk_total_count = 0
    #     for row in range(self.legend_table.rowCount()):
    #         item = self.legend_table.item(row, 3)
    #         if item is not None:
    #             try:
    #                 value = int(item.text())
    #                 sk_total_count += value
    #             except ValueError:
    #                 print(f"无法将 '{item.text()}' 转换为整数，跳过该值")
    #         else:
    #             print("None")  # 单元格为空时
    #     print(f"色卡总计：{sk_total_count}")
    #     # 添加总计行
    #
    #     self.legend_table.insertRow(table_row)
    #     total_count_item = QTableWidgetItem(str(sk_total_count))
    #     total_count_item.setFlags(total_count_item.flags() & ~Qt.ItemIsEditable)
    #     total_count_item.setTextAlignment(Qt.AlignCenter)
    #     self.legend_table.setItem(table_row, 3, total_count_item)
    #
    #     self.legend_table_data.append([
    #         {"title": None, "color": "black", "background": None},
    #         {"title": None, "color": "black", "background": None},
    #         {"title": None, "color": "black", "background": None},
    #         {"title": str(sk_total_count), "color": "black", "background": None}])

    def update_legend(self):
        """更新色卡图例，显示颜色使用数量"""
        print("更新色卡图例")
        # 添加信号连接状态标志
        if not hasattr(self, 'legend_signal_connected'):
            self.legend_signal_connected = False
        # 强制处理所有待处理的UI事件，确保界面立即更新
        QApplication.processEvents()
        self.legend_table_data = []
        # 清除旧图例
        if hasattr(self, 'legend_table'):
            self.legend_table.setRowCount(0)

            # 安全断开信号连接
            if self.legend_signal_connected:
                try:
                    self.legend_table.cellChanged.disconnect(self.update_total_count)
                    self.legend_signal_connected = False
                except:
                    pass
        else:
            # 创建表格
            self.legend_table = QTableWidget()
            self.legend_table.setColumnCount(4)  # 设置为4列
            self.legend_table.setHorizontalHeaderLabels(["", "Code", "No.", "Bag."])

            self.legend_table.setStyleSheet(f"""
                QTableWidget {{ border: none; }}
            """)

            # 设置列宽和调整模式
            self.legend_table.horizontalHeader().setSectionResizeMode(0, QHeaderView.Interactive)
            self.legend_table.horizontalHeader().setSectionResizeMode(1, QHeaderView.Interactive)
            self.legend_table.horizontalHeader().setSectionResizeMode(2, QHeaderView.Interactive)
            self.legend_table.horizontalHeader().setSectionResizeMode(3, QHeaderView.Interactive)

            self.legend_table.setColumnWidth(0, 50)
            self.legend_table.setColumnWidth(1, 50)  # 色样列宽度
            self.legend_table.setColumnWidth(2, 50)  # Bag.列宽度
            self.legend_table.setColumnWidth(3, 50)  # 数量列宽度

            # 隐藏顶部和左侧标签
            self.legend_table.horizontalHeader().setVisible(False)  # 隐藏顶部标签
            self.legend_table.verticalHeader().setVisible(False)  # 隐藏左侧标签

            # 替换原来的图例布局
            if hasattr(self, 'legend_frame'):
                # 清除现有布局
                layout = self.legend_frame.layout()
                if layout:
                    layout.setStyleSheet("QTableWidget { border: none; }")
                    for i in reversed(range(layout.count())):
                        item = layout.itemAt(i)
                        if item.widget():
                            item.widget().deleteLater()
                        else:
                            layout.removeItem(item)
                else:
                    layout = QVBoxLayout(self.legend_frame)
                    layout.setContentsMargins(5, 0, 0, 5)

                # 添加表格到布局
                layout.addWidget(self.legend_table)
            else:
                # 如果没有legend_frame，创建它
                self.legend_frame = QFrame()
                layout = QVBoxLayout(self.legend_frame)
                layout.setContentsMargins(5, 0, 0, 5)
                layout.addWidget(self.legend_table)
                layout.setStyleSheet("QTableWidget { border: none; }  QFrame { border: none; }")

                # 确保legend_frame被添加到主布局中
                if hasattr(self, 'main_layout') and isinstance(self.main_layout, QLayout):
                    self.main_layout.addWidget(self.legend_frame)

            # 连接单元格变化信号到处理函数
            self.legend_table.cellChanged.connect(self.update_total_count)
            self.legend_signal_connected = True

        # 添加标题行
        self.legend_table.insertRow(0)

        # 标题行样式
        header_bg = QBrush(QColor(240, 240, 240))

        # 标题行 - ID
        header_item0 = QTableWidgetItem("    ")
        header_item0.setFlags(header_item0.flags() & ~Qt.ItemIsEditable)
        header_item0.setTextAlignment(Qt.AlignCenter)
        self.legend_table.setItem(0, 0, header_item0)

        # 标题行 - Code
        header_item1 = QTableWidgetItem("Code")
        header_item1.setFlags(header_item1.flags() & ~Qt.ItemIsEditable)
        header_item1.setTextAlignment(Qt.AlignCenter)
        self.legend_table.setItem(0, 1, header_item1)

        # 标题行 - Bag.
        header_item2 = QTableWidgetItem("No.")
        header_item2.setFlags(header_item2.flags() & ~Qt.ItemIsEditable)
        header_item2.setTextAlignment(Qt.AlignCenter)
        self.legend_table.setItem(0, 2, header_item2)

        # 标题行 - No.
        header_item3 = QTableWidgetItem("Bag.")
        header_item3.setFlags(header_item3.flags() & ~Qt.ItemIsEditable)
        header_item3.setTextAlignment(Qt.AlignCenter)
        self.legend_table.setItem(0, 3, header_item3)

        self.legend_table_data.append([
            {"title": None, "color": "black", "background": None},
            {"title": "Code", "color": "black", "background": None},
            {"title": "No.", "color": "black", "background": None},
            {"title": "Bag.", "color": "black", "background": None}])

        # 获取颜色使用计数
        color_counts = self.count_color_usage()

        # 排序逻辑（数字优先，字母在后）
        def sort_key(item):
            key = item[0]
            try:
                return (0, int(key))  # 数字键排序
            except ValueError:
                return (1, key)  # 字母键排序

        # 遍历排序后的色卡
        sorted_items = sorted(self.color_palette.items(), key=sort_key)
        table_row = 1
        for row, (key, color) in enumerate(sorted_items):
            # 数量列（可编辑）
            count = color_counts.get(key, 0)
            if count == 0:
                continue  # 跳过计数为0的颜色
            count = count // self.boxNumber + 1

            # 插入新行
            self.legend_table.insertRow(table_row)

            # ID列 - 使用key作为ID
            id_item = QTableWidgetItem(str(table_row))
            id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)
            id_item.setTextAlignment(Qt.AlignCenter)
            self.legend_table.setItem(table_row, 0, id_item)

            # 色样列 - 使用布局确保居中
            if color.name in self.selected_color_data:
                dic = self.selected_color_data[color.name]
                title = dic["title"]
                text_color = dic["text_color"]
            else:
                title = self._num_to_alphabet(len(self.selected_color_data) + 1, color)
                brightness = (color.red() * 299 +
                              color.green() * 587 +
                              color.blue() * 114) / 1000
                text_color = "white" if brightness < 128 else "black"
                self.selected_color_data[color.name] = {"title": title, "text_color": text_color, "color": color, "key": key,
                                                 "count": 1, "back_color": color}

            color_label = QLabel(title)
            color_label.setFixedSize(20, 20)  # 调整色样大小
            color_style = f"color:{text_color}; background-color: {color.name()}; border: 1px solid #666; border-radius: 4px"
            color_label.setStyleSheet(color_style)
            color_label.setAlignment(Qt.AlignCenter)

            # 创建容器并使用布局居中
            color_widget = QWidget()
            color_layout = QHBoxLayout(color_widget)
            color_layout.setAlignment(Qt.AlignCenter)
            color_layout.setContentsMargins(0, 0, 0, 0)
            color_layout.addWidget(color_label)

            self.legend_table.setCellWidget(table_row, 1, color_widget)

            # Bag.列 - 使用key作为Bag.内容
            bag_item = QTableWidgetItem(key)
            bag_item.setFlags(bag_item.flags() & ~Qt.ItemIsEditable)
            bag_item.setTextAlignment(Qt.AlignCenter)
            self.legend_table.setItem(table_row, 2, bag_item)

            # 数量列（可编辑）
            count_item = QTableWidgetItem(str(count))
            count_item.setFlags(count_item.flags() | Qt.ItemIsEditable)
            count_item.setTextAlignment(Qt.AlignCenter)
            self.legend_table.setItem(table_row, 3, count_item)


            self.legend_table_data.append([
                {"title": str(table_row), "color": "black", "background": None},
                {"title": title, "color": text_color, "background": color},
                {"title": key, "color": "black", "background": None},
                {"title": str(count), "color": "black", "background": None}])
            # 增加行计数器
            table_row += 1


        # 连接单元格双击事件到编辑处理函数
        self.legend_table.cellChanged.connect(self.update_total_count)

        # 添加总计行
        total_row = self.legend_table.rowCount()
        self.legend_table.insertRow(total_row)

        # 计算并设置总计值
        sk_total_count = self.calculate_total_count()
        total_count_item = QTableWidgetItem(str(sk_total_count))
        total_count_item.setFlags(total_count_item.flags() & ~Qt.ItemIsEditable)
        total_count_item.setTextAlignment(Qt.AlignCenter)
        self.legend_table.setItem(total_row, 3, total_count_item)

        self.legend_table_data.append([
            {"title": None, "color": "black", "background": None},
            {"title": None, "color": "black", "background": None},
            {"title": None, "color": "black", "background": None},
            {"title": str(sk_total_count), "color": "black", "background": None}])

    def calculate_total_count(self):
        """计算总计值（修复版）"""
        if not hasattr(self, 'legend_table'):
            return 0

        sk_total_count = 0
        total_row_index = self.legend_table.rowCount() - 1  # 总计行索引

        # 遍历所有数据行 (跳过行0标题，到总计行前一行)
        for row in range(1, total_row_index):
            item = self.legend_table.item(row, 3)
            if item and item.text().isdigit():
                sk_total_count += int(item.text())

        return sk_total_count

    def update_total_count(self, row, column):
        """单元格内容变化时更新总计值"""
        # print(f"更新总计值：{row}, {column}")
        # 只处理数量列的变化
        if column == 3 and row < self.legend_table.rowCount() - 1:  # 排除总计行
            # 重新计算总计值
            sk_total_count = self.calculate_total_count()

            # 更新总计行
            total_row = self.legend_table.rowCount() - 1
            total_count_item = self.legend_table.item(total_row, 3)
            if total_count_item:
                total_count_item.setText(str(sk_total_count))

            item = self.legend_table.item(row, 3)
            row_data = self.legend_table_data[row]
            col_data = row_data[column]
            col_data["title"] = item.text()
            row_data[column] = col_data
            self.legend_table_data[row] = row_data
            print(self.legend_table_data)


            total_row_data = self.legend_table_data[len(self.legend_table_data)-1]
            total_col_data = total_row_data[column]
            total_col_data["title"] = str(sk_total_count)
            total_row_data[column] = total_col_data
            self.legend_table_data[len(self.legend_table_data)-1] = total_row_data
            print(self.legend_table_data)



    def count_color_usage(self):
        """统计每个颜色在色块中的使用次数"""
        color_counts = {key: 0 for key in self.color_palette.keys()}

        if hasattr(self, 'block_labels') and self.block_labels:
            # 修改遍历方式
            for row in self.block_labels:
                for label in row:
                    key = label["key"]
                    if key in color_counts:
                        color_counts[key] += 1

        return color_counts

    """创建色卡管理菜单"""
    def create_palette_menu(self):
        """创建色卡管理菜单"""
        menu = QMenu(self)

        edit_action = QAction("编辑色卡", self)
        edit_action.triggered.connect(self.edit_palette)
        menu.addAction(edit_action)

        save_action = QAction("保存色卡", self)
        save_action.triggered.connect(self.save_palette_to_file)
        menu.addAction(save_action)

        load_action = QAction("加载色卡", self)
        load_action.triggered.connect(self.load_palette_from_file)
        menu.addAction(load_action)

        reset_action = QAction("重置色卡", self)
        reset_action.triggered.connect(self.reset_palette)
        menu.addAction(reset_action)

        return menu

    """开始框选"""
    def on_select_layer_press(self, event):

        for row in self.selected_blocks:
            for info in row:
                label = info['label']
                label.setParent(None)
                label.deleteLater()
        self.selected_blocks = []
        self.operation_bar.hide()
        print("选择区域p：", event.pos())
        """选择层鼠标按下事件"""
        # 判断鼠标事件是否由 左键 触发
        if event.button() == Qt.LeftButton:
            pos = event.pos()
            self.select_start_pos = QPoint(
                pos.x() // self.block_width * self.block_width,
                pos.y() // self.block_height * self.block_height
            )
            print("选择区域sp：", self.select_start_pos)
            self.select_current_pos = self.select_start_pos

            # 显示选择框
            self.select_rect.setGeometry(QRect(self.select_start_pos, QSize()))
            self.select_rect.show()

            # 清除之前的选择
            self.clear_selection()

    """框选中"""
    def on_select_layer_move(self, event):
        """选择层鼠标移动事件"""
        # print("选择区域m：", event.pos())
        if self.select_start_pos is not None:
            self.select_current_pos = event.pos()

            # 更新选择框大小和位置
            rect = QRect(self.select_start_pos, self.select_current_pos).normalized()
            # print("选择区域m：", rect)
            self.select_rect.setGeometry(rect)

            # 实时高亮选中的色块
            # self.update_selection_highlight(rect)

    """框选结束"""
    def on_select_layer_release(self, event):
        """选择层鼠标释放事件"""
        print("选择区域r：", event.pos())
        if self.select_start_pos is not None:
            pos = event.pos()
            # 获取当前鼠标位置
            x, y = pos.x(), pos.y()

            print("选择区域r：", pos)

            # 计算网格索引（整数除法）
            grid_x = x // self.block_width
            grid_y = y // self.block_height

            # 计算余数（当前位置相对于网格的偏移量）
            remainder_x = x % self.block_width
            remainder_y = y % self.block_height

            # 如果余数超过网格宽度/高度的一半，则移动到下一个网格
            if remainder_x > self.block_width / 2:
                grid_x += 1

            if remainder_y > self.block_height / 2:
                grid_y += 1
            print("选择区域r：", grid_x, grid_y)
            # 计算调整后的网格位置（转换回像素坐标）
            self.select_current_pos = QPoint(
                grid_x * self.block_width-2,
                grid_y * self.block_height-2
            )
            print("选择区域r：", self.select_current_pos)

            rect = QRect(self.select_start_pos, self.select_current_pos).normalized()
            print("选择区域rect：", rect)
            self.select_current_rect = rect

            # 更新选择框大小和位置
            s_rect = QRect(self.select_start_pos.x()-2, self.select_start_pos.y()-2, rect.size().width()+4, rect.size().height()+4)
            # print("选择区域m：", rect)
            self.select_rect.setGeometry(s_rect)

            # 最终确定选中的色块
            self.update_selection_highlight(rect)

            self.select_start_pos = None
            self.select_current_pos = None
            # self.select_rect.hide()
            print("选择区域：", rect)
            # 显示操作栏
            self.show_operation_bar(rect)
        else:
            print("未选择任何区域")

    """显示框选操作栏"""
    def show_operation_bar(self, rect):
        """显示操作栏，并考虑当前缩放比例"""
        # 计算选择框的位置（考虑缩放后的坐标）
        select_x = rect.left()  # * self.current_scale
        select_y = rect.top()  # * self.current_scale
        select_width = rect.width()  # * self.current_scale
        select_height = rect.height()  # * self.current_scale

        # 操作栏的位置（在选择框下方）
        operation_x = select_x
        operation_y = select_y + select_height

        # 设置操作栏的位置和缩放
        self.proxy_operation_bar.setPos(operation_x, operation_y)
        self.update_operation_bar_scale()  # 确保缩放比例正确
        self.operation_bar.show()

    """根据当前缩放比例调整操作栏的大小"""
    def update_operation_bar_scale(self):
        """根据当前缩放比例调整操作栏的大小"""
        if hasattr(self, 'proxy_operation_bar'):
            # 反向缩放操作栏，使其看起来大小不变
            self.proxy_operation_bar.setScale(1.0 / self.current_scale)

    """开始移动选择框"""
    def start_drag_mode(self, event):
        print("开始拖动")
        self.is_dragging = True
        self.drag_start_pos = None
        self.drag_start_pos = event.pos()

    """选择框移动中"""
    def on_drag_move(self, event):
        print("拖动：", event.pos())
        if not self.is_dragging:
            return

        # 计算鼠标的偏移量
        dx = event.pos().x() - self.drag_start_pos.x()
        dy = event.pos().y() - self.drag_start_pos.y()

        print("\n拖动：", dx, dy)

        pos = self.proxy_operation_bar.pos()
        # 设置操作栏的位置
        self.proxy_operation_bar.setPos(pos.x() + dx, pos.y() + dy)
        print("拖动：", pos)

        rect = self.select_current_rect

        rect.moveTo(rect.x() + dx, rect.y() + dy)
        self.select_rect.setGeometry(rect)


    """选择框结束移动"""
    def on_drag_release(self, event):
        print("结束拖动")
        if not self.is_dragging:
            return
        self.is_dragging = False

        self.view.setCursor(Qt.ArrowCursor)
        # self.preview_selectWidget.mouseMoveEvent = self.on_select_layer_move
        # self.preview_selectWidget.mouseReleaseEvent = self.on_select_layer_release

    """框选 保存功能"""
    def drag_saveAction(self):
        # 获取选择框的几何信息
        select_rect = self.select_rect.geometry()
        if not select_rect.isValid():
            return

        # 获取色块尺寸

        block_width = self.block_width
        block_height = self.block_height

        # 计算网格范围
        start_col = (select_rect.x()+2) // block_width
        start_row = (select_rect.y()+2) // block_height
        end_col = (select_rect.x() + select_rect.width()) // block_width
        end_row = (select_rect.y() + select_rect.height()) // block_height

        # 边界检查
        start_col = max(0, start_col)
        start_row = max(0, start_row)
        end_col = min(self.horizontal_blocks - 1, end_col)
        end_row = min(self.vertical_blocks - 1, end_row)

        # 遍历选择区域

        # for row, row_data in self.selected_blocks:
        #     for col, info in row_data:
        #         label = info['label']

        for rel_row, row in enumerate(self.selected_blocks):
            for rel_col, info in enumerate(row):
                label = info['label']
                print(info)

                # 计算目标位置
                target_col = start_col + rel_col
                target_row = start_row + rel_row

                # 移除目标位置旧色块
                target_item = self.preview_layout.itemAtPosition(target_row, target_col)
                if target_item and (target_widget := target_item.widget()):
                    target_widget.deleteLater()



                # 克隆新色块
                new_label = QLabel(info["title"])
                new_label.setStyleSheet(label.styleSheet())
                new_label.setFixedSize(label.size())
                new_label.mousePressEvent = lambda e, c=target_col, r=target_row, lbl=new_label: \
                    self.on_block_clicked(e, c, r, lbl)
                dic = {"title":info['title'],"label": new_label, 'width': self.block_width, 'height': self.block_height, 'x': target_row,
                       'y': target_col,
                       'key': info['key'], 'color': info['color']}

                self.block_labels[target_row][target_col] = dic
                # 更新到主网格
                self.preview_layout.addWidget(new_label, target_row, target_col)
        self.update_legend()
        # 清除选择状态
        self.select_rect.hide()
        self.operation_bar.hide()
        QMessageBox.information(self, "成功", "色块已成功替换！")

    """根据鼠标位置计算行列索引"""
    def get_row_col_from_pos(self, select_x, select_y):
        """根据鼠标位置计算行列索引"""
        pos = QPoint(select_x, select_y)
        for i in range(self.preview_layout.count()):
            item = self.preview_layout.itemAt(i)
            if item is not None:
                widget = item.widget()
                if widget is not None:
                    widget_rect = widget.geometry()
                    if widget_rect.contains(pos):
                        row, col, _, _ = self.preview_layout.getItemPosition(i)
                        return row, col
        return None, None

    # 实现左右反转功能
    def flip_horizontal_selection(self):
        # 实现左右反转功能
        if not self.selected_blocks:
            print("<UNK>")
            return
        # 遍历二维数组的每一行
        for row in self.selected_blocks:
            # 获取当前行的长度
            cols = len(row)
            # 遍历当前行的前半部分元素，将其与对应的后半部分元素交换
            for i in range(cols // 2):
                row[i], row[cols - 1 - i] = row[cols - 1 - i], row[i]
        self.flip_loadData()

    # 实现上下反转功能
    def flip_vertical_selection(self):
        # 实现上下反转功能
        if not self.selected_blocks:
            print("<UNK>")
            return
            return
        # 获取二维数组的行数
        rows = len(self.selected_blocks)

        # 遍历数组的前半部分行，将其与对应的后半部分行交换
        for i in range(rows // 2):
            self.selected_blocks[i], self.selected_blocks[rows - 1 - i] = self.selected_blocks[rows - 1 - i], \
                                                                          self.selected_blocks[i]

        self.flip_loadData()

    def flip_loadData(self):

        # 清除当前选择框内容
        # while self.select_layout.count():
        #     item = self.select_layout.takeAt(0)
        #     if item.widget():
        #         item.widget().deleteLate()
        #     elif item.layout():
        #         # 清除布局中的所有小部件
        #         for i in reversed(range(item.layout().count())):
        #             item.layout().itemAt(i).widget().deleteLater()
        print('flip_loadData')
        print(self.selected_blocks)
        for row, data in enumerate(self.selected_blocks):
            qhLayout = QHBoxLayout()
            row_data = []
            for col, info in enumerate(data):
                label = info['label']
                print("info: ",info)
                dic = info
                dic["x"] = col
                dic["y"] = row
                row_data.append(dic)
                qhLayout.addWidget(label)
                print("dic:  ",dic)

            if len(row_data) > 0:
                self.select_layout.addLayout(qhLayout)



    """选择色块"""
    def openskView(self):
        # 创建色卡选择对话框
        dialog = QDialog(self)
        dialog.setWindowTitle("选择颜色")
        dialog.setFixedSize(150, 300)

        layout = QVBoxLayout(dialog)

        # 创建色卡列表
        self.color_list = QListWidget()
        self.color_list.setIconSize(QSize(60, 30))

        # 填充色卡列表
        for key, color in self.color_palette.items():
            item = QListWidgetItem(key)

            # 创建颜色预览图标
            pixmap = QPixmap(60, 30)
            pixmap.fill(color)

            # 根据亮度设置文字颜色
            brightness = (color.red() * 299 + color.green() * 587 + color.blue() * 114) / 1000
            text_color = QColor(Qt.white) if brightness < 128 else QColor(Qt.black)

            painter = QPainter(pixmap)
            painter.setPen(text_color)
            painter.drawText(pixmap.rect(), Qt.AlignCenter, key)
            painter.end()

            item.setIcon(QIcon(pixmap))
            item.setData(Qt.UserRole, key)  # 存储色卡ID
            self.color_list.addItem(item)

        # 连接选择事件
        self.color_list.itemClicked.connect(lambda item: self.on_seka_selected(item, dialog))

        layout.addWidget(self.color_list)
        dialog.exec_()

    """处理色卡选择"""
    def on_seka_selected(self, item, dialog):
        """处理色卡选择"""
        selected_key = item.data(Qt.UserRole)
        closest_color = self.color_palette[selected_key]
        print("selected_key: ",selected_key)

        # 计算文字颜色（保证在背景色上可读）
        brightness = (closest_color.red() * 299 +
                      closest_color.green() * 587 +
                      closest_color.blue() * 114) / 1000
        text_color = "white" if brightness < 128 else "black"

        print(self.selected_blocks)
        for c, row in enumerate (self.selected_blocks):
            for r, info in enumerate (row):
                label = info['label']

                title = self.add_color_data(info['title'], closest_color, selected_key, info['color'])


                info['color'] = closest_color
                info['key'] = selected_key
                info['title'] = title
                print(info)

                self.selected_blocks[c][r] = info
                # 更新色块显示
                self.update_block_color(label, closest_color, title)


        print(self.selected_blocks)

        # 关闭对话框
        dialog.close()

    def exit_tabbar(self):

        # 清除当前选择框内容
        while self.select_layout.count():
            item = self.select_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLate()
            elif item.layout():
                # 清除布局中的所有小部件
                for i in reversed(range(item.layout().count())):
                    item.layout().itemAt(i).widget().deleteLater()
        self.selected_blocks = []
        self.operation_bar.hide()
        self.select_rect.hide()

    """获取选择区域的色块"""
    def update_selection_highlight(self, rect):
        """更新选中区域的高亮显示，并将选中的 block_label 复制到 select_rect 内"""

        for row in self.selected_blocks:
            for info in row:
                label = info['label']
                label.setParent(None)
                label.deleteLater()
        self.selected_blocks = []
        block_arr = []
        # 遍历所有色块标签
        for r, row_arr in enumerate(self.block_labels):
            row_data = []
            qhLayout = QHBoxLayout()
            for c, block in enumerate(row_arr):

                # print(f"r={r}, c={c}")
                if block is None or 'label' not in block or not block['label']:
                    # print(f"None r={r}, c={c}")
                    continue
                label = block['label']
                if isinstance(label, QLabel) and not label.isWidgetType():
                    # print(f"Deleted QLabel r={r}, c={c}")
                    continue
                # print(f"r={r}, c={c}")
                # print(f"block={block}")
                label = block["label"]
                # 获取标签在预览区域的位置和大小
                label_pos = label.pos()
                label_rect = QRect(label_pos, label.size())

                label.setFixedSize(self.block_width, self.block_height)

                # 检查标签是否在选择区域内
                if rect.intersects(label_rect):
                    print(f"Label_rect:{label_rect}")

                    # 获取标签在预览区域的坐标
                    label_x = label_pos.x()
                    label_y = label_pos.y()

                    # 计算标签在选择框内的相对位置
                    relative_x = label_x - rect.left()
                    relative_y = label_y - rect.top()

                    # 计算在网格布局中的行和列索引
                    row = relative_y // label.height()
                    col = relative_x // label.width()

                    # 确保行和列索引非负
                    if row >= 0 and col >= 0:
                        # 创建一个新的标签副本
                        new_label = QLabel(label.text())

                        # 计算文字颜色（保证在背景色上可读）
                        closest_color = QColor(block["color"])
                        brightness = (closest_color.red() * 299 +
                                      closest_color.green() * 587 +
                                      closest_color.blue() * 114) / 1000
                        text_color = "white" if brightness < 128 else "black"

                        # 设置样式（显示色卡编号）
                        new_label.setStyleSheet(
                            f"""
                            background-color: {block["color"]};
                            color: {text_color};
                            font-size: 8px;
                            font-weight: lighter;
                            qproperty-alignment: 'AlignCenter';
                            """
                        )
                        new_label.setAlignment(label.alignment())
                        new_label.setFixedSize(label.size())

                        info = {"label": new_label, 'width': block["width"], 'height': block["height"],
                                'x': len(row_data), 'y': len(self.selected_blocks),'title':block["title"], 'key': block["key"],
                                'color': block["color"]}
                        row_data.append(info)
                        # 将新标签添加到选择框对应的位置
                        qhLayout.addWidget(new_label)
                        # self.select_layout.addWidget(new_label)

            if len(row_data) > 0:
                block_arr.append(row_data)
                self.select_layout.addLayout(qhLayout)
        self.selected_blocks = block_arr
            # 显示选择框标签容器
            # self.preview_selectLabelWidget.show()


    def clear_selection(self):
        """清除当前选择"""
        for block in self.selected_blocks:
            if hasattr(block, 'original_style'):
                block.setStyleSheet(block.original_style)
        self.selected_blocks = []

    """切换抖动算法"""

    def toggle_dithering(self, state):
        """切换抖动算法"""
        print(f"使用抖动算法: {state}")
        self.use_dithering = state  # == Qt.Checked
        print(f"使用抖动算法: {self.use_dithering}")
        if self.original_pixmap:
            self.draw_grid()

    """显示色块"""

    def toggle_sColorCode(self, state):
        """显示色块"""
        print(f"显示色块: {state}")
        self.show_ColorCode = state  # == Qt.Checked
        self.preview_widget.setVisible(self.show_ColorCode)

    """显示线条"""

    def toggle_showGrid(self, state):
        """显示线条"""
        print(f"显示网格: {state}")
        self.show_grid = state  # == Qt.Checked
        # self.show_grid = state == Qt.Checked
        self.grid_layer.setVisible(self.show_grid)
        if self.show_grid and self.original_pixmap:
            self.draw_grid()


    def toggle_changeColorCode(self, state):
        """显示线条"""
        print(f"显示网格: {state}")
        self.change_ColorCode = state  # == Qt.Checked
        # self.preview_selectWidget.setVisible(self.show_selectLayer)
        # self.clear_selection()

    def toggle_showSelectLayer(self, state):
        """显示线条"""
        print(f"显示网格: {state}")
        self.show_selectLayer = state  # == Qt.Checked
        self.preview_selectWidget.setVisible(self.show_selectLayer)
        self.clear_selection()

    """切换网格可见性"""

    def toggle_grid(self):
        """切换网格可见性"""
        self.grid_visible = self.toggle_grid_action.isChecked()
        if self.original_pixmap:
            print("apply_grid4")
            self.apply_grid()

    """放大预览图像"""

    def zoom_in(self):
        """放大预览图像"""
        self.view.scale(1.2, 1.2)
        self.current_scale *= 1.2
        self.update_scene_rect()
        self.center_image()
        # self.update_operation_bar_scale()  # 新增：同步更新操作栏缩放

    """缩小预览图像"""

    def zoom_out(self):
        """缩小预览图像"""
        self.view.scale(1 / 1.2, 1 / 1.2)
        self.current_scale /= 1.2
        self.update_scene_rect()
        self.center_image()
        # self.update_operation_bar_scale()  # 新增：同步更新操作栏缩放

    def center_image(self):
        if self.original_pixmap:
            # 计算图像的中心位置
            image_center = QPointF(self.original_pixmap.width() / 2 + self.margin,
                                   self.original_pixmap.height() / 2 + self.margin)
            # 设置视图的中心为图像的中心
            self.view.centerOn(image_center)

    def update_scene_rect(self):
        if self.original_pixmap:
            width = self.original_pixmapWidth + 2 * self.margin
            height = self.original_pixmapHeight + 2 * self.margin
            self.scene.setSceneRect(0, 0, width, height)
            # self.view.fitInView(self.scene.sceneRect(), Qt.KeepAspectRatio)

    """选择图像"""

    def upload_image(self):
        """上传图像文件"""
        file_path, _ = QFileDialog.getOpenFileName(
            self, "选择图像", "",
            "图像文件 (*.png *.jpg *.jpeg *.bmp *.gif)"
        )

        if file_path:
            full_name = os.path.basename(file_path)  # 获取完整文件名 "report.pdf"
            name_without_ext = os.path.splitext(full_name)[0]  # 输出: "report"
            self.fileName  = name_without_ext
            self.load_image(file_path)

    """加载图像"""

    def load_image(self, file_path):
        """从文件路径加载图像"""
        self.image_path = file_path
        self.current_scale = 1.0

        # 加载图像并显示在 QGraphicsView 中
        self.original_pixmap = QPixmap(file_path)
        if self.original_pixmap.isNull():
            QMessageBox.warning(self, "警告", "无法加载图像，请检查文件路径或文件格式。")
            return

        # self.pixmap_item.setPixmap(self.original_pixmap)
        # self.scene.setSceneRect(QRectF(self.original_pixmap.rect()))
        # self.view.fitInView(self.scene.sceneRect(), Qt.KeepAspectRatio)

        print("set_imageSize1")
        self.set_imageSize()

    def changed_vSpinValue(self):

        value = self.v_spin.value()
        """处理垂直色块数量 SpinBox 值改变的事件"""
        if self.vspinbox_being_edited or value == self.vertical_blocks:
            return
        self.vspinbox_being_edited = True
        try:

            self.vertical_blocks = value
            print(f"垂直色块数量已更新为: {value}")
            # 在这里可以添加其他处理逻辑，例如重新绘制网格等
            print("set_imageSize2")
            self.set_imageSize()
        finally:
            # 重置标志位
            self.vspinbox_being_edited = False

    def changed_hSpinValue(self):

        value = self.h_spin.value()
        if self.hspinbox_being_edited or value == self.horizontal_blocks:
            return
        self.hspinbox_being_edited = True
        try:

            """处理垂直色块数量 SpinBox 值改变的事件"""
            self.horizontal_blocks = value
            print(f"垂直色块数量已更新为: {value}")
            # 在这里可以添加其他处理逻辑，例如重新绘制网格等
            print("set_imageSize3")
            self.set_imageSize()

        finally:
            # 重置标志位
            self.hspinbox_being_edited = False

    def changed_boxNumberValue(self, value):
        self.boxNumber = value
        self.update_legend()


    """设置图片大小"""

    def set_imageSize(self):
        if not self.image_path:
            print("图像路径为空，无法设置图像尺寸。")
            return

        # 加载图像并转换为ARGB32格式
        image = QImage(self.image_path).convertToFormat(QImage.Format_ARGB32)

        # 获取用户设置的水平和垂直色块数量
        h_blocks = self.horizontal_blocks
        v_blocks = self.vertical_blocks

        # 计算调整后的图像尺寸（使色块尺寸为整数）
        adjusted_width = self.block_width * h_blocks
        adjusted_height = self.block_height * v_blocks

        # 调整图像大小（使用平滑变换保持质量）
        scaled_image = image.scaled(
            adjusted_width,
            adjusted_height,
            Qt.IgnoreAspectRatio,
            Qt.SmoothTransformation
        )

        # 更新图像数据
        ptr = scaled_image.constBits()
        if ptr is not None:
            # 将内存视图转换为numpy数组
            self.image_data = np.frombuffer(
                bytes(ptr),  # 将memoryview转换为bytes
                dtype=np.uint8
            ).reshape(scaled_image.height(), scaled_image.width(), 4)
        else:
            print("Failed to access image data")
            # 处理错误情况
            raise ValueError("Failed to access image data")

        # 更新原始pixmap
        self.original_pixmap = QPixmap.fromImage(scaled_image)

        self.original_pixmapWidth = self.original_pixmap.width()
        self.original_pixmapHeight = self.original_pixmap.height()
        print(f"图像尺寸已更新{self.original_pixmapWidth}:{self.original_pixmapHeight}")
        # 显示原始图像
        self.pixmap_item.setPixmap(self.original_pixmap)
        # self.pixmap_item.setPos(QPointF(self.margin, self.margin))
        self.view.fitInView(self.pixmap_item, Qt.KeepAspectRatio)
        self.scene.setSceneRect(0, 0,
                                self.original_pixmapWidth + 2 * self.margin,
                                self.original_pixmapHeight + 2 * self.margin)
        print(f"图像尺寸已更新{self.pixmap_item}")
        # self.block_width = self.original_pixmapWidth / h_blocks
        # self.block_height = self.original_pixmapHeight / v_blocks
        self.preview_widget.setFixedSize(self.original_pixmapWidth, self.original_pixmapHeight)

        print("apply_grid1")
        self.apply_grid()

    """计算指定区域的平均颜色"""

    def get_average_color(self, image, rect):
        """计算指定区域的平均颜色"""
        total_red = 0
        total_green = 0
        total_blue = 0
        total_alpha = 0
        count = 0

        for y in range(rect.top(), rect.bottom()):
            for x in range(rect.left(), rect.right()):
                color = QColor(image.pixel(x, y))
                total_red += color.red()
                total_green += color.green()
                total_blue += color.blue()
                total_alpha += color.alpha()
                count += 1

        if count > 0:
            avg_red = total_red // count
            avg_green = total_green // count
            avg_blue = total_blue // count
            avg_alpha = total_alpha // count
            return QColor(avg_red, avg_green, avg_blue, avg_alpha)
        else:
            return QColor(0, 0, 0, 0)

    """获取指定区域的中心点颜色"""
    def get_center_color(self, image, rect):
        """获取指定区域的中心点颜色"""
        # 计算中心点坐标
        center_x = rect.left() + (rect.width() - 1) // 2
        center_y = rect.top() + (rect.height() - 1) // 2

        # 确保坐标在图像范围内
        if (0 <= center_x < image.width() and
                0 <= center_y < image.height()):
            # 获取中心点像素颜色
            pixel = image.pixel(center_x, center_y)
            return QColor(pixel)
        else:
            return QColor(0, 0, 0, 0)  # 区域超出图像范围时返回透明黑色





    def rgb_to_xyz(self, r, g, b):
        """将 RGB 颜色转换为 XYZ 颜色空间 (D65 白平衡点)"""
        # 归一化 RGB 值
        r, g, b = r / 255.0, g / 255.0, b / 255.0

        # sRGB 到线性 RGB 的转换
        def linearize(c):
            if c <= 0.04045:
                return c / 12.92
            else:
                return ((c + 0.055) / 1.055) ** 2.4

        r, g, b = linearize(r), linearize(g), linearize(b)

        # 线性 RGB 到 XYZ 的转换矩阵
        x = r * 0.4124 + g * 0.3576 + b * 0.1805
        y = r * 0.2126 + g * 0.7152 + b * 0.0722
        z = r * 0.0193 + g * 0.1192 + b * 0.9505

        return x, y, z

    def xyz_to_lab(self, x, y, z):
        """将 XYZ 颜色转换为 CIELAB 颜色空间"""
        # 参考白点 (D65)
        xn, yn, zn = 0.95047, 1.00000, 1.08883

        # XYZ 到 LAB 转换
        def f(t):
            if t > 0.008856:
                return t ** (1 / 3)
            else:
                return 7.787 * t + 16 / 116

        L = 116 * f(y / yn) - 16
        a = 500 * (f(x / xn) - f(y / yn))
        b = 200 * (f(y / yn) - f(z / zn))

        return L, a, b

    def rgb_to_lab(self, rgb_tuple):
        """将 RGB 元组转换为 Lab 颜色空间"""
        r, g, b = rgb_tuple
        # 创建 1x1x3 的数组
        rgb_array = np.array([[[r, g, b]]], dtype=np.uint8)
        lab_array = rgb2lab(rgb_array)
        # 返回 Lab 值 (L, a, b)
        return lab_array[0][0][0], lab_array[0][0][1], lab_array[0][0][2]

    def cie94_distance(self, color1, color2, application='graphic'):
        """
        计算两个 RGB 颜色之间的 CIE94 色差

        参数:
            color1, color2: RGB 颜色元组 (r, g, b)
            application: 'graphic' (图形艺术) 或 'textile' (纺织)

        返回:
            两个颜色之间的 CIE94 色差
        """
        rgb_tuple1 = (color1.red(), color1.green(), color1.blue())
        rgb_tuple2 = (color2.red(), color2.green(), color2.blue())
        print(rgb_tuple1)
        print(rgb_tuple2)
        # 转换为 LAB 颜色空间
        lab1 = self.rgb_to_lab(rgb_tuple1)
        lab2 = self.rgb_to_lab(rgb_tuple2)

        # 计算色差分量
        delta_L = lab1[0] - lab2[0]
        delta_a = lab1[1] - lab2[1]
        delta_b = lab1[2] - lab2[2]

        # 计算彩度差
        c1 = math.sqrt(lab1[1] ** 2 + lab1[2] ** 2)
        c2 = math.sqrt(lab2[1] ** 2 + lab2[2] ** 2)
        delta_C = c1 - c2

        # 计算色调差
        delta_H_squared = delta_a ** 2 + delta_b ** 2 - delta_C ** 2
        delta_H = 0 if delta_H_squared < 0 else math.sqrt(delta_H_squared)

        # 根据应用场景设置参数
        if application == 'graphic':
            k_L = 1
            k_C = 1
            k_H = 1
            K_1 = 0.045
            K_2 = 0.015
        else:  # 纺织
            k_L = 2
            k_C = 1
            k_H = 1
            K_1 = 0.048
            K_2 = 0.014

        # 计算各项权重
        S_L = 1
        S_C = 1 + K_1 * c1
        S_H = 1 + K_2 * c1

        # 计算最终色差
        return math.sqrt(
            (delta_L / (k_L * S_L)) ** 2 +
            (delta_C / (k_C * S_C)) ** 2 +
            (delta_H / (k_H * S_H)) ** 2
        )

    def find_closest_color(self, target, method='cie94'):
        distance_functions = {
            'cie94': lambda c1, c2: self.cie94_distance(c1, c2, 'graphic'),
        }
        key = f"{target.red()}{target.green()}{target.blue()}{target.alpha()}"
        print(f"正在计算色差... {key}")
        dist_func = distance_functions.get(method, self.cie94_distance)
        closest_color = None
        closest_key  = None
        min_distance = float('inf')
        print(f"正在计算色差... {target}")
        print(f"正在计算色差... {self.color_palette}")

        for key in self.color_palette.keys():
            color = self.color_palette[key]
            dist = dist_func(target, color)
            if dist < min_distance:
                min_distance = dist
                closest_color = color
                closest_key = key

        return closest_color


    """找到最接近的色卡颜色"""

    # def find_closest_color(self, color):
    #     """找到最接近的色卡颜色"""
    #     target = np.array([color.red(), color.green(), color.blue(), color.alpha()])
    #     distances = np.linalg.norm(self.palette_array - target, axis=1)
    #     index = np.argmin(distances)
    #     keys = list(self.color_palette.keys())
    #     return self.color_palette[keys[index]]

    """创建色块"""
    def apply_grid(self, image=None):
        try:

            # 强制处理所有待处理的UI事件，确保界面立即更新
            QApplication.processEvents()
            # 清除旧的色块标签
            for row in self.block_labels:
                for info in row:
                    label = info['label']
                    label.setParent(None)
                    label.deleteLater()
            self.block_labels = []
            self.selected_color_data = {}
            print("清除旧的色块标签")

            # 使用原始 pixmap 进行处理
            image = self.original_pixmap.toImage()
            print(f"image:{image}, size:{image.size()}")
            if image.isNull():
                print(f"无法加载图像: {self.image_path}")
                return

            # 获取用户设置的水平和垂直色块数量
            h_blocks = self.horizontal_blocks
            v_blocks = self.vertical_blocks

            # 计算每个色块的宽度和高度
            # self.block_width = image.width() // h_blocks
            # self.block_height = image.height() // v_blocks

            print(f"色块宽高: {self.block_width} x {self.block_height},{h_blocks},{v_blocks}")

            # 创建新的处理后的图像
            processed_image = QImage(image.size(), QImage.Format_ARGB32)
            processed_image.fill(Qt.transparent)
            painter = QPainter(processed_image)

            for y in range(v_blocks):
                rows = []
                for x in range(h_blocks):
                    # 计算当前色块的区域
                    rect = QRect(x * self.block_width, y * self.block_height, self.block_width, self.block_height)
                    # print(f"色块区域: {rect}")

                    # 获取该区域的平均颜色
                    # avg_color = self.get_average_color(image, rect)
                    avg_color = self.get_center_color(image, rect)
                    # print("start get color")

                    # 找到最接近的色卡颜色
                    closest_color,closest_key, title, text_color = self.get_closest_color(avg_color)
                    # print("end get color")
                    # 创建色块标签
                    block_label = QLabel()
                    block_label.setFixedSize(self.block_width, self.block_height)


                    # 设置样式（显示色卡编号）
                    block_label.setStyleSheet(
                        f"""
                        background-color: rgba({closest_color.red()}, {closest_color.green()}, 
                                              {closest_color.blue()}, {closest_color.alpha()});
                        color: {text_color};
                        font-size: 8px;
                        font-weight: lighter;
                        qproperty-alignment: 'AlignCenter';
                        """
                    )
                    block_label.setText(title)  # 显示色卡编号

                    # 保存色块位置信息
                    block_label.coords = (x, y)

                    # 添加点击事件
                    block_label.mousePressEvent = lambda event, x = x, y = y, lbl=block_label: self.on_block_clicked(event,
                                                                                                                 x, y,
                                                                                                                 lbl)

                    self.preview_layout.addWidget(block_label, y, x)
                    dic = {"label": block_label, 'width': self.block_width, 'height': self.block_height, 'x': x, 'y': y,
                           'key': closest_key, 'title':title, 'color': QColor(closest_color.red(), closest_color.green(),
                                                               closest_color.blue(), closest_color.alpha()).name()}
                    rows.append(dic)
                self.block_labels.append(rows)

            painter.end()

            print("painter.end()")

            # 强制处理所有待处理的UI事件，确保界面立即更新
            QApplication.processEvents()

            # 更新场景和视图
            self.scene.setSceneRect(QRectF(self.original_pixmap.rect()))
            self.view.fitInView(self.scene.sceneRect(), Qt.KeepAspectRatio)

            print(f"成功创建 {len(self.block_labels)} 个色块标签。")

            if self.show_grid:
                self.draw_grid()
            self.grid_layer.setVisible(self.show_grid)
            self.preview_selectWidget.setFixedSize(self.original_pixmapWidth, self.original_pixmapHeight)

            print("update_legend9")
            # 更新图例显示
            self.update_legend()

            self.update_scene_rect()
            self.center_image()
        except Exception as e:
            print(f"设置图像尺寸时出现错误: {e}")

    """更新色块颜色和文本"""
    def update_block_color(self, label, color, key):
        """更新色块颜色和文本"""
        # 计算文字颜色
        brightness = (color.red() * 299 + color.green() * 587 + color.blue() * 114) / 1000
        text_color = "white" if brightness < 128 else "black"

        # 更新样式
        label.setStyleSheet(
            f"""
            background-color: rgba({color.red()}, {color.green()}, {color.blue()}, {color.alpha()});
            color: {text_color};
            font-size: 8px;
            font-weight: lighter;
            qproperty-alignment: 'AlignCenter';
            """
        )
        label.setText(key)

        print("update_legend10")
        # 更新图例
        self.update_legend()

    """处理色块点击事件"""
    def on_block_clicked(self, event, x, y, label):
        """处理色块点击事件"""
        if event.button() == Qt.LeftButton and self.change_ColorCode:
            # 创建色卡选择对话框
            dialog = QDialog(self)
            dialog.setWindowTitle("选择颜色")
            dialog.setFixedSize(150, 300)

            layout = QVBoxLayout(dialog)

            # 创建色卡列表
            self.color_list = QListWidget()
            self.color_list.setIconSize(QSize(60, 30))

            # 填充色卡列表
            for key, color in self.color_palette.items():
                item = QListWidgetItem(key)

                # 创建颜色预览图标
                pixmap = QPixmap(60, 30)
                pixmap.fill(color)

                # 根据亮度设置文字颜色
                brightness = (color.red() * 299 + color.green() * 587 + color.blue() * 114) / 1000
                text_color = QColor(Qt.white) if brightness < 128 else QColor(Qt.black)

                painter = QPainter(pixmap)
                painter.setPen(text_color)
                painter.drawText(pixmap.rect(), Qt.AlignCenter, key)
                painter.end()

                item.setIcon(QIcon(pixmap))
                item.setData(Qt.UserRole, key)  # 存储色卡ID
                self.color_list.addItem(item)

            # 连接选择事件
            self.color_list.itemClicked.connect(lambda item: self.on_color_selected(item, x, y, label, dialog))

            layout.addWidget(self.color_list)
            dialog.exec_()

    """处理色卡选择"""
    def on_color_selected(self, item, x, y, label, dialog):
        """处理色卡选择"""
        selected_key = item.data(Qt.UserRole)
        selected_color = self.color_palette[selected_key]
        print(f"已选择色卡: {selected_key}")

        info = self.block_labels[y][x]
        title = self.add_color_data(info['title'], selected_color, selected_key, info['color'])
        info['color'] = selected_color
        info['key'] = selected_key
        info['title'] = title
        self.block_labels[y][x] = info
        # 更新色块显示
        self.update_block_color(label, selected_color, title)

        image = self.original_pixmap.toImage()
        rect = QRect(x * self.block_width, y * self.block_height, self.block_width, self.block_height)
        avg_color = self.get_center_color(image, rect)


        print(f"imageColor:{avg_color}, selected_color:{selected_color}")
        # 关闭对话框
        dialog.close()

    """绘制网格"""
    def draw_grid(self):
        """绘制网格到独立图层"""
        # 创建透明图层，增加顶部和左侧空间用于显示坐标
        margin = 30  # 顶部和左侧预留空间
        grid_pixmap = QPixmap(self.original_pixmapWidth + 2 * margin,
                              self.original_pixmapHeight + 2 * margin)
        grid_pixmap.fill(Qt.transparent)
        # 设置背景色，这里以灰色为例，你可以根据需要修改颜色
        # background_color = QColor(200, 200, 200, 180)  # RGB值表示灰色
        # grid_pixmap.fill(background_color)

        painter = QPainter(grid_pixmap)
        painter.setRenderHint(QPainter.Antialiasing)

        # 获取用户设置的水平和垂直色块数量
        h_blocks = self.horizontal_blocks
        v_blocks = self.vertical_blocks

        # 获取图像尺寸
        img_width = self.original_pixmapWidth
        img_height = self.original_pixmapHeight

        # 计算每个色块的宽度和高度
        block_width = img_width // h_blocks
        block_height = img_height // v_blocks

        # 线条样式
        normal_pen = QPen(QColor(50, 50, 50, 255), 0.5)  # 半透明黑色
        bold_pen = QPen(QColor(0, 0, 0, 255), 1)  # 更明显的线条

        # 文本样式
        font = QFont()
        font.setPointSize(14)
        painter.setFont(font)
        text_pen = QPen(QColor(255, 255, 255, 200))

        # 绘制水平坐标（顶部）
        painter.setPen(text_pen)
        for x in range(0, img_width + 1, block_width * 10):
            if x >= 0:  # 不显示最左侧的0坐标
                col_num = x // block_width
                text_rect = QRect(x - 15 + margin, 5, 30, 20)
                painter.drawText(text_rect, Qt.AlignCenter, f"{col_num}")

        # 绘制垂直坐标（左侧）
        painter.setPen(text_pen)
        for y in range(0, img_height + 1, block_height * 10):
            if y > 0:  # 不显示最顶部的0坐标
                row_num = y // block_height
                text_rect = QRect(0, y - 10 + margin, 30, 20)
                painter.drawText(text_rect, Qt.AlignCenter, f"{row_num}")

        # 绘制网格线（偏移margin）
        painter.translate(margin, margin)  # 移动坐标系到图像开始位置

        # 绘制水平线
        for y in range(0, img_height + 1, block_height):
            if y % (block_height * 10) == 0:
                painter.setPen(bold_pen)
            else:
                painter.setPen(normal_pen)
            painter.drawLine(0, y, img_width, y)

        # 绘制垂直线
        for x in range(0, img_width + 1, block_width):
            if x % (block_width * 10) == 0:
                painter.setPen(bold_pen)
            else:
                painter.setPen(normal_pen)
            painter.drawLine(x, 0, x, img_height)

        painter.end()
        self.grid_layer.setPos(-margin, -margin)
        # 更新网格图层
        self.grid_layer.setPixmap(grid_pixmap)

    def calculate_max_multiple(self, original_width):
        """
        计算整倍数小于 6000 的最大数
        :param original_width: 原始宽度
        :return: 整倍数小于 6000 的最大数
        """
        # 计算最大的 n 值
        n = 6000 // original_width
        # 如果 n 乘以 original_width 等于 6000，则将 n 减 1
        if n * original_width == 6000:
            n = n - 1
        # 计算整倍数小于 6000 的最大数
        target_width = original_width * n
        return target_width

    """保存图片"""
    def save_result(self):
        if self.block_labels:
            # 获取原始图像的宽高比
            original_width = self.original_pixmapWidth
            original_height = self.original_pixmapHeight
            aspect_ratio = original_height / original_width

            # 目标图片尺寸（固定宽度，高度根据比例计算）
            target_width = self.calculate_max_multiple(original_width)
            target_height = int(target_width * aspect_ratio)

            # 创建一个新的QImage用于保存拼接图片
            w_blocks = self.block_width * self.save_scale
            h_blocks = self.block_height * self.save_scale

            border_width = 10

            # 目标图片尺寸（固定宽度，高度根据比例计算）
            target_width = w_blocks * self.horizontal_blocks + 20
            target_height = h_blocks * self.vertical_blocks + 20

            # 创建新图像
            new_image = QImage(target_width, target_height, QImage.Format_ARGB32)
            new_image.fill(Qt.transparent)

            painter = QPainter(new_image)

            # 绘制内部色块
            for y, row in enumerate(self.block_labels):
                for x, label in enumerate(row):
                    info = self.block_labels[y][x]
                    color_str = info["color"]
                    color = QColor(color_str)
                    rect = QRect(x * w_blocks + border_width, y * h_blocks + border_width, w_blocks, h_blocks)
                    painter.fillRect(rect, color)

            # 修复：绘制蓝色边框（使用半宽边距，并调整矩形大小）
            pen = QPen(Qt.blue, border_width)
            painter.setPen(pen)
            # 调整矩形大小，确保边框完全在图像内
            border_rect = QRect(border_width // 2, border_width // 2, target_width - border_width,
                                target_height - border_width)
            painter.drawRect(border_rect)

            painter.end()

            # 设置图片分辨率为300 dpi
            new_image.setDotsPerMeterX(int(300 * 100 / 2.54))
            new_image.setDotsPerMeterY(int(300 * 100 / 2.54))
            default_path = os.path.join(os.getcwd(), f"{self.fileName}-打印-{self.horizontal_blocks}x{self.vertical_blocks}.png")
            file_path, _ = QFileDialog.getSaveFileName(
                self, "保存结果", default_path,
                "图像文件 (*.png)"
            )
            # "图像文件 (*.png *.jpg *.jpeg *.bmp *.gif)"
            if file_path:
                print(file_path)
                # image_path = os.path.splitext(file_path)[0] + '-印刷-43x43.png'
                new_image.save(file_path)
                # print(image_path)
                # 保存图片时同时保存XSD色块信息文件
                # xsd_file_path = os.path.splitext(file_path)[0] + '.xsd'
                xsd_file_path = os.path.splitext(file_path)[0] + ".xsd"
                self.save_blocks_to_xsd(xsd_file_path)

    def save_wgresult(self):
        """Save the grid result as an image file with coordinates and grid lines."""
        if not self.block_labels:
            QMessageBox.warning(self, "Warning", "No block data to save!")
            print("No block data to save!")
            return

        try:
            # Calculate dimensions
            w_blocks = self.block_width * self.save_scale
            h_blocks = self.block_height * self.save_scale
            # w_blocks = self.block_width
            # h_blocks = self.block_height
            img_width = w_blocks * self.horizontal_blocks
            img_height = h_blocks * self.vertical_blocks

            # Border settings
            border_width = 300
            target_width = img_width + 2 * border_width
            target_height = img_height + 2 * border_width

            # Create new image with white background
            new_image = QImage(target_width, target_height, QImage.Format_ARGB32)
            new_image.fill(Qt.white)

            painter = QPainter(new_image)
            painter.setRenderHint(QPainter.Antialiasing)
            painter.setRenderHint(QPainter.SmoothPixmapTransform)

            # Draw color blocks
            for y, row in enumerate(self.block_labels):
                for x, label in enumerate(row):
                    if x >= self.horizontal_blocks or y >= self.vertical_blocks:
                        continue  # Skip if out of bounds

                    info = self.block_labels[y][x]
                    color_str = info.get("color", "#FFFFFF")  # Default to white if no color
                    color = QColor(color_str)
                    rect = QRect(
                        x * w_blocks + border_width,
                        y * h_blocks + border_width,
                        w_blocks, h_blocks
                    )
                    painter.fillRect(rect, color)

            # Draw white border
            pen = QPen(Qt.white, border_width)
            painter.setPen(pen)
            border_rect = QRect(
                border_width // 2,
                border_width // 2,
                target_width - border_width,
                target_height - border_width
            )
            painter.drawRect(border_rect)

            # Text and line settings
            font = QFont()
            font.setPointSize(80)
            painter.setFont(font)
            text_pen = QPen(QColor(0, 0, 0, 255))  # Black text for better visibility
            normal_pen = QPen(QColor(0, 0, 0, 255), 3)  # Light gray lines
            bold_pen = QPen(QColor(0, 0, 0, 255), 8)  # Darker gray for major lines

            # Draw horizontal coordinates (top)
            painter.setPen(text_pen)
            for x in range(0, img_width + 1, w_blocks * 10):
                if x >= 0:  # 不显示最左侧的0坐标
                    col_num = x // w_blocks
                    text_rect = QRect(x + border_width / 2 + 40, 150, 200, 110)
                    painter.drawText(text_rect, Qt.AlignCenter, f"{col_num}")

            # 绘制垂直坐标（左侧）
            painter.setPen(text_pen)
            for y in range(0, img_height + 1, h_blocks * 10):
                if y > 0:  # 不显示最顶部的0坐标
                    row_num = y // h_blocks
                    text_rect = QRect(100, y + border_width / 2 + 70, 200, 110)
                    painter.drawText(text_rect, Qt.AlignCenter, f"{row_num}")

            # Draw grid lines (offset by border)
            painter.translate(border_width, border_width)

            # Draw horizontal lines
            for y in range(0, img_height + 1, h_blocks):
                painter.setPen(bold_pen if y % (h_blocks * 10) == 0 else normal_pen)
                painter.drawLine(0, y, img_width, y)

            # Draw vertical lines
            for x in range(0, img_width + 1, w_blocks):
                painter.setPen(bold_pen if x % (w_blocks * 10) == 0 else normal_pen)
                painter.drawLine(x, 0, x, img_height)

            painter.end()

            # Set DPI to 300
            new_image.setDotsPerMeterX(int(300 * 100 / 2.54))
            new_image.setDotsPerMeterY(int(300 * 100 / 2.54))


            # file_path, _ = QFileDialog.getSaveFileName(
            #     self,
            #     "保存带网格的图片",
            #     "",
            #     "PNG Images (*.png);;JPEG Images (*.jpg *.jpeg);;BMP Images (*.bmp)"
            # )
            #
            # if file_path:
            #
            #     image_path = os.path.splitext(file_path)[0] + '.png'
            #     new_image.save(file_path)
            #     print(image_path)
            #
            #     # 解析文件路径和文件名
            #     file_dir = os.path.dirname(file_path)
            #     file_name = os.path.basename(file_path)
            #     file_ext = os.path.splitext(file_name)[1]
            #
            #     # 修改文件名，例如在文件名前添加 "legend_"
            #     new_file_name = os.path.splitext(file_name)[0] + "_legend" + file_ext
            #
            #     # 组合新的文件路径
            #     new_file_path = os.path.join(file_dir, new_file_name)
            #     self.save_legend_table(new_file_path)
            # else:
            #     print("No file selected!")



            self.number_image.emit(1, new_image)
            self.save_legend_table("")

        except Exception as e:
            QMessageBox.critical(self, "Error", f"An error occurred: {str(e)}")

    def save_legend_table(self, save_path):
        try:
            # 获取表格的行数和列数
            rows = len(self.legend_table_data)
            cols = 4

            # 如果表格为空，直接返回
            if rows == 0:
                QMessageBox.warning(self, "保存失败", "表格为空，无法保存")
                return

            # 计算表格内容的总尺寸
            table_width = 200
            table_height = rows * 30

            # 创建一个与表格内容大小相同的 QImage
            image = QImage(table_width, table_height, QImage.Format_ARGB32)
            image.fill(Qt.white)  # 背景填充为白色

            with QPainter(image) as painter:
                painter.setRenderHint(QPainter.Antialiasing)
                painter.setRenderHint(QPainter.TextAntialiasing)



                white_pen = QPen(QColor(255, 255, 255))  # 深灰色文本
                black_pen = QPen(QColor(0, 0, 0))  # 深灰色文本

                # 文本样式
                font = QFont()
                font.setPointSize(14)
                painter.setFont(font)
                # print(f"legend_table_data:{self.legend_table_data}")

                # 遍历所有单元格，绘制文本内容
                for row in range(rows):
                    for col in range(cols):
                        item = self.legend_table_data[row][col]

                        if isinstance(item, dict):
                            title = item.get('title', '')
                            # print(f"title:{title}")
                            cell_rect = QRect(col * 50, row * 30, 50, 30)

                            # 如果是色样列，绘制颜色方块
                            if col == 1:
                                try:
                                    color_value = item.get('background', '')

                                    if isinstance(color_value, str):
                                        color = QColor(color_value)
                                    elif isinstance(color_value, QColor):
                                        color = color_value
                                    else:
                                        color = QColor()

                                    if color.isValid():
                                        color_rect = QRect(
                                            cell_rect.x() + 10,
                                            cell_rect.y() + 5,
                                            cell_rect.width() - 20,
                                            cell_rect.height() - 10
                                        )
                                        painter.fillRect(color_rect, color)
                                        painter.drawRect(color_rect)
                                except Exception as e:
                                    print(f"绘制颜色方块出错: {e}")

                            # 绘制文本（居中对齐）
                            if title:
                                # print(f"text_color:{item.get('color', '11')}")
                                # 重置画笔为黑色，用于绘制文本
                                painter.setPen(white_pen if item.get('color', '') == 'white' else black_pen)
                                painter.drawText(cell_rect, Qt.AlignCenter, title)


                # 恢复原始状态，确保后续绘制不受影响
                painter.restore()
                # 绘制网格线
                grid_pen = QPen(QColor(0, 0, 0, 255), 1)
                grid_pen.setWidth(1)
                painter.setPen(grid_pen)

                # 绘制垂直线
                for col in range(cols+1):
                    x = max(1, min(table_width-1, col * 50))
                    painter.drawLine(x, 0, x, table_height-30)

                # 绘制水平线
                for row in range(rows):
                    y = max(1, row * 30)
                    painter.drawLine(0, y, table_width, y)


            self.number_image.emit(2, image)
            # if save_path:
            #     if image.save(save_path):
            #         QMessageBox.information(self, "保存成功", f"图例表格已成功保存到 {save_path}")
            #     else:
            #         QMessageBox.warning(self, "保存失败", "无法保存图例表格，请检查文件路径和权限。")

        except Exception as e:
            print(f"保存图例表格时出错：{str(e)}")
            QMessageBox.critical(self, "错误", f"保存图例表格时发生错误：{str(e)}")

    """保存色块信息"""
    def save_blocks_to_xsd(self, file_path=None):
        if not file_path:
            h_blocks = self.horizontal_blocks
            v_blocks = self.vertical_blocks
            file_path, _ = QFileDialog.getSaveFileName(
                self, "保存色块信息为XSD", "",
                "XSD文件 (*.xsd)"
            )
        if file_path:
            file = QSaveFile(file_path)
            if not file.open(QSaveFile.WriteOnly):
                return
            # print(f"图像尺寸 {self.original_pixmapWidth}:{self.original_pixmapHeight}")

            writer = QXmlStreamWriter(file)
            writer.setAutoFormatting(True)
            writer.writeStartDocument()
            writer.writeStartElement("BlockPalette")
            writer.writeAttribute("width", str(self.original_pixmapWidth))
            writer.writeAttribute("height", str(self.original_pixmapHeight))
            writer.writeAttribute("vertical_blocks", str(self.vertical_blocks))
            writer.writeAttribute("horizontal_blocks", str(self.horizontal_blocks))

            for y, row in enumerate(self.block_labels):
                writer.writeStartElement("row")
                for x, block in enumerate(row):
                    # print(block)
                    writer.writeStartElement("col")
                    writer.writeAttribute("x", str(block['x']))
                    writer.writeAttribute("y", str(block['y']))
                    writer.writeAttribute("key", block['key'])
                    writer.writeAttribute("title", block['title'])
                    writer.writeAttribute("color", block['color'])
                    writer.writeAttribute("width", str(block['width']))
                    writer.writeAttribute("height", str(block['height']))
                    writer.writeEndElement()

                writer.writeEndElement()

            writer.writeEndElement()
            writer.writeEndDocument()

            file.commit()

    """弹出色卡选择对话框"""
    def edit_block(self, label):
        # 弹出色卡选择对话框
        dialog = QDialog(self)
        dialog.setWindowTitle("选择色卡颜色")
        layout = QVBoxLayout()

        for key, color in self.color_palette.items():
            color_btn = QPushButton()
            color_btn.setStyleSheet(
                f"background-color: rgba({color.red()}, {color.green()}, {color.blue()}, {color.alpha()});"
                "border: 1px solid black;"
            )
            color_btn.setText(key)
            color_btn.clicked.connect(lambda _, k=key, c=color: self.update_block(label, k, c))
            layout.addWidget(color_btn)

        dialog.setLayout(layout)
        dialog.exec()

    def update_block(self, label, key, color):
        label.setStyleSheet(
            f"background-color: rgba({color.red()}, {color.green()}, {color.blue()}, {color.alpha()});"
            "border: 1px solid black;"
        )
        label.setText(key)


    def get_closest_color(self, target_color):
        """优化的颜色匹配算法，使用欧几里得距离在Lab颜色空间"""

        # 初始化计数器（如果还没有）
        if not hasattr(self, 'color_sid_counter'):
            self.color_sid_counter = 0

        # 转换目标颜色到Lab空间
        target_rgb = (target_color.red(), target_color.green(), target_color.blue())
        target_lab = np.array(self.rgb_to_lab(target_rgb))

        min_distance = float('inf')
        closest_color = None
        closest_key = None

        for key, palette_color in self.color_palette.items():
            # 转换色卡颜色到Lab空间
            palette_rgb = (palette_color.red(), palette_color.green(), palette_color.blue())
            palette_lab = np.array(self.rgb_to_lab(palette_rgb))

            # 计算欧几里得距离
            distance = np.linalg.norm(target_lab - palette_lab)

            # distance = abs(palette_color.red()+palette_color.green()+palette_color.blue()-target_color.red()-target_color.green()-target_color.blue())

            if distance < min_distance:
                min_distance = distance
                closest_color = palette_color
                closest_key = key

        # 生成字母SID (A, B, C, ..., Z, AA, AB, ...)
        self.color_sid_counter += 1
        sid = self._num_to_alphabet(self.color_sid_counter, closest_color)

        if closest_color.name in self.selected_color_data:
            dic = self.selected_color_data[closest_color.name]
            dic["count"] += 1
            self.selected_color_data[closest_color.name] = dic
            text_color = dic["text_color"]
        else:

            # 计算文字颜色（保证在背景色上可读）
            brightness = (closest_color.red() * 299 +
                          closest_color.green() * 587 +
                          closest_color.blue() * 114) / 1000
            text_color = "white" if brightness < 128 else "black"
            self.selected_color_data[closest_color.name] = {"title": sid, "text_color":text_color, "color": closest_color, "key": closest_key, "count": 1, "back_color":target_color}
        # print(f"self.selected_color_data: {self.selected_color_data}")
        return closest_color, closest_key, sid, text_color


    def _num_to_alphabet(self, num, color = None):
        if color is not None:
            if color.name in self.selected_color_data:
                dic = self.selected_color_data[color.name]
                return dic["title"]
        # print(f"num: {num}")
        num = len(self.selected_color_data) + 1
        """将数字转换为单个字母，超过26时循环 (1→A, 2→B, ..., 26→Z, 27→A, 28→B, ...)"""
        remainder = (num - 1) % 26
        title = chr(65 + remainder)  # 65 is ASCII code for 'A'
        # print(f"title: {title}, remainder: {remainder}")
        return title

    def add_color_data(self, title, color,  select_key,  back_color=None):
        # print(f"title: {title}, color: {color}, key: {select_key}")
        backColor = QColor(back_color)
        # print(f"color: {color}, key: {select_key}, back_color:{backColor}")
        del_key = None
        update_key = None
        update_dic = None
        new_title = None
        if color.name in self.selected_color_data:
            dic = self.selected_color_data[color.name]
            if dic["title"] == title:
                count = dic["count"] - 1
                if count > 0:
                    dic["count"] = count
                    update_dic =  dic
                    update_key = color.name
                    self.selected_color_data[color.name] = dic
                else:
                    del_key = color.name
            if dic["color"] == color:
                count = dic["count"] + 1
                dic["count"] = count
                update_dic = dic
                update_key = color.name
                self.selected_color_data[color.name] = dic
                title = dic["title"]
        if del_key is not None:
            del self.selected_color_data[del_key]
        if update_key is not None:
            self.selected_color_data[update_key] = update_dic
        if new_title is not None:
            return new_title


        sid = self._num_to_alphabet(len(self.selected_color_data)+1, color)

        color_key = color.name
        # print(f"color_key: {key}")

        brightness = (color.red() * 299 +
                      color.green() * 587 +
                      color.blue() * 114) / 1000
        text_color = "white" if brightness < 128 else "black"
        new_dic = {"title": sid, "text_color": text_color, "color": color, "key": select_key, "count": 1,
                                               "back_color": backColor}
        # print(f"new_dic: {new_dic}")
        self.selected_color_data[color_key] = new_dic
        return sid

    """颜色转码"""

    def _rgb_to_lab(self, rgb):
        """RGB转Lab颜色空间的辅助方法"""
        # 归一化
        r, g, b = [x / 255.0 for x in rgb]

        # Gamma校正
        r = ((r + 0.055) / 1.055) ** 2.4 if r > 0.04045 else r / 12.92
        g = ((g + 0.055) / 1.055) ** 2.4 if g > 0.04045 else g / 12.92
        b = ((b + 0.055) / 1.055) ** 2.4 if b > 0.04045 else b / 12.92

        # 转换为XYZ
        x = r * 0.4124 + g * 0.3576 + b * 0.1805
        y = r * 0.2126 + g * 0.7152 + b * 0.0722
        z = r * 0.0193 + g * 0.1192 + b * 0.9505

        # 转换为Lab
        x /= 0.95047
        z /= 1.08883

        x = x ** (1 / 3) if x > 0.008856 else (7.787 * x) + (16 / 116)
        y = y ** (1 / 3) if y > 0.008856 else (7.787 * y) + (16 / 116)
        z = z ** (1 / 3) if z > 0.008856 else (7.787 * z) + (16 / 116)

        L = max(0, min(100, (116 * y) - 16))
        a = max(-128, min(127, 500 * (x - y)))
        b_lab = max(-128, min(127, 200 * (y - z)))

        return np.array([L, a, b_lab])

    """色差计算"""

    def _ciede2000_distance(self, lab1, lab2):
        """计算CIEDE2000色差"""
        # 简化的CIEDE2000实现
        L1, a1, b1 = lab1
        L2, a2, b2 = lab2.T  # 转置以处理多个颜色

        # 计算各项差值
        delta_L = L2 - L1
        delta_a = a2 - a1
        delta_b = b2 - b1

        # 考虑亮度权重
        L_mean = (L1 + L2) / 2
        weight_L = 1 + (0.015 * (L_mean - 50) ** 2) / np.sqrt(20 + (L_mean - 50) ** 2)

        # 考虑色度权重
        C1 = np.sqrt(a1 ** 2 + b1 ** 2)
        C2 = np.sqrt(a2 ** 2 + b2 ** 2)
        C_mean = (C1 + C2) / 2
        weight_C = 1 + 0.045 * C_mean

        # 考虑色调权重
        h1 = np.degrees(np.arctan2(b1, a1)) % 360
        h2 = np.degrees(np.arctan2(b2, a2)) % 360
        delta_h = h2 - h1
        delta_h = np.where(delta_h > 180, delta_h - 360,
                           np.where(delta_h < -180, delta_h + 360, delta_h))

        H_mean = np.where(np.abs(h1 - h2) > 180, (h1 + h2 + 360) / 2, (h1 + h2) / 2)
        weight_H = 1 + 0.015 * C_mean * (1 - 0.17 * np.cos(np.radians(H_mean - 30)))

        # 计算最终色差 - 修正的表达式
        delta_E = np.sqrt(
            (delta_L / weight_L) ** 2 +
            (delta_a / weight_C) ** 2 +
            (delta_b / weight_H) ** 2
        )

        return delta_E

    """打开XSD文件"""

    def open_blocks_from_xsd(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "打开XSD文件", "",
            "XSD文件 (*.xsd)"
        )
        if file_path:
            file = QFile(file_path)
            if not file.open(QFile.ReadOnly | QFile.Text):
                return

            reader = QXmlStreamReader(file)

            color_blocks = []

            self.selected_color_data = {}
            while not reader.atEnd():
                reader.readNext()
                if reader.isStartElement():
                    if reader.name() == "BlockPalette":
                        attributes = reader.attributes()
                        self.original_pixmapWidth = int(attributes.value("width"))
                        self.original_pixmapHeight = int(attributes.value("height"))
                        self.vertical_blocks = int(attributes.value("vertical_blocks"))
                        self.horizontal_blocks = int(attributes.value("horizontal_blocks"))
                    elif reader.name() == "row":
                        row_data = []
                        while True:
                            reader.readNext()
                            if reader.isEndElement() and reader.name() == "row":
                                color_blocks.append(row_data)
                                break
                            if reader.isStartElement() and reader.name() == "col":
                                attributes = reader.attributes()
                                block = {
                                    'x': int(attributes.value("x")),
                                    'y': int(attributes.value("y")),
                                    'key': attributes.value("key"),
                                    'title': attributes.value("title"),
                                    'color': QColor(attributes.value("color")),
                                    'width': int(attributes.value("width")),
                                    'height': int(attributes.value("height"))
                                }
                                row_data.append(block)

            file.close()
            # print(color_blocks)

            if self.original_pixmapWidth and self.original_pixmapHeight:
                # Set dimensions first
                self.h_spin.setValue(self.horizontal_blocks)
                self.v_spin.setValue(self.vertical_blocks)
                # self.set_imageSize()  # This will create the grid structure

                # Now update the blocks with loaded colors

                for rel_row, row in enumerate(color_blocks):
                    row_data = []
                    for rel_col, block in enumerate(row):
                        key = block['key']
                        title = block['title']
                        x = block['x']
                        y = block['y']
                        closest_color = block['color']
                        block_width = block['width']
                        block_height = block['height']
                        # 创建色块标签
                        block_label = QLabel()
                        block_label.setFixedSize(block_width, block_height)

                        # 计算文字颜色（保证在背景色上可读）
                        brightness = (closest_color.red() * 299 +
                                      closest_color.green() * 587 +
                                      closest_color.blue() * 114) / 1000
                        text_color = "white" if brightness < 128 else "black"

                        # 设置样式（显示色卡编号）
                        block_label.setStyleSheet(
                            f"""
                            background-color: rgba({closest_color.red()}, {closest_color.green()}, 
                                                  {closest_color.blue()}, {closest_color.alpha()});
                            color: {text_color};
                            font-size: 8px;
                            font-weight: lighter;
                            qproperty-alignment: 'AlignCenter';
                            """
                        )
                        block_label.setText(title)  # 显示色卡编号

                        print(block_label.setStyleSheet)
                        # 保存色块位置信息
                        block_label.coords = (x, y)

                        # 添加点击事件
                        block_label.mousePressEvent = lambda event, x=x, y=y, lbl=block_label: self.on_block_clicked(
                            event,
                            x, y,
                            lbl)

                        self.preview_layout.addWidget(block_label, y, x)
                        dic = block
                        block["label"] = block_label
                        row_data.append(dic)

                        self.preview_selectWidget.setFixedSize(self.original_pixmapWidth, self.original_pixmapHeight)

                    self.block_labels.append(row_data)

                self.draw_grid()
                print("update_legend0")
                self.update_legend()
            else:
                print("Invalid dimensions")

    # def edit_palette(self):
    #     """打开色卡编辑对话框"""
    #     dialog = ColorPaletteEditDialog(self.color_palette, self)
    #     if dialog.exec() == QDialog.Accepted:
    #         new_palette = dialog.get_updated_palette()
    #         # 校验颜色有效性（无Alpha）
    #         for color in new_palette.values():
    #             if not color.isValid():
    #                 QMessageBox.warning(self, "错误", "存在无效的颜色值！")
    #                 return
    #         self.color_palette = new_palette
    #         self.update_palette_array()
    #         self.update_legend()
    #         self.save_palette_config()
    #         if self.original_pixmap:
    #             self.apply_grid()

    """编辑色卡"""
    def edit_palette(self):
        """打开色卡编辑对话框"""
        dialog = ColorPaletteEditDialog(self.color_palette, self)
        if dialog.exec() == QDialog.Accepted:
            new_palette = dialog.get_updated_palette()
            # 验证色卡至少包含1个颜色
            if not new_palette:
                QMessageBox.warning(self, "错误", "色卡不能为空！")
                return

            self.color_palette = new_palette
            self.update_palette_array()  # 更新预计算数组

            print("update_legend1")
            self.update_legend()  # 更新图例显示
            self.save_palette_config()  # 自动保存到配置文件
            if self.original_pixmap:
                print("apply_grid2")
                self.apply_grid()  # 刷新色块显示

    """保存当前色卡到配置文件"""

    def save_palette_config(self):
        """保存当前色卡到配置文件"""
        ColorPaletteManager.save_to_xsd(self.default_palette_path, self.color_palette)
        print("色卡配置已保存")

    def on_cell_edited(self, row, col, table):
        """处理表格单元格编辑事件"""
        if col == 0:  # ID 列
            old_id = list(self.color_palette.keys())[row]
            new_id = table.item(row, 0).text().strip()

            if not new_id:
                QMessageBox.warning(self, "警告", "色卡ID不能为空！")
                table.item(row, 0).setText(old_id)
                return

            if new_id in self.color_palette and new_id != old_id:
                QMessageBox.warning(self, "警告", f"色卡ID '{new_id}' 已存在！")
                table.item(row, 0).setText(old_id)
                return

            # 更新色卡ID
            color = self.color_palette.pop(old_id)
            self.color_palette[new_id] = color
            self.update_palette_array()
            print("update_legend2")
            self.update_legend()

        elif col == 2:  # 色值列
            color_id = list(self.color_palette.keys())[row]
            hex_value = table.item(row, 2).text().strip()

            color = QColor(hex_value)
            if not color.isValid():
                QMessageBox.warning(self, "警告", "无效的颜色值！请使用格式如 #RRGGBB。")
                table.item(row, 2).setText(self.color_palette[color_id].name())
                return

            # 更新颜色
            self.color_palette[color_id] = color
            self.update_palette_array()

            print("update_legend3")
            self.update_legend()

            # 更新颜色预览
            color_widget = table.cellWidget(row, 1)
            color_label = color_widget.findChild(QLabel)
            color_label.setStyleSheet(f"background-color: {color.name()}; border: 1px solid black;")

        # 如果已有图像，重新应用网格
        if self.original_pixmap:
            print("apply_grid3")
            self.apply_grid()

    """编辑色卡颜色"""

    def edit_single_color(self, key, table):

        color = QColorDialog.getColor(self.temp_palette[key], self, "选择颜色")
        if color.isValid():
            self.temp_palette[key] = color
            # 更新表格中的颜色显示
            for i in range(table.rowCount()):
                if table.item(i, 0).text() == key:
                    table.cellWidget(i, 1).setStyleSheet(
                        f"background-color: rgba({color.red()}, {color.green()}, {color.blue()}, {color.alpha()});"
                        "border: 1px solid black; min-width: 80px;"
                    )
                    break

    """添加新色卡"""

    def add_new_color(self, table):
        """添加新颜色（兼容复选框列）"""
        new_id = self.generate_new_id()
        color = QColorDialog.getColor(Qt.white, self, "选择新颜色")

        if color.isValid():
            self.temp_palette[new_id] = color
            row = table.rowCount()
            table.insertRow(row)

            # 复选框列
            checkbox = QCheckBox()
            checkbox_widget = QWidget()
            checkbox_layout = QHBoxLayout(checkbox_widget)
            checkbox_layout.addWidget(checkbox)
            checkbox_layout.setAlignment(Qt.AlignCenter)
            checkbox_layout.setContentsMargins(0, 0, 0, 0)
            table.setCellWidget(row, 0, checkbox_widget)

            # ID列
            id_item = QTableWidgetItem(new_id)
            id_item.setFlags(id_item.flags() & ~Qt.ItemIsEditable)
            table.setItem(row, 1, id_item)

            # 颜色预览
            color_label = QLabel()
            color_label.setStyleSheet(
                f"background-color: rgba({color.red()}, {color.green()}, {color.blue()}, {color.alpha()});"
                "border: 1px solid black; min-width: 80px;"
            )
            table.setCellWidget(row, 2, color_label)

            # 编辑按钮
            edit_button = QPushButton("编辑")
            edit_button.clicked.connect(lambda _, k=new_id: self.edit_single_color(k, table))
            table.setCellWidget(row, 3, edit_button)

            table.resizeColumnsToContents()

    def generate_new_id(self):
        """生成最短可用ID（先字母后数字）"""
        existing = set(self.temp_palette.keys())

        # 单字符ID
        for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':
            if c not in existing:
                return c

        # 双字符ID（如果需要）
        for c1 in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ':
            for c2 in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789':
                new_id = c1 + c2
                if new_id not in existing:
                    return new_id

        return 'A'  # 极端情况下的回退

    """删除所有选中的颜色"""

    def delete_selected_colors(self, table):
        """删除所有选中的颜色"""
        selected_rows = []

        # 收集所有选中的行
        for row in range(table.rowCount()):
            checkbox = table.cellWidget(row, 0).findChild(QCheckBox)
            if checkbox and checkbox.isChecked():
                selected_rows.append(row)

        if not selected_rows:
            QMessageBox.warning(self, "提示", "请先选择要删除的颜色")
            return

        # 从后往前删除，避免索引变化问题
        for row in sorted(selected_rows, reverse=True):
            key = table.item(row, 1).text()
            del self.temp_palette[key]
            table.removeRow(row)

        QMessageBox.information(self, "成功", f"已删除 {len(selected_rows)} 种颜色")

    def apply_palette_changes(self, dialog):
        """应用色卡修改"""
        # 检查至少保留一个颜色
        if not self.temp_palette:
            QMessageBox.warning(self, "警告", "色卡不能为空！")
            return

        # 应用修改
        self.color_palette = self.temp_palette.copy()
        self.update_palette_array()

        print("update_legend4")
        self.update_legend()
        ColorPaletteManager.save_to_xsd(self.default_palette_path, self.color_palette)

        # 如果有图像则重新处理
        if self.original_pixmap:
            print("set_imageSize4")
            self.set_imageSize()

        dialog.accept()
        QMessageBox.information(self, "成功", "色卡修改已保存！")

    """色卡另存为"""

    def save_palette_to_file(self):
        file_path, _ = QFileDialog.getSaveFileName(
            self, "保存色卡", "",
            "XSD文件 (*.xsd)"
        )
        if file_path:
            ColorPaletteManager.save_to_xsd(file_path, self.color_palette)

    """加载色卡"""

    def load_palette_from_file(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "加载色卡", "",
            "XSD文件 (*.xsd)"
        )
        if file_path:
            loaded = ColorPaletteManager.load_from_xsd(file_path)
            if loaded:
                self.color_palette = loaded
                self.update_palette_array()

                print("update_legend5")
                self.update_legend()
                if self.original_pixmap:
                    print("set_imageSize5")
                    self.set_imageSize()

                ColorPaletteManager.save_to_xsd(self.default_palette_path, self.color_palette)

    """重置色卡为默认值"""

    def reset_palette(self):
        self.init_mixed_palette()
        if self.original_pixmap:
            print("set_imageSize6")
            self.set_imageSize()

# if __name__ == "__main__":
#     app = QApplication(sys.argv)
#     window = ColorBlockPage()
#     window.show()
#     sys.exit(app.exec())


