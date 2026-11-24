package local.habittracker.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import local.habittracker.app.focus.FocusBlockPlugin;
import local.habittracker.app.sound.FocusSoundPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins (Fokus-Sperre, Fokus-Klänge); npm plugins register themselves.
        registerPlugin(FocusBlockPlugin.class);
        registerPlugin(FocusSoundPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
