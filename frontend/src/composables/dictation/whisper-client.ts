import type { WhisperPlan } from "./whisper-model";
import type { WhisperReply, WhisperRequest } from "./whisper-protocol";

/**
 * The page's side of the Whisper worker. The worker (and with it
 * transformers.js and the ONNX runtime) is created on the first use only,
 * so none of it weighs on the app's start.
 */

let worker: Worker | null = null;
let loaded: { id: string; promise: Promise<void>; done: boolean } | null = null;
let progressListener: ((fraction: number) => void) | null = null;
let nextId = 1;
const pending = new Map<
  number,
  { resolve(text: string): void; reject(error: Error): void }
>();
let onLoad: { resolve(): void; reject(error: Error): void } | null = null;

function ensureWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (event: MessageEvent<WhisperReply>) => {
    const message = event.data;
    switch (message.type) {
      case "progress":
        if (message.total > 0)
          progressListener?.(Math.min(1, message.loaded / message.total));
        break;
      case "ready":
        onLoad?.resolve();
        onLoad = null;
        break;
      case "load-error":
        onLoad?.reject(new Error(message.message));
        onLoad = null;
        break;
      case "result":
        pending.get(message.id)?.resolve(message.text);
        pending.delete(message.id);
        break;
      case "error":
        pending.get(message.id)?.reject(new Error(message.message));
        pending.delete(message.id);
        break;
    }
  });
  return worker;
}

const send = (request: WhisperRequest, transfer: Transferable[] = []) =>
  ensureWorker().postMessage(request, transfer);

/** Loads the plan's model; again only after a failure or for another plan. */
export function loadWhisper(
  plan: WhisperPlan,
  onProgress: (fraction: number) => void,
): Promise<void> {
  progressListener = onProgress;
  if (loaded?.id === plan.id) return loaded.promise;
  if (loaded) {
    // Another plan (WebGPU failed): a fresh worker for it.
    worker?.terminate();
    worker = null;
  }
  const promise = new Promise<void>((resolve, reject) => {
    onLoad = { resolve, reject };
    send({
      type: "load",
      model: plan.model,
      device: plan.device,
      dtype: plan.dtype,
    });
  });
  const current = { id: plan.id, promise, done: false };
  loaded = current;
  promise.then(
    () => (current.done = true),
    () => {
      if (loaded === current) loaded = null;
    },
  );
  return promise;
}

/** The plan's model is loaded in the worker. */
export function whisperLoaded(plan: WhisperPlan): boolean {
  return loaded?.id === plan.id && loaded.done;
}

/** 16 kHz mono samples → text. The samples move to the worker. */
export function transcribeWithWhisper(audio: Float32Array): Promise<string> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    send({ type: "transcribe", id, audio }, [audio.buffer]);
  });
}

/** Ends the worker and forgets the loaded model (after removing it). */
export function unloadWhisper(): void {
  worker?.terminate();
  worker = null;
  loaded = null;
  onLoad = null;
  progressListener = null;
  for (const request of pending.values())
    request.reject(new Error("Modell entfernt"));
  pending.clear();
}
