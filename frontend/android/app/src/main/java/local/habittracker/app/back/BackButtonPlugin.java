package local.habittracker.app.back;

import android.os.Handler;
import android.os.Looper;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.OnBackPressedDispatcher;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Android's Back button and back gesture, handed to the page
 * (frontend/src/native/back-button-plugin.ts, docs/android-test.md › Zurück).
 * An OnBackPressedCallback takes every press, so it also works with the
 * predictive back gesture of Android 13+. The page gets `back` {id} and
 * answers with `answer({ id, handled })`; see BackPress for who decides.
 * Without this, Capacitor has no Back of its own and every press left the app.
 */
@CapacitorPlugin(name = "BackButton")
public class BackButtonPlugin extends Plugin {
    private static final String BACK = "back";
    /** The page answers at once; this only catches a page that cannot. */
    static final long ANSWER_TIMEOUT_MS = 800;

    private final BackPress presses = new BackPress();
    private final Handler main = new Handler(Looper.getMainLooper());
    private OnBackPressedCallback callback;

    @Override
    public void load() {
        callback = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                onBack();
            }
        };
        getActivity().getOnBackPressedDispatcher().addCallback(getActivity(), callback);
    }

    /** `{ id, handled }`: the page's answer to the press `id`. */
    @PluginMethod
    public void answer(PluginCall call) {
        // Not getLong: a small number arrives as an Integer, which getLong
        // turns into its default, and every answer would be dropped.
        long id = call.getData().optLong("id", BackPress.ANDROID_DEFAULT);
        boolean handled = Boolean.TRUE.equals(call.getBoolean("handled", false));
        call.resolve();
        main.post(() -> {
            if (presses.answer(id, handled)) androidBack();
        });
    }

    private void onBack() {
        long id = presses.press(hasListeners(BACK));
        if (id == BackPress.ANDROID_DEFAULT) {
            androidBack();
            return;
        }
        JSObject data = new JSObject();
        data.put("id", id);
        notifyListeners(BACK, data);
        main.postDelayed(() -> {
            if (presses.timeout(id)) androidBack();
        }, ANSWER_TIMEOUT_MS);
    }

    /** Android's own Back: the app goes to the background (or closes before Android 12). */
    private void androidBack() {
        OnBackPressedDispatcher dispatcher = getActivity().getOnBackPressedDispatcher();
        callback.setEnabled(false);
        dispatcher.onBackPressed();
        callback.setEnabled(true);
    }
}
