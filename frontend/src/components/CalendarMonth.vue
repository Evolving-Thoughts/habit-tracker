<script setup lang="ts">
import { computed } from "vue";
import HistoryItem from "./HistoryItem.vue";
import HistoryPlannedItems, {
  type PlannedActions,
} from "./HistoryPlannedItems.vue";
import type { HistoryResponse } from "../types/history";
import { formatTimeForGermanDisplay } from "../utils/date";
import {
  dayCounts,
  dayLabel,
  hasEntries,
  longDate,
  weekStart,
} from "../utils/history";
import { compactDuration, formatDuration } from "../utils/logbook";

type Day = HistoryResponse["days"][number];

const props = defineProps<{
  result: HistoryResponse;
  /** The selected day. */
  date: string;
  actions: PlannedActions;
}>();
const emit = defineEmits<{
  select: [date: string];
  openDay: [date: string];
}>();

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const leadingBlanks = computed(() => {
  const first = props.result.startDate;
  return (Date.parse(first) - Date.parse(weekStart(first))) / 86_400_000;
});
const selectedDay = computed(() =>
  props.result.days.find((day) => day.date === props.date),
);

function cellLabel(day: Day): string {
  const counts = dayCounts(day);
  const parts = [
    counts.completed && `${counts.completed} erledigt`,
    counts.skipped && `${counts.skipped} übersprungen`,
    counts.open && `${counts.open} offen`,
    counts.events &&
      `${counts.events} ${counts.events === 1 ? "Termin" : "Termine"}`,
  ].filter(Boolean);
  const today = day.date === props.result.today ? ", heute" : "";
  const work = day.work.minutes
    ? `, ${formatDuration(day.work.minutes)} im Logbuch`
    : "";
  return `${longDate(day.date)}${today}, ${parts.length ? parts.join(", ") : "nichts geplant"}${work}`;
}
</script>

<template>
  <div class="month-grid">
    <span
      v-for="weekday in WEEKDAYS"
      :key="weekday"
      class="month-grid__weekday"
      aria-hidden="true"
      >{{ weekday }}</span
    >
    <span
      v-for="blank in leadingBlanks"
      :key="`blank-${blank}`"
      class="month-grid__blank"
    />
    <button
      v-for="day in result.days"
      :key="day.date"
      type="button"
      class="month-day"
      :class="{ 'month-day--today': day.date === result.today }"
      :data-date="day.date"
      :aria-pressed="day.date === date"
      :aria-label="cellLabel(day)"
      @click="emit('select', day.date)"
    >
      <span class="month-day__number">{{ Number(day.date.slice(8)) }}</span>
      <span class="month-day__marks" aria-hidden="true">
        <i v-if="dayCounts(day).completed" class="mark mark--done" />
        <i v-if="dayCounts(day).open" class="mark mark--open" />
        <i v-if="dayCounts(day).events" class="mark mark--event" />
      </span>
      <!-- Measured work as a quiet figure; the label above says it in full. -->
      <span v-if="day.work.minutes" class="month-day__work" aria-hidden="true">
        <span class="month-day__work-long">{{
          formatDuration(day.work.minutes)
        }}</span>
        <span class="month-day__work-short">{{
          compactDuration(day.work.minutes)
        }}</span>
      </span>
    </button>
  </div>
  <p class="legend" aria-hidden="true">
    <span><i class="mark mark--done" />erledigt</span>
    <span><i class="mark mark--open" />offen</span>
    <span><i class="mark mark--event" />Termin</span>
    <span
      ><span class="legend__figure"
        ><span class="month-day__work-long">1 Std. 30 Min.</span
        ><span class="month-day__work-short">1:30 h</span></span
      >im Logbuch</span
    >
  </p>

  <section
    v-if="selectedDay"
    class="selected-day"
    aria-labelledby="selected-day-title"
  >
    <div class="selected-day__header">
      <h2 id="selected-day-title" class="section-title">
        {{ dayLabel(selectedDay.date) }}
      </h2>
      <button
        type="button"
        class="btn"
        :aria-label="`Tag öffnen: ${dayLabel(selectedDay.date)}`"
        @click="emit('openDay', selectedDay.date)"
      >
        Tag öffnen
      </button>
    </div>
    <p v-if="selectedDay.work.minutes" class="selected-day__work">
      {{ formatDuration(selectedDay.work.minutes) }} im Logbuch
    </p>
    <div v-if="!hasEntries(selectedDay)" class="empty-state">
      <strong>Für diesen Tag gibt es nichts.</strong>
    </div>
    <div v-else class="entries">
      <ul v-if="selectedDay.external?.length" class="events">
        <li
          v-for="event in selectedDay.external"
          :key="`external-${event.id}`"
          class="event"
        >
          <span class="event__time">{{
            formatTimeForGermanDisplay(event.start)
          }}</span>
          <span class="event__title">{{ event.title }}</span>
          <span class="event__source">Google Kalender</span>
        </li>
      </ul>
      <HistoryPlannedItems
        v-if="selectedDay.planned?.length"
        :items="selectedDay.planned"
        :actions="actions"
      />
      <ul v-if="selectedDay.items.length" class="entries__list">
        <HistoryItem
          v-for="item in selectedDay.items"
          :key="`${item.type}-${item.id}`"
          :item="item"
        />
      </ul>
    </div>
  </section>
</template>

<style scoped>
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
}

.month-grid__weekday {
  padding-bottom: var(--space-1);
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: center;
}

.month-day {
  display: grid;
  grid-template-rows: auto 0.5rem auto;
  gap: 0.3rem;
  align-content: start;
  justify-items: center;
  min-width: 0;
  /* Room for the figure, so weeks with and without work keep one height. */
  min-height: 4.25rem;
  padding: var(--space-2) 0 var(--space-1);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out);
}

.month-day:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.month-day--today {
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

.month-day[aria-pressed="true"] {
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.month-day--today[aria-pressed="true"] {
  box-shadow:
    inset 0 0 0 2px var(--color-ink),
    var(--shadow-card);
}

.month-day__marks {
  display: flex;
  gap: 0.1875rem;
  align-items: center;
  height: 0.5rem;
}

/* Quiet: the figure is a fact about the day, not a score. */
.month-day__work {
  max-width: 100%;
  padding: 0 0.125rem;
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.15;
  text-align: center;
}

.month-day__work-long {
  display: none;
}

.mark {
  display: inline-block;
  flex: none;
}

.mark--done,
.mark--open {
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: 50%;
}

.mark--done {
  background: var(--color-ink-muted);
}

.mark--open {
  border: 1.5px solid var(--color-ink-muted);
}

.mark--event {
  width: 0.75rem;
  height: 0.1875rem;
  border-radius: var(--radius-pill);
  background: var(--color-ink-soft);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.legend > span {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.legend__figure {
  font-size: 0.6875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.selected-day__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  justify-content: space-between;
  margin: var(--space-6) 0 var(--space-3);
}

.selected-day__header .section-title {
  margin: 0;
}

.selected-day__work {
  margin: 0 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.entries,
.entries__list,
.events {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.event {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: 0 calc(var(--tap) + var(--space-4));
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
  border-radius: var(--radius-card);
  background: var(--color-surface-flat);
}

.event__time {
  grid-row: span 2;
  padding-top: 0.1rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.event__title {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.event__source {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

@media (min-width: 40rem) {
  .month-day {
    min-height: 4.5rem;
  }

  .month-day__work-long {
    display: inline;
  }

  .month-day__work-short {
    display: none;
  }
}
</style>
