<script setup lang="ts">
import { computed } from "vue";
import {
  CORE_COLORS,
  EXTRA_COLORS,
  type CampaignColor,
} from "../types/campaign";
import { COLOR_NAMES, markToken } from "../utils/campaign-style";
import AppIcon from "./AppIcon.vue";

/**
 * The palette of campaign and category colours as radio swatches. The core
 * colours, which stay apart for colour-blind eyes too, come first; the
 * extra ones follow. Every swatch says its name (tooltip and spoken), and
 * the choice stands below in words, so nothing depends on seeing colour.
 */
const props = defineProps<{
  /** The radio group's name; unique on the page. */
  name: string;
  legend: string;
  /** The colour used while none is chosen, shown as a ring. */
  automatic: string;
  /** What the automatic choice is called, e.g. "Automatisch aus dem Titel". */
  automaticLabel: string;
}>();

const color = defineModel<CampaignColor | null>({ required: true });

const groups = [
  { key: "core", label: "Für alle gut unterscheidbar", colors: CORE_COLORS },
  { key: "extra", label: "Weitere Farben", colors: EXTRA_COLORS },
] as const;

const chosen = computed(() =>
  color.value ? COLOR_NAMES[color.value] : props.automaticLabel,
);
</script>

<template>
  <fieldset class="mark-picker">
    <legend>{{ legend }}</legend>
    <div v-for="group in groups" :key="group.key" class="mark-picker__group">
      <p class="mark-picker__group-label" aria-hidden="true">
        {{ group.label }}
      </p>
      <div
        class="mark-picker__choices"
        role="group"
        :aria-label="group.label"
      >
        <!-- The automatic colour leads the row: it is one of the core ones. -->
        <label
          v-if="group.key === 'core'"
          class="mark-picker__swatch"
          :style="{ '--swatch': automatic }"
          :title="automaticLabel"
        >
          <input
            v-model="color"
            class="visually-hidden"
            type="radio"
            :name="name"
            :value="null"
          />
          <span class="mark-picker__dot mark-picker__dot--auto">
            <AppIcon v-if="color === null" name="check" />
          </span>
          <span class="visually-hidden">{{ automaticLabel }}</span>
        </label>
        <label
          v-for="key in group.colors"
          :key="key"
          class="mark-picker__swatch"
          :style="{ '--swatch': markToken(key) }"
          :title="COLOR_NAMES[key]"
        >
          <input
            v-model="color"
            class="visually-hidden"
            type="radio"
            :name="name"
            :value="key"
          />
          <span class="mark-picker__dot">
            <AppIcon v-if="color === key" name="check" />
          </span>
          <span class="visually-hidden">{{ COLOR_NAMES[key] }}</span>
        </label>
      </div>
    </div>
    <p class="mark-picker__chosen" aria-hidden="true">{{ chosen }}</p>
  </fieldset>
</template>

<style scoped>
.mark-picker {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.mark-picker legend {
  margin-bottom: var(--space-2);
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.mark-picker__group {
  display: grid;
  gap: var(--space-1);
}

.mark-picker__group-label {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}

.mark-picker__choices {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.mark-picker__swatch {
  position: relative;
  display: grid;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  cursor: pointer;
}

.mark-picker__dot {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 50%;
  background: var(--swatch);
  color: var(--color-on-action);
  transition: transform 420ms var(--spring);
}

/* The automatic colour shows as a ring, so it never looks chosen by hand. */
.mark-picker__dot--auto {
  border: 0.3125rem solid var(--swatch);
  background: var(--color-surface);
  color: var(--color-ink);
}

.mark-picker__dot :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 3;
}

.mark-picker__swatch:has(input:checked) .mark-picker__dot {
  box-shadow:
    0 0 0 2px var(--color-surface),
    0 0 0 4px var(--color-ink);
}

.mark-picker__swatch:active .mark-picker__dot {
  transform: scale(0.92);
  transition-duration: 90ms;
}

.mark-picker__swatch:has(input:focus-visible) .mark-picker__dot {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 2px;
}

.mark-picker__chosen {
  margin: 0;
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
