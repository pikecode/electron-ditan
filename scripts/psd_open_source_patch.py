#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from copy import deepcopy
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps
from psd_tools import PSDImage
from psd_tools.api.layers import PixelLayer
from psd_tools.constants import Resource, Tag


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Replace the PSD effect-template pixel layer with a custom source image "
            "and save a patched PSD for downstream renderers such as Photopea."
        )
    )
    parser.add_argument("--psd", required=True, help="PSD effect template path")
    parser.add_argument("--source", required=True, help="Source image path")
    parser.add_argument("--edge-source", help="Optional edge-safe source image path")
    parser.add_argument("--output-psd", required=True, help="Output patched PSD path")
    parser.add_argument(
        "--fit",
        choices=("stretch", "cover", "contain"),
        default="stretch",
        help="How to place the source image into the PSD target layer bounds",
    )
    parser.add_argument(
        "--source-preprocess",
        choices=("none", "baked-grid-preview"),
        default="none",
        help="Optional source-image preprocessing mode before placing into PSD",
    )
    parser.add_argument(
        "--cell-scale",
        type=float,
        default=0.0,
        help="Optional source grid cell size in pixels for baked-grid-preview preprocessing",
    )
    parser.add_argument(
        "--metadata-json",
        help="Optional path to save patch metadata as JSON",
    )
    return parser.parse_args()


def configure_macos_library_fallback() -> None:
    candidates = []
    for path in ("/opt/homebrew/lib", "/usr/local/lib"):
        if Path(path).exists():
            candidates.append(path)
    if not candidates:
        return

    key = "DYLD_FALLBACK_LIBRARY_PATH"
    current = [item for item in os.environ.get(key, "").split(":") if item]
    merged = []
    for item in candidates + current:
        if item not in merged:
            merged.append(item)
    os.environ[key] = ":".join(merged)


def find_effect_layer_index(psd: PSDImage) -> int:
    for index, layer in enumerate(psd):
        try:
            if not getattr(layer, "effects", None):
                continue
            for effect in layer.effects:
                if type(effect).__name__ == "PatternOverlay" and getattr(effect, "enabled", False):
                    return index
        except Exception:
            continue
    raise RuntimeError("No PatternOverlay effect layer found in PSD")


def layer_is_clipping(layer) -> bool:
    clipping = getattr(layer, "clipping", None)
    if clipping is not None:
        return bool(clipping)
    record = getattr(layer, "_record", None)
    return bool(getattr(record, "clipping", False))


def find_clipping_base_layer_index(psd: PSDImage, effect_layer_index: int) -> int:
    for index in range(effect_layer_index - 1, -1, -1):
        if not layer_is_clipping(psd[index]):
            return index
    return -1


def place_image(image: Image.Image, size: tuple[int, int], fit: str) -> Image.Image:
    image = image.convert("RGBA")
    if image.size == size:
        return image
    if fit == "stretch":
        return image.resize(size, Image.Resampling.LANCZOS)
    if fit == "cover":
        return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=(0.5, 0.5))
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    contained = ImageOps.contain(image, size, method=Image.Resampling.LANCZOS)
    left = (size[0] - contained.width) // 2
    top = (size[1] - contained.height) // 2
    canvas.paste(contained, (left, top))
    return canvas


def resize_float_map(array: np.ndarray, size: tuple[int, int]) -> np.ndarray:
    image = Image.fromarray(np.clip(array * 255.0, 0, 255).astype(np.uint8))
    resized = image.resize(size, Image.Resampling.BICUBIC)
    return np.asarray(resized, dtype=np.float32) / 255.0


def build_boundary_weight(width: int, height: int, scale: float) -> np.ndarray:
    xs = np.arange(width, dtype=np.float32)
    ys = np.arange(height, dtype=np.float32)
    dx = np.mod(xs, scale)
    dy = np.mod(ys, scale)
    dx = np.minimum(dx, scale - dx)
    dy = np.minimum(dy, scale - dy)
    distance = np.minimum(dy[:, None], dx[None, :])
    radius = max(1.0, scale * 0.34)
    weight = np.clip(1.0 - distance / radius, 0.0, 1.0)
    return weight**1.15


def build_smooth_noise(width: int, height: int, pitch: float, seed: int) -> np.ndarray:
    safe_pitch = max(2.0, float(pitch))
    rng = np.random.default_rng(seed)
    small_w = max(2, int(np.ceil(width / safe_pitch)))
    small_h = max(2, int(np.ceil(height / safe_pitch)))
    base = rng.random((small_h, small_w), dtype=np.float32)
    return resize_float_map(base, (width, height))


def shift_with_edge(array: np.ndarray, dx: int, dy: int) -> np.ndarray:
    height, width = array.shape[:2]
    pad_x = abs(dx)
    pad_y = abs(dy)
    if array.ndim == 3:
        padded = np.pad(array, ((pad_y, pad_y), (pad_x, pad_x), (0, 0)), mode="edge")
    else:
        padded = np.pad(array, ((pad_y, pad_y), (pad_x, pad_x)), mode="edge")
    start_y = pad_y - dy
    start_x = pad_x - dx
    return padded[start_y : start_y + height, start_x : start_x + width]


def preprocess_baked_grid_preview(image: Image.Image, cell_scale: float) -> tuple[Image.Image, dict]:
    safe_scale = float(cell_scale or 0.0)
    if safe_scale < 4.0:
        return image.convert("RGBA"), {
            "mode": "baked-grid-preview",
            "applied": False,
            "reason": "cell-scale-too-small",
            "cell_scale": safe_scale,
        }

    rgba = image.convert("RGBA")
    width, height = rgba.size
    rgb = np.asarray(rgba.convert("RGB"), dtype=np.float32)
    alpha = np.asarray(rgba.getchannel("A"), dtype=np.uint8)

    blur_radius = max(0.8, safe_scale * 0.18)
    softened_rgb = np.asarray(
        rgba.convert("RGB").filter(ImageFilter.GaussianBlur(radius=blur_radius)),
        dtype=np.float32,
    )

    spray_shift = max(1, int(round(safe_scale * 0.22)))
    sprayed_rgb = (
        softened_rgb
        + shift_with_edge(softened_rgb, spray_shift, 0)
        + shift_with_edge(softened_rgb, -spray_shift, max(1, spray_shift // 2))
        + shift_with_edge(softened_rgb, 0, -spray_shift)
    ) / 4.0

    seed_base = int(width * 73856093 + height * 19349663 + round(safe_scale * 1009))
    boundary_weight = build_boundary_weight(width, height, safe_scale)
    breakup_noise = build_smooth_noise(width, height, safe_scale * 0.9, seed_base ^ 0x5F3759DF)
    grain_noise = build_smooth_noise(width, height, safe_scale * 0.3, seed_base ^ 0x45D9F3B)

    soft_weight = np.clip(boundary_weight * (0.54 + 0.32 * breakup_noise), 0.0, 0.62)
    spray_weight = np.clip(boundary_weight * np.maximum(0.0, breakup_noise - 0.35) * 0.24, 0.0, 0.24)
    keep_weight = np.clip(1.0 - soft_weight - spray_weight, 0.0, 1.0)

    output_rgb = rgb * keep_weight[..., None]
    output_rgb += softened_rgb * soft_weight[..., None]
    output_rgb += sprayed_rgb * spray_weight[..., None]

    grain = (grain_noise - 0.5) * (2.0 + boundary_weight * 4.5)
    output_rgb = np.clip(output_rgb + grain[..., None], 0.0, 255.0)

    output = Image.fromarray(np.dstack([output_rgb.astype(np.uint8), alpha]))
    return output, {
        "mode": "baked-grid-preview",
        "applied": True,
        "cell_scale": safe_scale,
        "blur_radius": round(float(blur_radius), 3),
        "spray_shift": int(spray_shift),
    }


def preprocess_source_image(
    image: Image.Image,
    preprocess_mode: str,
    cell_scale: float,
) -> tuple[Image.Image, dict]:
    mode = str(preprocess_mode or "none").strip().lower() or "none"
    if mode == "baked-grid-preview":
        return preprocess_baked_grid_preview(image, cell_scale)
    return image.convert("RGBA"), {"mode": "none", "applied": False}


def transfer_original_alpha(image: Image.Image, reference_layer) -> tuple[Image.Image, bool]:
    try:
        reference = reference_layer.topil()
        if reference is None:
            return image, False
        alpha = reference.convert("RGBA").getchannel("A")
        if alpha.size != image.size:
            alpha = alpha.resize(image.size, Image.Resampling.BILINEAR)
        output = image.copy()
        output.putalpha(alpha)
        return output, True
    except Exception:
        return image, False


def resolve_replacement_alpha_layer(psd: PSDImage, source_layer, clipping_base_layer_index: int):
    if layer_is_clipping(source_layer) and clipping_base_layer_index >= 0:
        try:
            return psd[clipping_base_layer_index]
        except Exception:
            return source_layer
    return source_layer


def blend_edge_safe_source(
    primary_image: Image.Image,
    edge_image: Image.Image | None,
    alpha_reference_layer,
    hard_kernel_size: int = 11,
    blur_radius: float = 1.6,
) -> tuple[Image.Image, bool]:
    if edge_image is None:
        return primary_image, False
    try:
        alpha_reference = alpha_reference_layer.topil()
        if alpha_reference is None:
            return primary_image, False

        output = primary_image.convert("RGBA")
        edge = edge_image.convert("RGBA")
        if alpha_reference.size != output.size:
            alpha_reference = alpha_reference.resize(output.size, Image.Resampling.BILINEAR)
        else:
            alpha_reference = alpha_reference.convert("RGBA")
        if edge.size != output.size:
            edge = edge.resize(output.size, Image.Resampling.LANCZOS)

        alpha_arr = np.asarray(alpha_reference.getchannel("A"), dtype=np.uint8)
        if not np.any(alpha_arr > 0):
            return output, False

        solid_mask = Image.fromarray(np.where(alpha_arr >= 254, 255, 0).astype(np.uint8))
        hard_kernel = max(3, int(hard_kernel_size) | 1)
        interior_mask = solid_mask.filter(ImageFilter.MinFilter(size=hard_kernel))
        interior_arr = np.asarray(interior_mask, dtype=np.uint8)

        band_arr = np.where(alpha_arr == 0, 0, np.where((alpha_arr < 254) | (interior_arr < 255), 255, 0)).astype(
            np.uint8
        )
        if not np.any(band_arr > 0):
            return output, False

        mask = Image.fromarray(band_arr)
        if blur_radius > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(radius=max(0.1, float(blur_radius))))

        blended = Image.composite(edge, output, mask)
        return blended.convert("RGBA"), True
    except Exception:
        return primary_image, False


def preserve_template_edge_rgb(
    image: Image.Image,
    template_layer,
    alpha_reference_layer,
    edge_kernel_size: int = 5,
) -> tuple[Image.Image, bool]:
    try:
        template = template_layer.topil()
        alpha_reference = alpha_reference_layer.topil()
        if template is None or alpha_reference is None:
            return image, False

        output = image.convert("RGBA")
        if template.size != output.size:
            template = template.resize(output.size, Image.Resampling.BILINEAR)
        else:
            template = template.convert("RGBA")
        if alpha_reference.size != output.size:
            alpha_reference = alpha_reference.resize(output.size, Image.Resampling.BILINEAR)
        else:
            alpha_reference = alpha_reference.convert("RGBA")

        alpha = alpha_reference.getchannel("A")
        alpha_arr = np.asarray(alpha, dtype=np.uint8)
        if not np.any(alpha_arr > 0):
            return output, False

        solid_mask = Image.fromarray(np.where(alpha_arr >= 254, 255, 0).astype(np.uint8))
        edge_kernel = max(3, int(edge_kernel_size) | 1)
        interior_mask = solid_mask.filter(ImageFilter.MinFilter(size=edge_kernel))
        edge_band = (alpha_arr > 0) & (np.asarray(interior_mask, dtype=np.uint8) < 255)
        if not np.any(edge_band):
            return output, False

        output_arr = np.asarray(output, dtype=np.uint8).copy()
        template_arr = np.asarray(template, dtype=np.uint8)
        output_arr[edge_band, :3] = template_arr[edge_band, :3]
        return Image.fromarray(output_arr), True
    except Exception:
        return image, False


def clone_effect_render_blocks(source_layer) -> tuple[object, list[str]]:
    allowed_tags = {
        Tag.OBJECT_BASED_EFFECTS_LAYER_INFO,
        Tag.EFFECTS_LAYER,
        Tag.LAYER_ID,
        Tag.BLEND_CLIPPING_ELEMENTS,
        Tag.BLEND_INTERIOR_ELEMENTS,
        Tag.KNOCKOUT_SETTING,
        Tag.PROTECTED_SETTING,
        Tag.REFERENCE_POINT,
    }
    cloned = deepcopy(source_layer._record.tagged_blocks)
    removed = []
    for key in list(cloned._items.keys()):
        if key not in allowed_tags:
            removed.append(getattr(key, "name", str(key)))
            cloned.pop(key, None)
    return cloned, removed


def patch_template_with_source(
    psd: PSDImage,
    source_path: str,
    edge_source_path: str | None,
    fit: str,
    source_preprocess: str = "none",
    cell_scale: float = 0.0,
) -> tuple[PSDImage, dict]:
    effect_layer_index = find_effect_layer_index(psd)
    effect_layer = psd[effect_layer_index]
    replacement_layer_index = effect_layer_index
    old_layer = effect_layer
    clipping_base_layer_index = find_clipping_base_layer_index(psd, effect_layer_index)
    source = Image.open(source_path)
    source_prepared, preprocess_info = preprocess_source_image(source, source_preprocess, cell_scale)
    placed = place_image(source_prepared, (old_layer.width, old_layer.height), fit)
    alpha_reference_layer = resolve_replacement_alpha_layer(psd, old_layer, clipping_base_layer_index)
    placed, reused_alpha = transfer_original_alpha(placed, alpha_reference_layer)
    preserved_edge_source = False
    if edge_source_path:
        edge_source = Image.open(edge_source_path)
        edge_placed = place_image(edge_source.convert("RGBA"), (old_layer.width, old_layer.height), fit)
        edge_placed, _ = transfer_original_alpha(edge_placed, alpha_reference_layer)
        placed, preserved_edge_source = blend_edge_safe_source(placed, edge_placed, alpha_reference_layer)
    preserved_template_edge = False
    if not preserved_edge_source:
        placed, preserved_template_edge = preserve_template_edge_rgb(placed, old_layer, alpha_reference_layer)

    new_layer = PixelLayer.frompil(
        placed,
        psd,
        name=old_layer.name,
        top=old_layer.top,
        left=old_layer.left,
    )
    new_layer.visible = old_layer.visible
    new_layer.opacity = old_layer.opacity
    new_layer.blend_mode = old_layer.blend_mode
    new_layer._record.clipping = old_layer._record.clipping
    filtered_blocks, removed_tagged_blocks = clone_effect_render_blocks(old_layer)
    new_layer._record.tagged_blocks = filtered_blocks

    psd.remove(old_layer)
    psd.insert(replacement_layer_index, new_layer)

    version_info = psd.image_resources.get_data(Resource.VERSION_INFO)
    if version_info:
        version_info.has_composite = False

    effect_summary = []
    for effect in effect_layer.effects:
        item = {
            "type": type(effect).__name__,
            "enabled": bool(getattr(effect, "enabled", False)),
            "opacity": float(getattr(effect, "opacity", 0) or 0),
            "blend_mode": str(getattr(effect, "blend_mode", b"") or ""),
        }
        if hasattr(effect, "pattern"):
            item["pattern_name"] = str(getattr(effect.pattern, "name", "") or "")
            item["pattern_id"] = str(getattr(effect.pattern, "id", "") or "")
            item["scale"] = float(getattr(effect, "scale", 0) or 0)
        effect_summary.append(item)

    metadata = {
        "effect_layer_index": effect_layer_index,
        "effect_layer_name": effect_layer.name,
        "effect_layer_clipping": layer_is_clipping(effect_layer),
        "clipping_base_layer_index": clipping_base_layer_index,
        "clipping_base_layer_name": psd[clipping_base_layer_index].name if clipping_base_layer_index >= 0 else "",
        "replacement_layer_index": replacement_layer_index,
        "replacement_layer_name": old_layer.name,
        "replacement_layer_clipping": layer_is_clipping(old_layer),
        "replacement_strategy": "effect-layer-rgb",
        "replacement_layer_alpha_reused": reused_alpha,
        "replacement_layer_edge_source_applied": preserved_edge_source,
        "replacement_layer_template_edge_preserved": preserved_template_edge,
        "edge_source": str(Path(edge_source_path).resolve()) if edge_source_path else "",
        "replacement_alpha_layer_name": getattr(alpha_reference_layer, "name", ""),
        "preserved_tagged_blocks": [getattr(key, "name", str(key)) for key in filtered_blocks._items.keys()],
        "removed_tagged_blocks": removed_tagged_blocks,
        "fit": fit,
        "source_size": [source.width, source.height],
        "source_preprocess": preprocess_info,
        "target_bbox": list(old_layer.bbox),
        "placed_size": [placed.width, placed.height],
        "effects": effect_summary,
        "version_info_has_composite": bool(getattr(version_info, "has_composite", False)) if version_info else False,
    }
    return psd, metadata


def main() -> None:
    args = parse_args()
    configure_macos_library_fallback()

    psd = PSDImage.open(args.psd)
    patched_psd, metadata = patch_template_with_source(
        psd,
        args.source,
        args.edge_source,
        args.fit,
        source_preprocess=args.source_preprocess,
        cell_scale=args.cell_scale,
    )

    output_path = Path(args.output_psd)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    patched_psd.save(output_path, encoding="utf-8")

    payload = {
        "psd": str(Path(args.psd).resolve()),
        "source": str(Path(args.source).resolve()),
        "edge_source": str(Path(args.edge_source).resolve()) if args.edge_source else "",
        "output_psd": str(output_path.resolve()),
        **metadata,
    }

    if args.metadata_json:
        metadata_path = Path(args.metadata_json)
        metadata_path.parent.mkdir(parents=True, exist_ok=True)
        metadata_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
