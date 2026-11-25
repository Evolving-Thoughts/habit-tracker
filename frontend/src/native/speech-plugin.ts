import { listenNativeData, nativeBridge } from "./bridge";

/**
 * The Android plugin `Speech` (frontend/android, docs/voice-input.md): the
 * phone's own speech recognition, on the device only. Android 12+ uses
 * Android's on-device recogniser; older versions the default service, asked
 * to stay offline. No online fallback. Null in a browser or an app without
 * the plugin.
 */

export type SpeechStartOptions = {
  /** Send `partial` events while the person speaks. */
  partial: boolean;
};

/** Why dictation cannot run on the device (yet). */
export type SpeechUnavailableReason =
  "offline-model-missing" | "offline-model-downloading" | "unavailable";

export type SpeechStatus = {
  available: boolean;
  /** Android's on-device recogniser does the work (Android 12+). */
  onDevice: boolean;
  reason: SpeechUnavailableReason | null;
};

/** What `openOfflineSetup` did: asked Android to download, opened settings, nothing. */
export type SpeechSetupAction = "download" | "settings" | "none";

/**
 * Stable codes from SpeechErrors.java: "permission" (microphone refused),
 * "offline-model-missing" (no German offline model), "no-match" (nothing
 * understood), "speech-timeout" (nothing said), "busy", "audio", "server",
 * "client", "unknown"; `start` may also reject with "unavailable".
 */
export type SpeechErrorEvent = { code: string; message: string };

export type SpeechNative = {
  status(): Promise<SpeechStatus>;
  /**
   * Asks for the microphone if needed, then listens until the person pauses
   * (the recogniser decides). Rejects with code "permission" when refused.
   * The result arrives as `final`, followed by `end`.
   */
  start(options: SpeechStartOptions): Promise<void>;
  /** Stops listening; what was heard so far still arrives as `final`. */
  stop(): Promise<void>;
  /** Stops and drops what was heard: no `final`, only `end`. */
  cancel(): Promise<void>;
  /** Helps to get the German offline model (download on Android 13+, else settings). */
  openOfflineSetup(): Promise<SpeechSetupAction>;
  onPartial(handler: (event: { text: string }) => void): () => void;
  onFinal(handler: (event: { text: string }) => void): () => void;
  onError(handler: (event: SpeechErrorEvent) => void): () => void;
  /** Listening is over, after `final`, `error` or `cancel()`. */
  onEnd(handler: () => void): () => void;
};

const PLUGIN = "Speech";
const REASONS: SpeechUnavailableReason[] = [
  "offline-model-missing",
  "offline-model-downloading",
  "unavailable",
];

export function speechNative(): SpeechNative | null {
  const cap = nativeBridge(PLUGIN);
  if (!cap?.nativePromise) return null;
  const call = <T>(method: string, options: object = {}) =>
    cap.nativePromise!(PLUGIN, method, options) as Promise<T>;
  return {
    status: async () => {
      const result = await call<{
        available?: unknown;
        onDevice?: unknown;
        reason?: unknown;
      }>("available");
      const reason = REASONS.find((known) => known === result.reason) ?? null;
      return {
        available: result.available === true,
        onDevice: result.onDevice === true,
        reason: result.available === true ? null : (reason ?? "unavailable"),
      };
    },
    start: (options) => call<void>("start", options),
    stop: () => call<void>("stop"),
    cancel: () => call<void>("cancel"),
    openOfflineSetup: async () => {
      const { action } = await call<{ action?: unknown }>("openOfflineSetup");
      return action === "download" || action === "settings" ? action : "none";
    },
    onPartial: (handler) => listenNativeData(cap, PLUGIN, "partial", handler),
    onFinal: (handler) => listenNativeData(cap, PLUGIN, "final", handler),
    onError: (handler) => listenNativeData(cap, PLUGIN, "error", handler),
    onEnd: (handler) => listenNativeData(cap, PLUGIN, "end", () => handler()),
  };
}
