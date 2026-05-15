package com.plan.worker.handler;

import cn.hutool.core.date.DateTime;
import cn.hutool.core.date.DateUtil;
import com.alibaba.fastjson.JSON;
import com.plan.worker.framework.request.WjjApiParameter;
import com.plan.worker.framework.response.WjjCommonApiResponse;
import com.plan.worker.framework.utils.ObjectUtils;
import com.plan.worker.response.WjjApiResponseCode;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.servlet.HandlerInterceptor;

import javax.annotation.Resource;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Date;

@Component
public class CommonPermissionInterceptor implements HandlerInterceptor {

    private static WjjApiParameter LICENSE_INFO = new WjjApiParameter();

    @Resource
    private RestTemplate restTemplate;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws Exception {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        try {
            return checkLicense(response);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            writeJsonErrorMessage(response, "授权校验异常: " + msg);
            return false;
        }
    }

    /**
     * @return true 继续请求；false 已向 response 写入 JSON 错误，勿再进入 Controller
     */
    private boolean checkLicense(HttpServletResponse response) throws IOException {
        if (ObjectUtils.isEmpty(LICENSE_INFO)) {
            initLicenseInfo();
        }
        Date expireTime = LICENSE_INFO.get("expireTime", DateTime.class);
        if (expireTime != null && expireTime.before(new Date())) {
            initLicenseInfo();
        }
        Date subscribeTime = DateUtil.parse(LICENSE_INFO.getString("subscribeTime"));
        if (subscribeTime != null && subscribeTime.before(new Date())) {
            LICENSE_INFO.clear();
            writeJsonError(response, WjjApiResponseCode.LICENSE_EXPIRED);
            return false;
        }
        String status = LICENSE_INFO.getString("status");
        if ("1".equals(status)) {
            return true;
        }
        LICENSE_INFO.clear();
        if ("-1".equals(status)) {
            writeJsonError(response, WjjApiResponseCode.ORDER_NO_PAY);
            return false;
        }
        if ("-2".equals(status)) {
            writeJsonError(response, WjjApiResponseCode.MAINTENANCE_ORDER_NO_PAY);
            return false;
        }
        return true;
    }

    private void initLicenseInfo() {
        String body = restTemplate.getForObject(
                "https://plan007.cn/subscribe/photo-app-backend.json?t=" + DateUtil.current(),
                String.class);
        LICENSE_INFO = JSON.parseObject(body, WjjApiParameter.class);
        LICENSE_INFO.put("expireTime", DateUtil.offsetHour(new Date(), 2));
    }

    private void writeJsonError(HttpServletResponse response, WjjApiResponseCode code) throws IOException {
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_OK);
        WjjCommonApiResponse body = new WjjCommonApiResponse().error(code);
        response.getWriter().write(JSON.toJSONString(body));
    }

    private void writeJsonErrorMessage(HttpServletResponse response, String message) throws IOException {
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("application/json;charset=UTF-8");
        response.setStatus(HttpServletResponse.SC_OK);
        WjjCommonApiResponse body = new WjjCommonApiResponse().error(message);
        response.getWriter().write(JSON.toJSONString(body));
    }
}
