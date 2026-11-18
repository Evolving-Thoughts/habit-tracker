<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { formatDuration } from "../utils/today-agenda";
import {
  durationParts,
  reviewFigures,
  type FigurePart,
} from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const figures = computed(() => reviewFigures(props.hours));
/* A missed goal is a number like any other: the bar just stops short. */
const filled = computed(() =>
  figures.value.targetMinutes
    ? Math.min(100, (figures.value.questMinutes / figures.value.targetMinutes) * 100)
    : 0,
);
const averageNote = computed(() => {
  const days = figures.value.daysPassed;
  if (!days) return "Die Woche hat noch nicht begonnen";
  return days === 7 ? "über alle 7 Tage" : `über ${days} ${days === 1 ? "Tag" : "Tage"} bisher`;
});
const measured = computed(
  () => figures.value.questMinutes + figures.value.otherMinutes,
);
const UNKNOWN: FigurePart[] = [{ value: "–", unit: "" }];
const average = computed(() =>
  figures.value.dailyAverage === null
    ? UNKNOWN
    : durationParts(figures.value.dailyAverage),
);
const share = computed(() =>
  figures.value.questShare === null
    ? UNKNOWN
    : [{ value: String(figures.value.questShare), unit: "%" }],
);
</script>

<template>
  <!-- Three cards side by side from 40rem; on a phone one card, so the numbers keep room. -->
  <section class="figures" aria-labelledby="review-figures-title">
    <h2 id="review-figures-title" class="visually-hidden">Kennzahlen</h2>
    <dl class="figures__list">
      <div class="figures__item figures__item--hours">
        <dt class="card-title">Quest-Stunden</dt>
        <dd class="figures__value">
          <template
            v-for="(part, index) in durationParts(figures.questMinutes)"
            :key="index"
            >{{ index ? " " : "" }}{{ part.value }} <span class="figures__unit">{{ part.unit }}</span></template
          >
        </dd>
        <template v-if="figures.targetMinutes !== null">
          <dd class="figures__note">
            von {{ formatDuration(figures.targetMinutes) }} Wochenziel
          </dd>
          <dd class="figures__goal">
            <span
              class="figures__bar"
              role="progressbar"
              aria-label="Quest-Stunden gegen das Wochenziel"
              :aria-valuenow="figures.questMinutes"
              aria-valuemin="0"
              :aria-valuemax="figures.targetMinutes"
              :aria-valuetext="`${formatDuration(figures.questMinutes)} von ${formatDuration(figures.targetMinutes)}`"
            >
              <span :style="{ width: `${filled}%` }" />
            </span>
            <span class="figures__percent">{{ figures.targetPercent }} % vom Ziel</span>
          </dd>
        </template>
      </div>
      <div class="figures__item">
        <dt class="card-title">Tagesschnitt</dt>
        <dd class="figures__value">
          <template v-for="(part, index) in average" :key="index"
            >{{ index ? " " : "" }}{{ part.value }} <span class="figures__unit">{{ part.unit }}</span></template
          >
        </dd>
        <dd class="figures__note">{{ averageNote }}</dd>
      </div>
      <div class="figures__item">
        <dt class="card-title">Quest-Arbeit</dt>
        <dd class="figures__value">
          <template v-for="(part, index) in share" :key="index"
            >{{ part.value }} <span class="figures__unit">{{ part.unit }}</span></template
          >
        </dd>
        <dd class="figures__note">
          {{
            measured
              ? `von ${formatDuration(measured)} gemessen`
              : "Noch nichts gemessen"
          }}
        </dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.figures dd {
  margin: 0;
}

/* Phone: one lifted card, the quest hours over the two smaller figures. */
.figures__list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  margin: 0;
  padding: var(--space-5) var(--space-4) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-card);
}

.figures__item {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.figures__item--hours {
  grid-column: 1 / -1;
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--color-line);
}

.figures__item .card-title {
  margin: 0;
}

.figures__value {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.figures__item--hours .figures__value {
  font-size: clamp(2rem, 9vw, 2.5rem);
  line-height: 1.05;
}

/* The unit sits smaller beside its number, so the number leads. */
.figures__unit {
  color: var(--color-ink-muted);
  font-size: 0.55em;
  font-weight: 700;
  letter-spacing: 0;
}

.figures__note,
.figures__percent {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.figures__goal {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: center;
  margin-top: var(--space-2);
}

.figures__bar {
  display: block;
  height: 0.5rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.figures__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
  transition: width 240ms var(--ease-out);
}

/*
 * From 40rem three equal cards in a row. The quest hours keep the lift: they
 * are what the week is measured by.
 */
@media (min-width: 40rem) {
  .figures__list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    padding: 0;
    background: none;
    box-shadow: none;
  }

  .figures__item,
  .figures__item--hours {
    grid-column: auto;
    padding: var(--space-4) var(--space-5) var(--space-5);
    border: 0;
    border-radius: var(--radius-card);
    background: var(--color-surface);
  }

  .figures__item--hours {
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-card);
  }

  .figures__item .figures__value {
    margin-top: var(--space-2);
    font-size: clamp(1.625rem, 3.4vw, 2.25rem);
    line-height: 1.1;
  }

  /* The goal sits on the cards' common bottom edge. */
  .figures__goal {
    margin-top: auto;
    padding-top: var(--space-3);
  }
}
</style>
