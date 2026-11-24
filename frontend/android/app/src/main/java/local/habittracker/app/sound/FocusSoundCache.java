package local.habittracker.app.sound;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

/**
 * File names in the cache of the Fokus-Klänge (cacheDir/focus-sounds), pure
 * and without Android: one file per sound and address. The address carries
 * `?v=<version>`, so a new version gets a new name, and the older files of
 * the same sound count as stale.
 */
public final class FocusSoundCache {
    public static final String DIRECTORY = "focus-sounds";
    static final String EXTENSION = ".ogg";
    static final String PARTIAL = ".part";
    private static final int HASH_LENGTH = 16;

    private FocusSoundCache() {}

    /** The id with everything but letters, digits, `_` and `-` replaced, never empty. */
    public static String safeId(String id) {
        String safe = id == null ? "" : id.replaceAll("[^A-Za-z0-9_-]", "_");
        return safe.isEmpty() ? "sound" : safe;
    }

    /** `<id>-<first 16 hex digits of SHA-256(url)>.ogg` */
    public static String fileName(String id, String url) {
        return safeId(id) + "-" + hash(url) + EXTENSION;
    }

    /** The name of the download in progress for a cache file. */
    public static String partialName(String fileName) {
        return fileName + PARTIAL;
    }

    /**
     * The names among `existing` that belong to the same sound but not to
     * `keep`: older versions and left-over partial downloads. Other sounds,
     * also those whose id starts with this one (`rain` and `rain-heavy`),
     * and foreign files stay.
     */
    public static List<String> staleNames(String[] existing, String id, String keep) {
        List<String> stale = new ArrayList<String>();
        if (existing == null) return stale;
        Pattern own = Pattern.compile(
            Pattern.quote(safeId(id) + "-") + "[0-9a-f]{" + HASH_LENGTH + "}" + Pattern.quote(EXTENSION) + "(" + Pattern.quote(PARTIAL) + ")?"
        );
        for (String name : existing) {
            if (name != null && !name.equals(keep) && own.matcher(name).matches()) stale.add(name);
        }
        return stale;
    }

    static String hash(String url) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest((url == null ? "" : url).getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (int i = 0; hex.length() < HASH_LENGTH; i++) {
                hex.append(String.format("%02x", digest[i]));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 missing", e);
        }
    }
}
