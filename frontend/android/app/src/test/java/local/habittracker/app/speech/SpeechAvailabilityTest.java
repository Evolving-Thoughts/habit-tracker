package local.habittracker.app.speech;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class SpeechAvailabilityTest {
    @Test
    public void android13WithGermanInstalledRunsOnTheDevice() {
        SpeechAvailability a = SpeechAvailability.decide(34, true, true, true, false);
        assertTrue(a.available);
        assertTrue(a.onDevice);
        assertNull(a.reason);
    }

    @Test
    public void android13WithoutGermanAsksForTheOfflinePack() {
        SpeechAvailability missing = SpeechAvailability.decide(33, true, true, false, false);
        assertFalse(missing.available);
        assertEquals("offline-model-missing", missing.reason);
        SpeechAvailability pending = SpeechAvailability.decide(33, true, true, false, true);
        assertEquals("offline-model-downloading", pending.reason);
    }

    @Test
    public void android12CannotCheckTheLanguageAndTriesOnTheDevice() {
        SpeechAvailability a = SpeechAvailability.decide(31, true, true, null, false);
        assertTrue(a.available);
        assertTrue(a.onDevice);
    }

    @Test
    public void android12WithoutOnDeviceRecogniserNeverFallsBackToTheCloud() {
        SpeechAvailability a = SpeechAvailability.decide(32, true, false, null, false);
        assertFalse(a.available);
        assertEquals("offline-model-missing", a.reason);
        assertEquals("unavailable", SpeechAvailability.decide(32, false, false, null, false).reason);
    }

    @Test
    public void olderAndroidUsesTheServiceAskedToStayOffline() {
        SpeechAvailability a = SpeechAvailability.decide(30, true, false, null, false);
        assertTrue(a.available);
        assertFalse(a.onDevice);
        assertEquals("unavailable", SpeechAvailability.decide(26, false, false, null, false).reason);
    }

    @Test
    public void recognisesGermanLanguageTags() {
        assertTrue(SpeechAvailability.isGerman("de"));
        assertTrue(SpeechAvailability.isGerman("de-DE"));
        assertTrue(SpeechAvailability.isGerman("DE_at"));
        assertFalse(SpeechAvailability.isGerman("den"));
        assertFalse(SpeechAvailability.isGerman("en-US"));
        assertFalse(SpeechAvailability.isGerman(null));
        assertTrue(SpeechAvailability.containsGerman(Arrays.asList("en-US", "de-DE")));
        assertFalse(SpeechAvailability.containsGerman(Collections.<String>emptyList()));
        assertFalse(SpeechAvailability.containsGerman(null));
    }
}
