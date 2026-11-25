<script setup lang="ts">
import { computed, useId } from "vue";
import { useSoundCatalog } from "../composables/useFocusSound";
import { useFocusSoundSettings } from "../composables/useFocusSoundSettings";

/**
 * Fokus-Klänge in Einstellungen: the same choice and volume as in the
 * Fokus-Modus, here as one compact select ("Aus", then the groups Musik
 * and Geräusche) instead of a long radio list. Stored on this device
 * (docs/focus-sounds.md). The short sounds have their own section, "Töne"
 * (SoundEffectSettings.vue).
 */
const { settings, update } = useFocusSoundSettings();
const { catalog, failed, music, ambience } = useSoundCatalog();
const id = useId();
const percent = computed(() => Math.round(settings.value.volume * 100));
/* Without a sound there is nothing to turn up or down. */
const silent = computed(() => !settings.value.soundId);
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
    <div v-else-if="catalog" class="sound-settings__field">
      <label :for="`${id}-sound`">Klang</label>
      <select
        :id="`${id}-sound`"
        class="input"
        name="focusSound"
        :value="settings.soundId ?? ''"
        @change="
          update({
            soundId: ($event.target as HTMLSelectElement).value || null,
          })
        "
      >
        <option value="">Aus</option>
        <template
          v-for="group in [
            { title: 'Musik', sounds: music },
            { title: 'Geräusche', sounds: ambience },
          ]"
          :key="group.title"
        >
          <optgroup v-if="group.sounds.length" :label="group.title">
            <option v-for="sound in group.sounds" :key="sound.id" :value="sound.id">
              {{ sound.title }}
            </option>
          </optgroup>
        </template>
      </select>
    </div>

    <div
      class="sound-settings__volume"
      :class="{ 'sound-settings__volume--off': silent }"
    >
      <label :for="`${id}-volume`">Lautstärke</label>
      <input
        :id="`${id}-volume`"
        class="range"
        type="range"
        min="0"
        max="100"
        step="5"
        :value="percent"
        :disabled="silent"
        :aria-valuetext="`${percent} %`"
        :style="{ '--fill': `${percent}%` }"
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

.sound-settings__field,
.sound-settings__volume {
  display: grid;
  gap: var(--space-1);
  max-width: 20rem;
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
}

.sound-settings__volume--off label {
  color: var(--color-ink-muted);
}
</style>
