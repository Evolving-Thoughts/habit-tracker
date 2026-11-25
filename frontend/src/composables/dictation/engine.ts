import type { Ref } from "vue";

/**
 * What every way of turning speech into text provides (docs/voice-input.md).
 * Both run on the device: no audio ever leaves it. `useDictation` asks the
 * engines in order and starts the first one that can run here. A new way is
 * one more file with this shape plus its place in the order.
 */

/** "short": a title or one line, ends after a pause. "long": until stopped. */
export type DictationMode = "short" | "long";

/** Known engines; a new one adds its id here. "stub" is the e2e test hook. */
export type DictationEngineId = "native" | "whisper" | "stub";

/** What a running engine reports; calls after the first ending are ignored. */
export type DictationHandlers = {
  /** The microphone is open (after any permission question): it listens now. */
  listening(): void;
  /** What was heard so far, if the engine can tell. */
  partial(text: string): void;
  /** Recording is over, the text is being worked out. */
  processing(): void;
  done(text: string): void;
  /** In German, ready to show. */
  failed(message: string): void;
  cancelled(): void;
};

export type DictationSession = {
  /** Stop listening; what was heard still arrives as `done`. */
  stop(): void;
  /** Stop and drop everything; `cancelled` follows at once. */
  cancel(): void;
};

/** Something the person has to do first, e.g. install an offline language pack. */
export type DictationSetup = {
  message: string;
  /** How to do it, step by step. */
  steps: readonly string[];
  /** A button that helps (opens the settings); with what it said afterwards. */
  action?: { label: string; run(): Promise<string | null> };
};

/** A one-time download that needs a yes before the first dictation. */
export type DictationDownload = { megabytes: number };

export type DictationEngine = {
  readonly id: DictationEngineId;
  /** Whether it can run on this page; null until `detect` has answered. */
  readonly supported: Readonly<Ref<boolean | null>>;
  /** Finds out whether it can run; cheap to call again (answers are kept). */
  detect(): Promise<void>;
  /** What has to happen before it can listen; null when ready. */
  readonly setup?: Readonly<Ref<DictationSetup | null>>;
  /** The download still to agree to; null when none is due. */
  pendingDownload?(): DictationDownload | null;
  /** Gets ready (loads the model; downloads it the first time). 0 to 1. */
  prepare?(onProgress: (fraction: number) => void): Promise<void>;
  /** Already prepared on this page: `prepare` can be skipped. */
  ready?(): boolean;
  start(mode: DictationMode, handlers: DictationHandlers): DictationSession;
  /** Forgets what was found, e.g. after a test changed the page. */
  reset(): void;
};

export const MICROPHONE_DENIED =
  "Kein Zugriff aufs Mikrofon. Erlaube es in den Einstellungen des Geräts.";
export const NOTHING_HEARD =
  "Nichts verstanden. Tipp noch einmal aufs Mikrofon und sprich etwas.";
export const NO_MICROPHONE = "Kein Mikrofon gefunden.";
export const START_FAILED =
  "Die Spracherkennung ließ sich nicht starten. Versuch es noch einmal.";
export const RECOGNITION_FAILED =
  "Die Spracherkennung ist fehlgeschlagen. Versuch es noch einmal.";

/** getUserMedia's refusal in the app's words. */
export function microphoneError(error: unknown): string {
  const name = (error as { name?: unknown } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return MICROPHONE_DENIED;
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return NO_MICROPHONE;
  return START_FAILED;
}
