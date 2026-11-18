<script setup lang="ts">
import { computed, useId } from "vue";
import AppIcon from "./AppIcon.vue";
import type { PerfectWeek, WeekQuota } from "../types/history";
import { categoryMark } from "../utils/category-mark";

/* The week's quota and perfect week, shared by the calendar's week and the weekly review. */
const props = withDefaults(
  defineProps<{
    quota: WeekQuota | null;
    perfectWeek: PerfectWeek | null;
    /** The one lifted card of its view; the review lifts its key figures instead. */
    lifted?: boolean;
    /** Puts "Wochenquote" above the card, where nothing else introduces it. */
    titled?: boolean;
  }>(),
  { lifted: true, titled: false },
);

const id = useId();
const shownQuota = computed(() =>
  props.quota && props.quota.total > 0 ? props.quota : null,
);
const shownPerfectWeek = computed(() =>
  props.perfectWeek?.categories.length ? props.perfectWeek : null,
);
</script>

<template>
  <h2 v-if="titled && shownQuota" class="section-title">Wochenquote</h2>
  <section
    v-if="shownQuota"
    class="quota card"
    :class="{ 'quota--lifted': lifted }"
    :aria-labelledby="`${id}-quota`"
  >
    <p class="quota__value">
      {{ shownQuota.completed }} von {{ shownQuota.total }}
    </p>
    <p :id="`${id}-quota`" class="quota__label">Dailies der Woche</p>
    <div
      class="quota__bar"
      role="progressbar"
      :aria-labelledby="`${id}-quota`"
      :aria-valuenow="shownQuota.completed"
      aria-valuemin="0"
      :aria-valuemax="shownQuota.total"
    >
      <span
        :style="{
          width: `${Math.min(100, (shownQuota.completed / shownQuota.total) * 100)}%`,
        }"
      />
    </div>
  </section>

  <section
    v-if="shownPerfectWeek"
    class="perfect-week"
    :aria-labelledby="`${id}-perfect`"
  >
    <h2 :id="`${id}-perfect`" class="section-title">
      {{ shownPerfectWeek.perfect ? "Perfekte Woche!" : "Perfekte Woche" }}
    </h2>
    <ul class="rows card">
      <li
        v-for="category in shownPerfectWeek.categories"
        :key="category.id"
        class="row"
      >
        <span class="row__name">
          <i
            class="swatch"
            :style="{ background: categoryMark(category.name) }"
            aria-hidden="true"
          />{{ category.name }}
        </span>
        <span class="count"
          >{{ category.completed }} von {{ category.target }}</span
        >
        <span class="row__check">
          <template v-if="category.reached">
            <AppIcon name="check" />
            <span class="visually-hidden">erreicht</span>
          </template>
        </span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.quota {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-5);
}

.quota--lifted {
  box-shadow: var(--shadow-card);
}

.quota p {
  margin: 0;
}

.quota__value {
  font-size: clamp(2.25rem, 10vw, 3rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.quota__label {
  color: var(--color-ink-muted);
  font-weight: 700;
}

.quota__bar {
  height: 0.625rem;
  margin-top: var(--space-3);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.quota__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
}

.rows {
  display: grid;
  margin: 0;
  padding: var(--space-1) var(--space-4);
  list-style: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  align-items: center;
  min-height: var(--tap);
  padding: var(--space-2) 0;
}

.row + .row {
  border-top: 1px solid var(--color-line);
}

.row__name {
  display: inline-flex;
  flex: 1 1 10rem;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.row__check {
  display: inline-grid;
  width: 1.25rem;
  place-items: center;
  color: var(--color-ink);
}

.row__check :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2.6;
}

.swatch {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}
</style>
