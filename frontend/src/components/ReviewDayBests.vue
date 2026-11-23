<script setup lang="ts">
import { computed } from "vue";
import { getDayBests } from "../api/day-bests.api";
import { useLoader } from "../composables/useLoader";
import { DAY_QUERY, hrefOf } from "../routes";
import type { DayBestRange } from "../types/day-best";
import { addDays } from "../utils/date";
import { countLine, dayName } from "../utils/day-best";

/**
 * The week's lines of "Das Beste des Tages", Monday to Sunday, beside what
 * was done. Only days with a line are listed; a week without any shows no
 * card at all, so nothing here reads as a gap to fill.
 */
const props = defineProps<{
  /** The Monday of the week. */
  week: string;
  today: string;
}>();

const sunday = computed(() => addDays(props.week, 6));
const { data } = useLoader<DayBestRange | null>(
  (signal) => getDayBests(props.week, sunday.value, signal),
  {
    initial: null,
    fallbackError: "Das Beste der Woche konnte nicht geladen werden.",
    params: [() => props.week],
    resetOnLoad: true,
  },
);

/* Oldest first: the week reads from Monday on. */
const entries = computed(() => [...(data.value?.entries ?? [])].reverse());
/* The days the week has offered so far: all seven once it is over. */
const days = computed(() => {
  if (props.today > sunday.value) return 7;
  if (props.today < props.week) return 0;
  return (
    Math.round(
      (Date.parse(`${props.today}T12:00:00Z`) -
        Date.parse(`${props.week}T12:00:00Z`)) /
        86_400_000,
    ) + 1
  );
});
const dayHref = (date: string) =>
  `${hrefOf("best")}?${DAY_QUERY}=${encodeURIComponent(date)}`;
</script>

<template>
  <section
    v-if="entries.length"
    class="review-day-bests card"
    aria-labelledby="review-day-bests-title"
  >
    <div class="card-head">
      <h2 id="review-day-bests-title" class="card-title">
        Das Beste der Woche
        <span class="count">· {{ countLine(entries.length, days) }}</span>
      </h2>
      <a class="review-day-bests__all" :href="hrefOf('best')">Alle ansehen</a>
    </div>
    <ol class="review-day-bests__list">
      <li v-for="entry in entries" :key="entry.date" class="review-day-bests__row">
        <a class="review-day-bests__day" :href="dayHref(entry.date)">{{
          dayName(entry.date)
        }}</a>
        <p class="review-day-bests__text">{{ entry.text }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.review-day-bests__all,
.review-day-bests__day {
  color: var(--color-action-strong);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--color-line);
  text-underline-offset: 0.2em;
}

.review-day-bests__all,
.review-day-bests__day {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
}

.review-day-bests__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.review-day-bests__row {
  display: grid;
  padding: var(--space-1) 0 var(--space-3);
}

.review-day-bests__row + .review-day-bests__row {
  border-top: 1px solid var(--color-line);
}

.review-day-bests__day {
  justify-self: start;
}

.review-day-bests__text {
  margin: 0;
  font-size: 1.0625rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

/* From 56rem two columns: the day beside its line. */
@media (min-width: 56rem) {
  .review-day-bests__row {
    grid-template-columns: 12rem minmax(0, 1fr);
    gap: var(--space-4);
    align-items: baseline;
  }
}
</style>
