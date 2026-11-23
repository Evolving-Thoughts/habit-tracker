package local.habittracker.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import local.habittracker.app.focus.FocusBlockPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin (Fokus-Sperre); npm plugins register themselves.
        registerPlugin(FocusBlockPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
