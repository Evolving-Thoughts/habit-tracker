import { listenNativeData, nativeBridge } from "./bridge";

/**
 * The Android plugin `BackButton` (frontend/android, docs/android-test.md ›
 * Zurück): Android's Back button and back gesture come to the page as
 * `back` {id}, and the page answers each one at once. Answering "not
 * handled", or not in time, leaves the app as Android's own Back would.
 * Null in a browser.
 */
export type BackButtonNative = {
  /** Every press of Back; the returned function stops listening. */
  onBack(handler: (id: number) => void): () => void;
  answer(id: number, handled: boolean): Promise<void>;
};

const PLUGIN = "BackButton";

export function backButtonNative(): BackButtonNative | null {
  const cap = nativeBridge(PLUGIN);
  if (!cap?.nativePromise) return null;
  return {
    onBack: (handler) =>
      listenNativeData<{ id: number }>(cap, PLUGIN, "back", ({ id }) =>
        handler(id),
      ),
    answer: (id, handled) =>
      cap.nativePromise!(PLUGIN, "answer", { id, handled }).then(
        () => undefined,
      ),
  };
}
