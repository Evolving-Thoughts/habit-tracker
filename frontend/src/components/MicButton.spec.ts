import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { record } from "../composables/dictation/audio";
import {
  loadWhisper,
  transcribeWithWhisper,
  whisperLoaded,
} from "../composables/dictation/whisper-client";
import {
  WHISPER_AGREED_KEY,
  WHISPER_PLANS,
} from "../composables/dictation/whisper-model";
import {
  MICROPHONE_DENIED,
  forgetDictationEngines,
} from "../composables/useDictation";
import {
  reloadVoiceInputSettings,
  updateVoiceInput,
} from "../composables/useVoiceInputSettings";
import { speechNative, type SpeechNative } from "../native/speech-plugin";
import MicButton from "./MicButton.vue";

vi.mock("../native/speech-plugin", () => ({ speechNative: vi.fn(() => null) }));
vi.mock("../composables/dictation/whisper-client", () => ({
  loadWhisper: vi.fn(),
  transcribeWithWhisper: vi.fn(),
  whisperLoaded: vi.fn(() => false),
}));
vi.mock("../composables/dictation/audio", () => ({
  record: vi.fn(),
  toWhisperSamples: vi.fn(async () => new Float32Array(16)),
}));

const recordMock = vi.mocked(record);

function fakeRecording() {
  let finish: (value: unknown) => void = () => {};
  const recording = {
    stop: vi.fn(() => finish({ audio: new Blob(["voice"]), end: "stopped" })),
    cancel: vi.fn(() => finish(null)),
    result: new Promise((resolve) => (finish = resolve)),
  };
  recordMock.mockResolvedValueOnce(recording as never);
  return recording;
}

function withBrowserAudio() {
  vi.stubGlobal("MediaRecorder", class {});
  vi.stubGlobal("AudioContext", class {});
  vi.stubGlobal("Worker", class {});
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
}

beforeEach(() => {
  localStorage.clear();
  reloadVoiceInputSettings();
  forgetDictationEngines();
  recordMock.mockReset();
  vi.mocked(loadWhisper).mockReset().mockResolvedValue(undefined);
  vi.mocked(transcribeWithWhisper)
    .mockReset()
    .mockResolvedValue("Steuer morgen");
  vi.mocked(speechNative).mockReturnValue(null);
  vi.mocked(whisperLoaded).mockReturnValue(false);
});
afterEach(() => {
  forgetDictationEngines();
  vi.unstubAllGlobals();
  delete (navigator as { mediaDevices?: unknown }).mediaDevices;
});

async function mountMic(props: Record<string, unknown> = {}) {
  const wrapper = mount(MicButton, { props, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe("MicButton", () => {
  it("is not there without a way to recognise speech on this device", async () => {
    const wrapper = await mountMic();
    expect(wrapper.find("button").exists()).toBe(false);
    wrapper.unmount();
  });

  it("is not there with Spracheingabe off on this device", async () => {
    withBrowserAudio();
    updateVoiceInput({ enabled: false });
    const wrapper = await mountMic();
    expect(wrapper.find("button").exists()).toBe(false);
    wrapper.unmount();
  });

  it("asks before the first download and shows the progress as a word", async () => {
    withBrowserAudio();
    let report: (fraction: number) => void = () => {};
    let loaded: () => void = () => {};
    vi.mocked(loadWhisper).mockImplementation((_plan, onProgress) => {
      report = onProgress;
      return new Promise((resolve) => (loaded = resolve));
    });
    fakeRecording();
    const wrapper = await mountMic();
    const button = wrapper.get(".mic__button");
    expect(button.text()).toBe("Diktieren");
    expect(button.attributes("aria-pressed")).toBe("false");

    await button.trigger("click");
    await flushPromises();
    const question = wrapper.get('[aria-label="Sprachmodell laden"]');
    expect(question.text()).toContain(`~${WHISPER_PLANS.wasm.megabytes}`);
    expect(question.text()).toContain("danach geht es offline");
    expect(question.text()).toContain("verlässt das Gerät nie");
    expect(document.activeElement?.textContent?.trim()).toBe("Laden");

    await wrapper.get(".btn--primary").trigger("click");
    report(0.42);
    await flushPromises();
    expect(wrapper.get(".mic__word").text()).toBe("Lade Sprachmodell … 42 %");
    expect(button.attributes("aria-busy")).toBe("true");
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Sprachmodell wird geladen.",
    );

    loaded();
    await flushPromises();
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(wrapper.get(".mic__word").text()).toBe("Hört zu …");
    wrapper.unmount();
  });

  it("listens on a tap, shows it with symbol and word, and hands over the text", async () => {
    withBrowserAudio();
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    const recording = fakeRecording();
    let answer: (text: string) => void = () => {};
    vi.mocked(transcribeWithWhisper).mockReturnValue(
      new Promise((resolve) => (answer = resolve)),
    );
    // The model is in memory already: straight to listening.
    vi.mocked(whisperLoaded).mockReturnValue(true);
    const wrapper = await mountMic({ label: "Titel diktieren" });
    const button = wrapper.get(".mic__button");
    expect(button.text()).toBe("Titel diktieren");
    expect(button.get("svg").attributes("aria-hidden")).toBe("true");

    await button.trigger("click");
    await flushPromises();
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(wrapper.get(".mic__word").text()).toBe("Hört zu …");
    expect(wrapper.get(".mic__word").attributes("aria-hidden")).toBe("true");
    expect(wrapper.get('[role="status"]').text()).toContain("Hört zu");

    await button.trigger("click");
    expect(recording.stop).toHaveBeenCalled();
    await flushPromises();
    expect(wrapper.get(".mic__word").text()).toBe("Wird erkannt …");
    expect(button.attributes("aria-busy")).toBe("true");
    expect(button.attributes("aria-pressed")).toBe("false");

    answer("Steuer morgen");
    await flushPromises();
    expect(wrapper.emitted("result")).toEqual([["Steuer morgen"]]);
    expect(wrapper.find(".mic__word").exists()).toBe(false);
    // "Mikrofon …" until the microphone is open, then "Hört zu …".
    expect(wrapper.emitted("state")).toEqual([
      ["starting"],
      ["listening"],
      ["processing"],
      ["idle"],
    ]);
    wrapper.unmount();
  });

  it("explains how to install the offline pack on the phone", async () => {
    vi.stubGlobal("Capacitor", {
      getPlatform: () => "android",
      PluginHeaders: [],
    });
    const plugin = {
      status: vi.fn().mockResolvedValue({
        available: false,
        onDevice: false,
        reason: "offline-model-missing",
      }),
      openOfflineSetup: vi.fn().mockResolvedValue("settings"),
    };
    vi.mocked(speechNative).mockReturnValue(plugin as unknown as SpeechNative);
    const wrapper = await mountMic();
    await wrapper.get(".mic__button").trigger("click");
    await flushPromises();
    const hint = wrapper.get('[aria-label="Spracherkennung einrichten"]');
    expect(hint.text()).toContain("deutsche Offline-Sprachpaket");
    expect(hint.findAll("li").length).toBeGreaterThan(1);
    expect(document.activeElement?.textContent?.trim()).toBe(
      "Sprachpaket einrichten",
    );
    await wrapper.get(".btn--primary").trigger("click");
    await flushPromises();
    expect(plugin.openOfflineSetup).toHaveBeenCalled();
    await wrapper.get(".btn--quiet").trigger("click");
    expect(
      wrapper.find('[aria-label="Spracherkennung einrichten"]').exists(),
    ).toBe(false);
    wrapper.unmount();
  });

  it("shows why it failed until dismissed", async () => {
    withBrowserAudio();
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    recordMock.mockRejectedValueOnce(
      Object.assign(new Error("no"), { name: "NotAllowedError" }),
    );
    const wrapper = await mountMic();
    await wrapper.get(".mic__button").trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe(MICROPHONE_DENIED);
    await wrapper.get(".mic__dismiss").trigger("click");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("can be started by its caller", async () => {
    withBrowserAudio();
    localStorage.setItem(WHISPER_AGREED_KEY, WHISPER_PLANS.wasm.id);
    fakeRecording();
    const wrapper = await mountMic();
    await (wrapper.vm as unknown as { start(): Promise<void> }).start();
    await flushPromises();
    expect(wrapper.get(".mic__button").attributes("aria-pressed")).toBe("true");
    wrapper.unmount();
  });
});
