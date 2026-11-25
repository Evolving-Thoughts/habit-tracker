package local.habittracker.app.speech;

import java.util.List;

/**
 * Whether dictation can run on this phone without sending audio anywhere
 * (docs/voice-input.md). Pure, so a JVM test covers the rules:
 *
 * - Android 12+ (API 31): only Android's on-device recogniser counts. From
 *   Android 13 (API 33) it also says whether the German model is installed
 *   or still downloading; on 12 that shows only when listening starts.
 * - Below Android 12 there is no on-device recogniser; the default service
 *   is asked to stay offline (EXTRA_PREFER_OFFLINE), which it may ignore
 *   without an offline German pack.
 */
public final class SpeechAvailability {
    public static final String OFFLINE_MODEL_MISSING = "offline-model-missing";
    public static final String OFFLINE_MODEL_DOWNLOADING = "offline-model-downloading";
    public static final String UNAVAILABLE = "unavailable";

    /** Android 12, the first with an on-device recogniser. */
    static final int ON_DEVICE_SDK = 31;
    /** Android 13, the first that reports installed languages. */
    static final int LANGUAGE_CHECK_SDK = 33;

    public final boolean available;
    /** Recognition happens on the device for sure (Android's on-device recogniser). */
    public final boolean onDevice;
    /** Why not, or null: OFFLINE_MODEL_MISSING, OFFLINE_MODEL_DOWNLOADING, UNAVAILABLE. */
    public final String reason;

    private SpeechAvailability(boolean available, boolean onDevice, String reason) {
        this.available = available;
        this.onDevice = onDevice;
        this.reason = reason;
    }

    /**
     * @param service           SpeechRecognizer.isRecognitionAvailable
     * @param onDeviceRecognizer SpeechRecognizer.isOnDeviceRecognitionAvailable (false before API 31)
     * @param germanInstalled   the on-device German model is installed; null when unknown (before API 33)
     * @param germanPending     the on-device German model is downloading
     */
    public static SpeechAvailability decide(
        int sdk,
        boolean service,
        boolean onDeviceRecognizer,
        Boolean germanInstalled,
        boolean germanPending
    ) {
        if (sdk >= ON_DEVICE_SDK) {
            if (!onDeviceRecognizer) {
                return service
                    ? new SpeechAvailability(false, false, OFFLINE_MODEL_MISSING)
                    : new SpeechAvailability(false, false, UNAVAILABLE);
            }
            if (Boolean.TRUE.equals(germanInstalled) || germanInstalled == null) {
                return new SpeechAvailability(true, true, null);
            }
            return new SpeechAvailability(false, true, germanPending ? OFFLINE_MODEL_DOWNLOADING : OFFLINE_MODEL_MISSING);
        }
        return service ? new SpeechAvailability(true, false, null) : new SpeechAvailability(false, false, UNAVAILABLE);
    }

    /** "de", "de-DE", "de_AT": German. */
    public static boolean isGerman(String tag) {
        if (tag == null) return false;
        String lower = tag.toLowerCase(java.util.Locale.ROOT);
        return lower.equals("de") || lower.startsWith("de-") || lower.startsWith("de_");
    }

    public static boolean containsGerman(List<String> tags) {
        if (tags == null) return false;
        for (String tag : tags) if (isGerman(tag)) return true;
        return false;
    }
}
