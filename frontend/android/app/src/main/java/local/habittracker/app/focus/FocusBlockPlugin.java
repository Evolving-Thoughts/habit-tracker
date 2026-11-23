package local.habittracker.app.focus;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.VpnService;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The web layer's way to the Fokus-Sperre on Android
 * (frontend/src/native/focus-block-plugin.ts): the stand of the two
 * permissions, the ways to grant them, the installed apps for the lists,
 * and `setBlock`, which hands over each server answer. The phone stores it
 * and enforces it from then on by itself (FocusBlockStore).
 */
@CapacitorPlugin(name = "FocusBlock")
public class FocusBlockPlugin extends Plugin {
    private static final String OPEN_FOCUS = "openFocus";

    @Override
    public void load() {
        // Opened from the block screen while the app was not running.
        Intent intent = getActivity().getIntent();
        if (intent != null && intent.getBooleanExtra(BlockActivity.EXTRA_OPEN_FOCUS, false)) {
            intent.removeExtra(BlockActivity.EXTRA_OPEN_FOCUS);
            notifyListeners(OPEN_FOCUS, new JSObject(), true);
        }
        FocusBlockController.apply(getContext());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (intent != null && intent.getBooleanExtra(BlockActivity.EXTRA_OPEN_FOCUS, false)) {
            notifyListeners(OPEN_FOCUS, new JSObject(), true);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // In front again: a good moment to start the website filter.
        FocusBlockController.apply(getContext());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context context = getContext();
        JSObject result = new JSObject();
        result.put("accessibilityEnabled", FocusBlockController.accessibilityEnabled(context));
        result.put("vpnPrepared", FocusBlockController.vpnPrepared(context));
        call.resolve(result);
    }

    @PluginMethod
    public void openAccessibilitySettings(PluginCall call) {
        Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
        call.resolve();
    }

    @PluginMethod
    public void requestVpnPermission(PluginCall call) {
        Intent consent = VpnService.prepare(getContext());
        if (consent == null) {
            call.resolve(granted(true));
            return;
        }
        startActivityForResult(call, consent, "vpnResult");
    }

    @ActivityCallback
    private void vpnResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        boolean ok = FocusBlockController.vpnPrepared(getContext());
        if (ok) FocusBlockController.apply(getContext());
        call.resolve(granted(ok));
    }

    private JSObject granted(boolean value) {
        JSObject result = new JSObject();
        result.put("granted", value);
        return result;
    }

    /** Apps with a launcher icon, by name; this app left out. */
    @PluginMethod
    public void listInstalledApps(PluginCall call) {
        PackageManager packages = getContext().getPackageManager();
        Intent launcher = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        Map<String, String> apps = new LinkedHashMap<String, String>();
        for (ResolveInfo info : packages.queryIntentActivities(launcher, 0)) {
            String name = info.activityInfo.packageName;
            if (name.equals(getContext().getPackageName()) || apps.containsKey(name)) continue;
            apps.put(name, info.loadLabel(packages).toString());
        }
        List<JSObject> list = new ArrayList<JSObject>();
        for (Map.Entry<String, String> app : apps.entrySet()) {
            JSObject entry = new JSObject();
            entry.put("label", app.getValue());
            entry.put("packageName", app.getKey());
            list.add(entry);
        }
        JSObject result = new JSObject();
        result.put("apps", new JSArray(list));
        call.resolve(result);
    }

    /** The server's latest answer with the addresses to poll and lift; null forgets it. */
    @PluginMethod
    public void setBlock(PluginCall call) {
        Context context = getContext();
        JSObject state = call.getObject("state", null);
        if (state == null) {
            FocusBlockStore.clear(context);
        } else {
            FocusBlockStore.save(
                context,
                state,
                System.currentTimeMillis(),
                call.getString("pollUrl"),
                call.getString("endUrl"),
                call.getString("origin")
            );
        }
        FocusBlockController.apply(context);
        call.resolve();
    }
}
