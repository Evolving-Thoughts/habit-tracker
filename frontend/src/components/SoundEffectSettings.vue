<script setup lang="ts">
import { computed, useId } from "vue";
import { playEffect, useSoundEffects } from "../composables/useSoundEffects";

/**
 * "Töne" in Einstellungen: the switch and the volume of the app's short
 * sounds, stored on this device (docs/focus-sounds.md). The Fokus-Klänge
 * keep their own choice and volume.
 */
const { settings, update } = useSoundEffects();
const id = useId();
const percent = computed(() => Math.round(settings.value.volume * 100));
</script>

<template>
  <div class="effect-settings">
    <div class="effect-settings__row">
      <span :id="`${id}-label`" class="effect-settings__label">Töne</span>
      <button
        class="switch"
        type="button"
        role="switch"
        :aria-labelledby="`${id}-label`"
        :aria-describedby="`${id}-text`"
        :aria-checked="settings.enabled"
        @click="update({ enabled: !settings.enabled })"
      >
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </div>
    <p :id="`${id}-text`" class="effect-settings__text">
      Kurze Töne beim Abhaken, bei „Soll erreicht“ im Fokus-Modus und bei
      Meilensteinen wie der Perfect Week. Gilt auf diesem Gerät.
    </p>
    <p class="visually-hidden" role="status">
      {{ settings.enabled ? "Töne sind eingeschaltet." : "Töne sind ausgeschaltet." }}
    </p>

    <div class="effect-settings__volume">
      <label :for="`${id}-volume`">Lautstärke der Töne</label>
      <input
        :id="`${id}-volume`"
        type="range"
        min="0"
        max="100"
        step="5"
        :value="percent"
        :disabled="!settings.enabled"
        :aria-valuetext="`${percent} %`"
        @input="
          update({
            volume: Number(($event.target as HTMLInputElement).value) / 100,
          })
        "
        @change="playEffect('chime-done')"
      />
    </div>
  </div>
</template>

<style scoped>
.effect-settings {
  display: grid;
  gap: var(--space-2);
}

.effect-settings p {
  margin: 0;
}

.effect-settings__row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
}

.effect-settings__label {
  font-weight: 700;
}

.effect-settings__text {
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.effect-settings__volume {
  display: grid;
  gap: var(--space-1);
  max-width: 20rem;
  margin-top: var(--space-2);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
}

.effect-settings__volume input {
  width: 100%;
  min-height: var(--tap);
  margin: 0;
}
</style>
