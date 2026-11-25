package local.habittracker.app.focus;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import org.junit.Test;

public class FocusBlockPolicyTest {
    private static final long NOW = 1_800_000_000_000L;
    private static final long MINUTE = 60_000L;

    private static FocusBlockState state(String mode, String listMode, Long endsAt, List<String> blockApps, List<String> allowApps) {
        return new FocusBlockState(
            "v1",
            "block-1",
            "Kapitel schreiben",
            mode,
            listMode,
            NOW - 5 * MINUTE,
            endsAt,
            blockApps,
            allowApps,
            Arrays.asList("youtube.com", "reddit.com"),
            Collections.singletonList("wikipedia.org"),
            Collections.singletonList("plan.evolving-thoughts.com"),
            0,
            null
        );
    }

    private static FocusBlockState blocklist() {
        return state("soft", "blocklist", null, Collections.singletonList("com.google.android.youtube"), Collections.<String>emptyList());
    }

    @Test
    public void hostCoversItsSubdomainsOnly() {
        assertTrue(FocusBlockPolicy.hostMatches("youtube.com", "youtube.com"));
        assertTrue(FocusBlockPolicy.hostMatches("m.youtube.com", "youtube.com"));
        assertTrue(FocusBlockPolicy.hostMatches("WWW.M.YouTube.com.", "youtube.com"));
        assertFalse(FocusBlockPolicy.hostMatches("notyoutube.com", "youtube.com"));
        assertFalse(FocusBlockPolicy.hostMatches("youtube.com.evil.org", "youtube.com"));
        assertFalse(FocusBlockPolicy.hostMatches("", "youtube.com"));
    }

    @Test
    public void blocklistModeStopsListedHosts() {
        FocusBlockState state = blocklist();
        assertTrue(FocusBlockPolicy.isHostBlocked("m.youtube.com", state));
        assertTrue(FocusBlockPolicy.isHostBlocked("old.reddit.com", state));
        assertFalse(FocusBlockPolicy.isHostBlocked("de.wikipedia.org", state));
        assertFalse(FocusBlockPolicy.isHostBlocked("example.com", state));
    }

    @Test
    public void strictModeStopsEverythingButTheAllowListAndTheApp() {
        FocusBlockState state = state("soft", "allowlist", null, Collections.<String>emptyList(), Collections.singletonList("org.wikipedia"));
        assertFalse(FocusBlockPolicy.isHostBlocked("de.wikipedia.org", state));
        assertFalse(FocusBlockPolicy.isHostBlocked("plan.evolving-thoughts.com", state));
        assertTrue(FocusBlockPolicy.isHostBlocked("example.com", state));
        Set<String> fixed = FocusBlockPolicy.fixedAllowed("local.habittracker.app", Collections.singletonList("com.example.launcher"));
        assertFalse(FocusBlockPolicy.isPackageBlocked("org.wikipedia", state, fixed));
        assertFalse(FocusBlockPolicy.isPackageBlocked("com.example.launcher", state, fixed));
        assertFalse(FocusBlockPolicy.isPackageBlocked("local.habittracker.app", state, fixed));
        assertFalse(FocusBlockPolicy.isPackageBlocked("com.android.systemui", state, fixed));
        assertTrue(FocusBlockPolicy.isPackageBlocked("com.instagram.android", state, fixed));
    }

    @Test
    public void blocklistModeStopsListedAppsOnly() {
        Set<String> fixed = FocusBlockPolicy.fixedAllowed("local.habittracker.app", Collections.<String>emptyList());
        FocusBlockState state = blocklist();
        assertTrue(FocusBlockPolicy.isPackageBlocked("com.google.android.youtube", state, fixed));
        assertFalse(FocusBlockPolicy.isPackageBlocked("com.instagram.android", state, fixed));
        assertFalse(FocusBlockPolicy.isPackageBlocked(null, state, fixed));
    }

    @Test
    public void theAppAndThePhoneStayUsableEvenWhenListed() {
        FocusBlockState state = state(
            "soft",
            "blocklist",
            null,
            Arrays.asList("com.android.settings", "local.habittracker.app", "com.google.android.dialer"),
            Collections.<String>emptyList()
        );
        Set<String> fixed = FocusBlockPolicy.fixedAllowed("local.habittracker.app", Collections.<String>emptyList());
        assertFalse(FocusBlockPolicy.isPackageBlocked("com.android.settings", state, fixed));
        assertFalse(FocusBlockPolicy.isPackageBlocked("local.habittracker.app", state, fixed));
        assertFalse(FocusBlockPolicy.isPackageBlocked("com.google.android.dialer", state, fixed));
    }

    @Test
    public void hardcoreHoldsUntilTheSollOnTheServerClock() {
        FocusBlockState hardcore = state("hardcore", "blocklist", NOW + 12 * MINUTE, null, null);
        assertTrue(hardcore.isActive(NOW));
        assertEquals(12, hardcore.minutesLeft(NOW));
        assertEquals(12, hardcore.minutesLeft(NOW + 30_000));
        assertFalse(hardcore.isActive(NOW + 12 * MINUTE));
        assertEquals(0, hardcore.minutesLeft(NOW + 13 * MINUTE));
        // Lifting on the phone does not touch Hardcore.
        assertTrue(hardcore.lifted().isActive(NOW));
    }

    @Test
    public void hardcoreBoundToTheStopwatchHoldsWithoutAMomentAndCannotBeLiftedHere() {
        FocusBlockState hardcore = state("hardcore", "blocklist", null, null, null);
        assertTrue(hardcore.isHardcore());
        assertFalse(hardcore.hasEndMoment());
        assertTrue(hardcore.isActive(NOW + 3 * 60 * MINUTE));
        assertEquals(-1, hardcore.minutesLeft(NOW));
        assertTrue(hardcore.lifted().isActive(NOW));
        assertFalse(hardcore.isActive(NOW - 5 * MINUTE + FocusBlockState.SOFT_BLOCK_MAX_MS));
    }

    @Test
    public void softHoldsUntilLiftedOrTwelveHoursPassed() {
        FocusBlockState soft = blocklist();
        assertTrue(soft.isActive(NOW));
        assertEquals(-1, soft.minutesLeft(NOW));
        assertFalse(soft.lifted().isActive(NOW));
        assertFalse(soft.isActive(NOW - 5 * MINUTE + FocusBlockState.SOFT_BLOCK_MAX_MS));
        assertFalse(FocusBlockState.empty().isActive(NOW));
    }

    @Test
    public void readsTheClockOfTheServer() {
        // The phone runs two minutes ahead of the server.
        FocusBlockState skewed = new FocusBlockState(
            "v1",
            "block-1",
            "Kapitel",
            "hardcore",
            "blocklist",
            NOW,
            NOW + 10 * MINUTE,
            null,
            null,
            null,
            null,
            null,
            2 * MINUTE,
            null
        );
        assertEquals(10, skewed.minutesLeft(NOW + 2 * MINUTE));
        assertTrue(skewed.isActive(NOW + 11 * MINUTE));
        assertFalse(skewed.isActive(NOW + 12 * MINUTE));
    }

    @Test
    public void filtersWebsitesOnlyWhenTheBlockCoversAny() {
        assertTrue(blocklist().filtersDomains());
        FocusBlockState appsOnly = new FocusBlockState(
            "v1", "b", "t", "soft", "blocklist", NOW, null,
            Collections.singletonList("com.x.y"), null, null, null, null, 0, null
        );
        assertFalse(appsOnly.filtersDomains());
        FocusBlockState strict = new FocusBlockState(
            "v1", "b", "t", "soft", "allowlist", NOW, null, null, null, null, null, null, 0, null
        );
        assertTrue(strict.filtersDomains());
    }
}
