package local.habittracker.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import local.habittracker.app.focus.FocusBlockPlugin;
import local.habittracker.app.sound.FocusSoundPlugin;
import local.habittracker.app.speech.SpeechPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins (Fokus-Sperre, Fokus-Klänge, Spracheingabe); npm plugins register themselves.
        registerPlugin(FocusBlockPlugin.class);
        registerPlugin(FocusSoundPlugin.class);
        registerPlugin(SpeechPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
