package com.plan.worker.model.xsd;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * 按绣线编号 id 映射 RGB。
 */
public final class EmbroideryDefaultPalette {

    private static final Map<Integer, int[]> RGB_BY_ID;

    static {
        Map<Integer, int[]> m = new HashMap<>();
        put(m, 1, 251, 163, 175);
        put(m, 2, 227, 130, 173);
        put(m, 3, 220, 87, 135);
        put(m, 4, 219, 25, 35);
        put(m, 5, 195, 30, 16);
        put(m, 6, 172, 28, 12);
        put(m, 7, 233, 67, 128);
        put(m, 8, 232, 105, 237);
        put(m, 9, 255, 224, 222);
        put(m, 10, 229, 215, 182);
        put(m, 11, 246, 247, 230);
        put(m, 12, 255, 253, 199);
        put(m, 13, 255, 227, 76);
        put(m, 14, 255, 197, 44);
        put(m, 15, 239, 179, 13);
        put(m, 16, 196, 90, 52);
        put(m, 17, 253, 117, 0);
        put(m, 18, 249, 47, 47);
        put(m, 19, 215, 149, 169);
        put(m, 20, 163, 98, 201);
        put(m, 21, 115, 36, 161);
        put(m, 22, 168, 248, 244);
        put(m, 23, 113, 194, 253);
        put(m, 24, 11, 125, 162);
        put(m, 25, 16, 16, 187);
        put(m, 26, 1, 114, 200);
        put(m, 27, 87, 80, 140);
        put(m, 28, 6, 6, 83);
        put(m, 29, 143, 255, 121);
        put(m, 30, 93, 181, 154);
        put(m, 31, 135, 135, 97);
        put(m, 32, 71, 85, 56);
        put(m, 33, 199, 168, 119);
        put(m, 34, 173, 132, 90);
        put(m, 35, 110, 54, 27);
        put(m, 36, 55, 28, 21);
        put(m, 37, 255, 255, 255);
        put(m, 38, 216, 214, 233);
        put(m, 39, 103, 105, 97);
        put(m, 40, 59, 54, 65);
        put(m, 41, 0, 0, 0);
        put(m, 42, 0, 125, 41);
        put(m, 43, 30, 189, 70);
        put(m, 44, 248, 94, 52);
        put(m, 45, 142, 178, 44);
        put(m, 46, 120, 222, 125);
        put(m, 47, 209, 237, 4);
        put(m, 48, 22, 67, 140);
        put(m, 49, 1, 101, 87);
        put(m, 50, 255, 150, 36);
        put(m, 51, 228, 98, 42);
        put(m, 52, 218, 140, 88);
        put(m, 53, 205, 125, 43);
        put(m, 54, 255, 165, 136);
        put(m, 55, 255, 150, 136);
        put(m, 56, 160, 162, 151);
        put(m, 57, 205, 87, 37);
        put(m, 58, 173, 67, 35);
        put(m, 59, 161, 67, 37);
        put(m, 60, 255, 200, 124);
        put(m, 61, 152, 93, 75);
        RGB_BY_ID = Collections.unmodifiableMap(m);
    }

    private static void put(Map<Integer, int[]> m, int id, int r, int g, int b) {
        m.put(id, new int[]{r, g, b});
    }

    private EmbroideryDefaultPalette() {
    }

    public static int[] rgbForColorId(int colorId) {
        return RGB_BY_ID.get(colorId);
    }

    public static int[] rgbForColorIdOrNull(int colorId) {
        return RGB_BY_ID.get(colorId);
    }
}
