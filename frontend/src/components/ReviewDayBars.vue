<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { clockDuration, dayBars, dayBarsText } from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const bars = computed(() => dayBars(props.hours));
const label = computed(() => dayBarsText(bars.value));
</script>

<template>
  <section class="day-bars card" aria-labelledby="review-days-title">
    <div class="card-head">
      <h2 id="review-days-title" class="card-title">Quest-Stunden je Tag</h2>
      <span class="day-bars__unit">Std.:Min.</span>
    </div>
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
  </section>
</template>

<style scoped>
.day-bars {
  display: flex;
  flex-direction: column;
}

.day-bars__unit {
  color: var(--color-ink-soft);
  font-size: 0.8125rem;
  font-weight: 700;
}

/* A fixed height on the phone; beside the side column it fills the card. */
.day-bars__chart {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
  height: 9rem;
}

.day-bars__day {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: var(--space-1);
  justify-items: center;
  padding: var(--space-2) 0 var(--space-1);
  border-radius: var(--radius-control);
}

/* Today wears the calendar's ink frame, not the orange of what can be tapped. */
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
  width: min(100% - 0.5rem, 2.25rem);
  border-bottom: 1px solid var(--color-line);
}

.day-bars__bar {
  display: block;
  width: 100%;
  border-radius: 0.375rem 0.375rem 0 0;
  background: var(--color-ink);
  transition: height 240ms var(--ease-out);
}

/* Small enough that "Heute" keeps clear of its frame in a phone's column. */
.day-bars__weekday {
  color: var(--color-ink-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

@media (min-width: 40rem) {
  .day-bars__weekday {
    font-size: 0.8125rem;
  }
}

.day-bars__day--today .day-bars__weekday {
  color: var(--color-ink);
  font-weight: 800;
}

@media (min-width: 56rem) {
  .day-bars__chart {
    flex: 1 1 auto;
    height: auto;
    min-height: 11rem;
    max-height: 16rem;
    margin-top: auto;
  }

  .day-bars__value {
    font-size: 0.8125rem;
  }
}
</style>
