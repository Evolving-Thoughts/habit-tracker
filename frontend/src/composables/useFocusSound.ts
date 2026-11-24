import { computed, onScopeDispose, readonly, ref, watch } from "vue";
import { soundUrl } from "../api/sounds.api";
import type { Sound } from "../types/sound";
import { focusSoundNative } from "../native/focus-sound-plugin";
import { createSoundLoop, type SoundLoop } from "../utils/sound-loop";
import { loadSoundCatalog, useSoundCatalog } from "./sound-catalog";
import { useFocusSoundSettings } from "./useFocusSoundSettings";
import { playEffect } from "./useSoundEffects";

export {
  loadSoundCatalog,
  resetSoundCatalog,
  useSoundCatalog,
} from "./sound-catalog";

/**
 * Fokus-Klänge (docs/focus-sounds.md): music or ambience in the Fokus-Modus
 * while its stopwatch runs, and the short sound at "Soll erreicht" (through
 * the app's one player for short sounds, `useSoundEffects`).
 */

/** Off: no sound chosen. Paused: chosen, but silent now. */
export type FocusSoundState = "off" | "playing" | "paused";

/** Where the loop comes out: the browser's loop, or the Android service. */
export type SoundOutput = {
  play(sound: Sound, volume: number): void;
  setVolume(volume: number): void;
  stop(): void;
  /** Stopped outside the page (the Android notification). */
  onStopped?(handler: () => void): () => void;
};

function webOutput(onError: () => void): SoundOutput {
  let loop: SoundLoop | null = null;
  return {
    play(sound, volume) {
      // A failed loop is dropped; the next try loads the file afresh.
      loop ??= createSoundLoop({
        onError: () => {
          loop = null;
          onError();
        },
      });
      loop.play(soundUrl(sound), volume);
    },
    setVolume: (volume) => loop?.setVolume(volume),
    stop: () => loop?.stop(),
  };
}

/** The plugin's code for a play() that a later play() or stop() replaced. */
const CANCELLED = "CANCELLED";

function nativeOutput(
  plugin: NonNullable<ReturnType<typeof focusSoundNative>>,
  onError: () => void,
): SoundOutput {
  const absolute = (sound: Sound) =>
    new URL(soundUrl(sound), window.location.href).href;
  /*
   * Counts play() and stop(). The plugin rejects a play() that a later call
   * replaced, not always with CANCELLED; only the latest one's failure is a
   * load error.
   */
  let turn = 0;
  return {
    play(sound, volume) {
      const mine = ++turn;
      plugin
        .play({
          id: sound.id,
          url: absolute(sound),
          title: sound.title,
          volume,
        })
        .catch((cause: unknown) => {
          const code = (cause as { code?: unknown } | null)?.code;
          if (mine === turn && code !== CANCELLED) onError();
        });
    },
    setVolume: (volume) => void plugin.setVolume(volume).catch(() => {}),
    stop() {
      turn++;
      void plugin.stop().catch(() => {});
    },
    onStopped: (handler) => plugin.onStopped(handler),
  };
}

function defaultOutput(onError: () => void): SoundOutput {
  const plugin = focusSoundNative();
  return plugin ? nativeOutput(plugin, onError) : webOutput(onError);
}

export type FocusSoundOptions = {
  /**
   * `${timer.id}:${timer.state}`: a string, so the 3-second poll's fresh
   * objects are no change. Never watch the timer object itself.
   */
  timerKey: () => string;
  /** The stopwatch of the quest in view runs. */
  running: () => boolean;
  /** Its Soll is worked. */
  reached: () => boolean;
  createOutput?: (onError: () => void) => SoundOutput;
  now?: () => number;
};

/**
 * How long a Start pressed here may take to become a running stopwatch
 * (the request, or the question whether another stopwatch should end).
 */
const GESTURE_MS = 30_000;
/**
 * Start or Pause pressed here acts on the sound at once, before the server
 * confirms the stopwatch; this long the press stands in for its answer.
 * If the server says otherwise by then (refused, failed), the sound follows
 * the server again.
 */
const PENDING_MS = 8_000;

const timerIdOf = (key: string): string | null =>
  key.slice(0, key.lastIndexOf(":")) || null;

/**
 * The sound of the Fokus-Modus, for as long as the view is mounted.
 *
 * The rule: it plays only while a sound is chosen, the stopwatch of the
 * quest in view runs, and that stopwatch was started from this tab. "From
 * this tab" means a gesture here: Start or Fortsetzen (`gesture()`, also by
 * Space), choosing a sound, or M while it runs. A stopwatch started on
 * another device or in Heute, or already running when the view opens, stays
 * silent until such a gesture: no surprises, and no clash with the
 * browsers' autoplay rules, which refuse sound without one. Pausing or
 * stopping the stopwatch, or leaving the view (unmount), stops the sound
 * and takes the gesture back. Only `timerKey` and `running` drive this, so
 * the poll that replaces the timer object every 3 seconds changes nothing.
 */
export function useFocusSound(options: FocusSoundOptions) {
  const now = options.now ?? (() => Date.now());
  const { settings, update } = useFocusSoundSettings();
  const { catalog, failed, music, ambience } = useSoundCatalog();
  /** The sound playing now; null while silent. */
  const playingId = ref<string | null>(null);
  const loadFailed = ref(false);
  /*
   * Stopped outside the page (the Android notification, headphones out):
   * off in this view until a sound is chosen again or M. The stored choice
   * stays for the next time.
   */
  const stoppedOutside = ref(false);
  /** The stopwatch started or approved from this tab. */
  let armedFor: string | null = null;
  /** When Start or Fortsetzen was pressed here, waiting for the stopwatch to run. */
  let gestureAt = Number.NEGATIVE_INFINITY;
  /** The stopwatch whose "Soll erreicht" already chimed. */
  let chimedFor: string | null = null;
  /** A Start or Pause pressed here that the server has not confirmed yet. */
  let pending: { running: boolean; until: number } | null = null;
  let pendingCheck: ReturnType<typeof setTimeout> | null = null;

  const output = (options.createOutput ?? defaultOutput)(() => {
    playingId.value = null;
    loadFailed.value = true;
  });

  const chosenId = computed(() =>
    stoppedOutside.value ? null : settings.value.soundId,
  );
  const sound = computed(
    () =>
      catalog.value?.find(
        (entry) => entry.id === chosenId.value && entry.kind !== "chime",
      ) ?? null,
  );
  const state = computed<FocusSoundState>(() =>
    !chosenId.value ? "off" : playingId.value ? "playing" : "paused",
  );
  /** A calm line for the picker; null when all is well. */
  const note = computed(() => {
    if (loadFailed.value) return "Klang konnte nicht geladen werden.";
    if (failed.value) return "Klänge konnten nicht geladen werden.";
    if (catalog.value && !music.value.length && !ambience.value.length)
      return "Noch keine Klänge verfügbar.";
    return null;
  });

  function pendingRunning(): boolean | null {
    if (pending && now() < pending.until) return pending.running;
    pending = null;
    return null;
  }
  const running = () => pendingRunning() ?? options.running();
  const armed = () =>
    pendingRunning() === true ||
    (armedFor !== null && armedFor === timerIdOf(options.timerKey()));

  function silence(): void {
    if (playingId.value === null) return;
    playingId.value = null;
    output.stop();
  }

  /** Plays what the rule asks for now, or nothing. */
  function sync(): void {
    const wanted = armed() && running() ? chosenId.value : null;
    if (!wanted) return silence();
    if (playingId.value === wanted) return;
    const entry = sound.value;
    if (!entry) {
      silence();
      // Without a catalog yet it comes later (the watch below).
      if (catalog.value) loadFailed.value = true;
      else if (failed.value) {
        loadFailed.value = true;
        void loadSoundCatalog();
      }
      return;
    }
    loadFailed.value = false;
    playingId.value = entry.id;
    output.play(entry, settings.value.volume);
  }

  watch(
    [options.timerKey, options.running, options.reached],
    ([key, running, reached], [oldKey, wasRunning, wasReached]) => {
      const id = timerIdOf(key);
      if (key !== oldKey || running !== wasRunning) {
        // The server answered the press here.
        if (pending && pending.running === running) pending = null;
        if (!running) armedFor = null;
        else if (now() - gestureAt <= GESTURE_MS) {
          // The start pressed here: this stopwatch may sound.
          armedFor = id;
          gestureAt = Number.NEGATIVE_INFINITY;
        }
        sync();
        return;
      }
      // Reached while it runs from here: once per stopwatch.
      if (reached && !wasReached && running && armed() && chimedFor !== id) {
        chimedFor = id;
        void playEffect("chime-reached");
      }
    },
  );
  // A start from a gesture can come before the catalog.
  watch(catalog, sync);

  const stopListening = output.onStopped?.(() => {
    // The native loop is over already: nothing to stop.
    playingId.value = null;
    stoppedOutside.value = true;
  });
  onScopeDispose(() => {
    if (pendingCheck !== null) clearTimeout(pendingCheck);
    stopListening?.();
    silence();
  });

  function choose(id: string | null): void {
    stoppedOutside.value = false;
    update({ soundId: id });
    loadFailed.value = false;
    // Choosing is a gesture: a stopwatch running now may sound.
    if (id && options.running()) armedFor = timerIdOf(options.timerKey());
    sync();
  }

  /** The sound M brings back: the last one, else the first music. */
  function fallbackId(): string | null {
    const last = settings.value.lastSoundId;
    const list = catalog.value;
    if (!list) return last;
    const playable = [...music.value, ...ambience.value];
    return (
      playable.find((entry) => entry.id === last)?.id ?? playable[0]?.id ?? null
    );
  }

  return {
    state,
    /** The chosen sound, when the server has it. */
    sound,
    music,
    ambience,
    note,
    /** Set when the chosen sound could not play; for a calm line in the view. */
    loadFailed: readonly(loadFailed),
    volume: computed(() => settings.value.volume),
    /** The choice in effect here; null is "Aus". */
    soundId: chosenId,
    choose,
    /**
     * M: off while it plays (or waits for a paused stopwatch), otherwise on
     * with the chosen or last sound. False when there is nothing to play.
     */
    toggle(): boolean {
      const chosen = chosenId.value;
      if (state.value === "playing" || (chosen && !options.running())) {
        choose(null);
        return true;
      }
      const id = chosen ?? fallbackId();
      if (!id) return false;
      choose(id);
      return true;
    },
    setVolume(volume: number): void {
      update({ volume });
      if (playingId.value) output.setVolume(settings.value.volume);
    },
    /**
     * Start, Fortsetzen or Pause pressed in this tab. With `act` the sound
     * follows the press at once ("start" or "pause"); without, it waits for
     * the server (e.g. when another stopwatch has to end first, which asks).
     */
    gesture(act?: "start" | "pause"): void {
      if (act !== "pause") gestureAt = now();
      if (!act) return;
      pending = { running: act === "start", until: now() + PENDING_MS };
      if (pendingCheck !== null) clearTimeout(pendingCheck);
      pendingCheck = setTimeout(() => {
        pendingCheck = null;
        sync();
      }, PENDING_MS + 50);
      sync();
    },
  };
}

export type FocusSound = ReturnType<typeof useFocusSound>;
