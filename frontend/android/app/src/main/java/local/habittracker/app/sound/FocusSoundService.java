package local.habittracker.app.sound;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import local.habittracker.app.R;

/**
 * Plays the chosen Fokus-Klang in an endless loop, also with the screen off,
 * as a media foreground service with Media3's media notification
 * ("Fokus-Klang" and the sound's title).
 *
 * The app sends its commands through a MediaController (FocusSoundPlugin).
 * Any pause that does not come from the app (the notification, the system's
 * media controls, headphones unplugged, another app taking the audio focus)
 * or an error ends the playback completely and reports `stopped` to the
 * plugin, so the button in the web view stays true. The app itself stops
 * with {@link #stopPlayback()}, which reports nothing.
 */
public class FocusSoundService extends MediaSessionService {
    /** Called on the main thread when playback ended without the app asking for it. */
    interface StopListener {
        void onStopped();
    }

    private static volatile StopListener stopListener;
    /** The running service; touched on the main thread only. */
    private static FocusSoundService running;

    private MediaSession session;

    static void setStopListener(StopListener listener) {
        stopListener = listener;
    }

    static void clearStopListener(StopListener listener) {
        if (stopListener == listener) stopListener = null;
    }

    /** Stops playback and the service, if it runs. Main thread only. */
    static void stopPlayback() {
        if (running != null) running.finish(false);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();
        ExoPlayer player = new ExoPlayer.Builder(this)
            .setAudioAttributes(attributes, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_LOCAL)
            .build();
        player.setRepeatMode(Player.REPEAT_MODE_ONE);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayWhenReadyChanged(boolean playWhenReady, int reason) {
                // The app never pauses, it stops: a pause came from outside.
                if (!playWhenReady) finish(true);
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                finish(true);
            }
        });

        MediaSession.Builder builder = new MediaSession.Builder(this, player).setCallback(new SessionCallback());
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) {
            builder.setSessionActivity(
                PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)
            );
        }
        session = builder.build();
        setMediaNotificationProvider(
            new DefaultMediaNotificationProvider.Builder(this).setChannelName(R.string.focus_sound_channel).build()
        );
        running = this;
    }

    @Nullable
    @Override
    public MediaSession onGetSession(@NonNull MediaSession.ControllerInfo controllerInfo) {
        return session;
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        // App swiped away: nobody is left to show the sound as on.
        finish(true);
    }

    @Override
    public void onDestroy() {
        running = null;
        if (session != null) {
            session.getPlayer().release();
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    private void finish(boolean report) {
        if (session == null) return;
        Player player = session.getPlayer();
        boolean active = player.getMediaItemCount() > 0;
        player.stop();
        player.clearMediaItems();
        stopSelf();
        if (report && active) {
            StopListener listener = stopListener;
            if (listener != null) listener.onStopped();
        }
    }

    /** The notification gets play/pause only: no skipping or seeking in a loop. */
    private static final class SessionCallback implements MediaSession.Callback {
        @NonNull
        @Override
        public MediaSession.ConnectionResult onConnect(@NonNull MediaSession session, @NonNull MediaSession.ControllerInfo controller) {
            if (session.isMediaNotificationController(controller)) {
                Player.Commands commands = MediaSession.ConnectionResult.DEFAULT_PLAYER_COMMANDS.buildUpon()
                    .removeAll(
                        Player.COMMAND_SEEK_TO_PREVIOUS,
                        Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
                        Player.COMMAND_SEEK_TO_NEXT,
                        Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
                        Player.COMMAND_SEEK_BACK,
                        Player.COMMAND_SEEK_FORWARD,
                        Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM
                    )
                    .build();
                return new MediaSession.ConnectionResult.AcceptedResultBuilder(session).setAvailablePlayerCommands(commands).build();
            }
            return MediaSession.Callback.super.onConnect(session, controller);
        }
    }
}
