package com.plan.worker.framework.exception;

import com.plan.worker.framework.enums.WjjApiEnumsInterFace;
import lombok.Data;

/**
 * 自定义公共返回异常
 *
 * @author plan
 */
@Data
public class WjjApiException extends RuntimeException {
    private final WjjApiEnumsInterFace responseCode;

    private Object data;

    public WjjApiException(WjjApiEnumsInterFace responseCode) {
        super(responseCode.msg());
        this.responseCode = responseCode;
    }

    public WjjApiException(WjjApiEnumsInterFace responseCode, Object data) {
        super(responseCode.msg());
        this.responseCode = responseCode;
        this.data = data;
    }
}