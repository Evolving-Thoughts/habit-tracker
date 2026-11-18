<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { shortDate } from "../utils/history";
import { formatDuration } from "../utils/today-agenda";
import { weekTrend, weekTrendText } from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const trend = computed(() => weekTrend(props.hours));
const label = computed(() => weekTrendText(trend.value));
const shown = computed(() => trend.value.bars.find((bar) => bar.isShown));
const shownName = computed(() =>
  props.hours.startDate <= props.hours.today &&
  props.hours.today <= props.hours.endDate
    ? "Diese Woche"
    : `Woche ab ${shortDate(props.hours.startDate)}`,
);
</script>

<template>
  <section class="week-trend" aria-labelledby="review-trend-title">
    <h2 id="review-trend-title" class="section-title">
      Quest-Stunden · letzte Wochen
    </h2>
    <div class="card">
      <p class="week-trend__summary">
        <span
          >{{ shownName }}
          <strong>{{ formatDuration(shown?.minutes ?? 0) }}</strong></span
        >
        <span v-if="trend.average !== null"
          >Schnitt der Wochen davor
          <strong>{{ formatDuration(trend.average) }}</strong></span
        >
      </p>
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
            :class="{ 'week-trend__label--shown': bar.isShown }"
            >{{ bar.label }}</span
          >
        </div>
      </div>
      <p class="week-trend__legend" aria-hidden="true">
        <i class="week-trend__dash" />Schnitt der sieben Wochen davor
      </p>
    </div>
  </section>
</template>

<style scoped>
.week-trend .card {
  display: grid;
  gap: var(--space-3);
}

.week-trend__summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-5);
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.week-trend__summary strong {
  color: var(--color-ink);
}

.week-trend__chart {
  display: grid;
  gap: var(--space-1);
}

.week-trend__plot {
  position: relative;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: var(--space-1);
  height: 6rem;
  border-bottom: 1px solid var(--color-line);
}

.week-trend__slot {
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.week-trend__bar {
  display: block;
  width: min(100%, 1.75rem);
  border-radius: 0.375rem 0.375rem 0 0;
  background: var(--color-ink-soft);
  transition: height 240ms var(--ease-out);
}

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
  color: var(--color-ink-muted);
  font-size: 0.6875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.week-trend__label--shown {
  color: var(--color-ink);
  font-weight: 800;
}

.week-trend__legend {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
}

.week-trend__dash {
  display: inline-block;
  width: 1.25rem;
  border-top: 2px dashed var(--color-ink-muted);
}
</style>
