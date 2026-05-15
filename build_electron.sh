#!/usr/bin/env bash
# 打包 EasyStitch Electron 前端
# 目标: macOS arm64 (dmg, zip) 与 Windows x64 (nsis, zip)
# 产物 zip 移动到仓库根目录 output/ 便于统一分发

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$ROOT_DIR"
OUTPUT_DIR="$ROOT_DIR/output"

mkdir -p "$OUTPUT_DIR"
export ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
cd "$APP_DIR"

echo "[1/5] 安装依赖"
npm install --no-audit --no-fund

echo "[2/5] 构建前端 (Vite)"
npm run build:vue

# macOS arm64
echo "[3/5] 打包 macOS arm64 (dmg, zip)"
# 使用 package.json 中的脚本
npm run dist:mac --workspaces=false

# Windows x64
echo "[4/5] 打包 Windows x64 (nsis, zip)"
# 使用 package.json 中的脚本 (会再次执行 build:vue, 如需避免重复可改成直接调用 electron-builder)
if ! npm run dist:win:x64 --workspaces=false; then
  echo "⚠️  Windows x64 打包脚本执行失败，尝试仅生成 zip" >&2
  npx electron-builder --win zip --x64 --publish=never || true
fi

echo "[5/5] 收集 zip 产物"
BUILD_DIR="$APP_DIR/build"
shopt -s nullglob
for f in "$BUILD_DIR"/*.zip; do
  echo "  -> 移动 $(basename "$f")"
  mv -f "$f" "$OUTPUT_DIR/"
done
shopt -u nullglob

echo "完成。产物已放置在: $OUTPUT_DIR"
ls -1 "$OUTPUT_DIR" || true
