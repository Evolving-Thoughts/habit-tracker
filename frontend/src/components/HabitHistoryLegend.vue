<script setup lang="ts">
import HistoryDayMark from "./HistoryDayMark.vue";
import { DAY_MARKS, DAY_MARK_ORDER } from "../utils/day-marks";

/**
 * Dailies: what the marks of the 14-day history strip mean, once above the
 * first card. Drawn with the strip's own marks, so they match exactly.
 */

/* Mid-sentence: "erledigt", "kein Eintrag". */
const lowerFirst = (label: string) =>
  label.charAt(0).toLowerCase() + label.slice(1);
</script>

<template>
  <p class="history-legend">
    <span class="history-legend__lead">Letzte 14 Tage:</span>
    <span
      v-for="state in DAY_MARK_ORDER"
      :key="state"
      class="history-legend__entry"
      :data-state="state"
    >
      <HistoryDayMark :state="state" />{{
        lowerFirst(DAY_MARKS[state].label)
      }}
    </span>
  </p>
</template>

<style scoped>
.history-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  align-items: center;
  margin: 0 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}
.history-legend__entry {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  white-space: nowrap;
}
</style>
