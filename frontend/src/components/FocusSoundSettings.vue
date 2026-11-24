<script setup lang="ts">
import { computed, useId } from "vue";
import SoundChoices from "./SoundChoices.vue";
import { useSoundCatalog } from "../composables/useFocusSound";
import { useFocusSoundSettings } from "../composables/useFocusSoundSettings";

/**
 * Fokus-Klänge in Einstellungen: the same choice and volume as in the
 * Fokus-Modus. Stored on this device (docs/focus-sounds.md). The short
 * sounds have their own section, "Töne" (SoundEffectSettings.vue).
 */
const { settings, update } = useFocusSoundSettings();
const { catalog, failed, music, ambience } = useSoundCatalog();
const id = useId();
const percent = computed(() => Math.round(settings.value.volume * 100));
const empty = computed(
  () => !!catalog.value && !music.value.length && !ambience.value.length,
);
</script>

<template>
  <div class="sound-settings">
    <p class="sound-settings__text">
      Im Fokus-Modus läuft Musik oder ein Geräusch, solange die Stoppuhr läuft.
      Gilt auf diesem Gerät.
    </p>

    <p v-if="failed" class="sound-settings__note" role="status">
      Klänge konnten nicht geladen werden.
    </p>
    <p v-else-if="empty" class="sound-settings__note">
      Noch keine Klänge verfügbar.
    </p>
    <SoundChoices
      v-else-if="catalog"
      label="Klang"
      :music="music"
      :ambience="ambience"
      :model-value="settings.soundId"
      @update:model-value="(soundId) => update({ soundId })"
    />

    <div class="sound-settings__volume">
      <label :for="`${id}-volume`">Lautstärke</label>
      <input
        :id="`${id}-volume`"
        type="range"
        min="0"
        max="100"
        step="5"
        :value="percent"
        :aria-valuetext="`${percent} %`"
        @input="
          update({
            volume: Number(($event.target as HTMLInputElement).value) / 100,
          })
        "
      />
    </div>
  </div>
</template>

<style scoped>
.sound-settings {
  display: grid;
  gap: var(--space-3);
}

.sound-settings__text {
  margin: 0;
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.sound-settings__note {
  margin: 0;
  color: var(--color-ink);
}

.sound-settings__volume {
  display: grid;
  gap: var(--space-1);
  max-width: 20rem;
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
}

.sound-settings__volume input {
  width: 100%;
  min-height: var(--tap);
  margin: 0;
}
</style>
