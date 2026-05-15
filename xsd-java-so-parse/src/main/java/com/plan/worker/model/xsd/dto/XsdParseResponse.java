package com.plan.worker.model.xsd.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class XsdParseResponse {

    /**
     * Data URI：前缀 {@code data:image/png;base64,} 加上 PNG 的 Base64 正文，可直接用于 img src。
     */
    private String imageBase64;

    /**
     * 输出图像宽高（已按 scale 放大后的像素尺寸）。
     */
    private int imageWidth;
    private int imageHeight;

    /**
     * 与解析 JSON 中 fullstitches 顺序一致；colorIndex 对应 palindex。
     */
    private List<StitchPosition> stitches;

    /**
     * 底布网格尺寸（与 fabric.width / fabric.height 一致）。
     */
    private int fabricWidth;
    private int fabricHeight;

    /**
     * 渲染时像素放大倍数
     */
    private int scale;
}
