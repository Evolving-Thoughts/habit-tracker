<script setup lang="ts">
import { computed, useId } from "vue";
import AppIcon from "./AppIcon.vue";
import type { PerfectWeek, WeekQuota } from "../types/history";
import { categoryMark } from "../utils/category-mark";

/*
 * The week's Dailies against what was due, and the perfect week, shared by
 * the calendar's week and the weekly review.
 */
const props = withDefaults(
  defineProps<{
    quota: WeekQuota | null;
    perfectWeek: PerfectWeek | null;
    /**
     * In the weekly review: two flat cards side by side, each titled inside
     * like the dashboard above. The calendar lifts the quota instead.
     */
    dashboard?: boolean;
  }>(),
  { dashboard: false },
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
  <div
    v-if="shownQuota || shownPerfectWeek"
    class="week-quota"
    :class="{ 'week-quota--dashboard': dashboard }"
  >
    <section
      v-if="shownQuota"
      class="quota card"
      :class="{ 'quota--lifted': !dashboard }"
      :aria-labelledby="`${id}-quota`"
    >
      <component
        :is="dashboard ? 'h2' : 'p'"
        :id="`${id}-quota`"
        class="card-title"
        >Dailies im Wochensoll</component
      >
      <p class="quota__value">
        {{ shownQuota.completed }} von {{ shownQuota.total }}
      </p>
      <!-- Reads on from the number: "5 von 8 fälligen Ausführungen erledigt". -->
      <p class="quota__note">fälligen Ausführungen erledigt</p>
      <div
        class="quota__bar"
        role="progressbar"
        :aria-labelledby="`${id}-quota`"
        :aria-valuenow="shownQuota.completed"
        aria-valuemin="0"
        :aria-valuemax="shownQuota.total"
        :aria-valuetext="`${shownQuota.completed} von ${shownQuota.total} fälligen Ausführungen erledigt`"
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
      :class="{ card: dashboard }"
      :aria-labelledby="`${id}-perfect`"
    >
      <h2
        :id="`${id}-perfect`"
        :class="dashboard ? 'card-title' : 'section-title'"
      >
        {{ shownPerfectWeek.perfect ? "Perfekte Woche!" : "Perfekte Woche" }}
      </h2>
      <ul class="rows" :class="{ card: !dashboard }">
        <li
          v-for="category in shownPerfectWeek.categories"
          :key="category.id"
          class="row"
        >
          <span class="row__name">
            <i
              class="swatch"
              :style="{ background: categoryMark(category.name, category.color) }"
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
  </div>
</template>

<style scoped>
/* In the calendar the two parts flow with the rest of the week. */
.week-quota {
  display: contents;
}

/* In the review they stand side by side; one alone takes the full width. */
.week-quota--dashboard {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--space-4);
  align-items: stretch;
}

.quota {
  display: grid;
  gap: var(--space-1);
  align-content: start;
  padding: var(--space-5);
}

.quota--lifted {
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-card);
}

.quota p {
  margin: 0;
}

.quota .card-title {
  margin: 0;
}

.quota__value {
  font-size: clamp(2.25rem, 10vw, 3rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.week-quota--dashboard .quota {
  padding: var(--space-4) var(--space-5) var(--space-5);
}

.week-quota--dashboard .quota__value {
  margin-top: var(--space-2);
  font-size: clamp(1.625rem, 3.4vw, 2.25rem);
}

.quota__note {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
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

.week-quota--dashboard .perfect-week {
  padding: var(--space-4) var(--space-5) var(--space-3);
}

.rows {
  display: grid;
  margin: 0;
  padding: var(--space-1) var(--space-4);
  list-style: none;
}

/* Inside its own card the list needs no second inset. */
.week-quota--dashboard .rows {
  padding: 0;
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
