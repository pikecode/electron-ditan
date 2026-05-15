import json
import os
import shutil
import tempfile
from ctypes import CDLL, c_char, c_char_p, c_int, create_string_buffer
from typing import Optional

from exceptions import RustBridgeException
from models import Pattern, PatternProject, PaletteItem, FullStitch, StitchesPerInch, Fabric


class RustBridge:
    _instance = None

    def __new__(cls):
        if not cls._instance:
            cls._instance = super().__new__(cls)
            cls._instance._load_library()
        return cls._instance

    def _load_library(self):
        native_dir = "native"
        lib_path = os.path.join("xsd-parser-linux-x86_64-v0.0.3_xsd.so")

        if not os.path.exists(lib_path):
            raise RustBridgeException(f"Not find library: {lib_path}")

        temp_dir = tempfile.mkdtemp(prefix="native-lib-")
        temp_file = os.path.join(temp_dir, os.path.basename(lib_path))
        shutil.copy2(lib_path, temp_file)

        self._library = CDLL(temp_file)
        self._library.processDataWithAbsolutePath.argtypes = [c_char_p]
        self._library.processDataWithAbsolutePath.restype = c_char_p
        self._library.processDataWithBinary.argtypes = [c_char_p, c_int]
        self._library.processDataWithBinary.restype = c_char_p

    def _process_data_with_absolute_path(self, absolute_path):
        result = self._library.processDataWithAbsolutePath(absolute_path.encode())
        return result.decode()

    def _process_data_with_binary(self, file_bytes):
        # 将字节数据转换为ctypes类型
        data_bytes = create_string_buffer(file_bytes)
        result = self._library.processDataWithBinary(data_bytes, len(file_bytes))
        return result.decode()

    def parse_xsd_file(self, absolute_path) -> Optional[PatternProject]:
        try:
            result = self._process_data_with_absolute_path(absolute_path)
            return self._parse_result(result)
        except json.JSONDecodeError as e:
            raise RustBridgeException(f"parse xsd failed: {absolute_path}", e)

    def parse_xsd_file_binary(self, file_bytes) -> Optional[PatternProject]:
        try:
            if not file_bytes:
                raise RustBridgeException("data is null ", None)
            result = self._process_data_with_binary(file_bytes)
            return self._parse_result(result)
        except json.JSONDecodeError as e:
            raise RustBridgeException("parse xsd failed: ", e)

    def _parse_result(self, result) -> Optional[PatternProject]:
        if not result:
            raise RustBridgeException("result is null ", None)

        response = json.loads(result)
        if response.get("status", "").lower() == "success":
            pattern = self._create_pattern(response["result"])
            return PatternProject(pattern)
        elif response.get("message"):
            raise RustBridgeException(response["message"], None)
        return None

    def _create_pattern(self, result):
        fabric_data = result["fabric"]
        spi = StitchesPerInch(fabric_data["spi"]["x"], fabric_data["spi"]["y"])
        fabric = Fabric(fabric_data["width"], fabric_data["height"], spi, fabric_data["kind"], fabric_data["name"],
                        fabric_data["color"])

        palette = [PaletteItem(item["brand"], item["number"], item["name"], item["color"]) for item in
                   result["palette"]]
        fullstitches = [FullStitch(stitch["x"], stitch["y"], stitch["palindex"]) for stitch in result["fullstitches"]]

        return Pattern(fabric, palette, fullstitches)    