<script setup lang="ts">
import type { HabitResponse } from "../types/habit";
import { formatDateForGermanDisplay } from "../utils/date";

type Days = NonNullable<HabitResponse["streak"]["recentDays"]>;
defineProps<{ days: Days }>();
const marks = {
  done: ["✓", "Erledigt"],
  missed: ["−", "Verpasst"],
  open: ["○", "Noch offen"],
  skipped: ["↷", "Übersprungen"],
  free: ["·", "Kein Eintrag"],
} as const;
</script>

<template>
  <div class="history">
    <p class="caption">Letzte 14 Tage</p>
    <ol aria-label="Verlauf der letzten 14 Tage">
      <li
        v-for="day in days"
        :key="day.date"
        :title="
          formatDateForGermanDisplay(day.date) + ' · ' + marks[day.state][1]
        "
      >
        <span class="visually-hidden"
          >{{ formatDateForGermanDisplay(day.date) }} ·
          {{ marks[day.state][1] }}</span
        >
        <span aria-hidden="true" class="date">{{ Number(day.date.slice(-2)) }}.</span>
        <b aria-hidden="true" :class="day.state">{{ marks[day.state][0] }}</b>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.history {
  grid-column: 1 / -1;
  min-inline-size: 0;
  color: var(--color-ink-muted);
}
.caption {
  margin: 0 0 var(--space-2);
  font-size: 0.8125rem;
  font-weight: 700;
}
ol {
  display: grid;
  grid-template-columns: repeat(14, minmax(max-content, 1fr));
  overflow-x: auto;
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
li {
  display: grid;
  justify-items: center;
  gap: 0.25rem;
}
.date {
  white-space: nowrap;
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}
b {
  display: grid;
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
