package local.habittracker.app.speech;

import android.Manifest;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.speech.RecognitionListener;
import android.speech.RecognitionSupport;
import android.speech.RecognitionSupportCallback;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import androidx.annotation.NonNull;
import androidx.annotation.RequiresApi;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;

/**
 * Dictation on the phone, on the phone only (frontend/src/native/speech-plugin.ts,
 * docs/voice-input.md). Android 12+ uses Android's on-device recogniser;
 * below that the default service, asked to stay offline. There is no online
 * fallback: without the German offline model, `available` says why and
 * `openOfflineSetup` helps to get it.
 *
 * Events: `partial` {text} while speaking, `final` {text}, `error`
 * {code, message} (codes in SpeechErrors), and `end` after each of final,
 * error and cancel. Nothing heard is stored.
 */
@CapacitorPlugin(
    name = "Speech",
    permissions = { @Permission(alias = SpeechPlugin.MICROPHONE, strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class SpeechPlugin extends Plugin {
    static final String MICROPHONE = "microphone";
    private static final String PARTIAL = "partial";
    private static final String FINAL = "final";
    private static final String ERROR = "error";
    private static final String END = "end";
    private static final String LANGUAGE = "de-DE";
    /** How long Android 13+ may take to list its installed languages. */
    private static final long SUPPORT_TIMEOUT_MS = 3000;

    private final Handler main = new Handler(Looper.getMainLooper());

    // Main thread only from here.
    private SpeechRecognizer recognizer;
    /** Kept while Android downloads the German model it was asked for. */
    private SpeechRecognizer downloader;
    private String lastPartial = "";

    /** `{ available, onDevice, reason }`, see SpeechAvailability. */
    @PluginMethod
    public void available(PluginCall call) {
        main.post(() -> {
            boolean service = SpeechRecognizer.isRecognitionAvailable(getContext());
            boolean onDevice = onDeviceRecognizer();
            if (onDevice && Build.VERSION.SDK_INT >= SpeechAvailability.LANGUAGE_CHECK_SDK) {
                checkGerman(call, service);
                return;
            }
            resolve(call, SpeechAvailability.decide(Build.VERSION.SDK_INT, service, onDevice, null, false));
        });
    }

    /** `{ partial }`; resolves once listening has started. */
    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState(MICROPHONE) != PermissionState.GRANTED) {
            requestPermissionForAlias(MICROPHONE, call, "onMicrophonePermission");
            return;
        }
        begin(call);
    }

    @PermissionCallback
    private void onMicrophonePermission(PluginCall call) {
        if (getPermissionState(MICROPHONE) == PermissionState.GRANTED) begin(call);
        else call.reject(SpeechErrors.PERMISSION_MESSAGE, "permission");
    }

    /** Stops listening; what was heard still arrives as `final`. */
    @PluginMethod
    public void stop(PluginCall call) {
        main.post(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }

    /** Stops and drops what was heard: only `end` follows. */
    @PluginMethod
    public void cancel(PluginCall call) {
        main.post(() -> {
            if (recognizer != null) {
                recognizer.cancel();
                release();
                notifyListeners(END, new JSObject());
            }
            call.resolve();
        });
    }

    /**
     * Helps to get the German offline model. `{ action }`: "download" (Android
     * 13+ was asked to download it), "settings" (the voice input settings are
     * open) or "none".
     */
    @PluginMethod
    public void openOfflineSetup(PluginCall call) {
        main.post(() -> {
            JSObject result = new JSObject();
            if (Build.VERSION.SDK_INT >= SpeechAvailability.LANGUAGE_CHECK_SDK && onDeviceRecognizer()) {
                try {
                    requestGermanDownload();
                    result.put("action", "download");
                    call.resolve(result);
                    return;
                } catch (RuntimeException e) {
                    // Falls back to the settings below.
                }
            }
            result.put("action", openSettings() ? "settings" : "none");
            call.resolve(result);
        });
    }

    @Override
    protected void handleOnDestroy() {
        main.post(() -> {
            release();
            if (downloader != null) {
                downloader.destroy();
                downloader = null;
            }
        });
        super.handleOnDestroy();
    }

    private boolean onDeviceRecognizer() {
        return (
            Build.VERSION.SDK_INT >= SpeechAvailability.ON_DEVICE_SDK &&
            SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())
        );
    }

    private static Intent recognizerIntent(boolean partial) {
        Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, LANGUAGE);
        intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, partial);
        intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        // Since Android 6; the only offline switch below Android 12, and a hint only.
        intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true);
        return intent;
    }

    private void resolve(PluginCall call, SpeechAvailability availability) {
        JSObject result = new JSObject();
        result.put("available", availability.available);
        result.put("onDevice", availability.onDevice);
        result.put("reason", availability.reason);
        call.resolve(result);
    }

    /** Android 13+: is the German on-device model installed? */
    @RequiresApi(api = 33)
    private void checkGerman(PluginCall call, boolean service) {
        SpeechRecognizer probe = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
        boolean[] answered = { false };
        Runnable unknown = () -> {
            if (answered[0]) return;
            answered[0] = true;
            probe.destroy();
            resolve(call, SpeechAvailability.decide(Build.VERSION.SDK_INT, service, true, null, false));
        };
        main.postDelayed(unknown, SUPPORT_TIMEOUT_MS);
        try {
            probe.checkRecognitionSupport(
                recognizerIntent(false),
                getContext().getMainExecutor(),
                new RecognitionSupportCallback() {
                    @Override
                    public void onSupportResult(@NonNull RecognitionSupport support) {
                        if (answered[0]) return;
                        answered[0] = true;
                        main.removeCallbacks(unknown);
                        probe.destroy();
                        resolve(
                            call,
                            SpeechAvailability.decide(
                                Build.VERSION.SDK_INT,
                                service,
                                true,
                                SpeechAvailability.containsGerman(support.getInstalledOnDeviceLanguages()),
                                SpeechAvailability.containsGerman(support.getPendingOnDeviceLanguages())
                            )
                        );
                    }

                    @Override
                    public void onError(int error) {
                        main.removeCallbacks(unknown);
                        unknown.run();
                    }
                }
            );
        } catch (RuntimeException e) {
            main.removeCallbacks(unknown);
            unknown.run();
        }
    }

    @RequiresApi(api = 33)
    private void requestGermanDownload() {
        if (downloader != null) downloader.destroy();
        downloader = SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
        downloader.triggerModelDownload(recognizerIntent(false));
    }

    /** The voice input settings, or the language settings where those are missing. */
    private boolean openSettings() {
        for (String action : new String[] { Settings.ACTION_VOICE_INPUT_SETTINGS, Settings.ACTION_LOCALE_SETTINGS }) {
            try {
                Intent intent = new Intent(action);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                return true;
            } catch (ActivityNotFoundException e) {
                // Try the next one.
            }
        }
        return false;
    }

    private void begin(PluginCall call) {
        Boolean partial = call.getBoolean("partial", true);
        main.post(() -> {
            boolean onDevice = onDeviceRecognizer();
            SpeechAvailability availability = SpeechAvailability.decide(
                Build.VERSION.SDK_INT,
                SpeechRecognizer.isRecognitionAvailable(getContext()),
                onDevice,
                null,
                false
            );
            if (!availability.available) {
                boolean missing = SpeechAvailability.OFFLINE_MODEL_MISSING.equals(availability.reason);
                call.reject(
                    missing ? SpeechErrors.OFFLINE_MODEL_MESSAGE : SpeechErrors.UNAVAILABLE_MESSAGE,
                    availability.reason
                );
                return;
            }
            lastPartial = "";
            try {
                release();
                SpeechRecognizer current = onDevice && Build.VERSION.SDK_INT >= SpeechAvailability.ON_DEVICE_SDK
                    ? SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext())
                    : SpeechRecognizer.createSpeechRecognizer(getContext());
                recognizer = current;
                current.setRecognitionListener(new Listener(current));
                current.startListening(recognizerIntent(partial == null || partial));
                call.resolve();
            } catch (RuntimeException e) {
                release();
                call.reject(SpeechErrors.of(SpeechErrors.CLIENT).message, "client");
            }
        });
    }

    private void release() {
        if (recognizer == null) return;
        recognizer.destroy();
        recognizer = null;
    }

    private static String firstResult(Bundle results) {
        if (results == null) return "";
        ArrayList<String> texts = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return texts == null || texts.isEmpty() || texts.get(0) == null ? "" : texts.get(0).trim();
    }

    private void finish(String text) {
        JSObject result = new JSObject();
        result.put("text", text);
        notifyListeners(FINAL, result);
        notifyListeners(END, new JSObject());
        release();
    }

    /** Calls from a replaced recogniser are dropped. */
    private final class Listener implements RecognitionListener {
        private final SpeechRecognizer owner;

        Listener(SpeechRecognizer owner) {
            this.owner = owner;
        }

        private boolean current() {
            return owner == recognizer;
        }

        @Override
        public void onReadyForSpeech(Bundle params) {}

        @Override
        public void onBeginningOfSpeech() {}

        @Override
        public void onRmsChanged(float rmsdB) {}

        @Override
        public void onBufferReceived(byte[] buffer) {}

        @Override
        public void onEndOfSpeech() {}

        @Override
        public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onPartialResults(Bundle results) {
            if (!current()) return;
            String text = firstResult(results);
            if (text.isEmpty()) return;
            lastPartial = text;
            JSObject event = new JSObject();
            event.put("text", text);
            notifyListeners(PARTIAL, event);
        }

        @Override
        public void onResults(Bundle results) {
            if (!current()) return;
            String text = firstResult(results);
            finish(text.isEmpty() ? lastPartial : text);
        }

        @Override
        public void onError(int error) {
            if (!current()) return;
            if (SpeechErrors.keepsPartial(error) && !lastPartial.isEmpty()) {
                finish(lastPartial);
                return;
            }
            SpeechErrors.Mapped mapped = SpeechErrors.of(error);
            JSObject event = new JSObject();
            event.put("code", mapped.code);
            event.put("message", mapped.message);
            notifyListeners(ERROR, event);
            notifyListeners(END, new JSObject());
            release();
        }
    }
}
