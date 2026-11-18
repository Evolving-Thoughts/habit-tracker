<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { formatDuration } from "../utils/today-agenda";
import { reviewFigures } from "../utils/week-review";

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
</script>

<template>
  <section class="figures card" aria-labelledby="review-figures-title">
    <h2 id="review-figures-title" class="visually-hidden">Kennzahlen</h2>
    <div class="figures__lead">
      <p class="figures__label">Quest-Stunden</p>
      <p class="figures__value">{{ formatDuration(figures.questMinutes) }}</p>
      <p v-if="figures.targetMinutes !== null" class="figures__note">
        von {{ formatDuration(figures.targetMinutes) }} Wochenziel ·
        {{ figures.targetPercent }} %
      </p>
      <p v-else class="figures__note">Ohne Wochenziel</p>
      <div
        v-if="figures.targetMinutes !== null"
        class="figures__bar"
        role="progressbar"
        aria-label="Quest-Stunden gegen das Wochenziel"
        :aria-valuenow="figures.questMinutes"
        aria-valuemin="0"
        :aria-valuemax="figures.targetMinutes"
        :aria-valuetext="`${formatDuration(figures.questMinutes)} von ${formatDuration(figures.targetMinutes)}`"
      >
        <span :style="{ width: `${filled}%` }" />
      </div>
    </div>
    <dl class="figures__more">
      <div class="figures__stat">
        <dt class="figures__label">Tagesschnitt</dt>
        <dd class="figures__number">
          {{
            figures.dailyAverage === null
              ? "–"
              : formatDuration(figures.dailyAverage)
          }}
        </dd>
        <dd class="figures__note">{{ averageNote }}</dd>
      </div>
      <div class="figures__stat">
        <dt class="figures__label">Anteil Quest-Arbeit</dt>
        <dd class="figures__number">
          {{ figures.questShare === null ? "–" : `${figures.questShare} %` }}
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
.figures {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
}

.figures p,
.figures dl,
.figures dd {
  margin: 0;
}

.figures__lead {
  display: grid;
  gap: var(--space-1);
}

.figures__label {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.figures__value {
  font-size: clamp(2rem, 9vw, 2.75rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.figures__note {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.figures__bar {
  height: 0.625rem;
  margin-top: var(--space-2);
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

.figures__more {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-4);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.figures__stat {
  display: grid;
  gap: 0.125rem;
  align-content: start;
  min-width: 0;
}

.figures__number {
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
</style>
