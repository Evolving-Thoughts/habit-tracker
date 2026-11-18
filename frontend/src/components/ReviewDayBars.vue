<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { clockDuration, dayBars, dayBarsText } from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const bars = computed(() => dayBars(props.hours));
const label = computed(() => dayBarsText(bars.value));
</script>

<template>
  <section class="day-bars" aria-labelledby="review-days-title">
    <h2 id="review-days-title" class="section-title">Quest-Stunden je Tag</h2>
    <div class="card">
      <!-- The figure is read as one sentence; the bars repeat it for the eye. -->
      <div class="day-bars__chart" role="img" :aria-label="label">
        <div
          v-for="bar in bars"
          :key="bar.date"
          class="day-bars__day"
          :class="{
            'day-bars__day--today': bar.isToday,
            'day-bars__day--ahead': bar.isAhead,
          }"
          :data-date="bar.date"
        >
          <span class="day-bars__value" aria-hidden="true">{{
            bar.isAhead ? "–" : clockDuration(bar.minutes)
          }}</span>
          <span class="day-bars__track" aria-hidden="true">
            <span class="day-bars__bar" :style="{ height: `${bar.height}%` }" />
          </span>
          <span class="day-bars__weekday" aria-hidden="true">{{
            bar.isToday ? "Heute" : bar.weekday
          }}</span>
        </div>
      </div>
      <p class="day-bars__unit">Stunden:Minuten auf Quests einer Kampagne</p>
    </div>
  </section>
</template>

<style scoped>
.day-bars .card {
  display: grid;
  gap: var(--space-3);
}

.day-bars__chart {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
}

.day-bars__day {
  display: grid;
  grid-template-rows: auto 6rem auto;
  gap: var(--space-1);
  justify-items: center;
  padding: var(--space-1) 0;
  border-radius: var(--radius-control);
}

/* Today wears the calendar's ink frame. */
.day-bars__day--today {
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

.day-bars__value {
  color: var(--color-ink);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.day-bars__day--ahead .day-bars__value,
.day-bars__day--ahead .day-bars__weekday {
  color: var(--color-ink-soft);
}

.day-bars__track {
  display: flex;
  align-items: flex-end;
  width: min(100%, 1.75rem);
  height: 100%;
  border-bottom: 1px solid var(--color-line);
}

.day-bars__bar {
  display: block;
  width: 100%;
  border-radius: 0.375rem 0.375rem 0 0;
  background: var(--color-ink);
  transition: height 240ms var(--ease-out);
}

.day-bars__weekday {
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}

.day-bars__day--today .day-bars__weekday {
  color: var(--color-ink);
  font-weight: 800;
}

.day-bars__unit {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
}
</style>
