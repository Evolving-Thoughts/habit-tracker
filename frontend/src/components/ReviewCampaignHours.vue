<script setup lang="ts">
import { computed } from "vue";
import type { QuestHoursResponse } from "../types/quest-hours";
import { againstTarget } from "../utils/quest-hours";
import { campaignHourRows } from "../utils/week-review";

const props = defineProps<{ hours: QuestHoursResponse }>();

const rows = computed(() => campaignHourRows(props.hours));
</script>

<template>
  <section
    v-if="rows.length"
    class="campaign-hours card"
    aria-labelledby="review-campaign-hours-title"
  >
    <h2 id="review-campaign-hours-title" class="card-title">
      Stunden je Kampagne
    </h2>
    <ul class="campaign-hours__rows">
      <li
        v-for="row in rows"
        :key="row.id"
        class="campaign-hours__row"
        :data-campaign-id="row.id"
        :style="{ '--row-mark': row.mark }"
      >
        <span class="campaign-hours__name">
          <i class="campaign-hours__swatch" aria-hidden="true" />{{ row.title }}
        </span>
        <span class="campaign-hours__time">{{
          againstTarget(row.minutes, row.targetMinutes)
        }}</span>
        <!-- One scale for every row; the tick is the campaign's weekly goal. -->
        <span class="campaign-hours__track" aria-hidden="true">
          <span class="campaign-hours__bar" :style="{ width: `${row.width}%` }" />
          <span
            v-if="row.targetAt !== null"
            class="campaign-hours__goal"
            :style="{ left: `${row.targetAt}%` }"
          />
        </span>
      </li>
    </ul>
    <p
      v-if="rows.some((row) => row.targetAt !== null)"
      class="campaign-hours__legend"
    >
      <i class="campaign-hours__tick" aria-hidden="true" />Strich: Wochenziel
      der Kampagne
    </p>
  </section>
</template>

<style scoped>
.campaign-hours__rows {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.campaign-hours__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-1) var(--space-3);
  align-items: baseline;
}

.campaign-hours__name {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  font-size: 0.9375rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.campaign-hours__swatch {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
  background: var(--row-mark);
}

.campaign-hours__time {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.campaign-hours__track {
  position: relative;
  grid-column: 1 / -1;
  height: 0.5rem;
  margin-top: var(--space-1);
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.campaign-hours__bar {
  display: block;
  height: 100%;
  min-width: 0;
  border-radius: inherit;
  background: var(--row-mark);
  transition: width 240ms var(--ease-out);
}

.campaign-hours__goal {
  position: absolute;
  top: -0.25rem;
  bottom: -0.25rem;
  width: 2px;
  margin-left: -1px;
  border-radius: 1px;
  background: var(--color-ink);
}

.campaign-hours__legend {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: var(--space-4) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
}

.campaign-hours__tick {
  display: inline-block;
  width: 2px;
  height: 0.875rem;
  border-radius: 1px;
  background: var(--color-ink);
}
</style>
