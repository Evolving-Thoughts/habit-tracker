import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { speechNative, type SpeechNative } from "../native/speech-plugin";
import { record, toWhisperSamples, type RecordingEnd } from "./dictation/audio";
import { SHORT_SILENCE } from "./dictation/silence";
import {
  loadWhisper,
  transcribeWithWhisper,
  unloadWhisper,
} from "./dictation/whisper-client";
import { WHISPER_AGREED_KEY, WHISPER_PLANS } from "./dictation/whisper-model";
import {
  MAX_RECORDING_MS,
  MICROPHONE_DENIED,
  NOTHING_HEARD,
  describeDictation,
  forgetDictationEngines,
  pickEngine,
  removeWhisperModel,
  useDictation,
  useDictationAvailable,
} from "./useDictation";
import {
  reloadVoiceInputSettings,
  updateVoiceInput,
} from "./useVoiceInputSettings";

vi.mock("../native/speech-plugin", () => ({ speechNative: vi.fn(() => null) }));
vi.mock("./dictation/whisper-client", () => ({
  loadWhisper: vi.fn(),
  transcribeWithWhisper: vi.fn(),
  whisperLoaded: vi.fn(() => false),
  unloadWhisper: vi.fn(),
}));
vi.mock("./dictation/audio", () => ({
  record: vi.fn(),
  toWhisperSamples: vi.fn(),
}));

const native = vi.mocked(speechNative);
const load = vi.mocked(loadWhisper);
const transcribe = vi.mocked(transcribeWithWhisper);
const recordMock = vi.mocked(record);
const samples = vi.mocked(toWhisperSamples);

/** A recording the test ends. */
function fakeRecording() {
  let finish: (
    value: { audio: Blob; end: RecordingEnd } | null,
  ) => void = () => {};
  const recording = {
    stop: vi.fn(() =>
      finish({
        audio: new Blob(["voice"], { type: "audio/webm" }),
        end: "stopped",
      }),
    ),
    cancel: vi.fn(() => finish(null)),
    result: new Promise<{ audio: Blob; end: RecordingEnd } | null>(
      (resolve) => (finish = resolve),
    ),
    end: (end: RecordingEnd) =>
      finish({ audio: new Blob(["voice"], { type: "audio/webm" }), end }),
  };
  recordMock.mockResolvedValueOnce(recording);
  return recording;
}

/** What Whisper in the browser needs from the page. */
function withBrowserAudio() {
  vi.stubGlobal("MediaRecorder", class {});
  vi.stubGlobal("AudioContext", class {});
  vi.stubGlobal("Worker", class {});
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
}

function insideAndroidApp() {
  vi.stubGlobal("Capacitor", {
    getPlatform: () => "android",
    PluginHeaders: [],
  });
}

/** The Android plugin, driven by the test. */
function withNative(
  status: Awaited<ReturnType<SpeechNative["status"]>> = {
    available: true,
    onDevice: true,
    reason: null,
  },
) {
  insideAndroidApp();
  const listeners: Record<string, ((data: never) => void)[]> = {};
  const on =
    (event: string) =>
    (handler: (data: never) => void): (() => void) => {
      (listeners[event] ??= []).push(handler);
      return () => {
        listeners[event] = listeners[event].filter((h) => h !== handler);
      };
    };
  const plugin = {
    status: vi.fn().mockResolvedValue(status),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
    openOfflineSetup: vi.fn().mockResolvedValue("download"),
    onPartial: on("partial"),
    onFinal: on("final"),
    onError: on("error"),
    onEnd: on("end"),
  };
  native.mockReturnValue(plugin as unknown as SpeechNative);
  const emit = (event: string, data: unknown = {}) =>
    [...(listeners[event] ?? [])].forEach((handler) => handler(data as never));
  return { plugin, emit, listeners };
}

beforeEach(() => {
  localStorage.clear();
  reloadVoiceInputSettings();
  forgetDictationEngines();
  native.mockReturnValue(null);
  load.mockReset().mockResolvedValue(undefined);
  transcribe.mockReset().mockResolvedValue("Steuer morgen");
  recordMock.mockReset();
  samples.mockReset().mockResolvedValue(new Float32Array(16));
});
afterEach(() => {
  delete window.__dictationStub;
  forgetDictationEngines();
  vi.unstubAllGlobals();
  delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  delete (navigator as { gpu?: unknown }).gpu;
});

describe("engine order", () => {
  it("prefers the phone's own recogniser over Whisper in the browser", () => {
    expect(pickEngine({ native: true, whisper: true })).toBe("native");
    expect(pickEngine({ native: false, whisper: true })).toBe("whisper");
    expect(pickEngine({})).toBe(null);
  });
});

describe("availability", () => {
  it("offers no microphone without any engine", async () => {
    const dictation = useDictation();
    await flushPromises();
    expect(dictation.available.value).toBe(false);
    await dictation.start();
    expect(dictation.state.value).toBe("idle");
  });

  it("never runs Whisper inside the Android app", async () => {
    withBrowserAudio();
    insideAndroidApp();
    const dictation = useDictation();
    await flushPromises();
    expect(dictation.available.value).toBe(false);
  });

  it("hides the microphone when switched off on this device", async () => {
    withBrowserAudio();
    const dictation = useDictation();
    await flushPromises();
    expect(dictation.engine.value).toBe("whisper");
    updateVoiceInput({ enabled: false });
    expect(dictation.available.value).toBe(false);
  });
});

describe("what this device uses (Einstellungen)", () => {
  it("names the engine whatever the switch says, and whether Whisper's model is stored", async () => {
    withBrowserAudio();
    const keys = vi.fn(async () => [
      { url: `https://huggingface.co/${WHISPER_PLANS.wasm.model}/resolve/main/config.json` },
    ]);
    const deleteCache = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      has: vi.fn(async () => true),
      open: vi.fn(async () => ({ keys })),
      delete: deleteCache,
    });
    updateVoiceInput({ enabled: false });
    expect(useDictationAvailable().value).toBe(false);
    expect(await describeDictation()).toEqual({
      engine: "whisper",
      plan: WHISPER_PLANS.wasm,
      stored: true,
    });

    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    await removeWhisperModel();
    expect(unloadWhisper).toHaveBeenCalled();
    expect(deleteCache).toHaveBeenCalledWith("transformers-cache");
    // The next dictation asks again before it loads.
    expect(localStorage.getItem(WHISPER_AGREED_KEY)).toBeNull();
  });

  it("tells the Android app what is missing", async () => {
    withNative({ available: false, onDevice: false, reason: "offline-model-missing" });
    const device = await describeDictation();
    expect(device.engine).toBe("native");
    expect(device.engine === "native" && device.setup?.message).toContain(
      "Offline-Sprachpaket",
    );
  });
});

describe("test hook", () => {
  it("hears the text an e2e test set, and nothing without it", async () => {
    const plain = useDictation();
    await flushPromises();
    expect(plain.engine.value).toBe(null);

    forgetDictationEngines();
    window.__dictationStub = { text: "Steuer morgen" };
    const onResult = vi.fn();
    const dictation = useDictation({ onResult });
    await flushPromises();
    expect(dictation.engine.value).toBe("stub");
    expect(useDictationAvailable().value).toBe(true);
    await dictation.start();
    expect(dictation.state.value).toBe("listening");
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(onResult).toHaveBeenCalledWith("Steuer morgen");
    expect(dictation.state.value).toBe("idle");
  });
});

describe("Android recognition", () => {
  it("listens with live text and hands over the final text", async () => {
    const { plugin, emit, listeners } = withNative();
    const onResult = vi.fn();
    const onPartial = vi.fn();
    const dictation = useDictation({ onResult, onPartial });
    await dictation.start();
    expect(plugin.start).toHaveBeenCalledWith({ partial: true });
    expect(dictation.state.value).toBe("listening");
    expect(dictation.running.value).toBe("native");

    emit("partial", { text: "Steuer" });
    expect(dictation.interim.value).toBe("Steuer");
    expect(onPartial).toHaveBeenCalledWith("Steuer");
    dictation.toggle();
    expect(plugin.stop).toHaveBeenCalled();
    emit("final", { text: "Steuer morgen" });
    emit("end");
    expect(onResult).toHaveBeenCalledWith("Steuer morgen");
    expect(dictation.state.value).toBe("idle");
    expect(Object.values(listeners).flat()).toHaveLength(0);
  });

  it("maps a refused microphone and the plugin's errors", async () => {
    const { plugin, emit } = withNative();
    plugin.start.mockRejectedValueOnce(
      Object.assign(new Error("denied"), { code: "permission" }),
    );
    const dictation = useDictation();
    await dictation.start();
    await flushPromises();
    expect(dictation.state.value).toBe("error");
    expect(dictation.error.value).toBe(MICROPHONE_DENIED);

    dictation.dismiss();
    await dictation.start();
    emit("error", { code: "no-match", message: "x" });
    expect(dictation.error.value).toBe(NOTHING_HEARD);
  });

  it("explains how to get the offline pack instead of using the cloud", async () => {
    const { plugin } = withNative({
      available: false,
      onDevice: true,
      reason: "offline-model-missing",
    });
    const dictation = useDictation();
    await flushPromises();
    expect(dictation.available.value).toBe(true);

    await dictation.start();
    expect(plugin.start).not.toHaveBeenCalled();
    expect(dictation.state.value).toBe("setup");
    expect(dictation.setup.value?.message).toContain("Offline-Sprachpaket");
    expect(dictation.setup.value?.steps.length).toBeGreaterThan(1);

    await dictation.runSetupAction();
    expect(plugin.openOfflineSetup).toHaveBeenCalled();
    expect(dictation.setupNote.value).toContain("Android lädt");

    // The next tap asks the phone again.
    plugin.status.mockResolvedValue({
      available: true,
      onDevice: true,
      reason: null,
    });
    dictation.toggle();
    await flushPromises();
    expect(plugin.status.mock.calls.length).toBeGreaterThan(1);
    expect(plugin.start).toHaveBeenCalled();
    expect(dictation.state.value).toBe("listening");
  });

  it("switches to the hint when the pack turns out missing while listening", async () => {
    const { emit } = withNative();
    const dictation = useDictation();
    await dictation.start();
    emit("error", {
      code: "offline-model-missing",
      message:
        "Für die Erkennung auf dem Gerät fehlt das deutsche Offline-Sprachpaket.",
    });
    emit("end");
    expect(dictation.state.value).toBe("setup");
    expect(dictation.setup.value?.action?.label).toBe("Sprachpaket einrichten");
  });

  it("cancels without a result", async () => {
    const { plugin, emit } = withNative();
    const onResult = vi.fn();
    const dictation = useDictation({ onResult });
    await dictation.start();
    dictation.cancel();
    emit("final", { text: "weg" });
    emit("end");
    expect(plugin.cancel).toHaveBeenCalled();
    expect(onResult).not.toHaveBeenCalled();
    expect(dictation.state.value).toBe("idle");
  });
});

describe("Whisper in the browser", () => {
  beforeEach(withBrowserAudio);

  it("asks before the first download, loads with progress, then listens", async () => {
    const recording = fakeRecording();
    let report: (fraction: number) => void = () => {};
    let loaded: () => void = () => {};
    load.mockImplementation((_plan, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => (loaded = resolve));
    });
    const onResult = vi.fn();
    const dictation = useDictation({ onResult });
    await dictation.start();
    expect(dictation.state.value).toBe("confirming");
    expect(dictation.download.value).toEqual({
      megabytes: WHISPER_PLANS.wasm.megabytes,
    });
    expect(load).not.toHaveBeenCalled();

    const confirmed = dictation.confirmDownload();
    expect(dictation.state.value).toBe("downloading");
    expect(load).toHaveBeenCalledWith(WHISPER_PLANS.wasm, expect.any(Function));
    report(0.42);
    expect(dictation.progress.value).toBe(0.42);
    loaded();
    await confirmed;
    await flushPromises();
    expect(localStorage.getItem(WHISPER_AGREED_KEY)).toBe(
      WHISPER_PLANS.wasm.id,
    );
    expect(dictation.state.value).toBe("listening");
    expect(recordMock).toHaveBeenCalledWith({
      maxMs: MAX_RECORDING_MS,
      silence: SHORT_SILENCE,
    });

    dictation.toggle();
    expect(recording.stop).toHaveBeenCalled();
    await flushPromises();
    expect(transcribe).toHaveBeenCalled();
    expect(onResult).toHaveBeenCalledWith("Steuer morgen");
    expect(dictation.state.value).toBe("idle");

    // Agreed once: no question the next time (the model is in memory).
    load.mockImplementation(() => Promise.resolve());
    fakeRecording();
    await dictation.start();
    await flushPromises();
    expect(dictation.state.value).toBe("listening");
  });

  it("takes the larger model with a graphics card, and the smaller one if it fails", async () => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: { requestAdapter: () => Promise.resolve({}) },
    });
    fakeRecording();
    load.mockRejectedValueOnce(new Error("webgpu broke"));
    const dictation = useDictation();
    await dictation.start();
    expect(dictation.download.value?.megabytes).toBe(
      WHISPER_PLANS.webgpu.megabytes,
    );
    await dictation.confirmDownload();
    await flushPromises();
    expect(load.mock.calls.map(([plan]) => plan.device)).toEqual([
      "webgpu",
      "wasm",
    ]);
    expect(dictation.state.value).toBe("listening");
  });

  it("downloads nothing when the person declines, by button or Escape", async () => {
    const dictation = useDictation();
    await dictation.start();
    dictation.cancel();
    expect(dictation.state.value).toBe("idle");

    await dictation.start();
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(dictation.state.value).toBe("idle");
    expect(load).not.toHaveBeenCalled();
  });

  it("says so when the model does not load", async () => {
    load.mockRejectedValue(new Error("offline"));
    const dictation = useDictation();
    await dictation.start();
    await dictation.confirmDownload();
    expect(dictation.state.value).toBe("error");
    expect(dictation.error.value).toContain(
      "Sprachmodell ließ sich nicht laden",
    );
  });

  it("records long texts until stopped, and reports silence as nothing heard", async () => {
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    const recording = fakeRecording();
    const dictation = useDictation({ mode: "long" });
    await dictation.start();
    await flushPromises();
    expect(recordMock).toHaveBeenCalledWith({
      maxMs: MAX_RECORDING_MS,
      silence: null,
    });
    recording.end("nothing-heard");
    await flushPromises();
    expect(dictation.error.value).toBe(NOTHING_HEARD);
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("treats Whisper's known silence phrases as nothing heard", async () => {
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    transcribe.mockResolvedValue("Untertitel der Amara.org-Community");
    const recording = fakeRecording();
    const onResult = vi.fn();
    const dictation = useDictation({ onResult });
    await dictation.start();
    await flushPromises();
    recording.stop();
    expect(dictation.state.value).toBe("listening");
    await flushPromises();
    expect(onResult).not.toHaveBeenCalled();
    expect(dictation.error.value).toBe(NOTHING_HEARD);
  });

  it("shows that it works on the text after the recording", async () => {
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    let answer: (text: string) => void = () => {};
    transcribe.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const recording = fakeRecording();
    const onResult = vi.fn();
    const dictation = useDictation({ onResult });
    await dictation.start();
    await flushPromises();
    recording.stop();
    await flushPromises();
    expect(dictation.state.value).toBe("processing");
    // A tap meanwhile does nothing.
    dictation.toggle();
    answer("Ein guter Tag.");
    await flushPromises();
    expect(onResult).toHaveBeenCalledWith("Ein guter Tag.");
  });

  it("says so when the microphone is refused", async () => {
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    recordMock.mockRejectedValueOnce(
      Object.assign(new Error("no"), { name: "NotAllowedError" }),
    );
    const dictation = useDictation();
    await dictation.start();
    await flushPromises();
    expect(dictation.error.value).toBe(MICROPHONE_DENIED);
  });

  it("discards on Escape, before a dialog sees the key", async () => {
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    const recording = fakeRecording();
    const onResult = vi.fn();
    const dictation = useDictation({ onResult });
    await dictation.start();
    await flushPromises();
    const outside = vi.fn();
    document.addEventListener("keydown", outside);
    const event = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(event);
    document.removeEventListener("keydown", outside);
    expect(event.defaultPrevented).toBe(true);
    expect(outside).not.toHaveBeenCalled();
    expect(recording.cancel).toHaveBeenCalled();
    await flushPromises();
    expect(onResult).not.toHaveBeenCalled();
    expect(dictation.state.value).toBe("idle");

    const later = new KeyboardEvent("keydown", {
      key: "Escape",
      cancelable: true,
    });
    window.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
  });

  it("cancels when the component goes away, and one dictation cancels another", async () => {
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    const first = fakeRecording();
    const scope = effectScope();
    const one = scope.run(() => useDictation())!;
    await one.start();
    await flushPromises();
    fakeRecording();
    const two = useDictation();
    await two.start();
    await flushPromises();
    expect(first.cancel).toHaveBeenCalled();
    expect(one.state.value).toBe("idle");
    scope.stop();
    expect(two.state.value).toBe("listening");
  });
});
