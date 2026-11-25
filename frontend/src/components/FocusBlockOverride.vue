<script setup lang="ts">
import { computed, useId } from "vue";
import { useFocusBlock } from "../composables/useFocusBlock";
import type { FocusBlockOverride } from "../types/focus-block";
import { OVERRIDE_LABELS } from "../utils/focus-block";

/**
 * "Fokus-Sperre: Standard | Immer | Nie" in a quest's or daily's editor:
 * whether its running stopwatch blocks apps and websites. Standard follows
 * Einstellungen (while the stopwatch runs, or from a Soll of so many minutes).
 */
const choice = defineModel<FocusBlockOverride>({ required: true });
const props = defineProps<{ kind: "todo" | "habit" }>();
const name = useId();
const focusBlock = useFocusBlock();

const options: FocusBlockOverride[] = ["default", "always", "never"];
const hint = computed(() => {
  const settings = focusBlock?.state.value?.settings;
  const own = props.kind === "todo" ? "diese Quest" : "dieses Daily";
  if (choice.value === "always")
    return `Sperrt für ${own} immer, sobald ihre Stoppuhr läuft, auch ohne Soll.`;
  if (choice.value === "never") return `Sperrt für ${own} nie.`;
  if (!settings) return "Folgt den Einstellungen.";
  if (!settings.enabled)
    return "Folgt den Einstellungen: dort ist das Sperren aus.";
  return settings.trigger === "threshold"
    ? `Folgt den Einstellungen: sperren ab einem Soll von ${settings.thresholdMinutes} Min.`
    : "Folgt den Einstellungen: sperren, solange die Stoppuhr läuft.";
});
</script>

<template>
  <div class="field focus-block-override">
    <span :id="`${name}-label`">Fokus-Sperre</span>
    <div
      class="segmented"
      role="radiogroup"
      :aria-labelledby="`${name}-label`"
      :aria-describedby="`${name}-hint`"
    >
      <label v-for="option in options" :key="option">
        <input
          v-model="choice"
          type="radio"
          :name="name"
          :value="option"
          :data-test="`focus-block-${option}`"
        />
        {{ OVERRIDE_LABELS[option] }}
      </label>
    </div>
    <small :id="`${name}-hint`" class="focus-block-override__hint">
      {{ hint }}
    </small>
  </div>
</template>

<style scoped>
.focus-block-override .segmented {
  justify-self: start;
}

.focus-block-override__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}
</style>
