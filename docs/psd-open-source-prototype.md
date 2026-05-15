# PSD Open-Source Prototype

This prototype swaps the PSD content layer that actually drives the clipped effect stack, while keeping the original PSD layer style stack intact, then renders the result with `psd-tools`.

## Why this exists

The current browser-side path is limited by:

- PSD parser differences
- manual Pattern Overlay reimplementation
- no real PSD layer-style renderer
- weak color-management support

This prototype moves the effect render closer to the PSD itself.

## App integration status

This render path is now wired into the Electron app:

- Step 3 will prefer the Python PSD-native renderer for PSD `effect-template` files.
- If the Python environment is unavailable or the render fails, the app falls back to the existing BrushifyJS path.
- The packaged Electron build now includes `scripts/**/*`, with the Python script unpacked from `asar` so it can be executed externally.

## Setup

```bash
python3 -m venv .venv-psd-open
source .venv-psd-open/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r scripts/requirements-psd-open-source.txt
brew install vips
```

`pyvips` is optional for the first comparison run. The script works without it, but the metadata output will report whether `libvips` is available.
On macOS the script auto-adds Homebrew library paths, so no extra `DYLD_*` export is needed after `brew install vips`.

## Run

```bash
source .venv-psd-open/bin/activate
python scripts/psd_open_source_render.py \
  --psd '数据/DT4529 印刷 80x115cm-130x185格 拷贝.psd' \
  --source '数据/_analysis/lang_xml_extract/Original.jpg' \
  --output '数据/_analysis/psd_tools_swap_test_v2.png' \
  --reference '数据/_analysis/psd_composite.png' \
  --compare-against '/Users/suconnect/Downloads/lang_80x115cm-定义在ps里面_merged_20260429083327.png' \
  --metrics-json '数据/_analysis/psd_tools_swap_test_v2.metrics.json'
```

## Placement modes

- `--fit stretch`: match the current app semantics
- `--fit cover`: preserve aspect ratio and center-crop
- `--fit contain`: preserve aspect ratio and letterbox

## Current result

For the current `lang.xml` source image:

- `psd-tools` prototype vs reference composite: mean absolute diff `0.0 / 0.0 / 0.0`
- current app output vs PSD reference: mean absolute diff about `20.36 / 19.29 / 20.77`

The main breakthroughs were:

- replace the clipping stack's base layer, not the `PatternOverlay` layer itself
- reuse the original base layer alpha when transplanting the source image
