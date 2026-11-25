import { beforeEach, describe, expect, it } from "vitest";
import {
  WHISPER_AGREED_KEY,
  WHISPER_PLANS,
  agreedPlan,
  cleanTranscript,
  rememberPlan,
  whisperPlan,
} from "./whisper-model";

beforeEach(() => localStorage.clear());

describe("Whisper in the browser: model", () => {
  it("takes small on a graphics card and base on the processor", () => {
    expect(whisperPlan(true)).toMatchObject({
      model: "onnx-community/whisper-small",
      device: "webgpu",
      dtype: { encoder_model: "q4", decoder_model_merged: "q4" },
      megabytes: 330,
    });
    expect(whisperPlan(false)).toMatchObject({
      model: "onnx-community/whisper-base",
      device: "wasm",
      dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
      megabytes: 110,
    });
    expect(WHISPER_PLANS.webgpu.id).not.toBe(WHISPER_PLANS.wasm.id);
  });

  it("remembers which download was agreed to on this device", () => {
    expect(agreedPlan()).toBe(null);
    rememberPlan(WHISPER_PLANS.wasm.id);
    expect(localStorage.getItem(WHISPER_AGREED_KEY)).toBe(
      WHISPER_PLANS.wasm.id,
    );
    expect(agreedPlan()).toBe(WHISPER_PLANS.wasm.id);
  });

  it.each([
    ["  Steuer   morgen, 30 Minuten. ", "Steuer morgen, 30 Minuten."],
    ["Untertitel der Amara.org-Community", ""],
    ["Untertitel im Auftrag des ZDF, 2021", ""],
    ["Vielen Dank fürs Zuschauen!", ""],
    ["Danke für's Zuschauen.", ""],
    ["...", ""],
    ["Vielen Dank für deine Hilfe", "Vielen Dank für deine Hilfe"],
  ])("cleans %j", (text, expected) => {
    expect(cleanTranscript(text)).toBe(expected);
  });
});
