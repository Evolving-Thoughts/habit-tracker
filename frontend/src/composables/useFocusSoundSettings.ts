import { readonly, ref } from "vue";

/**
 * The Fokus-Klänge as chosen on this device (docs/focus-sounds.md): which
 * sound plays in the Fokus-Modus and how loud. One shared ref for the
 * Fokus-Modus and Einstellungen; no server table. The short sounds have
 * their own switch and volume ("Töne", `useSoundEffects`).
 */
export type FocusSoundSettings = {
  /** The chosen sound; null is "Aus". */
  soundId: string | null;
  /** 0 to 1. */
  volume: number;
  /** The last sound chosen, so M brings it back after "Aus". */
  lastSoundId: string | null;
};

export const FOCUS_SOUND_STORAGE_KEY = "focus:sound";

export const DEFAULT_FOCUS_SOUND: Readonly<FocusSoundSettings> = {
  soundId: null,
  volume: 0.6,
  lastSoundId: null,
};

const idOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/** Whatever is stored, read as valid settings; each bad field falls back alone. */
export function parseFocusSound(raw: string | null): FocusSoundSettings {
  let stored: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      stored = parsed as Record<string, unknown>;
  } catch {
    // Not JSON: the defaults.
  }
  const volume = stored.volume;
  return {
    soundId: idOrNull(stored.soundId),
    volume:
      typeof volume === "number" && Number.isFinite(volume)
        ? Math.min(1, Math.max(0, volume))
        : DEFAULT_FOCUS_SOUND.volume,
    lastSoundId: idOrNull(stored.lastSoundId) ?? idOrNull(stored.soundId),
  };
}

function read(): FocusSoundSettings {
  try {
    return parseFocusSound(localStorage.getItem(FOCUS_SOUND_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_FOCUS_SOUND };
  }
}

const settings = ref<FocusSoundSettings>(read());

/** Changes some of the settings and stores them on this device. */
export function updateFocusSound(change: Partial<FocusSoundSettings>): void {
  const next = parseFocusSound(
    JSON.stringify({ ...settings.value, ...change }),
  );
  if (next.soundId) next.lastSoundId = next.soundId;
  settings.value = next;
  try {
    localStorage.setItem(FOCUS_SOUND_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

/** Read again, e.g. after a test changed the storage. */
export function reloadFocusSoundSettings(): void {
  settings.value = read();
}

export function useFocusSoundSettings() {
  return { settings: readonly(settings), update: updateFocusSound };
}
