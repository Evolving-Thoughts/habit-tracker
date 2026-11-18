<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { formatDuration } from "../utils/today-agenda";
import { clockDuration, weekTrend, weekTrendText } from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const trend = computed(() => weekTrend(props.hours));
const label = computed(() => weekTrendText(trend.value));
</script>

<template>
  <section class="week-trend card" aria-labelledby="review-trend-title">
    <div class="card-head">
      <h2 id="review-trend-title" class="card-title">
        Quest-Stunden · letzte Wochen
      </h2>
      <p
        v-if="trend.average !== null"
        class="week-trend__average-note"
        aria-hidden="true"
      >
        <i class="week-trend__dash" />Schnitt der
        {{ trend.bars.length - 1 }} Wochen davor
        <strong>{{ formatDuration(trend.average) }}</strong>
      </p>
    </div>
    <div class="week-trend__chart" role="img" :aria-label="label">
      <div class="week-trend__plot" aria-hidden="true">
        <span
          v-for="bar in trend.bars"
          :key="bar.startDate"
          class="week-trend__slot"
        >
          <span
            class="week-trend__bar"
            :class="{ 'week-trend__bar--shown': bar.isShown }"
            :style="{ height: `${bar.height}%` }"
          />
        </span>
        <span
          v-if="trend.averageAt !== null"
          class="week-trend__average"
          :style="{ bottom: `${trend.averageAt}%` }"
        />
      </div>
      <div class="week-trend__labels" aria-hidden="true">
        <span
          v-for="bar in trend.bars"
          :key="bar.startDate"
          class="week-trend__label"
          :class="{ 'week-trend__label--shown': bar.isShown }"
        >
          <span class="week-trend__value">{{ clockDuration(bar.minutes) }}</span>
          <span class="week-trend__date">{{ bar.label }}</span>
          <span v-if="bar.isRunning" class="week-trend__running">bisher</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.week-trend__average-note {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  align-items: center;
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.week-trend__average-note strong {
  color: var(--color-ink);
  font-size: 0.9375rem;
  font-weight: 800;
}

.week-trend__dash {
  display: inline-block;
  width: 1.25rem;
  border-top: 2px dashed var(--color-ink-muted);
}

.week-trend__chart {
  display: grid;
  gap: var(--space-2);
}

.week-trend__plot {
  position: relative;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: var(--space-1);
  height: 6.5rem;
  border-bottom: 1px solid var(--color-line);
}

.week-trend__slot {
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.week-trend__bar {
  display: block;
  width: min(100% - 0.5rem, 3rem);
  border-radius: 0.375rem 0.375rem 0 0;
  background: var(--color-ink-soft);
  transition: height 240ms var(--ease-out);
}

/* The shown week in full ink; the others step back. */
.week-trend__bar--shown {
  background: var(--color-ink);
}

/* The average as a dashed rule across all weeks. */
.week-trend__average {
  position: absolute;
  right: 0;
  left: 0;
  border-top: 2px dashed var(--color-ink-muted);
}

.week-trend__labels {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: var(--space-1);
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.week-trend__label {
  display: grid;
  align-content: start;
  min-width: 0;
}

.week-trend__value {
  color: var(--color-ink-muted);
  font-size: 0.75rem;
  font-weight: 700;
}

.week-trend__date {
  color: var(--color-ink-soft);
  font-size: 0.6875rem;
  font-weight: 700;
}

.week-trend__label--shown .week-trend__value,
.week-trend__label--shown .week-trend__date {
  color: var(--color-ink);
  font-weight: 800;
}

.week-trend__running {
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  font-weight: 700;
}

@media (min-width: 56rem) {
  .week-trend__plot {
    height: 8rem;
  }

  .week-trend__value {
    font-size: 0.8125rem;
  }

  .week-trend__date,
  .week-trend__running {
    font-size: 0.75rem;
  }
}
</style>
