<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { formatDuration } from "../utils/today-agenda";
import { percentOf } from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const total = computed(() => props.hours.questMinutes + props.hours.otherMinutes);
const parts = computed(() => [
  {
    key: "quest",
    name: "Kampagnen-Arbeit",
    minutes: props.hours.questMinutes,
    share: percentOf(props.hours.questMinutes, total.value) ?? 0,
  },
  {
    key: "other",
    name: "Sonstiges",
    minutes: props.hours.otherMinutes,
    share: percentOf(props.hours.otherMinutes, total.value) ?? 0,
  },
]);
const label = computed(() =>
  parts.value
    .map((part) => `${part.name} ${formatDuration(part.minutes)}, ${part.share} %`)
    .join("; "),
);
</script>

<template>
  <section
    v-if="total"
    class="quest-split card"
    aria-labelledby="review-split-title"
  >
    <h2 id="review-split-title" class="card-title">
      Kampagnen-Arbeit gegen Sonstiges
    </h2>
    <div class="quest-split__bar" role="img" :aria-label="label">
      <span
        v-for="part in parts"
        :key="part.key"
        :class="[
          'quest-split__part',
          `quest-split__part--${part.key}`,
          { 'series-other': part.key === 'other' },
        ]"
        :style="{ flexGrow: part.minutes }"
      />
    </div>
    <!--
      Each part named right at its end of the bar: Kampagnen-Arbeit at the
      left, Sonstiges at the right, each with its key (solid or hatched) and
      its time. The share is the Kampagnen-Arbeit figure above.
    -->
    <ul class="quest-split__labels" aria-hidden="true">
      <li
        v-for="part in parts"
        :key="part.key"
        :class="`quest-split__label quest-split__label--${part.key}`"
      >
        <i
          :class="[
            'quest-split__key',
            `quest-split__part--${part.key}`,
            { 'series-other': part.key === 'other' },
          ]"
        />
        <span class="quest-split__name">{{ part.name }}</span>
        <strong>{{ formatDuration(part.minutes) }}</strong>
      </li>
    </ul>
    <p class="quest-split__note">Sonstiges ist gemessene Zeit ohne Kampagne.</p>
  </section>
</template>

<style scoped>
.quest-split__bar {
  display: flex;
  gap: 2px;
  height: 0.875rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
}

.quest-split__part {
  flex-basis: 0;
  min-width: 0;
}

.quest-split__part--quest {
  background: var(--color-bar);
}

/* Sonstiges is hatched (.series-other in style.css), lighter than the bar. */

.quest-split__labels {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  justify-content: space-between;
  margin: var(--space-2) 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
}

.quest-split__label {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  align-items: center;
  font-variant-numeric: tabular-nums;
}

/* Sonstiges ends where the bar ends, on the right. */
.quest-split__label--other {
  justify-content: flex-end;
  margin-left: auto;
  text-align: right;
}

.quest-split__key {
  flex: none;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 0.2rem;
}

.quest-split__key.series-other {
  box-shadow: inset 0 0 0 1px var(--color-mark-none);
}

.quest-split__name {
  font-weight: 700;
}

.quest-split__note {
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
}
</style>
