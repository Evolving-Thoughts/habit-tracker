/**
 * Seamless loops in the browser (docs/focus-sounds.md): two audio elements
 * take turns. Shortly before the end of one, the other starts from the top
 * and the two cross-fade, so the gap a codec leaves at the end of a file
 * never shows. Web Audio with decoded buffers would loop exactly, but four
 * minutes of music need about 85 MB decoded.
 *
 * Pure apart from the elements and the clock it is handed, so a spec can
 * drive it with fake elements and fake timers.
 */

/** The part of an HTMLAudioElement the loop uses. */
export type LoopElement = {
  src: string;
  volume: number;
  currentTime: number;
  readonly duration: number;
  preload: string;
  play(): Promise<void> | void;
  pause(): void;
  addEventListener(type: "ended" | "error", listener: () => void): void;
};

export type SoundLoopOptions = {
  createElement?: () => LoopElement;
  /** Length of the cross-fade at the end; shorter for very short files. */
  crossfadeMs?: number;
  /** The fade when the sound is stopped. */
  fadeOutMs?: number;
  tickMs?: number;
  now?: () => number;
  /** The file cannot be loaded or played (missing, not audio, offline). */
  onError?: (cause: unknown) => void;
};

export type SoundLoop = {
  /**
   * Plays `url` in a loop. While it plays, the same url only takes the
   * volume; after stop() it carries on where it stopped.
   */
  play(url: string, volume: number): void;
  setVolume(volume: number): void;
  /** Fades out briefly, then pauses. */
  stop(): void;
  readonly playing: boolean;
};

const clamp = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/*
 * A browser refuses play() without a gesture (NotAllowedError) or when a new
 * source interrupts it (AbortError). Neither means the file is broken.
 */
const harmless = (cause: unknown): boolean =>
  cause instanceof Error &&
  (cause.name === "NotAllowedError" || cause.name === "AbortError");

export function createSoundLoop(options: SoundLoopOptions = {}): SoundLoop {
  const {
    createElement = () => new Audio(),
    crossfadeMs = 2000,
    fadeOutMs = 500,
    tickMs = 100,
    now = () => Date.now(),
    onError = () => {},
  } = options;

  const elements = [createElement(), createElement()] as const;
  let active: LoopElement = elements[0];
  let idle: LoopElement = elements[1];
  let url: string | null = null;
  let volume = 1;
  let playing = false;
  /** The turn from one element to the other near the end of the file. */
  let crossfade: {
    from: LoopElement;
    to: LoopElement;
    at: number;
    ms: number;
  } | null = null;
  /** The fade after stop(), from the levels the elements had then. */
  let fadeOut: { at: number; levels: Map<LoopElement, number> } | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;

  function start(element: LoopElement): void {
    try {
      const result = element.play();
      if (result && typeof result.catch === "function")
        result.catch((cause: unknown) => {
          if (!harmless(cause)) fail(cause);
        });
    } catch (cause) {
      if (!harmless(cause)) fail(cause);
    }
  }

  function fail(cause: unknown): void {
    if (!playing) return;
    halt();
    onError(cause);
  }

  /** Silence at once: both paused, no fades, no ticks. */
  function halt(): void {
    playing = false;
    crossfade = null;
    fadeOut = null;
    for (const element of elements) element.pause();
    if (ticker !== null) clearInterval(ticker);
    ticker = null;
  }

  for (const element of elements) {
    // A missed turn (no duration known, a throttled tick): start over.
    element.addEventListener("ended", () => {
      if (!playing || fadeOut || element !== active) return;
      element.currentTime = 0;
      start(element);
    });
    element.addEventListener("error", () => {
      if (url !== null) fail((element as { error?: unknown }).error ?? null);
    });
  }

  function tick(): void {
    const time = now();
    if (fadeOut) {
      const progress = Math.min(1, (time - fadeOut.at) / fadeOutMs);
      for (const [element, level] of fadeOut.levels)
        element.volume = clamp(level * (1 - progress));
      if (progress >= 1) halt();
      return;
    }
    if (!playing) return;
    if (crossfade) {
      const progress = Math.min(1, (time - crossfade.at) / crossfade.ms);
      crossfade.to.volume = clamp(volume * progress);
      crossfade.from.volume = clamp(volume * (1 - progress));
      if (progress >= 1) {
        crossfade.from.pause();
        crossfade.from.currentTime = 0;
        crossfade = null;
      }
      return;
    }
    const duration = active.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const remainingMs = (duration - active.currentTime) * 1000;
    // A file shorter than two fades turns over at its middle.
    if (remainingMs > Math.min(crossfadeMs, (duration * 1000) / 2)) return;
    idle.currentTime = 0;
    idle.volume = 0;
    start(idle);
    crossfade = {
      from: active,
      to: idle,
      at: time,
      ms: Math.max(remainingMs, tickMs),
    };
    [active, idle] = [idle, active];
  }

  return {
    play(next, level) {
      volume = clamp(level);
      if (playing && url === next && !fadeOut) {
        if (!crossfade) active.volume = volume;
        return;
      }
      halt();
      // The same sound again carries on where it stopped.
      if (url !== next) {
        url = next;
        for (const element of elements) {
          element.preload = "auto";
          element.src = next;
          element.currentTime = 0;
        }
      }
      active.volume = volume;
      playing = true;
      start(active);
      ticker = setInterval(tick, tickMs);
    },
    setVolume(level) {
      volume = clamp(level);
      if (playing && !crossfade && !fadeOut) active.volume = volume;
    },
    stop() {
      if (!playing || fadeOut) return;
      crossfade = null;
      fadeOut = {
        at: now(),
        levels: new Map(elements.map((element) => [element, element.volume])),
      };
    },
    get playing() {
      return playing && !fadeOut;
    },
  };
}
