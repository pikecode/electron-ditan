import os
import json
import pickle
import platform
import tempfile
from typing import Any, Dict, Optional, Union


class ConfigManager:
    """配置项管理类，负责加载、保存和管理应用程序配置"""

    def __init__(self, config_file: Optional[str] = None,
                 default_config: Optional[Dict[str, Any]] = None):
        """
        初始化配置管理器

        参数:
            config_file: 配置文件路径，默认为系统临时目录下的配置文件
            default_config: 默认配置字典
        """
        # 如果未指定配置文件，使用系统临时目录
        if config_file is None:
            temp_dir = tempfile.gettempdir()
            config_file = os.path.join(temp_dir, "app_config.json")

        self.config_file = config_file
        self.config = default_config or {}
        self.loaded = False
        self.format = "json"  # 或 "pickle"

        # 设置默认配置
        self.set_defaults()

    def set_defaults(self) -> None:
        """设置默认配置项"""
        default_config = {

        }

        # 合并默认配置
        self.config = {**default_config, **self.config}

    def load(self) -> bool:
        """
        从配置文件加载配置

        返回:
            是否成功加载
        """
        if not os.path.exists(self.config_file):
            self.loaded = False
            return False

        try:
            if self.format == "json":
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    self.config = json.load(f)
            else:  # pickle
                with open(self.config_file, 'rb') as f:
                    self.config = pickle.load(f)

            self.loaded = True
            return True
        except Exception as e:
            print(f"加载配置文件出错: {e}")
            self.loaded = False
            return False

    def save(self) -> bool:
        """
        保存配置到文件

        返回:
            是否成功保存
        """
        try:
            # 确保目录存在
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)

            if self.format == "json":
                with open(self.config_file, 'w', encoding='utf-8') as f:
                    json.dump(self.config, f, indent=4, ensure_ascii=False)
            else:  # pickle
                with open(self.config_file, 'wb') as f:
                    pickle.dump(self.config, f)

            return True
        except Exception as e:
            print(f"保存配置文件出错: {e}")
            return False

    def get(self, key: str, default: Any = None) -> Any:
        """
        获取配置项值

        参数:
            key: 配置项键名
            default: 如果配置项不存在，返回的默认值

        返回:
            配置项值或默认值
        """
        # 如果尚未加载配置，尝试加载
        if not self.loaded:
            self.load()

        return self.config.get(key, default)

    def set(self, key: str, value: Any, save: bool = True) -> None:
        """
        设置配置项值

        参数:
            key: 配置项键名
            value: 配置项值
            save: 是否立即保存到文件
        """
        self.config[key] = value

        if save:
            self.save()

    def delete(self, key: str, save: bool = True) -> bool:
        """
        删除配置项

        参数:
            key: 配置项键名
            save: 是否立即保存到文件

        返回:
            是否成功删除
        """
        if key in self.config:
            del self.config[key]

            if save:
                return self.save()

            return True

        return False

    def get_all(self) -> Dict[str, Any]:
        """获取所有配置项"""
        return self.config

    def clear(self, save: bool = True) -> None:
        """
        清除所有配置项，恢复默认值

        参数:
            save: 是否立即保存到文件
        """
        self.config = {}
        self.set_defaults()

        if save:
            self.save()

    def update_from_dict(self, new_config: Dict[str, Any], save: bool = True) -> None:
        """
        从字典更新配置

        参数:
            new_config: 新配置字典
            save: 是否立即保存到文件
        """
        self.config.update(new_config)

        if save:
            self.save()

    def set_license_key(self, key: str) -> bool:
        """
        设置许可证密钥

        参数:
            key: 许可证密钥

        返回:
            是否成功保存
        """
        self.set("license_key", key)
        return True

    def get_license_key(self) -> str:
        """获取许可证密钥"""
        return self.get("license_key", "")

    def is_licensed(self) -> bool:
        """检查是否已授权"""
        return bool(self.get_license_key())

    def add_recent_file(self, file_path: str) -> None:
        """
        添加最近使用的文件

        参数:
            file_path: 文件路径
        """
        recent_files = self.get("recent_files", [])

        # 移除重复项
        if file_path in recent_files:
            recent_files.remove(file_path)

        # 添加到列表开头
        recent_files.insert(0, file_path)

        # 限制列表长度
        max_recent = self.get("max_recent_files", 10)
        if len(recent_files) > max_recent:
            recent_files = recent_files[:max_recent]

        self.set("recent_files", recent_files)

    def get_recent_files(self) -> list:
        """获取最近使用的文件列表"""
        return self.get("recent_files", [])

    def set_debug_mode(self, enabled: bool) -> None:
        """
        设置调试模式

        参数:
            enabled: 是否启用调试模式
        """
        self.set("debug_mode", enabled)

    def is_debug_mode(self) -> bool:
        """检查是否启用调试模式"""
        return self.get("debug_mode", False)

    def get_file_path(self) -> str:
        """获取配置文件路径"""
        return self.config_file


# 使用示例
if __name__ == "__main__":
    # 创建配置管理器实例
    config = ConfigManager()

    # 加载配置
    config.load()

    # 获取配置项
    print(f"应用名称: {config.get('app_name')}")
    print(f"调试模式: {config.is_debug_mode()}")

    # 设置配置项
    config.set("theme", "dark")
    config.set_debug_mode(True)

    # 添加最近使用的文件
    config.add_recent_file("/path/to/recent/file.png")

    # 获取所有配置
    print("\n所有配置:")
    for key, value in config.get_all().items():
        print(f"{key}: {value}")

    # 保存配置
    config.save()

    print(f"\n配置文件已保存到: {config.get_file_path()}")
