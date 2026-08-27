package com.jacy.sidequest;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * Native side of SideQuest's self-update: downloads the new APK straight to the app's
 * cache dir (no CORS, no base64 round-trip) and hands it to the Android package
 * installer through the FileProvider already declared in the manifest. Also posts a
 * system notification when the app has been updated, so the phone's notification tray
 * celebrates the new version even if the in-app toast was missed.
 */
@CapacitorPlugin(
    name = "SideQuestUpdater",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class SideQuestUpdaterPlugin extends Plugin {

    private static final String CHANNEL_ID = "sidequest_updates";
    private static final int NOTIFICATION_ID = 42;

    // Version/notes of the update awaiting a permission grant (if the user has to
    // approve POST_NOTIFICATIONS on Android 13+ before we can post).
    private String pendingVersion = "";
    private String pendingNotes = "";

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

    /**
     * Verifies the downloaded APK's SHA-256 against the expected value before it is
     * handed to the installer. A mismatch (tampered or corrupted release asset) is
     * rejected so a bad file is never installed. Returns { ok: true } on match.
     */
    @PluginMethod
    public void verifyApk(PluginCall call) {
        String fileName = call.getString("fileName", "sidequest-update.apk");
        String expected = call.getString("expectedSha256");
        if (expected == null) {
            // No pin for this version — allow install but signal unverified.
            JSObject ret = new JSObject();
            ret.put("ok", true);
            ret.put("verified", false);
            call.resolve(ret);
            return;
        }
        File file = new File(getContext().getCacheDir(), fileName);
        if (!file.exists()) {
            call.reject("APK not found: " + file.getAbsolutePath());
            return;
        }
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            try (InputStream in = new java.io.FileInputStream(file)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) md.update(buf, 0, n);
            }
            StringBuilder hex = new StringBuilder();
            for (byte b : md.digest()) hex.append(String.format("%02x", b));
            boolean match = hex.toString().equalsIgnoreCase(expected);
            JSObject ret = new JSObject();
            ret.put("ok", match);
            ret.put("verified", true);
            ret.put("actual", hex.toString());
            if (match) {
                call.resolve(ret);
            } else {
                call.reject("APK hash mismatch — expected " + expected + " but got " + hex);
            }
        } catch (Exception e) {
            call.reject("Hash check failed: " + e.getMessage());
        }
    }

    /**
     * Posts a "SideQuest updated to vX.Y.Z" notification to the system tray. On Android 13+
     * the POST_NOTIFICATIONS permission is requested first (one-time system dialog); the
     * notification is posted once granted. On older Android it posts immediately.
     */
    @PluginMethod
    public void showUpdatedNotification(PluginCall call) {
        pendingVersion = call.getString("version", "");
        pendingNotes = call.getString("notes", "");

        ensureChannel();

        if (Build.VERSION.SDK_INT >= 33 && !hasNotificationPermission()) {
            requestPermissionForAlias("notifications", call, "updatedNotificationPermissionResult");
            return;
        }
        postUpdatedNotification();
        call.resolve();
    }

    @PermissionCallback
    private void updatedNotificationPermissionResult(PluginCall call) {
        if (hasNotificationPermission()) {
            postUpdatedNotification();
        }
        call.resolve();
    }

    private boolean hasNotificationPermission() {
        return getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "SideQuest updates",
                    NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("New SideQuest versions");
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }
    }

    private void postUpdatedNotification() {
        if (pendingVersion.isEmpty()) return;

        Intent tapIntent = new Intent(getContext(), getActivity().getClass());
        tapIntent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                getContext(), 0, tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String text = pendingNotes != null && !pendingNotes.isEmpty()
                ? pendingNotes
                : "Tap to open the new version.";
        if (text.length() > 240) text = text.substring(0, 240) + "…";

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("🎉 SideQuest updated to v" + pendingVersion)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setContentIntent(contentIntent)
                .setAutoCancel(true);

        try {
            NotificationManagerCompat.from(getContext()).notify(NOTIFICATION_ID, builder.build());
        } catch (SecurityException e) {
            // Permission denied — the in-app toast still covers the celebration.
        }
    }
}
