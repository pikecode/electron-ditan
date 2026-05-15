package com.plan.worker.response;

import com.plan.worker.framework.enums.WjjApiEnumsInterFace;

/**
 * 自定义请求 code 返回类（仅保留登录注册相关）
 */
public enum WjjApiResponseCode implements WjjApiEnumsInterFace<Integer> {
    METHOD_ARGUMENT_NOT_VALID(40300, "参数提交无效"),
    SERVER_ERROR(50005, "服务异常"),
    JSON_READER_ERROR(50005, "读取数据序列化发生错误"),
    REQUEST_DATA_KEY_ERROR(50006, "请求数据密钥获取失败"),
    PARAM_ERROR(40000, "参数错误"),
    NOT_LOGIN(40002, "未登录，请先登录"),
    LOGIN_EXPIRED(40003, "登录已过期，请重新登录"),
    INVALID_TOKEN(40004, "无效的登录凭证"),
    USER_NOT_EXIST(40005, "用户不存在，请检查账号是否正确或注册"),
    USER_DISABLED(40006, "账号已被禁用"),
    CODE_ERROR_OR_EXPIRED(40007, "验证码错误或已过期"),
    ACCOUNT_EXISTS(40008, "账号已存在"),
    EMAIL_REGISTERED(40009, "邮箱已被注册"),
    ACCOUNT_OR_PASSWORD_ERROR(40010, "账号或密码错误"),
    EMAIL_NOT_EXIST(40011, "邮箱不存在"),
    /** 积分/余额不足 */
    POINT_INSUFFICIENT(40001, "当前积分额度不足"),
    DATA_NOT_EXIST(50019, "数据不存在"),
    OPERATION_FAILED(50020, "操作失败"),
    ADMIN_NOT_LOGIN(40101, "登录已过期,请登陆后重试"),
    ADMIN_LOGIN_EXPIRED(40102, "登录已过期,请登陆后重试"),
    ADMIN_ACCOUNT_OR_PASSWORD_ERROR(40103, "账号或密码错误"),
    ADMIN_DISABLED(40104, "账号已禁用"),
    WECHAT_AUTH_EXPIRED(40021, "微信授权已过期，请重新授权"),
    SMS_SEND_TOO_FREQUENT(40022, "发送过于频繁，请稍后再试"),
    ACCOUNT_ALREADY_REGISTERED(40023, "该账号已注册"),

    /** 请先输入授权码激活后再使用功能 */
    NOT_ACTIVATED(40030, "请先输入授权码激活"),
    /** 授权码无效或不存在 */
    ACTIVATION_CODE_INVALID(40031, "授权码无效或不存在"),
    /** 该授权码已被使用 */
    ACTIVATION_CODE_USED(40032, "该授权码已被使用"),
    /** 违规拍摄已禁止进行拍照 */
    RESTRICT_SHOOT(40033, "违规拍摄已禁止进行拍照"),
    /** 违规拍摄已禁止提现 */
    RESTRICT_WITHDRAW(40034, "违规拍摄已禁止提现"),

    /** 本程序订阅已过期，请联系管理员进行续费 */
    LICENSE_EXPIRED(50009, "本程序订阅已过期，请联系管理员进行续费"),
    /** 很抱歉，由于您未支付相关开发费用，无法继续使用本程序 */
    ORDER_NO_PAY(50008, "很抱歉，由于您未支付相关开发费用，无法继续使用本程序"),
    /** 很抱歉，由于您未支付维护相关费用，无法继续使用本程序 */
    MAINTENANCE_ORDER_NO_PAY(500010, "很抱歉，由于您未支付维护相关费用，无法继续使用本程序"),
    ;

    private final Integer code;
    private final String msg;

    WjjApiResponseCode(Integer code, String msg) {
        this.code = code;
        this.msg = msg;
    }

    @Override
    public Integer code() {
        return code;
    }

    @Override
    public String msg() {
        return msg;
    }
}
