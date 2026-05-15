import sys
import os
import tempfile
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout,
                               QTabWidget, QMessageBox, QInputDialog, QToolBar,
                               QFileDialog, QMenu, QToolButton, QLabel)
from PySide6.QtGui import (QIcon, QAction, QImage)
from PySide6.QtCore import Qt

# from image_test1 import MergePage
from merge_page import MergePage
from cover_page import CoverPage
from color_block_page import ColorBlockPage
from seka_merge_page import SKCoverPage


class LicenseManager:
    def __init__(self):
        temp_dir = tempfile.gettempdir()
        self.license_file = os.path.join(temp_dir, "license.key")
        print(self.license_file)
        # self.license_file = "license.key"
        # 固定盐值但不展示
        self.secret_salt = "MUYyQTkz9"  # "MjAyNS0wNC0zMF8xXzU5QkM3NUFGOEYzMTY5MUYyQTkz"

    def check_license(self):
        if os.path.exists(self.license_file):
            with open(self.license_file, 'r') as f:
                license_key = f.read().strip()
                if license_key == self.secret_salt:
                    return True
                else:
                    return False
        return False

    def show_activation_dialog(self):
        dialog = QInputDialog()
        dialog.setInputMode(QInputDialog.TextInput)
        dialog.setWindowTitle("输入许可证密钥")
        dialog.setLabelText("请输入有效的许可证密钥:")
        dialog.resize(200, 300)  # 设置输入框大小为 200x300
        ok = dialog.exec()
        key = dialog.textValue()
        if ok and key:
            try:
                if key == self.secret_salt:
                    with open(self.license_file, 'w') as f:
                        f.write(key)
                    return True
                else:
                    # QMessageBox.critical(None, "密钥无效", "输入的密钥无效")
                    return False
            except Exception as e:
                # QMessageBox.critical(None, "密钥无效", f"输入的密钥无效: {str(e)}")
                return False
        else:
            sys.exit(1)
        return False

    def get_license_status(self):
        # 这里可以添加更复杂的逻辑来获取许可证状态
        return {"expires": "未知", "days_remaining": "未知"}


class ImageData:
    """用于存储不同模块的图片数据"""

    def __init__(self):
        self.original_image = None  # 显示原图
        self.design_image = None  # 设计原图
        self.cover_background = None  # 封面背景
        self.sop_background = None  # SOP背景


class AdvancedImageBlendApp(QMainWindow):
    def __init__(self):
        super().__init__()

        # 保存菜单项引用的字典
        self.image_menu_actions = {}

        # Initialize license manager
        self.image_data = ImageData()
        self.license_manager = LicenseManager()
        self.setWindowIcon(QIcon("app.ico"))

        # Check license before showing UI
        if not self.license_manager.check_license():
            self.popInput()
        else:
            self.initUIview()
            # Show license status
            # status = self.license_manager.get_license_status()
            # QMessageBox.information(
            #     None,
            #     "License Info",
            #     f"License valid until: {status['expires']}\n"
            #     f"Days remaining: {status['days_remaining']}"
            # )

    def initUIview(self):
        self.setWindowTitle("合成工具")
        self.setGeometry(100, 100, 1400, 1200)

        # 主窗口部件
        self.main_widget = QWidget()
        self.setCentralWidget(self.main_widget)

        # self.creat_toolBar()
        # self.create_design_menu()

        # 创建 QTabWidget
        self.tab_widget = QTabWidget()
        self.main_layout = QVBoxLayout(self.main_widget)
        self.main_layout.addWidget(self.tab_widget)

        self.color_block_page = ColorBlockPage(self)
        self.tab_widget.addTab(self.color_block_page, "色块处理")
        self.color_block_page.number_image.connect(self.get_number_image)

        self.skCoverPage_page = SKCoverPage(self)
        self.tab_widget.addTab(self.skCoverPage_page, "设计图封面")
        self.tab_widget.setTabEnabled(self.tab_widget.indexOf(self.skCoverPage_page), False)

        # 创建页面实例时传递数据
        self.merge_page = MergePage(self)
        self.tab_widget.addTab(self.merge_page, "效果图")
        # 连接信号：当合并完成时，接收图片数据
        self.merge_page.image_merged.connect(self.process_merged_image)

        self.cover_page = CoverPage(self)
        self.tab_widget.addTab(self.cover_page, "效果图封面")

    def get_color_image(self, image):
        print("接收到图片数据：", image)
        self.skCoverPage_page.get_color_image(image)
    def get_number_image(self, type, image):
        self.skCoverPage_page.setSampleImage(type, image)
        self.tab_widget.setTabEnabled(self.tab_widget.indexOf(self.skCoverPage_page), True)
        self.tab_widget.setCurrentIndex(1)

    def process_merged_image(self, image):
        # 处理接收的数据（示例：显示图片或保存到文件）
        print( "接收到图片数据：", image)
        self.cover_page.setSampleImage(image)

        temp_file_path = self.save_image_to_temp(image)
        self.color_block_page .load_image(temp_file_path)

    def save_image_to_temp(self, image: QImage):
        # 生成唯一文件名（例如：prefix_12345.png）
        # 创建临时目录（如果不存在）
        dir_path = tempfile.gettempdir()  # 使用系统默认临时目录
        os.makedirs(dir_path, exist_ok=True)
        prefix = "prefix_"
        suffix = ".png"
        counter = 0
        while True:
            filename = f"{prefix}{counter}{suffix}"
            file_path = os.path.join(dir_path, filename)
            if not os.path.exists(file_path):
                break
            counter += 1

        # 保存图像到文件
        image.save(file_path, suffix[1:].upper())  # 保存格式由后缀决定
        return file_path



    def creat_toolBar(self):
    #     # 创建主工具栏
        self.main_toolbar = QToolBar("Main Toolbar")
        self.addToolBar(self.main_toolbar)

        main_buttons = ["选择图片", "一键生成", "封面合成", "设计合成", "色块"]

        for button_text in main_buttons:
            tool_button = QToolButton(self)
            tool_button.setText(button_text)
            tool_button.setPopupMode(QToolButton.InstantPopup)
            tool_button.setStyleSheet("QToolButton::menu-indicator { image: none; }")

            # 根据按钮类型创建不同的菜单
            if button_text == "选择图片":
                menu = self.create_upload_menu()
            elif button_text == "一键生成":
                menu = self.create_generate_menu()
            elif button_text == "封面合成":
                menu = self.create_cover_menu()
            elif button_text == "设计合成":
                menu = self.create_design_menu()
            elif button_text == "色块":
                menu = self.create_color_menu()

            tool_button.setMenu(menu)
            self.main_toolbar.addWidget(tool_button)

    def  create_design_menu(self):
        subToolbar= QToolBar("Sub Toolbar")
        self.addToolBar(subToolbar)

        main_buttons = ["选择图片", "一键生成", "封面合成", "设计合成", "色块"]

        for button_text in main_buttons:
            tool_button = QToolButton(self)
            tool_button.setText(button_text)
            tool_button.setPopupMode(QToolButton.InstantPopup)
            tool_button.setStyleSheet("QToolButton::menu-indicator { image: none; }")

            # 根据按钮类型创建不同的菜单
            if button_text == "选择图片":
                menu = self.create_upload_menu()
            elif button_text == "一键生成":
                menu = self.create_generate_menu()
            elif button_text == "封面合成":
                menu = self.create_cover_menu()
            elif button_text == "设计合成":
                menu = self.create_design_menu()
            elif button_text == "色块":
                menu = self.create_color_menu()

            tool_button.setMenu(menu)
            subToolbar.addWidget(tool_button)



    def create_upload_menu(self):
        """创建上传图片菜单"""
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu { background-color: #f0f0f0; border: 1px solid #ccc; }
            QMenu::item { padding: 5px 20px; }
            QMenu::item:selected { background-color: #e0e0e0; }
            QMenu::icon { margin-right: 8px; left: 10px;}
        """)

        sub_actions = [
            {"text": "显示原图", "image_type": "original"},
            {"text": "设计原图", "image_type": "design"},
            {"text": "封面背景", "image_type": "cover"},
            {"text": "SOP背景", "image_type": "sop"}
        ]


        for index, sub_cfg in enumerate(sub_actions):
            action = menu.addAction(sub_cfg["text"])
            self.image_menu_actions[index] = action
            self.update_menu_item_icon(index)

            action.triggered.connect(lambda _, t=index: self.handle_image_upload(t))

        return menu

    # def create_upload_menu(self):
    #     """创建上传图片菜单 - 带图标右移"""
    #     menu = QMenu(self)
    #     menu.setStyleSheet("""
    #         QMenu {
    #             background-color: #ffffff;
    #             border: 1px solid #dcdcdc;
    #             border-radius: 4px;
    #             padding: 4px;
    #         }
    #         QMenu::item {
    #             padding: 6px 44px 6px 12px;  /* 右侧padding增加到44px给图标留空间 */
    #             margin: 2px;
    #             color: #333333;
    #         }
    #         QMenu::item:selected {
    #             background-color: #e6f2ff;
    #             color: #0066cc;
    #             border-radius: 2px;
    #         }
    #         QMenu::icon {
    #             left: 20px;  /* 图标向右移动20px */
    #             padding-right: 8px;
    #         }
    #         QMenu::separator {
    #             height: 1px;
    #             background: #e0e0e0;
    #             margin: 4px 0;
    #         }
    #     """)
    #
    #     sub_actions = [
    #         {"text": "显示原图", "index": 0, "icon": "image/original.png"},
    #         {"text": "设计原图", "index": 1, "icon": "image/design.png"},
    #         {"text": "封面背景", "index": 2, "icon": "image/cover.png"},
    #         {"text": "SOP背景", "index": 3, "icon": "image/sop.png"},
    #     ]
    #
    #     for item in sub_actions:
    #         index = item["index"]
    #         has_image = self.check_image_status(index)
    #
    #         # 创建菜单项
    #         action = QAction(item["text"], self)
    #         action.setIcon(QIcon(item["icon"]))
    #
    #         # 设置状态提示
    #         action.setToolTip("已上传" if has_image else "点击上传")
    #
    #         # 添加触发事件
    #         action.triggered.connect(lambda _, x=index: self.handle_image_upload(x))
    #
    #         # 保存引用
    #         self.image_menu_actions[index] = action
    #
    #         # 添加到菜单
    #         menu.addAction(action)
    #
    #     return menu
    def create_generate_menu(self):
        """创建一键生成菜单"""
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu { background-color: #f0f0f0; border: 1px solid #ccc; }
            QMenu::item { padding: 5px 20px; }
            QMenu::item:selected { background-color: #e0e0e0; }
            QMenu::icon { margin-right: 8px; }
        """)

        menu.addAction("生成合并图").triggered.connect(self.generate_merge_image)
        menu.addAction("生成封面图").triggered.connect(self.generate_cover_image)

        return menu

    def create_cover_menu(self):
        """创建封面合成菜单"""
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu { background-color: #f0f0f0; border: 1px solid #ccc; }
            QMenu::item { padding: 5px 20px; }
            QMenu::item:selected { background-color: #e0e0e0; }
            QMenu::icon { margin-right: 8px; }
        """)

        menu.addAction("基础合成").triggered.connect(self.cover_basic_blend)
        menu.addAction("高级合成").triggered.connect(self.cover_advanced_blend)

        return menu

    def create_design_menu(self):
        """创建设计合成菜单"""
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu { background-color: #f0f0f0; border: 1px solid #ccc; }
            QMenu::item { padding: 5px 20px; }
            QMenu::item:selected { background-color: #e0e0e0; }
            QMenu::icon { margin-right: 8px; }
        """)

        menu.addAction("图层叠加").triggered.connect(self.design_layer_blend)
        menu.addAction("颜色校正").triggered.connect(self.design_color_correct)

        return menu

    def create_color_menu(self):
        """创建色块菜单"""
        menu = QMenu(self)
        menu.setStyleSheet("""
            QMenu { background-color: #f0f0f0; border: 1px solid #ccc; }
            QMenu::item { padding: 5px 20px; }
            QMenu::item:selected { background-color: #e0e0e0; }
            QMenu::icon { margin-right: 8px; }
        """)

        menu.addAction("提取色块").triggered.connect(self.extract_color_blocks)
        menu.addAction("生成色卡").triggered.connect(self.generate_color_palette)

        return menu




    def update_menu_item_icon(self, index):
        """更新菜单项的图标"""
        print("更新菜单项图标：", index)
        if index in self.image_menu_actions:
            action = self.image_menu_actions[index]
            if self.check_image_status(index):
                action.setIcon(QIcon("image/hasImage.png"))  # 已上传图片的图标
            else:
                action.setIcon(QIcon("image/noImage.png"))  # 未上传图片的图标

    def check_image_status(self, index):
        """检查指定类型的图片是否已上传"""
        if  index == 0:
            return self.image_data.original_image is not None
        elif index == 1:
            return self.image_data.design_image is not None
        elif  index == 2:
            return self.image_data.cover_background is not None
        elif  index == 3:
            return self.image_data.sop_background is not None
        return False

    def handle_image_upload(self, index):
        """处理图片上传操作"""
        print("上传图片操作：", index)
        file_path, _ = QFileDialog.getOpenFileName(self, "选择图片文件", "", "Image Files (*.png *.jpg *.bmp)")
        if file_path:
            # 这里可以添加图片加载逻辑，例如使用PIL库
            if index == 0:
                self.image_data.original_image = file_path
                print("原始图片已上传：", file_path)
                self.merge_page.setOriginalDrawing(file_path)
            elif  index == 1:
                self.image_data.design_image = file_path
                self.merge_page.setSampleImage(file_path)
            elif  index == 2:
                self.image_data.cover_background = file_path
                self.cover_page.setBackgroundImage(file_path)
            elif  index == 3:
                self.image_data.sop_background = file_path

            # 上传成功后更新图标
            self.update_menu_item_icon(index)

    def popInput(self):
        if not self.license_manager.show_activation_dialog():
            result = QMessageBox.question(
                None,
                "重新输入提示",
                "您输入的许可证密钥无效或取消了输入。是否要再次输入？",
                QMessageBox.Yes | QMessageBox.No
            )
            if result == QMessageBox.No:
                QMessageBox.critical(
                    None,
                    "License Required",
                    "A valid license is required to use this software."
                )
                sys.exit(1)  # Exit if no valid license
            else:
                self.popInput()
        else:
            self.initUIview()


    # ====================== 子菜单点击的功能方法 ======================
    def generate_merge_image(self):
        """合并图片功能"""
        if not self.image_data.original_image or not self.image_data.design_image:
            QMessageBox.warning(self, "提示", "请先上传显示原图和设计原图")
            return
        QMessageBox.information(self, "成功", "合并图片生成完成")

    def generate_cover_image(self):
        """生成封面功能"""
        if not self.image_data.cover_background:
            QMessageBox.warning(self, "提示", "请先上传封面背景")
            return
        QMessageBox.information(self, "成功", "封面生成完成")
    def cover_basic_blend(self):
        """封面基础合成"""
        if not self.image_data.cover_background:
            QMessageBox.warning(self, "提示", "请先上传封面背景")
            return
        QMessageBox.information(self, "成功", "封面基础合成完成")

    def cover_advanced_blend(self):
        """封面高级合成"""
        if not self.image_data.cover_background or not self.image_data.design_image:
            QMessageBox.warning(self, "提示", "请先上传封面背景和设计原图")
            return
        QMessageBox.information(self, "成功", "封面高级合成完成")

    def design_layer_blend(self):
        """图层叠加功能"""
        if not self.image_data.design_image:
            QMessageBox.warning(self, "提示", "请先上传设计原图")
            return
        QMessageBox.information(self, "成功", "图层叠加完成")

    def design_color_correct(self):
        """颜色校正功能"""
        if not self.image_data.original_image:
            QMessageBox.warning(self, "提示", "请先上传显示原图")
            return
        QMessageBox.information(self, "成功", "颜色校正完成")

    def extract_color_blocks(self):
        """提取色块功能"""
        if not self.image_data.original_image:
            QMessageBox.warning(self, "提示", "请先上传显示原图")
            return
        QMessageBox.information(self, "成功", "色块提取完成")

    def generate_color_palette(self):
        """生成色卡功能"""
        if not self.image_data.sop_background:
            QMessageBox.warning(self, "提示", "请先上传SOP背景")
            return
        QMessageBox.information(self, "成功", "色卡生成完成")


if __name__ == "__main__":
    app = QApplication(sys.argv)
    app.setStyle("Fusion")

    window = AdvancedImageBlendApp()
    window.show()

    sys.exit(app.exec())