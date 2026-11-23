package local.habittracker.app.focus;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import java.util.concurrent.CopyOnWriteArrayList;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * The block as this phone keeps it: the server's last answer (GET
 * /api/focus-block) in SharedPreferences, with the addresses to poll and
 * to lift a Soft block, so the block holds when the app's page is gone and
 * after the services restart. Every change tells the services at once.
 */
public final class FocusBlockStore {
    private static final String PREFS = "focus_block";
    private static final String KEY_STATE = "state";
    private static final String KEY_RECEIVED_AT = "receivedAt";
    private static final String KEY_POLL_URL = "pollUrl";
    private static final String KEY_END_URL = "endUrl";
    private static final String KEY_ORIGIN = "origin";
    private static final String KEY_LIFTED = "liftedBlockId";
    private static final String KEY_LIFT_PENDING = "liftPending";

    private static final List<Runnable> listeners = new CopyOnWriteArrayList<Runnable>();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static volatile FocusBlockState cached;

    private FocusBlockStore() {}

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Called on the main thread after every change. */
    public static void addListener(Runnable listener) {
        listeners.add(listener);
    }

    public static void removeListener(Runnable listener) {
        listeners.remove(listener);
    }

    private static void changed() {
        main.post(() -> {
            for (Runnable listener : listeners) listener.run();
        });
    }

    /** The block as last stored; empty before the first answer. */
    public static FocusBlockState load(Context context) {
        FocusBlockState state = cached;
        if (state != null) return state;
        SharedPreferences prefs = prefs(context);
        String raw = prefs.getString(KEY_STATE, null);
        state = FocusBlockState.empty();
        if (raw != null) {
            try {
                state = parse(new JSONObject(raw), prefs.getLong(KEY_RECEIVED_AT, System.currentTimeMillis()), prefs.getString(KEY_LIFTED, null));
            } catch (JSONException | ParseException ignored) {
                // A broken copy blocks nothing; the next answer replaces it.
            }
        }
        cached = state;
        return state;
    }

    /**
     * Stores a server answer received at `receivedAtMs` (device clock). The
     * web layer passes the addresses with it; a poll keeps the stored ones.
     */
    public static void save(Context context, JSONObject state, long receivedAtMs, String pollUrl, String endUrl, String origin) {
        SharedPreferences prefs = prefs(context);
        String lifted = prefs.getString(KEY_LIFTED, null);
        FocusBlockState parsed;
        try {
            parsed = parse(state, receivedAtMs, lifted);
        } catch (JSONException | ParseException error) {
            return;
        }
        SharedPreferences.Editor editor = prefs.edit().putString(KEY_STATE, state.toString()).putLong(KEY_RECEIVED_AT, receivedAtMs);
        // A lifted block that is over on the server needs no memory any more.
        if (lifted != null && !lifted.equals(parsed.blockId)) {
            editor.remove(KEY_LIFTED).remove(KEY_LIFT_PENDING);
        }
        if (pollUrl != null) editor.putString(KEY_POLL_URL, pollUrl);
        if (endUrl != null) editor.putString(KEY_END_URL, endUrl);
        if (origin != null) editor.putString(KEY_ORIGIN, origin);
        editor.apply();
        cached = null;
        changed();
    }

    /** Signed out: the phone forgets the block, the lists and the addresses. */
    public static void clear(Context context) {
        prefs(context).edit().clear().apply();
        cached = FocusBlockState.empty();
        changed();
    }

    /** Lifts the open Soft block on this phone; the server hears it next (see FocusBlockSync). */
    public static void markLifted(Context context, String blockId) {
        prefs(context).edit().putString(KEY_LIFTED, blockId).putBoolean(KEY_LIFT_PENDING, true).apply();
        cached = null;
        changed();
    }

    public static boolean liftPending(Context context) {
        return prefs(context).getBoolean(KEY_LIFT_PENDING, false);
    }

    public static void liftDelivered(Context context) {
        prefs(context).edit().putBoolean(KEY_LIFT_PENDING, false).apply();
    }

    public static String pollUrl(Context context) {
        return prefs(context).getString(KEY_POLL_URL, null);
    }

    public static String endUrl(Context context) {
        return prefs(context).getString(KEY_END_URL, null);
    }

    public static String origin(Context context) {
        return prefs(context).getString(KEY_ORIGIN, null);
    }

    /** The version of the stored answer, for If-None-Match. */
    public static String version(Context context) {
        return load(context).version;
    }

    static FocusBlockState parse(JSONObject json, long receivedAtMs, String liftedBlockId) throws JSONException, ParseException {
        long serverNow = parseInstant(json.getString("serverNow"));
        JSONObject lists = json.getJSONObject("lists");
        List<String> blockApps = new ArrayList<String>();
        List<String> blockDomains = new ArrayList<String>();
        List<String> allowApps = new ArrayList<String>();
        List<String> allowDomains = new ArrayList<String>();
        split(lists.getJSONArray("block"), blockApps, blockDomains);
        split(lists.getJSONArray("allow"), allowApps, allowDomains);
        List<String> fixedDomains = new ArrayList<String>();
        JSONArray fixed = json.optJSONArray("fixedDomains");
        if (fixed != null) {
            for (int i = 0; i < fixed.length(); i++) fixedDomains.add(fixed.getString(i));
        }
        JSONObject block = json.isNull("block") ? null : json.getJSONObject("block");
        String blockId = null;
        String title = "";
        String mode = "soft";
        String listMode = json.getJSONObject("settings").optString("listMode", "blocklist");
        long startedAt = 0;
        Long endsAt = null;
        if (block != null) {
            blockId = block.getString("id");
            title = block.optString("title", "");
            mode = block.optString("mode", "soft");
            listMode = block.optString("listMode", listMode);
            startedAt = parseInstant(block.getString("startedAt"));
            if (!block.isNull("endsAt")) endsAt = parseInstant(block.getString("endsAt"));
        }
        return new FocusBlockState(
            json.optString("version", ""),
            blockId,
            title,
            mode,
            listMode,
            startedAt,
            endsAt,
            blockApps,
            allowApps,
            blockDomains,
            allowDomains,
            fixedDomains,
            receivedAtMs - serverNow,
            liftedBlockId
        );
    }

    private static void split(JSONArray entries, List<String> apps, List<String> domains) throws JSONException {
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.getJSONObject(i);
            String value = entry.getString("value");
            if ("app".equals(entry.optString("kind"))) apps.add(value);
            else domains.add(value);
        }
    }

    /** "2026-11-23T10:00:00.000Z", as the server writes every instant. */
    static long parseInstant(String text) throws ParseException {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.parse(text).getTime();
    }
}
