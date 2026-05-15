package com.plan.worker.configuration;

import com.kxw.embroidery.bridge.RustBridge;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import javax.annotation.PostConstruct;

/**
 * 从配置文件读取 XSD 解析原生库路径，应用启动时加载 .so。
 * 配置项：xsd.parser.native-library（application.yml）
 */
@Configuration
public class XsdNativeLibraryConfiguration {

    private static final Logger log = LoggerFactory.getLogger(XsdNativeLibraryConfiguration.class);

    @Value("${xsd.parser.native-library:}")
    private String nativeLibraryPath;

    @PostConstruct
    public void loadNativeLibrary() {
        String path = StringUtils.hasText(nativeLibraryPath)
                ? nativeLibraryPath
                : RustBridge.defaultNativeLibraryPath();
        log.info("正在加载 XSD 解析原生库，路径：{}", path);
        try {
            RustBridge.ensureLoaded(path);
            log.info("XSD 解析原生库加载成功：{}", path);
        } catch (UnsatisfiedLinkError e) {
            log.error("XSD 解析原生库加载失败，路径：{}，错误：{}", path, e.getMessage(), e);
            throw e;
        }
    }
}
