package local.habittracker.app.speech;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class SpeechErrorsTest {
    @Test
    public void aRecogniserThatWantsTheNetworkLacksTheOfflinePack() {
        for (int error : new int[] { 1, 2, 11, 12, 13 }) {
            SpeechErrors.Mapped mapped = SpeechErrors.of(error);
            assertEquals("offline-model-missing", mapped.code);
            assertEquals("Für die Erkennung auf dem Gerät fehlt das deutsche Offline-Sprachpaket.", mapped.message);
        }
    }

    @Test
    public void refusedMicrophoneSaysWhatToDo() {
        SpeechErrors.Mapped mapped = SpeechErrors.of(9);
        assertEquals("permission", mapped.code);
        assertEquals("Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen des Geräts.", mapped.message);
    }

    @Test
    public void everyOtherKnownErrorHasItsCode() {
        assertEquals("audio", SpeechErrors.of(3).code);
        assertEquals("server", SpeechErrors.of(4).code);
        assertEquals("client", SpeechErrors.of(5).code);
        assertEquals("speech-timeout", SpeechErrors.of(6).code);
        assertEquals("no-match", SpeechErrors.of(7).code);
        assertEquals("busy", SpeechErrors.of(8).code);
        assertEquals("busy", SpeechErrors.of(10).code);
    }

    @Test
    public void unknownErrorsStillGetGermanWords() {
        SpeechErrors.Mapped mapped = SpeechErrors.of(99);
        assertEquals("unknown", mapped.code);
        assertTrue(mapped.message.startsWith("Die Spracherkennung"));
    }

    @Test
    public void partialTextStandsWhenNothingMoreWasUnderstood() {
        assertTrue(SpeechErrors.keepsPartial(7));
        assertTrue(SpeechErrors.keepsPartial(6));
        assertFalse(SpeechErrors.keepsPartial(3));
    }
}
