<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getBurnup } from "../api/todo-hierarchy.api";
import type { BurnupPoint } from "../types/todo-hierarchy";
import { formatDateForGermanDisplay } from "../utils/date";
import AppIcon from "./AppIcon.vue";

const props = defineProps<{ todoId: number }>();

const WIDTH = 320;
const HEIGHT = 160;
const PADDING = 12;

const points = ref<BurnupPoint[]>([]);
const loading = ref(true);
const error = ref("");
const chart = ref<"done" | "remaining">("done");
const unit = ref<"count" | "minutes">("count");

const series = computed(() =>
  points.value.map((point) => {
    const done = unit.value === "count" ? point.doneCount : point.doneMinutes;
    const total =
      unit.value === "count" ? point.totalCount : point.totalMinutes;
    return { date: point.date, done, total, remaining: total - done };
  }),
);
const latest = computed(() => series.value[series.value.length - 1]);
const unitLabel = computed(() =>
  unit.value === "count" ? "Aufgaben" : "Min.",
);
const top = computed(() =>
  Math.max(1, ...series.value.map((point) => point.total)),
);

function x(index: number): number {
  const steps = Math.max(1, series.value.length - 1);
  return PADDING + (index / steps) * (WIDTH - 2 * PADDING);
}
function y(value: number): number {
  return HEIGHT - PADDING - (value / top.value) * (HEIGHT - 2 * PADDING);
}
function line(values: number[]): string {
  return values.map((value, index) => `${x(index)},${y(value)}`).join(" ");
}
function shortDate(isoDate: string): string {
  return formatDateForGermanDisplay(isoDate).slice(0, 6);
}

// Ink carries the real progress; the dashed, muted line is the scope to reach.
const lines = computed(() =>
  chart.value === "done"
    ? [
        {
          name: "Gesamtumfang",
          tone: "scope",
          values: series.value.map((point) => point.total),
        },
        {
          name: "Erledigt",
          tone: "actual",
          values: series.value.map((point) => point.done),
        },
      ]
    : [
        {
          name: "Noch offen",
          tone: "actual",
          values: series.value.map((point) => point.remaining),
        },
      ],
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = "";
  try {
    points.value = await getBurnup(props.todoId);
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Der Fortschritt konnte nicht geladen werden.";
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

<template>
  <section class="burnup" aria-label="Fortschritt zum Ziel">
    <div
      v-if="loading"
      class="skeleton burnup__skeleton"
      role="status"
      aria-label="Fortschritt wird geladen"
    >
      <span /><span /><span />
    </div>
    <div v-else-if="error" class="alert" role="alert">
      <p>{{ error }}</p>
      <button class="btn btn--ground" type="button" @click="load">
        <AppIcon name="refresh" />Erneut versuchen
      </button>
    </div>
    <template v-else-if="latest">
      <div class="burnup__controls">
        <div class="segmented" role="group" aria-label="Ansicht">
          <button
            type="button"
            :aria-pressed="chart === 'done'"
            @click="chart = 'done'"
          >
            Erledigt
          </button>
          <button
            type="button"
            :aria-pressed="chart === 'remaining'"
            @click="chart = 'remaining'"
          >
            Noch offen
          </button>
        </div>
        <div class="segmented" role="group" aria-label="Einheit">
          <button
            type="button"
            :aria-pressed="unit === 'count'"
            @click="unit = 'count'"
          >
            Anzahl
          </button>
          <button
            type="button"
            :aria-pressed="unit === 'minutes'"
            @click="unit = 'minutes'"
          >
            Minuten
          </button>
        </div>
      </div>
      <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        :aria-label="`${latest.done} von ${latest.total} ${unitLabel} erledigt`"
      >
        <line
          class="burnup__axis"
          :x1="PADDING"
          :x2="WIDTH - PADDING"
          :y1="y(0)"
          :y2="y(0)"
        />
        <template v-for="item in lines" :key="item.name">
          <polyline
            :class="`burnup__line burnup__line--${item.tone}`"
            :points="line(item.values)"
          />
          <circle
            v-for="(value, index) in item.values"
            :key="index"
            :class="`burnup__dot burnup__dot--${item.tone}`"
            :cx="x(index)"
            :cy="y(value)"
            r="2.5"
          />
        </template>
      </svg>
      <ul class="burnup__legend">
        <li v-for="item in lines" :key="item.name">
          <span
            :class="`burnup__swatch burnup__swatch--${item.tone}`"
            aria-hidden="true"
          />{{ item.name }}
        </li>
      </ul>
      <p class="burnup__summary">
        {{ latest.done }} von {{ latest.total }} {{ unitLabel }} erledigt,
        {{ latest.remaining }} noch offen. Stand {{ shortDate(latest.date) }},
        seit {{ shortDate(series[0]!.date) }}.
      </p>
      <p v-if="unit === 'minutes'" class="burnup__note">
        Minuten zählen nur Aufgaben mit geplanter Dauer.
      </p>
    </template>
  </section>
</template>

<style scoped>
.burnup {
  display: grid;
  gap: var(--space-3);
}

.burnup p {
  margin: 0;
}

.burnup svg {
  width: 100%;
  height: auto;
}

.burnup__skeleton > span {
  height: 3rem;
  background: var(--color-action-tint);
}

.burnup__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.burnup__axis {
  stroke: var(--color-line);
  stroke-width: 1;
}

.burnup__line {
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.burnup__line--actual {
  stroke: var(--color-ink);
}

.burnup__line--scope {
  stroke: var(--color-ink-muted);
  stroke-dasharray: 5 4;
}

.burnup__dot--actual {
  fill: var(--color-ink);
}

.burnup__dot--scope {
  fill: var(--color-ink-muted);
}

.burnup__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  margin: 0;
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  list-style: none;
}

.burnup__legend li {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
}

.burnup__swatch {
  display: inline-block;
  width: 1.25rem;
  border-top: 2px solid var(--color-ink);
}

.burnup__swatch--scope {
  border-top: 2px dashed var(--color-ink-muted);
}

.burnup__summary {
  font-variant-numeric: tabular-nums;
}

.burnup__note {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
</style>
