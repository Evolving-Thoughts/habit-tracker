<script setup lang="ts">
import { computed } from "vue";
import { campaignMark } from "../utils/category-mark";
import {
  HOUR_REM,
  MIN_BLOCK_MINUTES,
  axisHours,
  formatDuration,
  layoutLane,
  logLabel,
  logTimes,
  type AxisBlock,
  type LogBlock,
  type PlanBlock,
} from "../utils/logbook";

const props = defineProps<{
  plan: PlanBlock[];
  /** The Logbuch lane; null for a day still ahead. */
  logs: LogBlock[] | null;
}>();
const emit = defineEmits<{ edit: [logId: number] }>();

const hours = computed(() =>
  axisHours([...props.plan, ...(props.logs ?? [])]),
);
const hourMarks = computed(() =>
  Array.from(
    { length: hours.value.to - hours.value.from + 1 },
    (_, index) => hours.value.from + index,
  ),
);
const planBlocks = computed(() => layoutLane(props.plan));
const logBlocks = computed(() => layoutLane(props.logs ?? []));
/** A short block late at night is drawn past the last hour line. */
const overflow = computed(() =>
  Math.max(
    0,
    ...[...props.plan, ...(props.logs ?? [])].map(
      (block) =>
        Math.max(block.end, block.start + MIN_BLOCK_MINUTES) -
        hours.value.to * 60,
    ),
  ),
);

function place(block: AxisBlock & { column: number; columns: number }) {
  return {
    "--top": block.start - hours.value.from * 60,
    "--length": block.end - block.start,
    "--column": block.column,
    "--columns": block.columns,
  };
}
const stripe = (block: LogBlock) =>
  campaignMark(block.log.campaign) ?? "var(--color-mark-none)";
</script>

<template>
  <div
    class="day-timeline"
    :class="{ 'day-timeline--plan-only': !logs }"
    :style="{
      '--hour': `${HOUR_REM}rem`,
      '--hours': hours.to - hours.from,
      '--overflow': overflow,
    }"
  >
    <div class="day-timeline__head" aria-hidden="true">
      <span>Plan</span>
      <span v-if="logs">Logbuch</span>
    </div>
    <div class="day-timeline__axis">
      <div class="day-timeline__hours" aria-hidden="true">
        <span
          v-for="hour in hourMarks"
          :key="hour"
          :style="{ '--at': hour - hours.from }"
          >{{ String(hour).padStart(2, "0") }}:00</span
        >
      </div>
      <ol class="day-timeline__lane" aria-label="Plan">
        <li
          v-for="block in planBlocks"
          :key="block.key"
          class="day-timeline__slot"
          :style="place(block)"
        >
          <div class="plan-block">
            <strong class="day-timeline__title">{{ block.title }}</strong>
            <span class="day-timeline__meta"
              >{{ block.time
              }}<span v-if="block.source === 'event'" class="visually-hidden">
                · Google Kalender</span
              ></span
            >
          </div>
        </li>
      </ol>
      <ol v-if="logs" class="day-timeline__lane" aria-label="Logbuch">
        <li
          v-for="block in logBlocks"
          :key="block.key"
          class="day-timeline__slot"
          :style="place(block)"
        >
          <button
            type="button"
            class="log-block"
            :style="{ '--campaign-mark': stripe(block) }"
            :aria-label="`${logLabel(block.log)}, korrigieren`"
            @click="emit('edit', block.log.id)"
          >
            <strong class="day-timeline__title">{{ block.log.title }}</strong>
            <span class="day-timeline__meta"
              >{{ formatDuration(block.log.minutes) }} ·
              {{ logTimes(block.log) }}</span
            >
          </button>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.day-timeline {
  --minute: calc(var(--hour) / 60);
  --columns-template: 2.75rem minmax(0, 1fr) minmax(0, 1fr);

  display: grid;
  gap: var(--space-2);
}

.day-timeline--plan-only {
  --columns-template: 2.75rem minmax(0, 1fr);
}

.day-timeline__head {
  display: grid;
  grid-template-columns: var(--columns-template);
  gap: var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.day-timeline__head > :first-child {
  grid-column: 2;
}

.day-timeline__axis {
  position: relative;
  display: grid;
  grid-template-columns: var(--columns-template);
  gap: var(--space-2);
  height: calc(var(--hours) * var(--hour));
  /* Room for the first label above the first line and blocks drawn past the last. */
  margin: 0.5rem 0 calc(var(--overflow) * var(--minute));
}

.day-timeline__hours {
  position: relative;
}

.day-timeline__hours > span {
  position: absolute;
  top: calc(var(--at) * var(--hour));
  right: 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transform: translateY(-50%);
}

.day-timeline__lane {
  position: relative;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--color-line);
  background: repeating-linear-gradient(
    to bottom,
    transparent 0 calc(var(--hour) - 1px),
    var(--color-line) calc(var(--hour) - 1px) var(--hour)
  );
}

/* Never smaller than a tap target, so a short stretch can still be reached. */
.day-timeline__slot {
  position: absolute;
  top: calc(var(--top) * var(--minute));
  left: calc(var(--column) / var(--columns) * 100%);
  width: calc(100% / var(--columns));
  height: max(calc(var(--tap) + 2px), calc(var(--length) * var(--minute)));
  padding: 1px;
}

.plan-block,
.log-block {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: hidden;
  padding: 0.25rem 0.375rem 0.25rem 0.625rem;
  border-radius: 0.625rem;
  color: var(--color-ink);
  text-align: left;
}

/* Planned, not done: the half-white of appointments elsewhere. */
.plan-block {
  background: rgb(255 255 255 / 55%);
}

.log-block {
  border: 0;
  background: var(--color-surface);
  box-shadow: inset 0.3125rem 0 0 var(--campaign-mark);
  font: inherit;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.log-block:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.day-timeline__title {
  overflow: hidden;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day-timeline__meta {
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
