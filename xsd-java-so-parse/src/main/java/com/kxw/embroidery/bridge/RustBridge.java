package com.kxw.embroidery.bridge;

import com.plan.worker.configuration.XsdNativeLibraryConfiguration;

import java.io.FileWriter;
import java.io.IOException;

public class RustBridge {

    private static final String DEFAULT_NATIVE_LIBRARY =
            "/usr/local/xsd-parser-linux-x86_64-v0.0.3_xsd.so";

    private static volatile boolean loaded;

    public static String defaultNativeLibraryPath() {
        return DEFAULT_NATIVE_LIBRARY;
    }

    public static void ensureLoaded() {
        ensureLoaded(System.getProperty("xsd.parser.native.library", DEFAULT_NATIVE_LIBRARY));
    }

    public static synchronized void ensureLoaded(String absolutePathToSharedLibrary) {
        if (loaded) {
            return;
        }
        System.load(absolutePathToSharedLibrary);
        loaded = true;
    }

    public native String processDataWithAbsolutePath(String path);

    public static void main(String[] args) {
        ensureLoaded();
        RustBridge t = new RustBridge();
        String res = t.processDataWithAbsolutePath("/usr/local/BX1.xsd");

        System.out.println(res);

        try (FileWriter writer = new FileWriter("/usr/local/output.json")) {
            writer.write(res);
            System.out.println("已保存到 /usr/local/output.json");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}