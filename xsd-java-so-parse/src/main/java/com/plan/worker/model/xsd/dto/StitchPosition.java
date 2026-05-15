package com.plan.worker.model.xsd.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 与 XSD 解析结果中 fullstitches 项对应：坐标与调色板索引（原字段 palindex）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class StitchPosition {

    private double x;
    private double y;
    private int colorIndex;
}
