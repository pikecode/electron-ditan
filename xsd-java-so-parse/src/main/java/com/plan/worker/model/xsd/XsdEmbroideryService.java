package com.plan.worker.model.xsd;

import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONArray;
import com.alibaba.fastjson.JSONObject;
import com.kxw.embroidery.bridge.RustBridge;
import com.plan.worker.model.xsd.dto.StitchPosition;
import com.plan.worker.model.xsd.dto.XsdParseResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

@Service
public class XsdEmbroideryService {

    @Value("${xsd.parser.scale:16}")
    private int scale;

    @Value("${xsd.parser.native-library:}")
    private String nativeLibraryPath;

    public XsdParseResponse parseXsdFile(Path xsdAbsolutePath) {
        String path = org.springframework.util.StringUtils.hasText(nativeLibraryPath)
                ? nativeLibraryPath
                : RustBridge.defaultNativeLibraryPath();
        RustBridge.ensureLoaded(path);
        RustBridge bridge = new RustBridge();
        String json = bridge.processDataWithAbsolutePath(xsdAbsolutePath.toAbsolutePath().toString());
        return renderFromNativeJson(json);
    }

    /**
     * 将原生返回的 JSON 字符串规范化为对象并渲染 PNG。
     */
    public XsdParseResponse renderFromNativeJson(String nativeJson) {
        JSONObject root = JSON.parseObject(nativeJson);
        JSONObject result = unwrapResult(root);
        JSONObject pattern = result.getJSONObject("pattern");
        JSONObject fabric = pattern.getJSONObject("fabric");
        int width = fabric.getIntValue("width");
        int height = fabric.getIntValue("height");
        JSONArray patternPalette = pattern.getJSONArray("palette");
        JSONArray fullstitches = pattern.getJSONArray("fullstitches");

        int[][] gridRgb = new int[height][width];
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                gridRgb[y][x] = packRgb(255, 255, 255);
            }
        }

        List<StitchPosition> stitches = new ArrayList<>(fullstitches.size());
        for (int i = 0; i < fullstitches.size(); i++) {
            JSONObject stitch = fullstitches.getJSONObject(i);
            double sx = stitch.getDoubleValue("x");
            double sy = stitch.getDoubleValue("y");
            int palIndex = stitch.getIntValue("palindex");
            stitches.add(new StitchPosition(sx, sy, palIndex));

            if (palIndex < 0 || palIndex >= patternPalette.size()) {
                continue;
            }
            JSONObject palItem = patternPalette.getJSONObject(palIndex);
            int colorId = parseColorNumber(palItem.getString("number"));
            int[] rgb = EmbroideryDefaultPalette.rgbForColorIdOrNull(colorId);
            if (rgb == null) {
                rgb = hexToRgb(palItem.getString("color"));
            }
            int ix = (int) sx;
            int iy = (int) sy;
            if (ix >= 0 && ix < width && iy >= 0 && iy < height) {
                gridRgb[iy][ix] = packRgb(rgb[0], rgb[1], rgb[2]);
            }
        }

        int outW = width * scale;
        int outH = height * scale;
        BufferedImage img = new BufferedImage(outW, outH, BufferedImage.TYPE_INT_RGB);
        for (int gy = 0; gy < height; gy++) {
            for (int gx = 0; gx < width; gx++) {
                int c = gridRgb[gy][gx];
                for (int dy = 0; dy < scale; dy++) {
                    for (int dx = 0; dx < scale; dx++) {
                        img.setRGB(gx * scale + dx, gy * scale + dy, c);
                    }
                }
            }
        }

        String rawB64 = toPngBase64(img);
        String dataUri = "data:image/png;base64," + rawB64;
        return new XsdParseResponse(dataUri, outW, outH, stitches, width, height, scale);
    }

    private static JSONObject unwrapResult(JSONObject root) {
        Object resultObj = root.get("result");
        if (resultObj == null) {
            throw new IllegalArgumentException("JSON 缺少字段 result");
        }
        if (resultObj instanceof String) {
            return JSON.parseObject((String) resultObj);
        }
        if (resultObj instanceof JSONObject) {
            return (JSONObject) resultObj;
        }
        throw new IllegalArgumentException("字段 result 类型不支持: " + resultObj.getClass());
    }

    private static int parseColorNumber(String number) {
        if (number == null || number.isEmpty()) {
            return 0;
        }
        try {
            return Integer.parseInt(number.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static int[] hexToRgb(String hexColor) {
        String hex = hexColor == null ? "" : hexColor.trim();
        if (hex.startsWith("#")) {
            hex = hex.substring(1);
        }
        if (hex.length() != 6) {
            return new int[]{255, 255, 255};
        }
        int r = Integer.parseInt(hex.substring(0, 2), 16);
        int g = Integer.parseInt(hex.substring(2, 4), 16);
        int b = Integer.parseInt(hex.substring(4, 6), 16);
        return new int[]{r, g, b};
    }

    private static int packRgb(int r, int g, int b) {
        return (r << 16) | (g << 8) | b;
    }

    private static String toPngBase64(BufferedImage img) {
        try (ByteArrayOutputStream bos = new ByteArrayOutputStream()) {
            ImageIO.write(img, "png", bos);
            return Base64.getEncoder().encodeToString(bos.toByteArray());
        } catch (IOException e) {
            throw new IllegalStateException("PNG 编码失败", e);
        }
    }

    /**
     * 将上传文件保存到临时路径并解析（调用方负责删除临时文件）。
     */
    public Path saveUploadToTemp(byte[] content, String originalFilename) throws IOException {
        String suffix = ".xsd";
        if (originalFilename != null && originalFilename.contains(".")) {
            suffix = originalFilename.substring(originalFilename.lastIndexOf('.'));
        }
        Path temp = Files.createTempFile("xsd-upload-", suffix);
        Files.write(temp, content);
        return temp;
    }
}
