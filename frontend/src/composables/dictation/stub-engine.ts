import { readonly, ref } from "vue";
import type { DictationEngine } from "./engine";

/**
 * A test hook, nothing more (e2e/voice-input.spec.ts): Playwright has no
 * microphone, so a test sets `window.__dictationStub = { text: "…" }` in an
 * init script, and every dictation then "hears" that text. Nothing in the
 * app sets the global; without it this engine reports itself unsupported
 * and the order goes on to the real ones.
 */

declare global {
  interface Window {
    __dictationStub?: { text: string };
  }
}

/** How long the stub "listens" before its text arrives. */
const HEARING_MS = 300;

const stubText = (): string | undefined => {
  const text =
    typeof window === "undefined" ? undefined : window.__dictationStub?.text;
  return typeof text === "string" ? text : undefined;
};

const supported = ref<boolean | null>(null);

export const stubEngine: DictationEngine = {
  id: "stub",
  supported: readonly(supported),

  async detect() {
    supported.value = stubText() !== undefined;
  },

  start(_mode, handlers) {
    let over = false;
    const finish = () => {
      if (over) return;
      over = true;
      clearTimeout(timer);
      handlers.processing();
      handlers.done(stubText() ?? "");
    };
    const timer = setTimeout(finish, HEARING_MS);
    return {
      stop: finish,
      cancel: () => {
        if (over) return;
        over = true;
        clearTimeout(timer);
        handlers.cancelled();
      },
    };
  },

  reset() {
    supported.value = null;
  },
};
