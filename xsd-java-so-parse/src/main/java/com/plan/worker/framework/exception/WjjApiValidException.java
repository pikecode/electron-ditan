package com.plan.worker.framework.exception;

import lombok.Data;

/**
 * 验证异常
 * <pre>
 *     用于检查参数合法性
 * </pre>
 *
 * @author plan
 */
@Data
public class WjjApiValidException extends RuntimeException {

    private String msg;
    private String id;

    public WjjApiValidException(String id, String msg) {
        this.msg = msg;
        this.id = id;
    }
}
