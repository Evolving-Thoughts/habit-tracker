import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  describeDictation,
  removeWhisperModel,
  type DictationDevice,
} from "../composables/useDictation";
import { WHISPER_PLANS } from "../composables/dictation/whisper-model";
import {
  VOICE_INPUT_STORAGE_KEY,
  reloadVoiceInputSettings,
} from "../composables/useVoiceInputSettings";
import VoiceInputSettings from "./VoiceInputSettings.vue";

vi.mock("../composables/useDictation", () => ({
  describeDictation: vi.fn(),
  removeWhisperModel: vi.fn(async () => undefined),
}));

enableAutoUnmount(afterEach);

const describeMock = vi.mocked(describeDictation);

async function render(device: DictationDevice) {
  describeMock.mockResolvedValue(device);
  const wrapper = mount(VoiceInputSettings);
  await flushPromises();
  return wrapper;
}

describe("VoiceInputSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    reloadVoiceInputSettings();
    vi.clearAllMocks();
  });

  it("switches every microphone on this device and says the audio stays here", async () => {
    const wrapper = await render({ engine: null });
    const toggle = wrapper.get('[role="switch"]');
    expect(toggle.attributes("aria-checked")).toBe("true");
    expect(wrapper.text()).toContain(
      "Die Erkennung läuft auf deinem Gerät; Aufnahmen verlassen es nicht.",
    );
    await toggle.trigger("click");
    expect(toggle.attributes("aria-checked")).toBe("false");
    expect(JSON.parse(localStorage.getItem(VOICE_INPUT_STORAGE_KEY)!)).toEqual({
      enabled: false,
    });
    expect(wrapper.get('[data-test="voice-engine"]').text()).toContain(
      "kann Sprache nicht selbst erkennen",
    );
  });

  it("names Whisper with its model and lets a stored model be removed", async () => {
    const plan = WHISPER_PLANS.wasm;
    const wrapper = await render({ engine: "whisper", plan, stored: true });
    expect(wrapper.get('[data-test="voice-engine"]').text()).toBe(
      `Auf diesem Gerät erkennt Whisper im Browser die Sprache (whisper-base, ~${plan.megabytes} MB).`,
    );
    expect(wrapper.text()).toContain("Das Sprachmodell ist geladen");

    describeMock.mockResolvedValue({ engine: "whisper", plan, stored: false });
    await wrapper.get("button.btn").trigger("click");
    await flushPromises();
    expect(removeWhisperModel).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain("Sprachmodell entfernt.");
    expect(wrapper.text()).toContain("lädt beim ersten Diktat");
    expect(wrapper.find("button.btn").exists()).toBe(false);
  });

  it("shows the Android offline pack's steps and button while it is missing", async () => {
    const run = vi.fn(async () => "Android lädt das deutsche Sprachpaket.");
    const wrapper = await render({
      engine: "native",
      setup: {
        message: "Zum Diktieren braucht dieses Gerät das deutsche Offline-Sprachpaket.",
        steps: ["Öffne die Einstellungen des Geräts."],
        action: { label: "Sprachpaket einrichten", run },
      },
    });
    expect(wrapper.get('[data-test="voice-engine"]').text()).toContain(
      "erkennt Android die Sprache selbst",
    );
    expect(wrapper.findAll("li").map((item) => item.text())).toEqual([
      "Öffne die Einstellungen des Geräts.",
    ]);
    await wrapper.get("button.btn").trigger("click");
    await flushPromises();
    expect(run).toHaveBeenCalled();
    expect(wrapper.text()).toContain("Android lädt das deutsche Sprachpaket.");
  });
});
