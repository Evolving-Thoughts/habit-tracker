package local.habittracker.app.speech;

/**
 * SpeechRecognizer's error numbers as the stable codes and German messages
 * the web layer shows (frontend/src/native/speech-plugin.ts). Pure, so a JVM
 * test covers it; the numbers mirror SpeechRecognizer.ERROR_*, some of which
 * only exist from Android 12 on.
 */
public final class SpeechErrors {
    static final int NETWORK_TIMEOUT = 1;
    static final int NETWORK = 2;
    static final int AUDIO = 3;
    static final int SERVER = 4;
    static final int CLIENT = 5;
    static final int SPEECH_TIMEOUT = 6;
    static final int NO_MATCH = 7;
    static final int RECOGNIZER_BUSY = 8;
    static final int INSUFFICIENT_PERMISSIONS = 9;
    static final int TOO_MANY_REQUESTS = 10;
    static final int SERVER_DISCONNECTED = 11;
    static final int LANGUAGE_NOT_SUPPORTED = 12;
    static final int LANGUAGE_UNAVAILABLE = 13;

    public static final String PERMISSION_MESSAGE =
        "Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen des Geräts.";
    public static final String UNAVAILABLE_MESSAGE =
        "Auf diesem Gerät ist keine Spracherkennung eingerichtet.";
    public static final String OFFLINE_MODEL_MESSAGE =
        "Für die Erkennung auf dem Gerät fehlt das deutsche Offline-Sprachpaket.";

    /** One error as the web layer gets it. */
    public static final class Mapped {
        public final String code;
        public final String message;

        Mapped(String code, String message) {
            this.code = code;
            this.message = message;
        }
    }

    private SpeechErrors() {}

    public static Mapped of(int error) {
        switch (error) {
            // Only on-device recognition is asked for: a recogniser that wants the
            // network, or lacks the language, is missing the offline German pack.
            case NETWORK_TIMEOUT:
            case NETWORK:
            case SERVER_DISCONNECTED:
            case LANGUAGE_NOT_SUPPORTED:
            case LANGUAGE_UNAVAILABLE:
                return new Mapped(SpeechAvailability.OFFLINE_MODEL_MISSING, OFFLINE_MODEL_MESSAGE);
            case AUDIO:
                return new Mapped("audio", "Das Mikrofon ließ sich nicht verwenden.");
            case SERVER:
                return new Mapped("server", "Die Spracherkennung des Geräts hat einen Fehler gemeldet.");
            case CLIENT:
                return new Mapped("client", "Die Spracherkennung wurde unterbrochen. Versuch es noch einmal.");
            case SPEECH_TIMEOUT:
                return new Mapped("speech-timeout", "Nichts gehört. Tipp noch einmal aufs Mikrofon und sprich etwas.");
            case NO_MATCH:
                return new Mapped("no-match", "Nichts verstanden. Tipp noch einmal aufs Mikrofon und sprich etwas.");
            case RECOGNIZER_BUSY:
            case TOO_MANY_REQUESTS:
                return new Mapped("busy", "Die Spracherkennung ist gerade beschäftigt. Versuch es gleich noch einmal.");
            case INSUFFICIENT_PERMISSIONS:
                return new Mapped("permission", PERMISSION_MESSAGE);
            default:
                return new Mapped("unknown", "Die Spracherkennung ist fehlgeschlagen. Versuch es noch einmal.");
        }
    }

    /** Nothing (more) understood, but the partial text may stand as the result. */
    public static boolean keepsPartial(int error) {
        return error == NO_MATCH || error == SPEECH_TIMEOUT;
    }
}
