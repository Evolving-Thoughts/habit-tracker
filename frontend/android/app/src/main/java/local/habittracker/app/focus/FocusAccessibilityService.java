package local.habittracker.app.focus;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;
import java.util.Set;

/**
 * The app blocker: Android tells it which app comes to the front
 * (TYPE_WINDOW_STATE_CHANGED, package name only; it cannot read window
 * content, see res/xml/focus_accessibility_service.xml). During a block it
 * lays the block screen over an app the block covers. While it runs, it
 * also keeps the stored block current (FocusBlockSync).
 */
public class FocusAccessibilityService extends AccessibilityService {
    private String foreground;
    private Set<String> fixedAllowed;
    private final Runnable onChange = this::recheck;

    @Override
    protected void onServiceConnected() {
        super.onServiceConnected();
        fixedAllowed = FocusBlockController.fixedAllowed(this);
        FocusBlockStore.addListener(onChange);
        FocusBlockSync.start(this);
        FocusBlockController.apply(this);
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
        CharSequence name = event.getPackageName();
        if (name == null) return;
        foreground = name.toString();
        recheck();
    }

    /** The app in front, again: after it changed or the block did. */
    private void recheck() {
        String current = foreground;
        if (current == null || current.equals(getPackageName())) return;
        FocusBlockState state = FocusBlockStore.load(this);
        if (!state.isActive(System.currentTimeMillis())) return;
        if (fixedAllowed == null) fixedAllowed = FocusBlockController.fixedAllowed(this);
        if (!FocusBlockPolicy.isPackageBlocked(current, state, fixedAllowed)) return;
        Intent screen = new Intent(this, BlockActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(screen);
    }

    @Override
    public void onInterrupt() {
        // Nothing to stop: the service gives no feedback of its own.
    }

    @Override
    public void onDestroy() {
        FocusBlockStore.removeListener(onChange);
        FocusBlockSync.stop();
        super.onDestroy();
    }
}
