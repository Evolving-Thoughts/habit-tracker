package local.habittracker.app.sound;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import org.junit.Test;

public class FocusSoundCacheTest {
    private static final String V1 = "https://plan.evolving-thoughts.com/api/sounds/rain/file?v=1";
    private static final String V2 = "https://plan.evolving-thoughts.com/api/sounds/rain/file?v=2";

    @Test
    public void nameIsIdHashAndOgg() {
        String name = FocusSoundCache.fileName("rain", V1);
        assertTrue(name, name.matches("rain-[0-9a-f]{16}\\.ogg"));
    }

    @Test
    public void sameAddressGivesSameName() {
        assertEquals(FocusSoundCache.fileName("rain", V1), FocusSoundCache.fileName("rain", V1));
    }

    @Test
    public void newVersionGivesNewName() {
        assertNotEquals(FocusSoundCache.fileName("rain", V1), FocusSoundCache.fileName("rain", V2));
    }

    @Test
    public void idCannotLeaveTheDirectory() {
        String name = FocusSoundCache.fileName("../../etc/passwd", V1);
        assertTrue(name, name.startsWith("______etc_passwd-"));
        assertTrue(name, !name.contains("/"));
        assertTrue(FocusSoundCache.fileName("", V1).startsWith("sound-"));
        assertTrue(FocusSoundCache.fileName(null, V1).startsWith("sound-"));
    }

    @Test
    public void staleFindsOlderVersionsAndPartialDownloads() {
        String current = FocusSoundCache.fileName("rain", V2);
        String old = FocusSoundCache.fileName("rain", V1);
        String[] existing = {current, old, FocusSoundCache.partialName(old), FocusSoundCache.partialName(current)};

        List<String> stale = FocusSoundCache.staleNames(existing, "rain", current);

        assertEquals(Arrays.asList(old, FocusSoundCache.partialName(old), FocusSoundCache.partialName(current)), stale);
    }

    @Test
    public void staleLeavesOtherSoundsAndForeignFiles() {
        String current = FocusSoundCache.fileName("rain", V2);
        String[] existing = {
            current,
            FocusSoundCache.fileName("rain-heavy", V1),
            FocusSoundCache.fileName("forest", V1),
            "rain-notes.txt",
            "rain-0123.ogg",
            null,
        };

        assertEquals(Collections.emptyList(), FocusSoundCache.staleNames(existing, "rain", current));
    }

    @Test
    public void staleOfAnEmptyOrMissingDirectoryIsEmpty() {
        assertEquals(Collections.emptyList(), FocusSoundCache.staleNames(null, "rain", "x"));
        assertEquals(Collections.emptyList(), FocusSoundCache.staleNames(new String[0], "rain", "x"));
    }
}
