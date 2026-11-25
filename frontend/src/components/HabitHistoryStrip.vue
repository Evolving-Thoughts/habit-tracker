<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { HabitResponse } from "../types/habit";
import { formatDateForGermanDisplay } from "../utils/date";

type Days = NonNullable<HabitResponse["streak"]["recentDays"]>;
const props = defineProps<{ days: Days }>();
const marks = {
  done: ["✓", "Erledigt"],
  missed: ["−", "Verpasst"],
  open: ["○", "Noch offen"],
  skipped: ["↷", "Übersprungen"],
  free: ["·", "Kein Eintrag"],
} as const;

/*
 * Where the fourteen days do not fit, the strip scrolls in itself and starts
 * at its right end, so today and yesterday are in view. Only then is it a
 * tab stop, scrolled with the arrow keys like any scroll area.
 */
const list = ref<HTMLOListElement | null>(null);
const scrollable = ref(false);
function measure(): void {
  const element = list.value;
  scrollable.value =
    !!element && element.scrollWidth > element.clientWidth + 1;
}
async function showToday(): Promise<void> {
  await nextTick();
  const element = list.value;
  if (!element) return;
  element.scrollLeft = element.scrollWidth;
  measure();
}
let observer: ResizeObserver | null = null;
onMounted(() => {
  void showToday();
  if (typeof ResizeObserver === "function" && list.value) {
    observer = new ResizeObserver(measure);
    observer.observe(list.value);
  }
});
onBeforeUnmount(() => observer?.disconnect());
watch(
  () => props.days.at(-1)?.date,
  () => void showToday(),
);
</script>

<template>
  <div class="history">
    <p class="caption">Letzte 14 Tage</p>
    <ol
      ref="list"
      aria-label="Verlauf der letzten 14 Tage"
      :tabindex="scrollable ? 0 : undefined"
    >
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
/*
 * The strip scrolls in itself, never the page: paint containment also
 * holds the hidden day names, which would otherwise widen the window.
 */
ol {
  display: grid;
  grid-template-columns: repeat(14, minmax(max-content, 1fr));
  overflow-x: auto;
  contain: paint;
  overscroll-behavior-x: contain;
  gap: 0.2rem;
  margin: 0;
  padding: 0 0 var(--space-2);
  border-radius: var(--radius-control);
  list-style: none;
  scrollbar-width: thin;
}
ol:focus-visible {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 2px;
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
