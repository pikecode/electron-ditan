package com.plan.worker.framework.request;

import cn.hutool.core.util.ObjectUtil;
import cn.hutool.extra.servlet.ServletUtil;
import com.alibaba.fastjson.JSONObject;
import com.plan.worker.framework.annotation.WjjApiParams;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.context.support.WebApplicationContextUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.util.List;
import java.util.Map;

/**
 * @author plan
 * <pre>
 *     配合验证请求仅获得指定参数
 * </pre>
 */
public class WjjApiValidRequest {
    Logger logger = LoggerFactory.getLogger(WjjApiValidRequest.class);

    private HttpServletRequest request;
    private HttpServletResponse response;
    private WjjApiParameter parameter;


    public WjjApiValidRequest() {
    }


    public WjjApiValidRequest(WjjApiParams wjjApiParams, HttpServletRequest request, HttpServletResponse response) {
        this.request = request;
        this.response = response;
        build(wjjApiParams, request);
    }

    public WjjApiParameter getParameter() {
        return parameter;
    }


    public HttpServletRequest getRequest() {
        return request;
    }

    public HttpServletResponse getResponse() {
        return response;
    }

    public void build(WjjApiParams wjjApiParams, HttpServletRequest request) {
        WjjApiParameter parameter = new WjjApiParameter();
        WjjApiParams.ValidParamPosition position = wjjApiParams.position();
        //判断获取参数的方式
        if (position == WjjApiParams.ValidParamPosition.ALL) {
            parameter.putAll(getRequestParameters(request));
            parameter.putAll(getRequestBody(request));
        } else if (position == WjjApiParams.ValidParamPosition.PARAM) {
            parameter.putAll(getRequestParameters(request));
        } else {
            parameter.putAll(getRequestBody(request));
        }
        this.parameter = parameter;
    }

    private Map<String, ?> getRequestParameters(HttpServletRequest request) {
        return ServletUtil.getParamMap(request);
    }

    private JSONObject getRequestBody(HttpServletRequest request) {
        String body = ServletUtil.getBody(request);
        try {
            if (ObjectUtil.isNotEmpty(body)) {
                return JSONObject.parseObject(body);
            }
        } catch (Exception e) {
            logger.error("json格式化错误,参数:{}@", body);
        }
        return new JSONObject();
    }

    public Object getAttribute(String key) {
        return request.getAttribute(key);
    }

    public void setAttribute(String key, Object value) {
        request.setAttribute(key, value);
    }

    public Cookie[] getCookies() {
        return request.getCookies();
    }

    public String getCookieStr() {
        Cookie[] cookies = getCookies();
        if (cookies != null) {
            StringBuilder cookieStringBuilder = new StringBuilder();
            for (Cookie cookie : cookies) {
                cookieStringBuilder.append(cookie.getName()).append("=").append(cookie.getValue()).append("; ");
            }
            return cookieStringBuilder.toString();
        }
        return "";
    }

    public Cookie[] getSpriteCookie() {
        return request.getCookies();
    }

    public WebApplicationContext getWebApplicationContext() {
        return WebApplicationContextUtils.getWebApplicationContext(request.getServletContext());
    }

    public Cookie addCookies(String name, String value) {
        return addCookies(name, value, -7);
    }

    public Cookie addCookies(String name, String value, int maxAge) {
        WebApplicationContext applicationContext = getWebApplicationContext();
        Environment environment = applicationContext.getBean(Environment.class);
        boolean httpOnly = environment.getProperty("server.servlet.session.cookie.http-only", boolean.class, false);
        boolean secure = environment.getProperty("server.servlet.session.cookie.secure", boolean.class, false);
        maxAge = maxAge != -7 ? maxAge : environment.getProperty("server.servlet.session.timeout", int.class, 30);
        Cookie cookie = new Cookie(name, value);
        cookie.setHttpOnly(httpOnly);
        cookie.setSecure(secure);
        cookie.setMaxAge(maxAge);
        response.addCookie(cookie);
        return cookie;
    }


    public void addHeader(String name, String value) {
        response.addHeader(name, value);
    }

    public void setHeader(String name, String value) {
        response.setHeader(name, value);
    }

    public boolean isHttps() {
        String scheme = request.getScheme();
        return scheme.startsWith("https");
    }

    public HttpSession getSession() {
        return request.getSession();
    }

    public HttpSession getSession(boolean b) {
        return request.getSession(b);
    }

    public Object getSessionValue(String key) {
        return getSession().getAttribute(key);
    }

    public <T> T getSessionValue(String key, Class<T> clazz) {
        Object obj = getSessionValue(key);
        return obj == null ? null : (T) obj;
    }

    public WjjApiValidRequest put(String key, Object value) {
        request.setAttribute(key, value);
        return this;
    }

    public MultipartFile getFile(String key) {
        if (this.request instanceof MultipartHttpServletRequest) {
            MultipartHttpServletRequest request = (MultipartHttpServletRequest) this.request;
            return request.getFile(key);
        } else {
            return null;
        }
    }

    public List<MultipartFile> getFiles(String key) {
        if (this.request instanceof MultipartHttpServletRequest) {
            MultipartHttpServletRequest request = (MultipartHttpServletRequest) this.request;
            return request.getFiles(key);
        } else {
            return null;
        }
    }

    public String getClientIP() {
        return ServletUtil.getClientIP(request);
    }
}
