package com.tally.movers;

import android.Manifest;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Log;
import android.view.ViewGroup;
import android.content.pm.PackageInfo;
import android.content.pm.Signature;
import android.os.Build;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.GeolocationPermissions;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * MoveCrew for Android: the MoveCrew web app, packaged inside the APK and shown full screen.
 *
 * The page is served from https://appassets.androidplatform.net/assets/ so it runs on a
 * secure address (sign-in, location and storage all need one) without needing a website.
 * Everything else the page links to (phone calls, texts, maps) opens in the phone's own apps.
 */
public class MainActivity extends Activity {
    private static final String TAG = "TallyWeb";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/assets/index.html";
    private static final int REQ_FILES = 41;
    private static final int REQ_LOCATION = 42;
    // photos: made smaller here before the page reads them, kept in the cache under picked/ (see readyPhoto)
    private static final String PICKED = "picked";
    private static final int PHOTO_MAX = 1600;
    private static final String PREF_BATCHES = "photoBatches";
    // what a pick needs when Android closes MoveCrew while the camera or the gallery is open
    private static final String KEY_CAMERA = "tally.camera", KEY_IMAGES = "tally.images", KEY_FOR = "tally.photoFor";

    private FrameLayout root;
    private WebViewAssetLoader assets;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private boolean pickImages;          // the open picker is for photos only (not a form or a document)
    private volatile String pickFor;     // what the page said they are for: {"job":…,"kind":…}
    private volatile boolean readying;   // photos are being made ready for the page
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        if (saved != null) {
            // Android closed MoveCrew while the camera or the gallery was open: the pick comes back to this one
            String c = saved.getString(KEY_CAMERA);
            cameraUri = c == null ? null : Uri.parse(c);
            pickImages = saved.getBoolean(KEY_IMAGES, false);
            pickFor = saved.getString(KEY_FOR);
        }

        root = new FrameLayout(this);
        root.setBackgroundColor(0xFF141B2D);
        setContentView(root);

        // Android 15 draws apps edge to edge. Keep MoveCrew clear of the status bar, the
        // navigation bar, any camera cutout, and the keyboard.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        // the app's own files, and the photos made ready for the page (fetched at /picked/<name> after a restart)
        assets = new WebViewAssetLoader.Builder()
                .setDomain(HOST)
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/" + PICKED + "/", new WebViewAssetLoader.InternalStoragePathHandler(this, pickedDir()))
                .build();
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        buildWeb();
        // a WebView that can't bring its last page back would stay blank: start the app again instead
        if (saved == null || web.restoreState(saved) == null) web.loadUrl(START);
        io.execute(this::tidyPhotos);
    }

    /* The window the page runs in. Made again when Android stops the page's own process (onRenderProcessGone). */
    private void buildWeb() {
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportMultipleWindows(false);
        s.setUserAgentString(s.getUserAgentString() + " TallyAndroid/" + BuildConfig.VERSION_NAME);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assets.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // frames inside the page (Stripe's card box and its bank check) load in place;
                // only the page itself leaving for another site opens outside
                if (!request.isForMainFrame()) return false;
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openOutside(u);
                return true;
            }

            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                // The page's own process stopped (Android needed the memory, or it crashed). Left alone, Android
                // closes the whole app: open the page again instead. A photo being picked now is kept for it.
                Log.w(TAG, "The page stopped (" + (detail.didCrash() ? "it crashed" : "Android needed the memory") + "); opening it again.");
                if (view != web) return true;
                fileCallback = null;
                root.removeView(view);
                view.destroy();
                buildWeb();
                web.loadUrl(START);
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                return chooseFiles(callback, params);
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocation()) {
                    callback.invoke(origin, true, false);
                    return;
                }
                geoOrigin = origin;
                geoCallback = callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, m.messageLevel() + " " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });

        web.addJavascriptInterface(new NativeBridge(), "TallyNative");
    }

    /* ---------- Google Maps distances ----------
       The Google key comes from the TALLY_GOOGLE_MAPS_KEY repository secret at build time.
       Each request names this app and its signing key, so a key restricted to
       "Android apps: com.tally.movers + this SHA-1" works here and nowhere else. */
    private class NativeBridge {
        @JavascriptInterface
        public boolean hasGoogle() {
            return BuildConfig.MAPS_KEY != null && !BuildConfig.MAPS_KEY.isEmpty();
        }

        @JavascriptInterface
        public void routeDistance(final String id, final String from, final String to) {
            new Thread(() -> {
                final String result = googleRoute(from, to);
                runOnUiThread(() -> {
                    if (web != null) web.evaluateJavascript("window.__tallyNativeDone&&window.__tallyNativeDone(" + JSONObject.quote(id) + "," + result + ")", null);
                });
            }).start();
        }

        /* Photos. The page says what the next photos are for just before the picker opens, so that if
           Android closes MoveCrew meanwhile, the page that opens next can put them on that job. */
        @JavascriptInterface
        public void photosFor(String what) {
            pickFor = what;
        }

        /* Photos picked while MoveCrew was closed, waiting for the page: {"busy":…, "batches":[{id, for, names, ts}]};
           each name is a file the page fetches at /picked/<name>. */
        @JavascriptInterface
        public String pendingPhotos() {
            try {
                return new JSONObject().put("busy", readying).put("batches", batches()).toString();
            } catch (Exception e) {
                return "{\"busy\":false,\"batches\":[]}";
            }
        }

        /* The page saved that batch (or gave up on it): its files go. */
        @JavascriptInterface
        public void photosDone(String id) {
            final JSONObject b = dropBatch(id);
            if (b == null) return;
            try {
                io.execute(() -> forget(b.optJSONArray("names")));
            } catch (Exception e) {
                Log.w(TAG, "Photos kept for now: " + e);
            }
        }
    }

    private String googleRoute(String from, String to) {
        try {
            JSONObject body = new JSONObject();
            body.put("origin", new JSONObject().put("address", from));
            body.put("destination", new JSONObject().put("address", to));
            body.put("travelMode", "DRIVE");
            HttpURLConnection c = (HttpURLConnection) new URL("https://routes.googleapis.com/directions/v2:computeRoutes").openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            c.setRequestMethod("POST");
            c.setDoOutput(true);
            c.setRequestProperty("Content-Type", "application/json");
            c.setRequestProperty("X-Goog-Api-Key", BuildConfig.MAPS_KEY);
            c.setRequestProperty("X-Goog-FieldMask", "routes.distanceMeters,routes.duration");
            c.setRequestProperty("X-Android-Package", getPackageName());
            c.setRequestProperty("X-Android-Cert", signingSha1());
            try (OutputStream o = c.getOutputStream()) {
                o.write(body.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = c.getResponseCode();
            String text = readAll(code >= 400 ? c.getErrorStream() : c.getInputStream());
            JSONObject out = new JSONObject();
            if (code == 200) {
                JSONObject res = new JSONObject(text.isEmpty() ? "{}" : text);
                JSONArray routes = res.optJSONArray("routes");
                if (routes == null || routes.length() == 0 || !routes.getJSONObject(0).has("distanceMeters")) {
                    return out.put("ok", false).put("message", "No driving route between those addresses. Check them.").toString();
                }
                JSONObject r = routes.getJSONObject(0);
                double miles = Math.round(r.getDouble("distanceMeters") / 1609.344 * 10) / 10.0;
                long secs = Long.parseLong(r.optString("duration", "0s").replace("s", "").trim().isEmpty() ? "0" : r.optString("duration", "0s").replace("s", "").trim());
                return out.put("ok", true).put("src", "google").put("miles", miles).put("minutes", Math.round(secs / 60.0)).toString();
            }
            Log.w(TAG, "Google Routes " + code + ": " + text);
            if (code == 400 && text.toLowerCase().matches("(?s).*(address|geocod|location).*")) {
                return out.put("ok", false).put("message", "Google Maps could not find one of those addresses.").toString();
            }
            if (code == 401 || code == 403) {
                return out.put("ok", false).put("keyProblem", true).put("message", "Google Maps turned the key down (" + code + "). Check the key's app restriction and that Routes API is on.").toString();
            }
            return out.put("ok", false).put("keyProblem", true).put("message", "Google Maps did not answer (" + code + ").").toString();
        } catch (Exception e) {
            Log.w(TAG, "Google Routes failed: " + e);
            try {
                return new JSONObject().put("ok", false).put("keyProblem", true).put("message", "Could not reach Google Maps. Check the phone's connection.").toString();
            } catch (Exception ignored) {
                return "{\"ok\":false}";
            }
        }
    }

    private static String readAll(InputStream in) throws java.io.IOException {
        if (in == null) return "";
        ByteArrayOutputStream b = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
        in.close();
        return b.toString("UTF-8");
    }

    /* The SHA-1 of the key this APK is signed with: what Google checks against the key's restriction. */
    @SuppressWarnings("deprecation")
    private String signingSha1() {
        try {
            Signature[] sigs;
            if (Build.VERSION.SDK_INT >= 28) {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                sigs = pi.signingInfo.getApkContentsSigners();
            } else {
                PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
                sigs = pi.signatures;
            }
            byte[] d = MessageDigest.getInstance("SHA-1").digest(sigs[0].toByteArray());
            StringBuilder sb = new StringBuilder();
            for (byte x : d) sb.append(String.format("%02X", x));
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    /* Calls, texts, maps and websites open in the phone's own apps. */
    private void openOutside(Uri u) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, u);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
        } catch (ActivityNotFoundException e) {
            Log.w(TAG, "Nothing on this phone opens " + u.getScheme());
        }
    }

    /* Photo and form uploads: the phone's picker, with the camera offered first for photos. */
    private boolean chooseFiles(ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        fileCallback = callback;
        cameraUri = null;

        List<String> types = new ArrayList<>();
        for (String t : params.getAcceptTypes()) {
            for (String part : t.split(",")) {
                String p = part.trim();
                if (!p.isEmpty()) types.add(p);
            }
        }
        boolean images = types.isEmpty();
        for (String t : types) if (t.startsWith("image/")) images = true;
        // photos for a job (accept="image/*"): made smaller before the page reads them, and kept if Android closes
        // MoveCrew meanwhile; a form or a document (a PDF or a photo) goes to the page as it is
        pickImages = !types.isEmpty();
        for (String t : types) if (!t.startsWith("image/")) pickImages = false;

        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        if (types.size() == 1) pick.setType(types.get(0));
        else {
            pick.setType("*/*");
            if (!types.isEmpty()) pick.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0]));
        }
        pick.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);

        Intent chooser = Intent.createChooser(pick, images ? "Add photos" : "Choose a file");
        if (images) {
            try {
                File dir = new File(getCacheDir(), "camera");
                if (!dir.exists() && !dir.mkdirs()) throw new IllegalStateException("no camera folder");
                File photo = File.createTempFile("tally-", ".jpg", dir);
                cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", photo);
                Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                camera.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                camera.setClipData(ClipData.newRawUri("photo", cameraUri));
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{camera});
            } catch (Exception e) {
                Log.w(TAG, "Camera not offered: " + e.getMessage());
                cameraUri = null;
            }
        }
        try {
            startActivityForResult(chooser, REQ_FILES);
            return true;
        } catch (ActivityNotFoundException e) {
            fileCallback = null;
            callback.onReceiveValue(null);
            return false;
        }
    }

    @Override
    protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request != REQ_FILES) return;
        // null when Android closed MoveCrew while the camera or the gallery was open (or the page restarted):
        // the page that asked is gone, so the photos wait for the next one (pendingPhotos)
        final ValueCallback<Uri[]> cb = fileCallback;
        fileCallback = null;
        final Uri cam = cameraUri;
        cameraUri = null;
        Uri[] out = null;
        if (result == RESULT_OK) {
            if (data != null && data.getClipData() != null && data.getClipData().getItemCount() > 0
                    && !(cam != null && cam.equals(data.getClipData().getItemAt(0).getUri()))) {
                ClipData clip = data.getClipData();
                out = new Uri[clip.getItemCount()];
                for (int i = 0; i < clip.getItemCount(); i++) out[i] = clip.getItemAt(i).getUri();
            } else if (data != null && data.getData() != null) {
                out = new Uri[]{data.getData()};
            } else if (cam != null && cameraFile(cam).length() > 0) {
                out = new Uri[]{cam};
            }
        }
        Log.i(TAG, "files chosen: " + (out == null ? 0 : out.length) + (cb == null ? " (MoveCrew had been closed meanwhile)" : "") + " " + Arrays.toString(out));
        if (out == null || !pickImages) {
            // nothing picked, or a form or a document, which goes to the page as it is
            if (cb != null) cb.onReceiveValue(out);
            if (cam != null && out == null) cameraFile(cam).delete();
            return;
        }
        final Uri[] picked = out;
        final String what = pickFor;
        readying = true;
        if (picked.length > 1) Toast.makeText(this, "Getting " + picked.length + " photos ready…", Toast.LENGTH_SHORT).show();
        io.execute(() -> {
            List<Uri> ready = new ArrayList<>();
            JSONArray names = new JSONArray();
            for (Uri u : picked) {
                File f = readyPhoto(u);
                if (f == null) {
                    ready.add(u);   // not a picture Android can open: the page tries it as it is
                    continue;
                }
                names.put(f.getName());
                ready.add(FileProvider.getUriForFile(this, getPackageName() + ".files", f));
                if (u.equals(cam)) cameraFile(cam).delete();   // the camera's full-size picture: the page gets the copy
            }
            if (cb == null && names.length() > 0) {
                try {
                    JSONObject b = new JSONObject().put("id", "b" + System.currentTimeMillis()).put("names", names).put("ts", System.currentTimeMillis());
                    try {
                        b.put("for", new JSONObject(what == null ? "{}" : what));
                    } catch (Exception e) {
                        b.put("for", new JSONObject());
                    }
                    keepBatch(b);
                } catch (Exception e) {
                    Log.w(TAG, "Could not keep the photos: " + e);
                }
            }
            runOnUiThread(() -> {
                readying = false;
                if (cb != null) cb.onReceiveValue(ready.toArray(new Uri[0]));
                else if (web != null) web.evaluateJavascript("window.tallyPhonePhotos&&window.tallyPhonePhotos()", null);
            });
        });
    }

    /* ---------- photos ----------
       A phone camera's picture (12 to 200 megapixels) opened whole inside the page can take more memory than
       Android gives MoveCrew. Each photo is opened here at a fraction of its size instead, turned the right way
       up, and saved in the cache as a JPEG of at most PHOTO_MAX pixels a side: the page makes its own smaller
       copy from that (shrink(), 560 pixels). null when Android can't open it as a picture. */
    private File readyPhoto(Uri u) {
        Bitmap bm = null;
        try {
            bm = Build.VERSION.SDK_INT >= 28 ? openPhoto(u) : openPhotoOld(u);
            if (bm == null) return null;
            File out = File.createTempFile("photo-", ".jpg", pickedDir());
            boolean ok;
            try (FileOutputStream fo = new FileOutputStream(out)) {
                ok = bm.compress(Bitmap.CompressFormat.JPEG, 85, fo);
            }
            if (!ok) {
                out.delete();
                return null;
            }
            return out;
        } catch (Throwable e) {   // an OutOfMemoryError too
            Log.w(TAG, "Could not make a photo ready: " + e);
            return null;
        } finally {
            if (bm != null) bm.recycle();
        }
    }

    /* Android 9 and later: ImageDecoder opens it already shrunk (a whole number of times smaller, so the shape
       stays exact), and turns it the way the camera held it. */
    @TargetApi(28)
    private Bitmap openPhoto(Uri u) throws IOException {
        ImageDecoder.Source src = ImageDecoder.createSource(getContentResolver(), u);
        return ImageDecoder.decodeBitmap(src, (decoder, info, source) -> {
            int big = Math.max(info.getSize().getWidth(), info.getSize().getHeight());
            if (big > PHOTO_MAX) decoder.setTargetSampleSize((big + PHOTO_MAX - 1) / PHOTO_MAX);
            decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
            decoder.setMemorySizePolicy(ImageDecoder.MEMORY_POLICY_LOW_RAM);
        });
    }

    /* Android 8: BitmapFactory opens it a power of two smaller, then it is scaled and turned by its EXIF tag. */
    private Bitmap openPhotoOld(Uri u) throws IOException {
        BitmapFactory.Options size = new BitmapFactory.Options();
        size.inJustDecodeBounds = true;
        try (InputStream in = getContentResolver().openInputStream(u)) {
            BitmapFactory.decodeStream(in, null, size);
        }
        if (size.outWidth <= 0 || size.outHeight <= 0) return null;
        BitmapFactory.Options o = new BitmapFactory.Options();
        o.inSampleSize = 1;
        while (Math.max(size.outWidth, size.outHeight) / (o.inSampleSize * 2) >= PHOTO_MAX) o.inSampleSize *= 2;
        Bitmap bm;
        try (InputStream in = getContentResolver().openInputStream(u)) {
            bm = BitmapFactory.decodeStream(in, null, o);
        }
        if (bm == null) return null;
        int turn = 0;
        try (InputStream in = getContentResolver().openInputStream(u)) {
            int t = new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            turn = t == ExifInterface.ORIENTATION_ROTATE_90 ? 90 : t == ExifInterface.ORIENTATION_ROTATE_180 ? 180 : t == ExifInterface.ORIENTATION_ROTATE_270 ? 270 : 0;
        } catch (Exception e) {
            Log.w(TAG, "No orientation for a photo: " + e);
        }
        float scale = Math.min(1f, PHOTO_MAX / (float) Math.max(bm.getWidth(), bm.getHeight()));
        if (turn == 0 && scale >= 1f) return bm;
        Matrix m = new Matrix();
        if (scale < 1f) m.postScale(scale, scale);
        if (turn != 0) m.postRotate(turn);
        Bitmap r = Bitmap.createBitmap(bm, 0, 0, bm.getWidth(), bm.getHeight(), m, true);
        if (r != bm) bm.recycle();
        return r;
    }

    private File pickedDir() {
        File d = new File(getCacheDir(), PICKED);
        if (!d.exists() && !d.mkdirs()) Log.w(TAG, "No folder for photos");
        return d;
    }

    private File cameraFile(Uri u) {
        return new File(new File(getCacheDir(), "camera"), String.valueOf(u.getLastPathSegment()));
    }

    /* Photos waiting for the page after MoveCrew was closed, kept until the page has saved them (photosDone). */
    private synchronized JSONArray batches() {
        try {
            return new JSONArray(getSharedPreferences("tally", MODE_PRIVATE).getString(PREF_BATCHES, "[]"));
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private synchronized void saveBatches(JSONArray a) {
        SharedPreferences.Editor e = getSharedPreferences("tally", MODE_PRIVATE).edit();
        e.putString(PREF_BATCHES, a.toString());
        e.commit();
    }

    private synchronized void keepBatch(JSONObject b) {
        JSONArray a = batches();
        a.put(b);
        saveBatches(a);
    }

    private synchronized JSONObject dropBatch(String id) {
        JSONArray a = batches(), keep = new JSONArray();
        JSONObject gone = null;
        for (int i = 0; i < a.length(); i++) {
            JSONObject b = a.optJSONObject(i);
            if (b == null) continue;
            if (gone == null && id != null && id.equals(b.optString("id"))) gone = b;
            else keep.put(b);
        }
        if (gone != null) saveBatches(keep);
        return gone;
    }

    private void forget(JSONArray names) {
        for (int i = 0; names != null && i < names.length(); i++) {
            String n = names.optString(i);
            if (!n.isEmpty() && !n.contains("/")) new File(pickedDir(), n).delete();
        }
    }

    /* At the start: photos made ready more than two days ago that no page is waiting for, batches a week old,
       and the camera's full-size pictures from an earlier day go. */
    private void tidyPhotos() {
        try {
            long now = System.currentTimeMillis(), old = now - 2 * 86400000L;
            Set<String> keep = new HashSet<>();
            JSONArray a = batches(), still = new JSONArray();
            for (int i = 0; i < a.length(); i++) {
                JSONObject b = a.optJSONObject(i);
                if (b == null || b.optLong("ts") < now - 7 * 86400000L) continue;
                still.put(b);
                JSONArray n = b.optJSONArray("names");
                for (int k = 0; n != null && k < n.length(); k++) keep.add(n.optString(k));
            }
            if (still.length() != a.length()) saveBatches(still);
            File[] fs = pickedDir().listFiles();
            if (fs != null) for (File f : fs) if (!keep.contains(f.getName()) && f.lastModified() < old) f.delete();
            File[] cs = new File(getCacheDir(), "camera").listFiles();
            if (cs != null) for (File f : cs) if (f.lastModified() < old) f.delete();
        } catch (Exception e) {
            Log.w(TAG, "Tidying photos: " + e);
        }
    }

    private boolean hasLocation() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == REQ_LOCATION && geoCallback != null) {
            geoCallback.invoke(geoOrigin, hasLocation(), false);
            geoCallback = null;
            geoOrigin = null;
        }
    }

    /* Back closes whatever is open in MoveCrew (a job, the signing screen, a menu) before leaving. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
        // called as the camera or the gallery opens: if Android closes MoveCrew meanwhile, the photo comes back
        // to the MoveCrew that opens next with where the camera saved it and what it was for
        out.putString(KEY_CAMERA, cameraUri == null ? null : cameraUri.toString());
        out.putBoolean(KEY_IMAGES, pickImages);
        out.putString(KEY_FOR, pickFor);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        io.shutdown();   // photos already being made ready finish; nothing new starts
        super.onDestroy();
    }
}
