/** Messages between `whisper-client.ts` and `whisper.worker.ts`. */

export type WhisperRequest =
  | {
      type: "load";
      model: string;
      device: "webgpu" | "wasm";
      dtype: Record<string, string>;
    }
  | { type: "transcribe"; id: number; audio: Float32Array };

export type WhisperReply =
  /** Bytes of the model loaded so far (downloads and cache reads). */
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "load-error"; message: string }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id: number; message: string };
