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
        :class="`quest-split__part quest-split__part--${part.key}`"
        :style="{ flexGrow: part.minutes }"
      />
    </div>
    <!-- The share is the Kampagnen-Arbeit figure above; here the two times. -->
    <ul class="quest-split__legend" aria-hidden="true">
      <li v-for="part in parts" :key="part.key">
        <i :class="`quest-split__key quest-split__part--${part.key}`" />
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
  background: var(--color-ink);
}

.quest-split__part--other {
  background: var(--color-mark-none);
}

.quest-split__legend {
  display: grid;
  gap: var(--space-1);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
  font-size: 0.9375rem;
}

.quest-split__legend li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: center;
  font-variant-numeric: tabular-nums;
}

.quest-split__key {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
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
