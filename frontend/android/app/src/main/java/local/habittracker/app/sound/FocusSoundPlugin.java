package local.habittracker.app.sound;

import android.content.ComponentName;
import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.webkit.CookieManager;
import androidx.annotation.NonNull;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.MoreExecutors;
import java.io.File;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * The web layer's way to the Fokus-Klänge on Android
 * (frontend/src/native/focus-sound-plugin.ts). The sound files come from the
 * server once, with the session cookie, into the app cache
 * (FocusSoundDownloader); the loop runs in FocusSoundService, so it goes on
 * with the screen off. `chime` plays a short signal once next to it.
 *
 * Event `stopped`: the loop ended without the web layer asking for it
 * (notification, media controls, headphones unplugged, audio focus lost,
 * error).
 */
@CapacitorPlugin(name = "FocusSound")
public class FocusSoundPlugin extends Plugin {
    private static final String STOPPED = "stopped";
    private static final String DEFAULT_TITLE = "Fokus-Klang";

    private interface ControllerTask {
        void run(MediaController controller);
    }

    private interface ErrorHandler {
        void onError(Exception error);
    }

    /** A task waiting for the controller to connect. */
    private static final class Waiter {
        final ControllerTask task;
        final ErrorHandler onError;

        Waiter(ControllerTask task, ErrorHandler onError) {
            this.task = task;
            this.onError = onError;
        }
    }

    private final ExecutorService downloads = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    /** Each play and stop counts up; a download for an older count is dropped. */
    private final AtomicInteger generation = new AtomicInteger();
    private final FocusSoundService.StopListener stopListener = this::onStoppedOutside;

    // Main thread only from here.
    private MediaController controller;
    private ListenableFuture<MediaController> connecting;
    private final List<Waiter> waiting = new ArrayList<Waiter>();
    private PluginCall pendingPlay;
    private String playingFile;
    private ExoPlayer chimePlayer;

    private final Player.Listener controllerListener = new Player.Listener() {
        @Override
        public void onPlaybackStateChanged(int state) {
            if (state == Player.STATE_READY) resolvePending();
        }

        @Override
        public void onPlayerError(@NonNull PlaybackException error) {
            rejectPending("Klang konnte nicht abgespielt werden: " + error.getMessage());
        }
    };

    @Override
    public void load() {
        FocusSoundService.setStopListener(stopListener);
    }

    @Override
    protected void handleOnDestroy() {
        FocusSoundService.clearStopListener(stopListener);
        downloads.shutdownNow();
        // The service keeps playing on its own; its notification can stop it.
        releaseController();
        releaseChime();
        super.handleOnDestroy();
    }

    /** `{ id, url, title, volume }`; resolves once the loop is ready to play. */
    @PluginMethod
    public void play(PluginCall call) {
        String id = call.getString("id");
        String url = call.getString("url");
        if (id == null || url == null) {
            call.reject("id und url fehlen");
            return;
        }
        String title = call.getString("title", DEFAULT_TITLE);
        float volume = volume(call);
        String cookie = CookieManager.getInstance().getCookie(url);
        int ticket = generation.incrementAndGet();
        downloads.execute(() -> {
            File file;
            try {
                file = FocusSoundDownloader.ensure(getContext(), id, url, cookie);
            } catch (Exception e) {
                call.reject("Klang konnte nicht geladen werden: " + e.getMessage());
                return;
            }
            main.post(() -> startLoop(call, ticket, id, file, title, volume));
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        generation.incrementAndGet();
        main.post(() -> {
            rejectPending("Wiedergabe abgebrochen", "CANCELLED");
            playingFile = null;
            FocusSoundService.stopPlayback();
            releaseController();
            call.resolve();
        });
    }

    /** `{ volume }` 0..1 for the running loop. */
    @PluginMethod
    public void setVolume(PluginCall call) {
        float volume = volume(call);
        main.post(() -> {
            if (controller != null && controller.isConnected()) controller.setVolume(volume);
            call.resolve();
        });
    }

    /** `{ id, url, volume }`: plays a short signal once, next to the loop. */
    @PluginMethod
    public void chime(PluginCall call) {
        String id = call.getString("id");
        String url = call.getString("url");
        if (id == null || url == null) {
            call.reject("id und url fehlen");
            return;
        }
        float volume = volume(call);
        String cookie = CookieManager.getInstance().getCookie(url);
        downloads.execute(() -> {
            File file;
            try {
                file = FocusSoundDownloader.ensure(getContext(), id, url, cookie);
            } catch (Exception e) {
                call.reject("Signalton konnte nicht geladen werden: " + e.getMessage());
                return;
            }
            main.post(() -> playChime(call, file, volume));
        });
    }

    private void startLoop(PluginCall call, int ticket, String id, File file, String title, float volume) {
        if (ticket != generation.get()) {
            call.reject("Wiedergabe abgebrochen", "CANCELLED");
            return;
        }
        withController(
            c -> {
                if (ticket != generation.get()) {
                    call.reject("Wiedergabe abgebrochen", "CANCELLED");
                    return;
                }
                String path = file.getAbsolutePath();
                if (path.equals(playingFile) && c.getPlayWhenReady() && c.getPlaybackState() != Player.STATE_IDLE) {
                    // Already playing this sound: no restart, only the volume.
                    c.setVolume(volume);
                    call.resolve();
                    return;
                }
                rejectPending("Wiedergabe abgelöst", "CANCELLED");
                pendingPlay = call;
                playingFile = path;
                MediaItem item = new MediaItem.Builder()
                    .setMediaId(id)
                    .setUri(Uri.fromFile(file))
                    .setMediaMetadata(new MediaMetadata.Builder().setTitle(title).setArtist(DEFAULT_TITLE).build())
                    .build();
                c.setMediaItem(item);
                c.setRepeatMode(Player.REPEAT_MODE_ONE);
                c.setVolume(volume);
                c.prepare();
                c.play();
            },
            error -> call.reject("Wiedergabe nicht möglich: " + error.getMessage())
        );
    }

    /** Runs the task with a connected controller, connecting (and so starting the service) first. */
    private void withController(ControllerTask task, ErrorHandler onError) {
        if (controller != null && controller.isConnected()) {
            task.run(controller);
            return;
        }
        waiting.add(new Waiter(task, onError));
        if (connecting != null) return;
        Context context = getContext();
        SessionToken token = new SessionToken(context, new ComponentName(context, FocusSoundService.class));
        ListenableFuture<MediaController> future = new MediaController.Builder(context, token)
            .setApplicationLooper(Looper.getMainLooper())
            .buildAsync();
        connecting = future;
        future.addListener(
            () -> {
                if (connecting != future) return;
                connecting = null;
                List<Waiter> waiters = new ArrayList<Waiter>(waiting);
                waiting.clear();
                try {
                    controller = future.get();
                    controller.addListener(controllerListener);
                } catch (Exception e) {
                    for (Waiter w : waiters) w.onError.onError(e);
                    return;
                }
                for (Waiter w : waiters) w.task.run(controller);
            },
            MoreExecutors.directExecutor()
        );
    }

    private void playChime(PluginCall call, File file, float volume) {
        releaseChime();
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_SONIFICATION)
            .build();
        // No audio focus: taking it would pause (and so end) the loop.
        ExoPlayer player = new ExoPlayer.Builder(getContext()).setAudioAttributes(attributes, false).build();
        chimePlayer = player;
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED && chimePlayer == player) releaseChime();
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                if (chimePlayer == player) releaseChime();
            }
        });
        player.setMediaItem(MediaItem.fromUri(Uri.fromFile(file)));
        player.setVolume(volume);
        player.prepare();
        player.play();
        call.resolve();
    }

    /** From the service, on the main thread. */
    private void onStoppedOutside() {
        playingFile = null;
        rejectPending("Klang konnte nicht abgespielt werden");
        releaseController();
        notifyListeners(STOPPED, new JSObject());
    }

    private void resolvePending() {
        if (pendingPlay == null) return;
        pendingPlay.resolve();
        pendingPlay = null;
    }

    private void rejectPending(String message) {
        rejectPending(message, null);
    }

    /** code "CANCELLED": replaced by a later play() or stop(), not a failure. */
    private void rejectPending(String message, String code) {
        if (pendingPlay == null) return;
        pendingPlay.reject(message, code);
        pendingPlay = null;
    }

    private void releaseController() {
        if (connecting != null) {
            MediaController.releaseFuture(connecting);
            connecting = null;
        }
        List<Waiter> waiters = new ArrayList<Waiter>(waiting);
        waiting.clear();
        for (Waiter w : waiters) w.onError.onError(new Exception("abgebrochen"));
        if (controller != null) {
            controller.removeListener(controllerListener);
            controller.release();
            controller = null;
        }
    }

    private void releaseChime() {
        if (chimePlayer != null) {
            chimePlayer.release();
            chimePlayer = null;
        }
    }

    private static float volume(PluginCall call) {
        Double value = call.getDouble("volume", 1.0);
        double v = value == null || value.isNaN() ? 1.0 : value;
        return (float) Math.max(0.0, Math.min(1.0, v));
    }
}
