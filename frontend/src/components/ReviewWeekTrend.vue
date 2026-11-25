<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { formatDuration } from "../utils/today-agenda";
import {
  clockDuration,
  weekBarText,
  weekTrend,
  weekTrendText,
} from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const trend = computed(() => weekTrend(props.hours));
const label = computed(() => weekTrendText(trend.value));
</script>

<template>
  <section class="week-trend card" aria-labelledby="review-trend-title">
    <div class="card-head">
      <h2 id="review-trend-title" class="card-title">
        Kampagnen-Stunden · letzte Wochen
      </h2>
      <!-- The same keys as "Kampagnen-Arbeit gegen Sonstiges", and the line. -->
      <ul class="week-trend__legend" aria-hidden="true">
        <li>
          <i class="week-trend__key week-trend__part--quest" />Kampagnen-Arbeit
        </li>
        <li>
          <i
            class="week-trend__key week-trend__part--other series-other"
          />Sonstiges</li
        >
        <li v-if="trend.average !== null" class="week-trend__average-note">
          <i class="week-trend__dash" />Schnitt der
          {{ trend.bars.length - 1 }} Wochen davor
          <strong>{{ formatDuration(trend.average) }}</strong>
        </li>
      </ul>
    </div>
    <div class="week-trend__chart" role="img" :aria-label="label">
      <div class="week-trend__plot" aria-hidden="true">
        <!-- Quest time on the baseline, the rest stacked on it. -->
        <span
          v-for="bar in trend.bars"
          :key="bar.startDate"
          class="week-trend__slot"
          :class="{ 'week-trend__slot--shown': bar.isShown }"
          :title="weekBarText(bar)"
        >
          <span
            v-if="bar.questHeight"
            class="week-trend__part week-trend__part--quest"
            :style="{ height: `${bar.questHeight}%` }"
          />
          <span
            v-if="bar.otherHeight"
            class="week-trend__part week-trend__part--other series-other"
            :style="{
              height: bar.questHeight
                ? `calc(${bar.otherHeight}% - 2px)`
                : `${bar.otherHeight}%`,
            }"
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
          <!-- The other time is written too, never only in the tooltip. -->
          <span class="week-trend__other">{{
            bar.otherMinutes ? `+${clockDuration(bar.otherMinutes)}` : " "
          }}</span>
          <span class="week-trend__date">{{ bar.label }}</span>
          <span v-if="bar.isRunning" class="week-trend__running">bisher</span>
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.week-trend__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  align-items: center;
  margin: 0;
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  list-style: none;
  font-variant-numeric: tabular-nums;
}

.week-trend__legend li {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
}

.week-trend__key {
  flex: none;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 0.2rem;
}

.week-trend__key.series-other {
  box-shadow: inset 0 0 0 1px var(--color-mark-none);
}

.week-trend__average-note {
  flex-wrap: wrap;
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

/* A column stacks from the baseline up, the parts 2px apart in the card's white. */
.week-trend__slot {
  display: flex;
  flex-direction: column-reverse;
  gap: 2px;
  justify-self: center;
  width: min(100% - 0.5rem, 3rem);
}

/* The shown week is marked quietly, like today in the day bars: a firmer baseline. */
.week-trend__slot--shown {
  box-shadow: 0 2px 0 var(--color-ink);
}

.week-trend__part {
  display: block;
  flex: none;
  width: 100%;
  transition: height 240ms var(--ease-out);
}

/* Only the top of a column is rounded; it stands on the baseline. */
.week-trend__part:last-child {
  border-radius: 0.375rem 0.375rem 0 0;
}

.week-trend__part--quest {
  background: var(--color-bar);
}

/* Sonstiges on top, hatched (.series-other in style.css) and lighter than the bar. */

/* The average of quest time as a dashed rule across all weeks. */
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

.week-trend__other,
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

  .week-trend__other,
  .week-trend__date,
  .week-trend__running {
    font-size: 0.75rem;
  }
}
</style>
