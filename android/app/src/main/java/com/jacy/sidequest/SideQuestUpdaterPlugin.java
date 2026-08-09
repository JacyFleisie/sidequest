package com.jacy.sidequest;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Native side of SideQuest's self-update: downloads the new APK straight to the app's
 * cache dir (no CORS, no base64 round-trip) and hands it to the Android package
 * installer through the FileProvider already declared in the manifest.
 */
@CapacitorPlugin(name = "SideQuestUpdater")
public class SideQuestUpdaterPlugin extends Plugin {

    @PluginMethod
    public void downloadApk(PluginCall call) {
        String url = call.getString("url");
        final String fileName = call.getString("fileName", "sidequest-update.apk");
        if (url == null) {
            call.reject("url is required");
            return;
        }
        final File file = new File(getContext().getCacheDir(), fileName);
        new Thread(() -> {
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setInstanceFollowRedirects(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(60000);
                conn.connect();
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    getActivity().runOnUiThread(() -> call.reject("Download failed: HTTP " + code));
                    return;
                }
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(file)) {
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                    }
                }
                JSObject ret = new JSObject();
                ret.put("path", file.getAbsolutePath());
                getActivity().runOnUiThread(() -> call.resolve(ret));
            } catch (Exception e) {
                getActivity().runOnUiThread(() -> call.reject("Download failed: " + e.getMessage()));
            }
        }).start();
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        String fileName = call.getString("fileName", "sidequest-update.apk");
        File file = new File(getContext().getCacheDir(), fileName);
        if (!file.exists()) {
            call.reject("APK not found: " + file.getAbsolutePath());
            return;
        }
        Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, "application/vnd.android.package-archive");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open installer: " + e.getMessage());
        }
    }
}
