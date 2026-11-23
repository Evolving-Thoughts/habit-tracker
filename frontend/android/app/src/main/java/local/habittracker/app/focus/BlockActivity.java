package local.habittracker.app.focus;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import local.habittracker.app.MainActivity;
import local.habittracker.app.R;

/**
 * The block screen over a blocked app: "Fokus läuft: <Quest> · noch 18 Min."
 * with "Zurück zur Quest", which opens the Fokus-Modus, and for a Soft block
 * "Sperre aufheben" after a question. Back leads to the home screen, not
 * into the blocked app. It closes by itself once the block is over.
 */
public class BlockActivity extends AppCompatActivity {
    public static final String EXTRA_OPEN_FOCUS = "local.habittracker.app.OPEN_FOCUS";
    private static final long REFRESH_MS = 15_000;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable refresh = new Runnable() {
        @Override
        public void run() {
            render();
            handler.postDelayed(this, REFRESH_MS);
        }
    };
    private final Runnable onChange = this::render;
    private TextView title;
    private TextView detail;
    private Button lift;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(layout());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                goHome();
            }
        });
    }

    private LinearLayout layout() {
        int padding = dp(24);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(padding, padding, padding, padding);
        root.setBackgroundColor(ContextCompat.getColor(this, R.color.focus_ground));

        TextView eyebrow = text(R.string.focus_block_eyebrow, 14, R.color.focus_ink_muted);
        title = text(0, 26, R.color.focus_ink);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        detail = text(0, 17, R.color.focus_ink_muted);

        Button back = new Button(this);
        back.setText(R.string.focus_block_back);
        back.setAllCaps(false);
        back.setTextColor(ContextCompat.getColor(this, R.color.focus_on_action));
        back.setBackgroundColor(ContextCompat.getColor(this, R.color.focus_action));
        back.setMinHeight(dp(52));
        back.setOnClickListener(view -> openFocus());

        lift = new Button(this);
        lift.setText(R.string.focus_block_lift);
        lift.setAllCaps(false);
        lift.setTextColor(ContextCompat.getColor(this, R.color.focus_action_strong));
        lift.setBackgroundColor(ContextCompat.getColor(this, R.color.focus_ground));
        lift.setMinHeight(dp(48));
        lift.setOnClickListener(view -> askLift());

        root.addView(eyebrow);
        root.addView(title, spaced(dp(8)));
        root.addView(detail, spaced(dp(8)));
        root.addView(back, spaced(dp(32)));
        root.addView(lift, spaced(dp(12)));
        return root;
    }

    private TextView text(int resource, int sizeSp, int color) {
        TextView view = new TextView(this);
        if (resource != 0) view.setText(resource);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
        view.setTextColor(ContextCompat.getColor(this, color));
        view.setGravity(Gravity.CENTER);
        return view;
    }

    private LinearLayout.LayoutParams spaced(int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = top;
        return params;
    }

    private int dp(int value) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value, getResources().getDisplayMetrics()));
    }

    @Override
    protected void onStart() {
        super.onStart();
        FocusBlockStore.addListener(onChange);
        handler.post(refresh);
    }

    @Override
    protected void onStop() {
        FocusBlockStore.removeListener(onChange);
        handler.removeCallbacks(refresh);
        super.onStop();
    }

    private void render() {
        FocusBlockState state = FocusBlockStore.load(this);
        long now = System.currentTimeMillis();
        if (!state.isActive(now)) {
            finish();
            return;
        }
        title.setText(getString(R.string.focus_block_title, state.title));
        if (state.isHardcore()) {
            long minutes = state.minutesLeft(now);
            detail.setText(
                minutes > 0
                    ? getResources().getQuantityString(R.plurals.focus_block_minutes_left, (int) minutes, (int) minutes)
                    : getString(R.string.focus_block_almost_done)
            );
            lift.setVisibility(android.view.View.GONE);
        } else {
            detail.setText(R.string.focus_block_soft);
            lift.setVisibility(android.view.View.VISIBLE);
        }
    }

    private void openFocus() {
        Intent intent = new Intent(this, MainActivity.class)
            .putExtra(EXTRA_OPEN_FOCUS, true)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
        finish();
    }

    private void askLift() {
        FocusBlockState state = FocusBlockStore.load(this);
        if (state.isHardcore() || state.blockId == null) return;
        final String blockId = state.blockId;
        new AlertDialog.Builder(this)
            .setTitle(R.string.focus_block_lift_question)
            .setMessage(R.string.focus_block_lift_detail)
            .setPositiveButton(R.string.focus_block_lift, (dialog, which) -> {
                FocusBlockSync.lift(this, blockId);
                finish();
            })
            .setNegativeButton(R.string.focus_block_keep, null)
            .show();
    }

    private void goHome() {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(home);
        finish();
    }
}
