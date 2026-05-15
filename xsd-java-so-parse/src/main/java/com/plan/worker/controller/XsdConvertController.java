package com.plan.worker.controller;

import com.plan.worker.framework.annotation.WjjApiParams;
import com.plan.worker.framework.request.WjjApiValidRequest;
import com.plan.worker.framework.response.WjjCommonApiResponse;
import com.plan.worker.model.xsd.XsdEmbroideryService;
import com.plan.worker.model.xsd.dto.XsdParseResponse;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import javax.annotation.Resource;
import java.nio.file.Files;
import java.nio.file.Path;

@RestController
@RequestMapping("/api/xsd")
public class XsdConvertController {

    @Resource
    private XsdEmbroideryService xsdEmbroideryService;

    /**
     * 上传 XSD 文件，返回 PNG Base64 与各针迹位置及调色板索引
     */
    @PostMapping("/parse")
    @WjjApiParams(valid = false, position = WjjApiParams.ValidParamPosition.PARAM)
    public WjjCommonApiResponse parse(WjjApiValidRequest request) {
        MultipartFile file = request.getFile("file");
        if (file == null || file.isEmpty()) {
            return new WjjCommonApiResponse().error("请上传非空的 XSD 文件");
        }
        Path temp = null;
        try {
            byte[] bytes = file.getBytes();
            temp = xsdEmbroideryService.saveUploadToTemp(bytes, file.getOriginalFilename());
            XsdParseResponse data = xsdEmbroideryService.parseXsdFile(temp);
            return new WjjCommonApiResponse().success(data);
        } catch (UnsatisfiedLinkError e) {
            return new WjjCommonApiResponse().error("原生库链接失败: " + e.getMessage());
        } catch (Exception e) {
            return new WjjCommonApiResponse().error("解析失败: " + e.getMessage());
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (Exception ignored) {
                }
            }
        }
    }
}
