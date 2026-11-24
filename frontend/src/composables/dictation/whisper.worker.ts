/// <reference lib="webworker" />
import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
} from "@huggingface/transformers";
// The ONNX runtime comes from the app's own server, not from a CDN.
import runtimeWasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import runtimeModule from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import type { WhisperReply, WhisperRequest } from "./whisper-protocol";

/**
 * Whisper in a Web Worker (docs/voice-input.md), so the page stays smooth
 * while it thinks. Loads the model once (the hub's public weights, cached
 * by the browser), then turns 16 kHz samples into German text. The audio
 * stays in this worker's memory and is gone after each request.
 */

declare const self: DedicatedWorkerGlobalScope;

env.allowLocalModels = false;
const onnx = env.backends.onnx as { wasm?: { wasmPaths?: unknown } };
if (onnx.wasm)
  onnx.wasm.wasmPaths = {
    wasm: new URL(runtimeWasm, self.location.href).href,
    mjs: new URL(runtimeModule, self.location.href).href,
  };

let recognizer: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

const reply = (message: WhisperReply) => self.postMessage(message);
const describe = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

self.addEventListener("message", (event: MessageEvent<WhisperRequest>) => {
  const request = event.data;
  if (request.type === "load") {
    recognizer ??= pipeline("automatic-speech-recognition", request.model, {
      device: request.device,
      dtype: request.dtype as never,
      progress_callback: (info) => {
        if (info.status === "progress_total")
          reply({ type: "progress", loaded: info.loaded, total: info.total });
      },
    }) as Promise<AutomaticSpeechRecognitionPipeline>;
    recognizer.then(
      () => reply({ type: "ready" }),
      (error: unknown) => {
        recognizer = null;
        reply({ type: "load-error", message: describe(error) });
      },
    );
    return;
  }
  void (async () => {
    try {
      if (!recognizer) throw new Error("Modell nicht geladen");
      const asr = await recognizer;
      const output = await asr(request.audio, {
        language: "de",
        task: "transcribe",
        // Longer recordings in 30-second windows with overlap.
        chunk_length_s: 30,
        stride_length_s: 5,
      });
      const text = Array.isArray(output)
        ? output.map((part) => part.text).join(" ")
        : output.text;
      reply({ type: "result", id: request.id, text });
    } catch (error) {
      reply({ type: "error", id: request.id, message: describe(error) });
    }
  })();
});
