<script setup lang="ts">
import { DAY_MARKS, type DayMarkState } from "../utils/day-marks";

/**
 * The mark of one day in a Daily's history strip, also drawn by the legend
 * above the list. Decoration only: the words stand beside it or in hidden
 * text.
 */
defineProps<{ state: DayMarkState }>();
</script>

<template>
  <b aria-hidden="true" class="day-mark" :class="state">{{
    DAY_MARKS[state].glyph
  }}</b>
</template>

<style scoped>
.day-mark {
  display: grid;
  flex: none;
  place-items: center;
  inline-size: 1.5rem;
  aspect-ratio: 1;
  border-radius: 50%;
  line-height: 1;
}
.done {
  background: var(--color-ink-muted);
  color: var(--color-surface);
}
.missed {
  border: 1px dashed var(--color-ink-soft);
}
.open,
.skipped {
  border: 1px solid var(--color-line-strong);
}
</style>
