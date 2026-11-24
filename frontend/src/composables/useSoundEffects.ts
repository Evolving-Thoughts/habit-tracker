import { readonly, ref } from "vue";
import { soundUrl } from "../api/sounds.api";
import { focusSoundNative } from "../native/focus-sound-plugin";
import { chimeEntry, loadSoundCatalog } from "./sound-catalog";
import { FOCUS_SOUND_STORAGE_KEY } from "./useFocusSoundSettings";

/**
 * The short sounds of the whole app (docs/focus-sounds.md, "Töne"): one
 * switch and one volume on this device, and one player that every caller
 * shares. The Fokus-Klänge (music while the stopwatch runs) are separate.
 */
export type SoundEffectId = "chime-reached" | "chime-done" | "chime-milestone";

export type SoundEffectSettings = {
  /** The switch "Töne". */
  enabled: boolean;
  /** 0 to 1. */
  volume: number;
};

export const SOUND_EFFECTS_STORAGE_KEY = "sounds:effects";

export const DEFAULT_SOUND_EFFECTS: Readonly<SoundEffectSettings> = {
  enabled: true,
  volume: 0.6,
};

function objectOf(raw: string | null): Record<string, unknown> | null {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Whatever is stored, read as valid settings; each bad field falls back alone. */
export function parseSoundEffects(raw: string | null): SoundEffectSettings {
  const stored = objectOf(raw) ?? {};
  const { enabled, volume } = stored;
  return {
    enabled:
      typeof enabled === "boolean" ? enabled : DEFAULT_SOUND_EFFECTS.enabled,
    volume:
      typeof volume === "number" && Number.isFinite(volume)
        ? Math.min(1, Math.max(0, volume))
        : DEFAULT_SOUND_EFFECTS.volume,
  };
}

/**
 * The settings on a device that has none yet: the defaults, except that
 * "Signaltöne" switched off in the Fokus-Klänge (`chimes: false` under
 * `focus:sound`, before "Töne" replaced it) starts the switch off.
 */
export function migrateSoundEffects(
  focusSoundRaw: string | null,
): SoundEffectSettings {
  return {
    ...DEFAULT_SOUND_EFFECTS,
    enabled: objectOf(focusSoundRaw)?.chimes !== false,
  };
}

function store(next: SoundEffectSettings): void {
  try {
    localStorage.setItem(SOUND_EFFECTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Without storage the choice lasts until the page is reloaded.
  }
}

function read(): SoundEffectSettings {
  try {
    const raw = localStorage.getItem(SOUND_EFFECTS_STORAGE_KEY);
    if (raw !== null) return parseSoundEffects(raw);
    const old = localStorage.getItem(FOCUS_SOUND_STORAGE_KEY);
    const migrated = migrateSoundEffects(old);
    // Kept at once: the Fokus-Klänge drop `chimes` on their next change.
    if (old !== null) store(migrated);
    return migrated;
  } catch {
    return { ...DEFAULT_SOUND_EFFECTS };
  }
}

const settings = ref<SoundEffectSettings>(read());

/** Changes some of the settings and stores them on this device. */
export function updateSoundEffects(change: Partial<SoundEffectSettings>): void {
  const next = parseSoundEffects(
    JSON.stringify({ ...settings.value, ...change }),
  );
  settings.value = next;
  store(next);
}

/** Read again, e.g. after a test changed the storage. */
export function reloadSoundEffects(): void {
  settings.value = read();
}

/** The switch "Töne" is on. */
export const soundEffectsEnabled = (): boolean => settings.value.enabled;

export function useSoundEffects() {
  return { settings: readonly(settings), update: updateSoundEffects };
}

/**
 * Plays a short sound once. Silent when "Töne" is off or the server lacks
 * the file. In the Android app it goes through `FocusSound.chime`, which
 * takes no audio focus and so never stops the Fokus-Klang; an `<audio>` in
 * the WebView might take it, so the native path never uses one. In a
 * browser each play is its own short `<audio>`; the file's address carries
 * its version, so the browser's cache serves the repeats.
 */
export async function playEffect(id: SoundEffectId): Promise<void> {
  if (!settings.value.enabled) return;
  await loadSoundCatalog();
  const entry = chimeEntry(id);
  if (!entry || !settings.value.enabled) return;
  const { volume } = settings.value;
  const plugin = focusSoundNative();
  if (plugin) {
    const url = new URL(soundUrl(entry), window.location.href).href;
    await plugin.chime({ id, url, volume }).catch(() => {});
    return;
  }
  try {
    const audio = new Audio(soundUrl(entry));
    audio.volume = volume;
    await audio.play()?.catch(() => {});
  } catch {
    // A sound that cannot play is skipped.
  }
}
