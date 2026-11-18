<script setup lang="ts">
import { computed } from "vue";
import { formatDateForGermanDisplay } from "../utils/date";
import { trendText } from "../utils/quest-hours";

const props = defineProps<{
  /** Minutes of each week, oldest first. */
  weeks: number[];
  /** The Monday of each week, in the same order. */
  starts: string[];
  /** The campaign's mark; the line is drawn in it. */
  mark: string;
}>();

const WIDTH = 240;
const HEIGHT = 40;
const PADDING = 4;

const top = computed(() => Math.max(1, ...props.weeks));
const points = computed(() =>
  props.weeks.map((minutes, index) => ({
    x:
      PADDING +
      (index / Math.max(1, props.weeks.length - 1)) * (WIDTH - 2 * PADDING),
    y: HEIGHT - PADDING - (minutes / top.value) * (HEIGHT - 2 * PADDING),
  })),
);
const line = computed(() =>
  points.value.map(({ x, y }) => `${x},${y}`).join(" "),
);
const label = computed(() =>
  trendText(props.weeks, props.starts, (date) =>
    formatDateForGermanDisplay(date).slice(0, 6),
  ),
);
</script>

<template>
  <svg
    class="quest-trend"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    preserveAspectRatio="none"
    role="img"
    :aria-label="label"
    :style="{ '--trend-mark': mark }"
  >
    <line
      class="quest-trend__axis"
      :x1="PADDING"
      :x2="WIDTH - PADDING"
      :y1="HEIGHT - PADDING"
      :y2="HEIGHT - PADDING"
    />
    <polyline class="quest-trend__line" :points="line" />
  </svg>
</template>

<style scoped>
.quest-trend {
  display: block;
  /* A fixed height at any width: the line stretches, its stroke does not. */
  width: 100%;
  height: 2.5rem;
  overflow: visible;
}

.quest-trend__axis {
  stroke: var(--color-line);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}

.quest-trend__line {
  fill: none;
  stroke: var(--trend-mark);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
</style>
