package local.habittracker.app.back;

/**
 * Who answers a press of Android's Back (docs/android-test.md › Zurück).
 * While the page listens, each press gets an id and the page decides: it
 * closes what is open, goes back a step or says it has nothing to do. No
 * answer in time (a page that hangs or reloads), an answer of "not handled"
 * or a page that does not listen at all leads to Android's own Back, which
 * leaves the app. Only the latest press counts; older answers are dropped.
 */
final class BackPress {
    /** What press() returns when Android's own Back should run at once. */
    static final long ANDROID_DEFAULT = 0;

    private long next = 0;
    private long pending = ANDROID_DEFAULT;

    /** The id to ask the page with, or ANDROID_DEFAULT. */
    synchronized long press(boolean pageListens) {
        if (!pageListens) {
            pending = ANDROID_DEFAULT;
            return ANDROID_DEFAULT;
        }
        pending = ++next;
        return pending;
    }

    /** True when Android's own Back should run now. */
    synchronized boolean answer(long id, boolean handled) {
        if (id == ANDROID_DEFAULT || id != pending) return false;
        pending = ANDROID_DEFAULT;
        return !handled;
    }

    /** The page did not answer in time; true when Android's own Back should run now. */
    synchronized boolean timeout(long id) {
        if (id == ANDROID_DEFAULT || id != pending) return false;
        pending = ANDROID_DEFAULT;
        return true;
    }
}
