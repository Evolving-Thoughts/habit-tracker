import { readonly, ref } from "vue";

/**
 * Spracheingabe on this device (docs/voice-input.md): on unless switched
 * off in Einstellungen. Off hides every microphone. One shared ref; no
 * server table, as a phone and a laptop may want it differently.
 */
export type VoiceInputSettings = {
  enabled: boolean;
};

export const VOICE_INPUT_STORAGE_KEY = "voice:input";

export const DEFAULT_VOICE_INPUT: Readonly<VoiceInputSettings> = {
  enabled: true,
};

/** Whatever is stored, read as valid settings. */
export function parseVoiceInput(raw: string | null): VoiceInputSettings {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (
      parsed &&
      typeof parsed === "object" &&
      "enabled" in parsed &&
      typeof parsed.enabled === "boolean"
    )
      return { enabled: parsed.enabled };
  } catch {
    // Not JSON: the defaults.
  }
  return { ...DEFAULT_VOICE_INPUT };
}

function read(): VoiceInputSettings {
  try {
    return parseVoiceInput(localStorage.getItem(VOICE_INPUT_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_VOICE_INPUT };
  }
}

const settings = ref<VoiceInputSettings>(read());

/** Changes the settings and stores them on this device. */
export function updateVoiceInput(change: Partial<VoiceInputSettings>): void {
  const next = parseVoiceInput(
    JSON.stringify({ ...settings.value, ...change }),
  );
  settings.value = next;
  try {
    localStorage.setItem(VOICE_INPUT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

/** Read again, e.g. after a test changed the storage. */
export function reloadVoiceInputSettings(): void {
  settings.value = read();
}

export function useVoiceInputSettings() {
  return { settings: readonly(settings), update: updateVoiceInput };
}
