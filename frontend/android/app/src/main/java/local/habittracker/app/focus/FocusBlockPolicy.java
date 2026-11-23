package local.habittracker.app.focus;

import java.util.Arrays;
import java.util.Collection;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Which app or website a block stops. The same rules as the server's
 * backend/src/focus-blocks/focus-block-rules.ts: a host covers its
 * subdomains; Sperrliste mode stops what is listed, strict mode everything
 * not on the Erlaubt-Liste; what the phone needs to stay usable and this
 * app itself always pass. No Android types, so it runs in JVM tests.
 */
public final class FocusBlockPolicy {
    private FocusBlockPolicy() {}

    /**
     * Apps a block never covers, besides the ones found on the phone (its
     * dialer, launchers and keyboards, see FocusBlockController): the system
     * UI, Settings, calls and emergency, the alarm clock, Android's own
     * permission and VPN dialogs.
     */
    public static final List<String> ALWAYS_ALLOWED_PACKAGES = Collections.unmodifiableList(
        Arrays.asList(
            "android",
            "com.android.systemui",
            "com.android.settings",
            "com.android.phone",
            "com.android.server.telecom",
            "com.android.incallui",
            "com.android.dialer",
            "com.google.android.dialer",
            "com.samsung.android.dialer",
            "com.android.emergency",
            "com.google.android.apps.safetyhub",
            "com.android.deskclock",
            "com.google.android.deskclock",
            "com.sec.android.app.clockpackage",
            "com.android.vpndialogs",
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.android.packageinstaller",
            "com.google.android.packageinstaller"
        )
    );

    /** "m.youtube.com" is covered by the entry "youtube.com"; "notyoutube.com" is not. */
    public static boolean hostMatches(String host, String entry) {
        String name = normalizeHost(host);
        String base = normalizeHost(entry);
        if (name.isEmpty() || base.isEmpty()) return false;
        return name.equals(base) || name.endsWith("." + base);
    }

    private static boolean matchesAny(String host, Collection<String> entries) {
        for (String entry : entries) {
            if (hostMatches(host, entry)) return true;
        }
        return false;
    }

    /** Whether the block stops looking up this host. */
    public static boolean isHostBlocked(String host, FocusBlockState state) {
        if (matchesAny(host, state.fixedDomains)) return false;
        if (state.isStrict()) return !matchesAny(host, state.allowDomains);
        return matchesAny(host, state.blockDomains);
    }

    /**
     * Whether the block covers this app. `fixedAllowed` are the packages the
     * phone needs (ALWAYS_ALLOWED_PACKAGES plus its dialer, launchers,
     * keyboards and this app).
     */
    public static boolean isPackageBlocked(String packageName, FocusBlockState state, Set<String> fixedAllowed) {
        if (packageName == null || packageName.isEmpty()) return false;
        if (fixedAllowed.contains(packageName)) return false;
        if (state.isStrict()) return !state.allowApps.contains(packageName);
        return state.blockApps.contains(packageName);
    }

    /** The always allowed packages together with those found on the phone. */
    public static Set<String> fixedAllowed(String ownPackage, Collection<String> foundOnPhone) {
        Set<String> result = new HashSet<String>(ALWAYS_ALLOWED_PACKAGES);
        if (ownPackage != null) result.add(ownPackage);
        for (String name : foundOnPhone) {
            if (name != null && !name.isEmpty()) result.add(name);
        }
        return result;
    }

    private static String normalizeHost(String host) {
        if (host == null) return "";
        String name = host.trim().toLowerCase(Locale.ROOT);
        while (name.endsWith(".")) name = name.substring(0, name.length() - 1);
        return name;
    }
}
