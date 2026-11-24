import { computed, readonly, ref } from "vue";
import { listSounds } from "../api/sounds.api";
import type { Sound } from "../types/sound";

/*
 * The sounds on the server (docs/focus-sounds.md), read once per page and
 * shared by the Fokus-Modus, Einstellungen and the short sounds of the app.
 */
const catalog = ref<Sound[] | null>(null);
const catalogFailed = ref(false);
let loading: Promise<void> | null = null;

export function loadSoundCatalog(): Promise<void> {
  // Through a promise, so even a request that throws at once is a calm failure.
  loading ??= Promise.resolve()
    .then(() => listSounds())
    .then(
      (sounds) => {
        catalog.value = sounds;
        catalogFailed.value = false;
      },
      () => {
        catalogFailed.value = true;
        // Asked again next time.
        loading = null;
      },
    );
  return loading;
}

/** Forgets the catalog, e.g. between tests. */
export function resetSoundCatalog(): void {
  catalog.value = null;
  catalogFailed.value = false;
  loading = null;
}

/** The catalog entry of a short sound; null while unknown or missing. */
export function chimeEntry(id: string): Sound | null {
  return (
    catalog.value?.find((item) => item.id === id && item.kind === "chime") ??
    null
  );
}

/** What can loop, in the picker's two groups; chimes are not chosen. */
export function useSoundCatalog() {
  void loadSoundCatalog();
  return {
    catalog: readonly(catalog),
    failed: readonly(catalogFailed),
    music: computed(
      () => catalog.value?.filter((s) => s.kind === "music") ?? [],
    ),
    ambience: computed(
      () => catalog.value?.filter((s) => s.kind === "ambience") ?? [],
    ),
  };
}
