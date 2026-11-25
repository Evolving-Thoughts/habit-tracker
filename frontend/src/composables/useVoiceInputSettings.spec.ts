import { beforeEach, describe, expect, it } from "vitest";
import {
  VOICE_INPUT_STORAGE_KEY,
  parseVoiceInput,
  reloadVoiceInputSettings,
  useVoiceInputSettings,
} from "./useVoiceInputSettings";

beforeEach(() => {
  localStorage.clear();
  reloadVoiceInputSettings();
});

describe("voice input settings", () => {
  it("is on by default", () => {
    expect(useVoiceInputSettings().settings.value).toEqual({ enabled: true });
  });

  it("stores the switch on this device and shares it", () => {
    useVoiceInputSettings().update({ enabled: false });
    expect(useVoiceInputSettings().settings.value.enabled).toBe(false);
    expect(
      JSON.parse(localStorage.getItem(VOICE_INPUT_STORAGE_KEY) ?? "null"),
    ).toEqual({ enabled: false });
    reloadVoiceInputSettings();
    expect(useVoiceInputSettings().settings.value.enabled).toBe(false);
  });

  it.each([null, "", "nope", "[]", '{"enabled":"no"}', "{}"])(
    "reads %s as the default",
    (raw) => {
      expect(parseVoiceInput(raw)).toEqual({ enabled: true });
    },
  );
});
