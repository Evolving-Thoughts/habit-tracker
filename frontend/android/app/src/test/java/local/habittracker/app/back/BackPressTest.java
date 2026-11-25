package local.habittracker.app.back;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class BackPressTest {
    @Test
    public void withoutAListeningPageAndroidsBackRunsAtOnce() {
        BackPress presses = new BackPress();
        assertEquals(BackPress.ANDROID_DEFAULT, presses.press(false));
    }

    @Test
    public void aHandledPressStaysInTheApp() {
        BackPress presses = new BackPress();
        long id = presses.press(true);
        assertNotEquals(BackPress.ANDROID_DEFAULT, id);
        assertFalse(presses.answer(id, true));
        assertFalse(presses.timeout(id));
    }

    @Test
    public void aPressThePageDoesNotHandleLeavesTheApp() {
        BackPress presses = new BackPress();
        long id = presses.press(true);
        assertTrue(presses.answer(id, false));
        assertFalse(presses.timeout(id));
    }

    @Test
    public void noAnswerInTimeLeavesTheApp() {
        BackPress presses = new BackPress();
        long id = presses.press(true);
        assertTrue(presses.timeout(id));
        assertFalse(presses.answer(id, false));
    }

    @Test
    public void onlyTheLatestPressCounts() {
        BackPress presses = new BackPress();
        long first = presses.press(true);
        long second = presses.press(true);
        assertNotEquals(first, second);
        assertFalse(presses.answer(first, false));
        assertFalse(presses.timeout(first));
        assertFalse(presses.answer(second, true));
    }

    @Test
    public void anAnswerWithoutAPressIsIgnored() {
        BackPress presses = new BackPress();
        assertFalse(presses.answer(BackPress.ANDROID_DEFAULT, false));
        assertFalse(presses.answer(7, false));
        assertFalse(presses.timeout(7));
    }
}
