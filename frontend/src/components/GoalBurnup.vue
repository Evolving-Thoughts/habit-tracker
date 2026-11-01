<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getBurnup } from "../api/todo-hierarchy.api";
import type { BurnupPoint } from "../types/todo-hierarchy";
import { formatDateForGermanDisplay } from "../utils/date";

const props = defineProps<{ todoId: number }>();

const WIDTH = 320;
const HEIGHT = 160;
const PADDING = 12;

const points = ref<BurnupPoint[]>([]);
const loading = ref(true);
const error = ref("");
const chart = ref<"burnup" | "burndown">("burnup");
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
const unitLabel = computed(() => (unit.value === "count" ? "Todos" : "Min."));
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

const lines = computed(() =>
  chart.value === "burnup"
    ? [
        {
          name: "Gesamtumfang",
          color: "#7a8496",
          dash: "5 4",
          values: series.value.map((point) => point.total),
        },
        {
          name: "Erledigt",
          color: "#198754",
          dash: undefined,
          values: series.value.map((point) => point.done),
        },
      ]
    : [
        {
          name: "Verbleibend",
          color: "#b42318",
          dash: undefined,
          values: series.value.map((point) => point.remaining),
        },
      ],
);

onMounted(async () => {
  try {
    points.value = await getBurnup(props.todoId);
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Der Verlauf konnte nicht geladen werden.";
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="burnup">
    <p v-if="loading" role="status">Verlauf wird geladen …</p>
    <p v-else-if="error" class="burnup__error" role="alert">{{ error }}</p>
    <template v-else-if="latest">
      <div class="burnup__controls">
        <button
          type="button"
          :aria-pressed="chart === 'burnup'"
          @click="chart = 'burnup'"
        >
          Burnup
        </button>
        <button
          type="button"
          :aria-pressed="chart === 'burndown'"
          @click="chart = 'burndown'"
        >
          Burndown
        </button>
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
      <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        :aria-label="`${latest.done} von ${latest.total} ${unitLabel} erledigt`"
      >
        <line
          :x1="PADDING"
          :x2="WIDTH - PADDING"
          :y1="y(0)"
          :y2="y(0)"
          stroke="#d9dde5"
        />
        <template v-for="item in lines" :key="item.name">
          <polyline
            :points="line(item.values)"
            fill="none"
            :stroke="item.color"
            stroke-width="2"
            :stroke-dasharray="item.dash"
          />
          <circle
            v-for="(value, index) in item.values"
            :key="index"
            :cx="x(index)"
            :cy="y(value)"
            r="2.5"
            :fill="item.color"
          />
        </template>
      </svg>
      <ul class="burnup__legend">
        <li v-for="item in lines" :key="item.name">
          <span :style="{ background: item.color }" />{{ item.name }}
        </li>
      </ul>
      <p>
        {{ latest.done }} von {{ latest.total }} {{ unitLabel }} erledigt,
        {{ latest.remaining }} verbleibend. Stand
        {{ formatDateForGermanDisplay(latest.date) }}, seit
        {{ formatDateForGermanDisplay(series[0].date) }}.
      </p>
      <small v-if="unit === 'minutes'">
        Minuten zählen nur Todos mit geplanter Dauer.
      </small>
    </template>
  </section>
</template>

<style scoped>
.burnup {
  display: grid;
  gap: 0.75rem;
}

.burnup p {
  margin: 0;
}

.burnup svg {
  width: 100%;
  height: auto;
}

.burnup__controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.burnup__controls button {
  min-height: 2.75rem;
  padding: 0 0.75rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
  cursor: pointer;
}

.burnup__controls button[aria-pressed="true"] {
  background: #eef1f5;
  font-weight: 600;
}

.burnup__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.burnup__legend span {
  display: inline-block;
  width: 0.75rem;
  height: 0.75rem;
  margin-right: 0.375rem;
  border-radius: 50%;
}

.burnup__error {
  color: #b42318;
}
</style>
