package co.dispatcher365.handheld;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.inputmethod.EditorInfo;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;

public class MainActivity extends Activity {
    private static final String TAG = "Dispatcher365Handheld";
    private static final int REQUEST_PERMISSIONS = 20;
    private static final int REQUEST_FILE_CHOOSER = 21;
    private static final String[] SCAN_ACTIONS = {
            "com.dispatcher365.SCAN",
            "com.symbol.datawedge.data",
            "com.symbol.datawedge.api.RESULT_ACTION",
            "com.honeywell.intent.action.BARCODE_DATA",
            "android.intent.ACTION_DECODE_DATA",
            "nlscan.action.SCANNER_RESULT",
            "com.rscja.scanner.action.scanner.RFID",
            "com.android.server.scannerservice.broadcast"
    };
    private static final String[] SCAN_EXTRA_KEYS = {
            "com.symbol.datawedge.data_string",
            "data",
            "barcode_string",
            "barcode",
            "scannerdata",
            "SCAN_BARCODE1",
            "decode_rslt",
            "value",
            "text"
    };

    private WebView webView;
    private EditText scanInput;
    private EditText urlInput;
    private TextView statusText;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraPhotoUri;
    private SharedPreferences prefs;
    private BroadcastReceiver scanReceiver;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("dispatcher365_handheld", MODE_PRIVATE);
        buildUi();
        configureWebView();
        registerScannerReceiver();
        requestRuntimePermissions();
        loadUrl(prefs.getString("last_url", BuildConfig.DEFAULT_PORTAL_URL));
    }

    private void buildUi() {
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.rgb(16, 25, 35));

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setOrientation(LinearLayout.VERTICAL);
        toolbar.setPadding(10, 10, 10, 8);

        statusText = new TextView(this);
        statusText.setTextColor(Color.WHITE);
        statusText.setText("Dispatcher365 Handheld");
        toolbar.addView(statusText, new LinearLayout.LayoutParams(-1, -2));

        urlInput = new EditText(this);
        urlInput.setSingleLine(true);
        urlInput.setTextColor(Color.WHITE);
        urlInput.setHintTextColor(Color.LTGRAY);
        urlInput.setHint("https://dispatcher365.co/portal");
        urlInput.setInputType(EditorInfo.TYPE_TEXT_VARIATION_URI);
        toolbar.addView(urlInput, new LinearLayout.LayoutParams(-1, -2));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        buttons.addView(button("Go", v -> loadUrl(urlInput.getText().toString())), new LinearLayout.LayoutParams(0, -2, 1));
        buttons.addView(button("Prod", v -> loadUrl(BuildConfig.DEFAULT_PORTAL_URL)), new LinearLayout.LayoutParams(0, -2, 1));
        buttons.addView(button("Reload", v -> webView.reload()), new LinearLayout.LayoutParams(0, -2, 1));
        toolbar.addView(buttons);

        scanInput = new EditText(this);
        scanInput.setSingleLine(true);
        scanInput.setTextColor(Color.WHITE);
        scanInput.setHintTextColor(Color.LTGRAY);
        scanInput.setHint("Scanner input - scan or press Enter");
        scanInput.setImeOptions(EditorInfo.IME_ACTION_DONE);
        scanInput.setOnEditorActionListener((v, actionId, event) -> {
            boolean enter = event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_UP;
            if (actionId == EditorInfo.IME_ACTION_DONE || enter) {
                handleScan(scanInput.getText().toString());
                scanInput.setText("");
                return true;
            }
            return false;
        });
        toolbar.addView(scanInput, new LinearLayout.LayoutParams(-1, -2));

        webView = new WebView(this);
        root.addView(toolbar, new LinearLayout.LayoutParams(-1, -2));
        root.addView(webView, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
    }

    private void registerScannerReceiver() {
        scanReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String value = scanValueFromIntent(intent);
                if (!value.isEmpty()) handleScan(value);
            }
        };
        IntentFilter filter = new IntentFilter();
        for (String action : SCAN_ACTIONS) filter.addAction(action);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(scanReceiver, filter, Context.RECEIVER_EXPORTED);
        } else {
            registerReceiver(scanReceiver, filter);
        }
    }

    private Button button(String label, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setOnClickListener(listener);
        return button;
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                urlInput.setText(url);
                prefs.edit().putString("last_url", url).apply();
                statusText.setText("Loaded: " + view.getTitle());
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, true, false);
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (filePathCallback != null) filePathCallback.onReceiveValue(null);
                filePathCallback = callback;
                Intent contentIntent = new Intent(Intent.ACTION_GET_CONTENT);
                contentIntent.addCategory(Intent.CATEGORY_OPENABLE);
                contentIntent.setType("image/*");

                Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cameraPhotoUri = createCameraUri();
                if (cameraPhotoUri != null) {
                    cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                    cameraIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }

                Intent chooser = Intent.createChooser(contentIntent, "Upload image");
                if (cameraPhotoUri != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                startActivityForResult(chooser, REQUEST_FILE_CHOOSER);
                return true;
            }
        });
    }

    private Uri createCameraUri() {
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) return null;
            File file = File.createTempFile("dispatcher365_", ".jpg", dir);
            return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
        } catch (IOException error) {
            Toast.makeText(this, error.getMessage(), Toast.LENGTH_LONG).show();
            return null;
        }
    }

    private void loadUrl(String rawUrl) {
        String url = rawUrl == null || rawUrl.trim().isEmpty() ? BuildConfig.DEFAULT_PORTAL_URL : rawUrl.trim();
        if (!url.startsWith("http://") && !url.startsWith("https://")) url = "https://" + url;
        urlInput.setText(url);
        statusText.setText("Loading " + url);
        webView.loadUrl(url);
    }

    private void handleScan(String rawValue) {
        String value = rawValue == null ? "" : rawValue.trim();
        if (value.isEmpty()) return;
        Log.i(TAG, "Scan received: " + value);
        statusText.setText("Scanned: " + value);
        String escaped = value.replace("\\", "\\\\").replace("'", "\\'");
        String script = "(() => {"
                + "const target=document.activeElement;"
                + "if(target && 'value' in target){target.value='" + escaped + "';target.dispatchEvent(new Event('input',{bubbles:true}));target.dispatchEvent(new Event('change',{bubbles:true}));return 'field';}"
                + "window.dispatchEvent(new CustomEvent('dispatcher365-scan',{detail:{value:'" + escaped + "'}}));"
                + "return 'event';"
                + "})()";
        webView.evaluateJavascript(script, null);
    }

    private String scanValueFromIntent(Intent intent) {
        if (intent == null) return "";
        for (String key : SCAN_EXTRA_KEYS) {
            String value = intent.getStringExtra(key);
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        byte[] decodeData = intent.getByteArrayExtra("decode_data");
        if (decodeData != null && decodeData.length > 0) return new String(decodeData).trim();
        Bundle extras = intent.getExtras();
        if (extras == null) return "";
        for (String key : extras.keySet()) {
            Object value = extras.get(key);
            if (value instanceof String && !((String) value).trim().isEmpty()) return ((String) value).trim();
        }
        return "";
    }

    private void requestRuntimePermissions() {
        String[] permissions = {
                Manifest.permission.CAMERA,
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
        };
        boolean missing = false;
        for (String permission : permissions) {
            missing = missing || ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED;
        }
        if (missing) ActivityCompat.requestPermissions(this, permissions, REQUEST_PERMISSIONS);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQUEST_FILE_CHOOSER || filePathCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (cameraPhotoUri != null) {
                result = new Uri[]{enhanceDocumentImage(cameraPhotoUri)};
            }
        }
        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
        cameraPhotoUri = null;
    }

    private Uri enhanceDocumentImage(Uri sourceUri) {
        try {
            Bitmap original = decodeBitmap(sourceUri, 2200);
            if (original == null) return sourceUri;
            Bitmap normalized = normalizeSize(original, 1800);
            Bitmap enhanced = enhanceForDocument(normalized);
            File dir = new File(getCacheDir(), "camera");
            if (!dir.exists() && !dir.mkdirs()) return sourceUri;
            File file = File.createTempFile("dispatcher365_doc_", ".jpg", dir);
            try (FileOutputStream output = new FileOutputStream(file)) {
                enhanced.compress(Bitmap.CompressFormat.JPEG, 92, output);
            }
            if (original != normalized) original.recycle();
            if (normalized != enhanced) normalized.recycle();
            return FileProvider.getUriForFile(this, getPackageName() + ".fileprovider", file);
        } catch (Exception error) {
            Toast.makeText(this, "Using original image: " + error.getMessage(), Toast.LENGTH_LONG).show();
            return sourceUri;
        }
    }

    private Bitmap decodeBitmap(Uri uri, int maxDimension) throws IOException {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            BitmapFactory.decodeStream(input, null, bounds);
        }
        int sample = 1;
        int largest = Math.max(bounds.outWidth, bounds.outHeight);
        while (largest / sample > maxDimension) sample *= 2;
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inSampleSize = sample;
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        try (InputStream input = getContentResolver().openInputStream(uri)) {
            return BitmapFactory.decodeStream(input, null, options);
        }
    }

    private Bitmap normalizeSize(Bitmap source, int maxDimension) {
        int width = source.getWidth();
        int height = source.getHeight();
        int largest = Math.max(width, height);
        if (largest <= maxDimension) return source;
        float scale = maxDimension / (float) largest;
        Matrix matrix = new Matrix();
        matrix.postScale(scale, scale);
        return Bitmap.createBitmap(source, 0, 0, width, height, matrix, true);
    }

    private Bitmap enhanceForDocument(Bitmap source) {
        int width = source.getWidth();
        int height = source.getHeight();
        Bitmap output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        int[] pixels = new int[width * height];
        source.getPixels(pixels, 0, width, 0, 0, width, height);

        int min = 255;
        int max = 0;
        int[] gray = new int[pixels.length];
        for (int i = 0; i < pixels.length; i++) {
            int color = pixels[i];
            int r = Color.red(color);
            int g = Color.green(color);
            int b = Color.blue(color);
            int value = Math.min(255, Math.max(0, Math.round((r * 0.299f) + (g * 0.587f) + (b * 0.114f))));
            gray[i] = value;
            if (value < min) min = value;
            if (value > max) max = value;
        }

        int range = Math.max(32, max - min);
        for (int i = 0; i < pixels.length; i++) {
            int value = gray[i];
            int stretched = Math.min(255, Math.max(0, (value - min) * 255 / range));
            int boosted = Math.min(255, Math.max(0, Math.round((stretched - 128) * 1.28f + 138)));
            int finalValue = boosted > 235 ? 255 : boosted < 38 ? 0 : boosted;
            pixels[i] = Color.rgb(finalValue, finalValue, finalValue);
        }
        output.setPixels(pixels, 0, width, 0, 0, width, height);
        return output;
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String value = scanValueFromIntent(intent);
        if (!value.isEmpty()) handleScan(value);
    }

    @Override
    protected void onDestroy() {
        if (scanReceiver != null) unregisterReceiver(scanReceiver);
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
