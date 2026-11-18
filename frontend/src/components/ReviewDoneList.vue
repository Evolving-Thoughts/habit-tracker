<script setup lang="ts">
import { computed, ref, useId } from "vue";
import AppIcon from "./AppIcon.vue";
import type { WeekReviewItem, WeekReviewResponse } from "../types/week-review";
import { campaignMark } from "../utils/category-mark";
import { dayLabel } from "../utils/history";

const props = defineProps<{ days: WeekReviewResponse["days"] }>();

/** Up to this many entries a wide screen shows the list open. */
const SHORT_LIST = 8;

/* Only days with something on them; the rest would be empty headings. */
const groups = computed(() =>
  props.days
    .filter((day) => day.items.length)
    .map((day) => ({
      ...day,
      done: day.items.filter((item) => item.status === "completed").length,
    })),
);
const total = computed(() =>
  groups.value.reduce((sum, day) => sum + day.done, 0),
);
const entries = computed(() =>
  groups.value.reduce((sum, day) => sum + day.items.length, 0),
);
/* Skipped runs are listed too; the head names them, so the counts add up. */
const skipped = computed(() => entries.value - total.value);

/*
 * Decided once when the list appears: on a phone it starts closed with its
 * count, on a wide screen it is simply open unless it is long.
 */
const wide = window.matchMedia?.("(min-width: 56rem)").matches ?? false;
const collapsible = !wide || entries.value > SHORT_LIST;
const open = ref(!collapsible);
const listId = useId();

function details(item: WeekReviewItem): string[] {
  const parts: string[] = [];
  if (item.type === "habit") parts.push("Daily");
  if (item.status === "skipped") parts.push("Übersprungen");
  if (item.deleted) parts.push("Gelöscht");
  return parts;
}
</script>

<template>
  <section class="done-list card" aria-labelledby="review-done-title">
    <div class="card-head">
      <h2 id="review-done-title" class="card-title">
        Erledigt <span class="count">{{ total }}</span
        ><span v-if="skipped" class="count"> · {{ skipped }} übersprungen</span>
      </h2>
      <button
        v-if="collapsible && entries"
        type="button"
        class="btn"
        :aria-expanded="open"
        :aria-controls="listId"
        @click="open = !open"
      >
        {{ open ? "Liste ausblenden" : "Liste zeigen" }}
      </button>
    </div>
    <p v-if="!groups.length" class="done-list__none">
      In dieser Woche ist nichts erledigt.
    </p>
    <div v-else v-show="open" :id="listId" class="done-list__days">
      <div v-for="day in groups" :key="day.date" class="done-list__day">
        <h3 class="done-list__date">
          {{ dayLabel(day.date) }}
          <span class="count">{{ day.done }}</span>
        </h3>
        <ul class="done-list__items">
          <li
            v-for="item in day.items"
            :key="`${item.type}-${item.id}`"
            class="done-list__item"
            :class="{ 'done-list__item--skipped': item.status === 'skipped' }"
            :data-done-key="`${item.type}-${item.id}`"
          >
            <!-- A state, not a control: never the action orange. -->
            <span class="done-list__state" aria-hidden="true">
              <AppIcon v-if="item.status === 'completed'" name="check" />
            </span>
            <span class="done-list__text">
              <span class="done-list__title">{{ item.title }}</span>
              <span
                v-if="item.campaign || details(item).length"
                class="done-list__meta"
              >
                <span v-if="item.campaign" class="done-list__campaign">
                  <i
                    class="done-list__mark"
                    :style="{ background: campaignMark(item.campaign)! }"
                    aria-hidden="true"
                  />{{ item.campaign.title }}
                </span>
                <span v-for="part in details(item)" :key="part">{{
                  part
                }}</span>
              </span>
            </span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Closed, the head alone is the card; the space below belongs to the list. */
.done-list .card-head {
  min-height: var(--tap);
  margin-bottom: 0;
}

.done-list__none {
  margin: var(--space-2) 0 0;
  color: var(--color-ink-muted);
}

/* Days side by side where there is room, each a short list. */
.done-list__days {
  display: grid;
  margin-top: var(--space-3);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 17rem), 1fr));
  gap: var(--space-4) var(--space-5);
}

.done-list__date {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 800;
}

.done-list__items {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.done-list__item {
  display: grid;
  grid-template-columns: 1.25rem minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-2) 0;
}

.done-list__item + .done-list__item {
  border-top: 1px solid var(--color-line);
}

.done-list__state {
  display: grid;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.125rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-ink-muted);
  color: var(--color-surface);
}

.done-list__state :deep(svg) {
  width: 0.8125rem;
  height: 0.8125rem;
  stroke-width: 3.5;
}

.done-list__item--skipped .done-list__state {
  border: 1.5px dashed var(--color-ink-soft);
  background: transparent;
}

.done-list__text {
  display: grid;
  min-width: 0;
}

.done-list__title {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.done-list__item--skipped .done-list__title {
  color: var(--color-ink-muted);
}

.done-list__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.done-list__campaign {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  font-weight: 700;
}

.done-list__mark {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}
</style>
