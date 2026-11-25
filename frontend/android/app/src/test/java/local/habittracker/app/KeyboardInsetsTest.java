package local.habittracker.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class KeyboardInsetsTest {
    @Test
    public void keepsClearOfTheNavigationBarWithoutAKeyboard() {
        assertEquals(48, KeyboardInsets.bottom(48, 0));
    }

    @Test
    public void endsRightAboveAnOpenKeyboard() {
        // The keyboard's inset already covers the navigation bar below it.
        assertEquals(910, KeyboardInsets.bottom(48, 910));
    }
}
