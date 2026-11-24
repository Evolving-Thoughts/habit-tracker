import { listenNative, nativeBridge } from "./bridge";

/**
 * The Android plugin `FocusSound` (frontend/android, docs/focus-sounds.md):
 * a media service plays the loop, so it goes on with the screen off and
 * shows a notification with a stop button. URLs are absolute; the service
 * fetches them with the WebView's cookies. Null in a browser.
 */
export type FocusSoundNative = {
  /**
   * Resolves once the loop is ready; the same file again only takes the
   * volume. Rejects when a later play() or stop() replaced it (code
   * CANCELLED, or none) or the file cannot load.
   */
  play(options: {
    id: string;
    url: string;
    title: string;
    volume: number;
  }): Promise<void>;
  stop(): Promise<void>;
  setVolume(volume: number): Promise<void>;
  chime(options: { id: string; url: string; volume: number }): Promise<void>;
  /**
   * The loop ended without the page asking: the notification's stop, media
   * controls, headphones unplugged, audio focus lost, an error. Not sent
   * after stop().
   */
  onStopped(handler: () => void): () => void;
};

const PLUGIN = "FocusSound";

export function focusSoundNative(): FocusSoundNative | null {
  const cap = nativeBridge(PLUGIN);
  if (!cap?.nativePromise) return null;
  const call = (method: string, options: object = {}) =>
    cap.nativePromise!(PLUGIN, method, options).then(() => undefined);
  return {
    play: (options) => call("play", options),
    stop: () => call("stop"),
    setVolume: (volume) => call("setVolume", { volume }),
    chime: (options) => call("chime", options),
    onStopped: (handler) => listenNative(cap, PLUGIN, "stopped", handler),
  };
}
