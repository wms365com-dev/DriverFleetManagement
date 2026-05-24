package co.dispatcher365.handheld;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
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
import java.io.IOException;

public class MainActivity extends Activity {
    private static final int REQUEST_PERMISSIONS = 20;
    private static final int REQUEST_FILE_CHOOSER = 21;

    private WebView webView;
    private EditText scanInput;
    private EditText urlInput;
    private TextView statusText;
    private ValueCallback<Uri[]> filePathCallback;
    private Uri cameraPhotoUri;
    private SharedPreferences prefs;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("dispatcher365_handheld", MODE_PRIVATE);
        buildUi();
        configureWebView();
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
        scanInput.setHint("Scanner input");
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
                result = new Uri[]{cameraPhotoUri};
            }
        }
        filePathCallback.onReceiveValue(result);
        filePathCallback = null;
        cameraPhotoUri = null;
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
