package local.habittracker.app;

import android.os.Build;
import android.view.View;
import android.view.ViewGroup.MarginLayoutParams;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * Keeps the WebView clear of the on-screen keyboard.
 *
 * <p>From Android 15 every app is drawn edge to edge, and {@code adjustResize}
 * no longer shrinks the window for the keyboard. Capacitor's own handler
 * ({@code adjustMarginsForEdgeToEdge}) only keeps the WebView clear of the
 * system bars, so the keyboard lay over the page: a dialog's sticky
 * "Quest erstellen" sat under it. This listener takes its place and also
 * counts the keyboard, so the WebView ends right above it, the page's
 * visual viewport shrinks as in a browser, and a bottom sheet's footer
 * stays in reach.
 */
final class KeyboardInsets {
    private KeyboardInsets() {}

    /** The bottom margin: the keyboard where it is open, else the navigation bar. */
    static int bottom(int systemBars, int keyboard) {
        return Math.max(systemBars, keyboard);
    }

    static void apply(View webView) {
        // Before Android 15 the window still resizes for the keyboard itself.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.VANILLA_ICE_CREAM) return;
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets keyboard = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            MarginLayoutParams margins = (MarginLayoutParams) view.getLayoutParams();
            margins.leftMargin = bars.left;
            margins.topMargin = bars.top;
            margins.rightMargin = bars.right;
            margins.bottomMargin = bottom(bars.bottom, keyboard.bottom);
            view.setLayoutParams(margins);
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
