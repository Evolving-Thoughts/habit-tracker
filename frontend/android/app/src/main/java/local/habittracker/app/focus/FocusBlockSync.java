package local.habittracker.app.focus;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.CookieManager;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Keeps the stored block current without the app's page: while one of the
 * focus services runs, it asks the server for the state (GET
 * /api/focus-block with the page's session cookie and If-None-Match, so an
 * unchanged state costs a bodiless 304), every 30 seconds during a block,
 * every 60 seconds otherwise. It also delivers a Soft block lifted on the
 * block screen. Nothing but these two requests to the app's own server.
 */
public final class FocusBlockSync {
    private static final String TAG = "FocusBlockSync";
    private static final long ACTIVE_INTERVAL_MS = 30_000;
    private static final long IDLE_INTERVAL_MS = 60_000;
    private static final int TIMEOUT_MS = 10_000;

    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final ExecutorService network = Executors.newSingleThreadExecutor();
    private static int users = 0;
    private static Context appContext;
    private static final Runnable tick = new Runnable() {
        @Override
        public void run() {
            pollNow(appContext);
            FocusBlockState state = FocusBlockStore.load(appContext);
            main.postDelayed(this, state.isActive(System.currentTimeMillis()) ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS);
        }
    };

    private FocusBlockSync() {}

    /** A focus service started: poll while at least one runs. */
    public static synchronized void start(Context context) {
        appContext = context.getApplicationContext();
        if (users++ == 0) main.post(tick);
    }

    public static synchronized void stop() {
        if (users > 0 && --users == 0) main.removeCallbacks(tick);
    }

    /** Asks the server once, in the background. */
    public static void pollNow(Context context) {
        if (context == null) return;
        final Context app = context.getApplicationContext();
        final String pollUrl = FocusBlockStore.pollUrl(app);
        if (pollUrl == null) return;
        network.execute(() -> {
            deliverLift(app);
            poll(app, pollUrl);
        });
    }

    /**
     * Lifts the open Soft block: at once on this phone, then on the server.
     * Without a connection it stays lifted here and is delivered later.
     */
    public static void lift(Context context, String blockId) {
        final Context app = context.getApplicationContext();
        FocusBlockStore.markLifted(app, blockId);
        network.execute(() -> deliverLift(app));
    }

    private static void deliverLift(Context app) {
        if (!FocusBlockStore.liftPending(app)) return;
        String endUrl = FocusBlockStore.endUrl(app);
        String origin = FocusBlockStore.origin(app);
        if (endUrl == null || origin == null) return;
        HttpURLConnection connection = null;
        try {
            connection = open(endUrl);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            // The server takes writes only from its own origin, as JSON.
            connection.setRequestProperty("Origin", origin);
            connection.setRequestProperty("Content-Type", "application/json");
            try (OutputStream out = connection.getOutputStream()) {
                out.write("{}".getBytes(StandardCharsets.UTF_8));
            }
            int status = connection.getResponseCode();
            // 409: Hardcore after all (another device); nothing more to deliver.
            if (status == 200 || status == 409) {
                FocusBlockStore.liftDelivered(app);
                if (status == 200) store(app, read(connection), null);
            }
        } catch (Exception error) {
            Log.i(TAG, "Lifting waits for a connection");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static void poll(Context app, String pollUrl) {
        HttpURLConnection connection = null;
        try {
            connection = open(pollUrl);
            String version = FocusBlockStore.version(app);
            if (version != null && !version.isEmpty()) connection.setRequestProperty("If-None-Match", "\"" + version + "\"");
            int status = connection.getResponseCode();
            if (status == 200) store(app, read(connection), null);
            // 304: unchanged. 401: signed out elsewhere; the stored block runs out by itself.
        } catch (Exception error) {
            Log.i(TAG, "No connection to the server");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static void store(Context app, String body, String pollUrl) throws Exception {
        FocusBlockStore.save(app, new JSONObject(body), System.currentTimeMillis(), pollUrl, null, null);
    }

    private static HttpURLConnection open(String address) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(address).openConnection();
        connection.setConnectTimeout(TIMEOUT_MS);
        connection.setReadTimeout(TIMEOUT_MS);
        connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");
        // The page's session cookie, as the WebView keeps it.
        String cookie = CookieManager.getInstance().getCookie(address);
        if (cookie != null) connection.setRequestProperty("Cookie", cookie);
        return connection;
    }

    private static String read(HttpURLConnection connection) throws Exception {
        try (InputStream in = connection.getInputStream()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int count;
            while ((count = in.read(buffer)) != -1) out.write(buffer, 0, count);
            return new String(out.toByteArray(), StandardCharsets.UTF_8);
        }
    }
}
