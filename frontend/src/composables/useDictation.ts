import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  onDeactivated,
  onScopeDispose,
  readonly,
  ref,
  shallowRef,
} from "vue";
import {
  NOTHING_HEARD,
  type DictationDownload,
  type DictationEngine,
  type DictationEngineId,
  type DictationHandlers,
  type DictationMode,
  type DictationSession,
  type DictationSetup,
} from "./dictation/engine";
import { nativeEngine } from "./dictation/native-engine";
import { stubEngine } from "./dictation/stub-engine";
import { whisperEngine, whisperModelState } from "./dictation/whisper-engine";
import type { WhisperPlan } from "./dictation/whisper-model";
import { useVoiceInputSettings } from "./useVoiceInputSettings";

/**
 * Dictation (docs/voice-input.md): one microphone, recognition on the
 * device only (`./dictation/`). In the Android app the phone's own
 * recogniser, elsewhere Whisper in the browser. The audio never leaves the
 * device. No way at all, or the switch in Einstellungen off: `available` is
 * false and the caller shows no microphone.
 */

export type {
  DictationEngineId,
  DictationMode,
  DictationSetup,
} from "./dictation/engine";
export { MICROPHONE_DENIED, NOTHING_HEARD } from "./dictation/engine";
export {
  MAX_RECORDING_MS,
  removeWhisperModel,
} from "./dictation/whisper-engine";

export type DictationState =
  | "idle"
  /** A one-time model download waits for a yes (`download`). */
  | "confirming"
  /** The model loads (`progress`). */
  | "downloading"
  /** Something to do first, e.g. install the offline pack (`setup`). */
  | "setup"
  /** Opening the microphone, e.g. while the device asks for permission. */
  | "starting"
  | "listening"
  | "processing"
  | "error";

export type UseDictationOptions = {
  /** Short ends after a pause; long runs until stopped. */
  mode?: DictationMode;
  /** The recognised text, trimmed and not empty. */
  onResult?: (text: string) => void;
  /** What was heard so far (only the phone's recogniser can tell). */
  onPartial?: (text: string) => void;
};

/** Every engine this page knows; a new one is registered here. */
const ENGINES: Record<DictationEngineId, DictationEngine> = {
  stub: stubEngine,
  native: nativeEngine,
  whisper: whisperEngine,
};

/**
 * Which engine first: the Android app's own, then Whisper in the browser.
 * The test stub leads, but only exists while an e2e test set its global.
 */
export const ENGINE_ORDER: DictationEngineId[] = ["stub", "native", "whisper"];

/** The first engine of the order that can run. */
export function pickEngine(
  support: Partial<Record<DictationEngineId, boolean>>,
): DictationEngineId | null {
  return ENGINE_ORDER.find((id) => support[id] === true) ?? null;
}

/** Asks the engines in order until one can run. */
async function detect(): Promise<void> {
  for (const id of ENGINE_ORDER) {
    await ENGINES[id].detect();
    if (ENGINES[id].supported.value) return;
  }
}

/** The first engine that can run here, whatever the switch says. */
function supportedEngine(): DictationEngineId | null {
  return pickEngine(
    Object.fromEntries(
      ENGINE_ORDER.map((id) => [id, ENGINES[id].supported.value === true]),
    ),
  );
}

/** What this device would dictate with, for Einstellungen. */
export type DictationDevice =
  | { engine: null }
  | { engine: "stub" }
  /** `setup`: what is missing, e.g. the German offline pack. */
  | { engine: "native"; setup: DictationSetup | null }
  /** `stored`: the model is already in the browser's cache. */
  | { engine: "whisper"; plan: WhisperPlan; stored: boolean };

export async function describeDictation(): Promise<DictationDevice> {
  await detect();
  const id = supportedEngine();
  if (id === "native")
    return { engine: id, setup: nativeEngine.setup?.value ?? null };
  if (id === "whisper") return { engine: id, ...(await whisperModelState()) };
  return { engine: id };
}

/**
 * Whether a microphone shows on this page (switch on and a way to
 * recognise), without a dictation of its own: for hints like "long press
 * to dictate" on the plus button.
 */
export function useDictationAvailable() {
  const { settings } = useVoiceInputSettings();
  void detect();
  return computed(
    () =>
      settings.value.enabled &&
      ENGINE_ORDER.some((id) => ENGINES[id].supported.value === true),
  );
}

/** The one dictation on this page; a new one cancels it. */
let active: { cancel(): void } | null = null;

/** Asks every engine again, e.g. after a test changed the page. */
export function forgetDictationEngines(): void {
  for (const engine of Object.values(ENGINES)) engine.reset();
  active?.cancel();
  active = null;
}

export function useDictation(options: UseDictationOptions = {}) {
  const mode = options.mode ?? "short";
  const state = ref<DictationState>("idle");
  /** What was heard so far, while listening. */
  const interim = ref("");
  /** Why the last attempt failed, in German; null otherwise. */
  const error = ref<string | null>(null);
  /** While confirming: what the download weighs. */
  const download = shallowRef<DictationDownload | null>(null);
  /** While downloading: 0 to 1. */
  const progress = ref(0);
  /** While in setup: what to do. */
  const setup = shallowRef<DictationSetup | null>(null);
  /** What the setup's button said after it ran. */
  const setupNote = ref<string | null>(null);
  const { settings } = useVoiceInputSettings();

  /** The engine the next start would take. */
  const engine = computed<DictationEngineId | null>(() =>
    settings.value.enabled ? supportedEngine() : null,
  );
  const available = computed(() => engine.value !== null);
  /** The engine of the running dictation. */
  const running = ref<DictationEngineId | null>(null);

  /** One attempt, from the tap to its end; cancel ends it at any step. */
  type Attempt = {
    ended: boolean;
    session: DictationSession | null;
    token: { cancel(): void } | null;
  };
  let attempt: Attempt | null = null;
  void detect();

  // Escape discards, before a dialog around the field sees it.
  function onKey(event: KeyboardEvent) {
    if (event.key !== "Escape" || !attempt) return;
    event.preventDefault();
    event.stopPropagation();
    cancel();
  }

  function begin(): Attempt {
    active?.cancel();
    const current: Attempt = { ended: false, session: null, token: null };
    current.token = { cancel: () => cancelAttempt(current) };
    attempt = current;
    active = current.token;
    error.value = null;
    interim.value = "";
    window.addEventListener("keydown", onKey, true);
    return current;
  }

  function end(current: Attempt, then: () => void) {
    if (current.ended) return;
    current.ended = true;
    window.removeEventListener("keydown", onKey, true);
    if (attempt === current) attempt = null;
    if (active === current.token) active = null;
    interim.value = "";
    running.value = null;
    download.value = null;
    then();
  }

  function fail(current: Attempt, message: string, id?: DictationEngineId) {
    end(current, () => {
      const needed = id ? ENGINES[id].setup?.value : null;
      if (needed) {
        setup.value = needed;
        setupNote.value = null;
        state.value = "setup";
      } else {
        error.value = message;
        state.value = "error";
      }
      // An engine may have dropped out: find the next for the next tap.
      void detect();
    });
  }

  function cancelAttempt(current: Attempt) {
    if (current.session) current.session.cancel();
    else end(current, () => (state.value = "idle"));
  }

  async function start(): Promise<void> {
    if (attempt) return;
    await detect();
    const chosen = engine.value;
    if (!chosen || attempt) return;
    const chosenEngine = ENGINES[chosen];
    const needed = chosenEngine.setup?.value;
    if (needed) {
      setup.value = needed;
      setupNote.value = null;
      state.value = "setup";
      return;
    }
    const current = begin();
    const due = chosenEngine.pendingDownload?.() ?? null;
    if (due) {
      download.value = due;
      state.value = "confirming";
      return;
    }
    await prepareAndListen(current, chosen);
  }

  /** The yes to the download: load, then listen. */
  async function confirmDownload(): Promise<void> {
    const current = attempt;
    const chosen = engine.value;
    if (!current || state.value !== "confirming" || !chosen) return;
    download.value = null;
    await prepareAndListen(current, chosen);
  }

  async function prepareAndListen(current: Attempt, chosen: DictationEngineId) {
    const chosenEngine = ENGINES[chosen];
    if (chosenEngine.prepare && !chosenEngine.ready?.()) {
      progress.value = 0;
      state.value = "downloading";
      try {
        await chosenEngine.prepare((fraction) => {
          if (!current.ended) progress.value = fraction;
        });
      } catch (failure) {
        if (!current.ended)
          fail(
            current,
            failure instanceof Error ? failure.message : String(failure),
          );
        return;
      }
      // Cancelled while loading: the model stays loaded for next time.
      if (current.ended) return;
    }
    listen(current, chosen);
  }

  function listen(current: Attempt, chosen: DictationEngineId) {
    // "Hört zu" only once the microphone is open: a permission question
    // may come first.
    state.value = "starting";
    running.value = chosen;
    const handlers: DictationHandlers = {
      listening: () => {
        if (!current.ended && state.value === "starting")
          state.value = "listening";
      },
      partial: (text) => {
        if (current.ended) return;
        interim.value = text;
        options.onPartial?.(text);
      },
      processing: () => {
        if (!current.ended) state.value = "processing";
      },
      done: (text) => {
        const result = text.trim();
        if (!result) return fail(current, NOTHING_HEARD);
        end(current, () => {
          state.value = "idle";
          options.onResult?.(result);
        });
      },
      failed: (message) => fail(current, message, chosen),
      cancelled: () => end(current, () => (state.value = "idle")),
    };
    const session = ENGINES[chosen].start(mode, handlers);
    if (!current.ended) current.session = session;
  }

  /** Ends listening; the text heard so far still arrives. */
  function stop(): void {
    attempt?.session?.stop();
  }

  /** Ends whatever runs (asking, loading, listening) and drops what was heard. */
  function cancel(): void {
    if (attempt) cancelAttempt(attempt);
  }

  /** A tap on the microphone: start; stop while listening; give up loading. */
  function toggle(): void {
    if (state.value === "listening") stop();
    else if (
      state.value === "downloading" ||
      state.value === "confirming" ||
      state.value === "starting"
    )
      cancel();
    else if (state.value !== "processing") {
      dismiss();
      void start();
    }
  }

  /** Back to idle from an error or the setup hint. */
  function dismiss(): void {
    if (state.value !== "error" && state.value !== "setup") return;
    error.value = null;
    setup.value = null;
    setupNote.value = null;
    state.value = "idle";
  }

  /** The setup hint's button (e.g. opens the offline pack's settings). */
  async function runSetupAction(): Promise<void> {
    const action = setup.value?.action;
    if (!action) return;
    try {
      setupNote.value = await action.run();
    } catch {
      setupNote.value =
        "Die Einstellungen ließen sich nicht öffnen. Such die Offline-Spracherkennung bitte von Hand.";
    }
  }

  if (getCurrentScope()) onScopeDispose(cancel);
  // Heute's quick add hidden behind another view (KeepAlive) stops listening.
  if (getCurrentInstance()) onDeactivated(cancel);

  return {
    state: readonly(state),
    interim: readonly(interim),
    error: readonly(error),
    download: readonly(download),
    progress: readonly(progress),
    setup: readonly(setup),
    setupNote: readonly(setupNote),
    engine,
    running: readonly(running),
    available,
    start,
    stop,
    cancel,
    toggle,
    confirmDownload,
    dismiss,
    runSetupAction,
  };
}
