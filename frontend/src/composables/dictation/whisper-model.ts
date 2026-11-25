/**
 * Which Whisper runs in the browser (docs/voice-input.md). Public ONNX
 * weights from the Hugging Face hub, downloaded once and kept in the
 * browser's cache by transformers.js; the audio itself never leaves the
 * device. Pure, so specs cover the choice and the clean-up.
 */

export type WhisperDevice = "webgpu" | "wasm";

export type WhisperPlan = {
  /** Changes with model, device or precision; the stored "agreed" is per plan. */
  id: string;
  model: string;
  device: WhisperDevice;
  dtype: Record<string, string>;
  /** What the first start loads, rounded: weights, tokenizer, ONNX runtime. */
  megabytes: number;
};

/** The ONNX runtime (WebAssembly) the app serves itself, about 27 MB. */
const RUNTIME_MB = 27;

const plan = (
  model: string,
  device: WhisperDevice,
  dtype: Record<string, string>,
  weightsMb: number,
): WhisperPlan => ({
  id: `${model}:${device}:${Object.values(dtype).join("+")}`,
  model,
  device,
  dtype,
  megabytes: Math.round((weightsMb + 3 + RUNTIME_MB) / 10) * 10,
});

export const WHISPER_PLANS: Record<WhisperDevice, WhisperPlan> = {
  // A graphics card does "small" quickly: encoder 66 MB + decoder 233 MB (4 bit).
  webgpu: plan(
    "onnx-community/whisper-small",
    "webgpu",
    { encoder_model: "q4", decoder_model_merged: "q4" },
    66 + 233,
  ),
  // On the processor "base" stays bearable: encoder 23 MB + decoder 54 MB (8 bit).
  wasm: plan(
    "onnx-community/whisper-base",
    "wasm",
    { encoder_model: "q8", decoder_model_merged: "q8" },
    23 + 54,
  ),
};

export function whisperPlan(webgpu: boolean): WhisperPlan {
  return WHISPER_PLANS[webgpu ? "webgpu" : "wasm"];
}

/**
 * What Whisper is known to "hear" in silence or noise, from the subtitles it
 * was trained on. Such a text alone counts as nothing heard.
 */
const HALLUCINATIONS = [
  /^untertitel (im auftrag des zdf|der amara\.org-community|von stephanie geiges)/,
  /^(vielen dank|danke) (für's|fürs|für das) zuschauen/,
  /^copyright/,
  /^swr \d{4}$/,
];

/** Whitespace tidied; a known hallucination becomes "". */
export function cleanTranscript(text: string): string {
  const tidy = text.replace(/\s+/g, " ").trim();
  const plain = tidy
    .toLowerCase()
    .replace(/[.!?…]+$/u, "")
    .trim();
  if (!plain || HALLUCINATIONS.some((pattern) => pattern.test(plain)))
    return "";
  return tidy;
}

export const WHISPER_AGREED_KEY = "voice:model";

/** The plan whose download was agreed to (and finished) on this device. */
export function agreedPlan(): string | null {
  try {
    return localStorage.getItem(WHISPER_AGREED_KEY);
  } catch {
    return null;
  }
}

export function rememberPlan(id: string): void {
  try {
    localStorage.setItem(WHISPER_AGREED_KEY, id);
  } catch {
    // Without storage the next page load asks again.
  }
}

/** After the model was removed: the next download asks again. */
export function forgetPlan(): void {
  try {
    localStorage.removeItem(WHISPER_AGREED_KEY);
  } catch {
    // Nothing stored, nothing to forget.
  }
}
