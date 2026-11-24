import { readonly, ref } from "vue";
import { isNativeAndroid } from "../../native/bridge";
import { record, toWhisperSamples, type Recording } from "./audio";
import {
  NOTHING_HEARD,
  RECOGNITION_FAILED,
  microphoneError,
  type DictationEngine,
} from "./engine";
import { SHORT_SILENCE } from "./silence";
import { clearWhisperCache, whisperStored } from "./whisper-cache";
import {
  loadWhisper,
  transcribeWithWhisper,
  unloadWhisper,
  whisperLoaded,
} from "./whisper-client";
import {
  WHISPER_PLANS,
  agreedPlan,
  cleanTranscript,
  forgetPlan,
  rememberPlan,
  whisperPlan,
  type WhisperPlan,
} from "./whisper-model";

/**
 * Whisper in the browser (transformers.js in a worker), for computers and
 * every browser with a microphone, Firefox included. The model comes once
 * from the Hugging Face hub after the person agreed to the download; the
 * recording is transcribed on the device after it ends (no live text). Not
 * in the Android app: there the phone's own recogniser does it.
 */

/** A recording stops by itself after 3 minutes. */
export const MAX_RECORDING_MS = 3 * 60_000;

const LOAD_FAILED =
  "Das Sprachmodell ließ sich nicht laden. Prüf die Verbindung und versuch es noch einmal.";

const supported = ref<boolean | null>(null);
let plan: WhisperPlan = WHISPER_PLANS.wasm;
let check: Promise<void> | null = null;

function canRun(): boolean {
  return (
    !isNativeAndroid() &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    typeof Worker !== "undefined" &&
    typeof WebAssembly !== "undefined"
  );
}

async function hasWebGpu(): Promise<boolean> {
  const gpu = (navigator as { gpu?: { requestAdapter(): Promise<unknown> } })
    .gpu;
  if (!gpu) return false;
  try {
    return (await gpu.requestAdapter()) !== null;
  } catch {
    return false;
  }
}

export const whisperEngine: DictationEngine = {
  id: "whisper",
  supported: readonly(supported),

  detect() {
    if (check) return check;
    check = (async () => {
      if (!canRun()) {
        supported.value = false;
        return;
      }
      plan = whisperPlan(await hasWebGpu());
      supported.value = true;
    })();
    return check;
  },

  pendingDownload() {
    return agreedPlan() === plan.id ? null : { megabytes: plan.megabytes };
  },

  ready: () => whisperLoaded(plan),

  async prepare(onProgress) {
    try {
      await loadWhisper(plan, onProgress);
    } catch (error) {
      if (plan.device !== "webgpu")
        throw new Error(LOAD_FAILED, { cause: error });
      // The graphics card failed: the processor takes the smaller model.
      plan = WHISPER_PLANS.wasm;
      try {
        await loadWhisper(plan, onProgress);
      } catch (fallback) {
        throw new Error(LOAD_FAILED, { cause: fallback });
      }
    }
    rememberPlan(plan.id);
  },

  start(mode, handlers) {
    let cancelled = false;
    let stopped = false;
    let recording: Recording | null = null;
    void (async () => {
      try {
        recording = await record({
          maxMs: MAX_RECORDING_MS,
          // Short: ends after a pause. Long: until stopped (or the limit).
          silence: mode === "short" ? SHORT_SILENCE : null,
        });
      } catch (error) {
        if (!cancelled) handlers.failed(microphoneError(error));
        return;
      }
      if (cancelled) return recording.cancel();
      handlers.listening();
      if (stopped) recording.stop();
      const result = await recording.result;
      if (cancelled || !result) return;
      if (result.end === "nothing-heard" || result.audio.size === 0)
        return handlers.failed(NOTHING_HEARD);
      handlers.processing();
      try {
        const text = cleanTranscript(
          await transcribeWithWhisper(await toWhisperSamples(result.audio)),
        );
        if (!cancelled) handlers.done(text);
      } catch {
        if (!cancelled) handlers.failed(RECOGNITION_FAILED);
      }
    })();
    return {
      stop: () => {
        stopped = true;
        recording?.stop();
      },
      cancel: () => {
        cancelled = true;
        recording?.cancel();
        handlers.cancelled();
      },
    };
  },

  reset() {
    supported.value = null;
    plan = WHISPER_PLANS.wasm;
    check = null;
  },
};

/** What Einstellungen says about Whisper here; after `detect`. */
export async function whisperModelState(): Promise<{
  plan: WhisperPlan;
  stored: boolean;
}> {
  await whisperEngine.detect();
  return { plan, stored: await whisperStored(plan) };
}

/** Removes the downloaded model; the next dictation asks again first. */
export async function removeWhisperModel(): Promise<void> {
  unloadWhisper();
  forgetPlan();
  await clearWhisperCache();
}
