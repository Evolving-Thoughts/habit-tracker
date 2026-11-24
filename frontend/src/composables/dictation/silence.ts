/**
 * When a short dictation in the browser ends by itself: after a pause
 * following speech, or when nothing was said at all. Pure: fed with the
 * microphone's level (RMS, 0 to 1) and the time.
 */

export type SilenceOptions = {
  /** A level above this counts as speech. */
  threshold: number;
  /** Quiet this long after speech ends the recording. */
  silenceMs: number;
  /** Quiet this long from the start, without any speech: nothing heard. */
  noSpeechMs: number;
};

/** About 2 seconds of pause end a title. */
export const SHORT_SILENCE: SilenceOptions = {
  threshold: 0.02,
  silenceMs: 2000,
  noSpeechMs: 8000,
};

export type SilenceVerdict = "listening" | "pause" | "nothing-heard";

export function createSilenceDetector(
  options: SilenceOptions,
  startedAt: number,
) {
  let lastSpeech: number | null = null;
  return {
    feed(level: number, now: number): SilenceVerdict {
      if (level > options.threshold) lastSpeech = now;
      if (lastSpeech === null)
        return now - startedAt >= options.noSpeechMs
          ? "nothing-heard"
          : "listening";
      return now - lastSpeech >= options.silenceMs ? "pause" : "listening";
    },
    get heardSpeech(): boolean {
      return lastSpeech !== null;
    },
  };
}

/** Root mean square of one block of samples. */
export function rms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}
