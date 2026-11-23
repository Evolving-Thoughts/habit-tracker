package local.habittracker.app.focus;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.net.VpnService;
import android.os.Build;
import android.telecom.TelecomManager;
import android.util.Log;
import android.view.accessibility.AccessibilityManager;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Puts the stored block into effect: starts the DNS filter (FocusVpnService)
 * while a block that covers websites holds and the VPN consent is given,
 * stops it otherwise, and knows what the phone needs to stay usable.
 */
public final class FocusBlockController {
    private static final String TAG = "FocusBlockController";

    private FocusBlockController() {}

    /** After every change of the stored block (and on service start). */
    public static void apply(Context context) {
        Context app = context.getApplicationContext();
        FocusBlockState state = FocusBlockStore.load(app);
        boolean wanted = state.isActive(System.currentTimeMillis()) && state.filtersDomains() && vpnPrepared(app);
        if (wanted && !FocusVpnService.isRunning()) {
            try {
                ContextCompat.startForegroundService(app, new Intent(app, FocusVpnService.class));
            } catch (RuntimeException error) {
                // Android may refuse a start from the background; the next
                // change with the app in front starts it.
                Log.w(TAG, "Could not start the website filter", error);
            }
        } else if (!wanted && FocusVpnService.isRunning()) {
            // The service also stops by itself on the same change; this is the quick way.
            try {
                app.startService(new Intent(app, FocusVpnService.class).setAction(FocusVpnService.ACTION_STOP));
            } catch (RuntimeException error) {
                Log.i(TAG, "The website filter stops by itself");
            }
        }
    }

    public static boolean vpnPrepared(Context context) {
        try {
            return VpnService.prepare(context) == null;
        } catch (RuntimeException error) {
            return false;
        }
    }

    public static boolean accessibilityEnabled(Context context) {
        AccessibilityManager manager = (AccessibilityManager) context.getSystemService(Context.ACCESSIBILITY_SERVICE);
        if (manager == null) return false;
        ComponentName own = new ComponentName(context, FocusAccessibilityService.class);
        for (AccessibilityServiceInfo info : manager.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
            if (info.getResolveInfo() == null || info.getResolveInfo().serviceInfo == null) continue;
            ComponentName name = new ComponentName(info.getResolveInfo().serviceInfo.packageName, info.getResolveInfo().serviceInfo.name);
            if (name.equals(own)) return true;
        }
        return false;
    }

    /**
     * What a block never covers on this phone: FocusBlockPolicy's list,
     * this app, the default dialer, every launcher and every keyboard.
     */
    public static Set<String> fixedAllowed(Context context) {
        Set<String> found = new LinkedHashSet<String>();
        PackageManager packages = context.getPackageManager();
        try {
            TelecomManager telecom = (TelecomManager) context.getSystemService(Context.TELECOM_SERVICE);
            if (telecom != null && telecom.getDefaultDialerPackage() != null) found.add(telecom.getDefaultDialerPackage());
        } catch (RuntimeException ignored) {
            // No telephony on this device.
        }
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        for (ResolveInfo info : packages.queryIntentActivities(home, 0)) {
            found.add(info.activityInfo.packageName);
        }
        Intent dial = new Intent(Intent.ACTION_DIAL);
        for (ResolveInfo info : packages.queryIntentActivities(dial, 0)) {
            found.add(info.activityInfo.packageName);
        }
        InputMethodManager input = (InputMethodManager) context.getSystemService(Context.INPUT_METHOD_SERVICE);
        if (input != null) {
            for (InputMethodInfo method : input.getEnabledInputMethodList()) {
                found.add(method.getPackageName());
            }
        }
        return FocusBlockPolicy.fixedAllowed(context.getPackageName(), found);
    }

    /**
     * The browsers on this phone: apps that open any web link. The DNS
     * filter covers only them, so other apps (and calls, messengers on the
     * Erlaubt-Liste, the system) keep their names.
     */
    public static List<String> browsers(Context context) {
        Set<String> result = new LinkedHashSet<String>();
        Intent web = new Intent(Intent.ACTION_VIEW, Uri.parse("https://example.com/"));
        web.addCategory(Intent.CATEGORY_BROWSABLE);
        int flags = PackageManager.GET_RESOLVED_FILTER | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PackageManager.MATCH_ALL : 0);
        for (ResolveInfo info : context.getPackageManager().queryIntentActivities(web, flags)) {
            // A browser takes any host; an app that opens only its own links does not.
            if (info.filter != null && info.filter.countDataAuthorities() > 0) continue;
            result.add(info.activityInfo.packageName);
        }
        result.remove(context.getPackageName());
        return new ArrayList<String>(result);
    }
}
