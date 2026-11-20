<script setup lang="ts">
import { computed, ref, useId } from "vue";
import AppIcon from "./AppIcon.vue";
import CampaignChip from "./CampaignChip.vue";
import type { WeekReviewItem, WeekReviewResponse } from "../types/week-review";
import { shortDate, weekdayName } from "../utils/history";

const props = defineProps<{
  days: WeekReviewResponse["days"];
  /** Marks this day in the week, when the week holds it. */
  today?: string;
}>();

/** Up to this many entries a wide screen shows the list open. */
const SHORT_LIST = 8;

/*
 * All seven days, Monday to Sunday: on a wide screen each keeps its column,
 * an empty one with a quiet dash. Narrower, the days stack and only those
 * with something on them show (the empty ones are hidden by CSS).
 */
const groups = computed(() =>
  props.days.map((day) => ({
    ...day,
    done: day.items.filter((item) => item.status === "completed").length,
    isToday: day.date === props.today,
  })),
);
const anyEntries = computed(() => groups.value.some((day) => day.items.length));
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
    <p v-if="!anyEntries" class="done-list__none">
      In dieser Woche ist nichts erledigt.
    </p>
    <div v-else v-show="open" :id="listId" class="done-list__days">
      <div
        v-for="day in groups"
        :key="day.date"
        class="done-list__day"
        :class="{
          'done-list__day--empty': !day.items.length,
          'done-list__day--today': day.isToday,
        }"
        :aria-current="day.isToday ? 'date' : undefined"
        :data-date="day.date"
      >
        <h3 class="done-list__date">
          <span class="done-list__weekday"
            >{{ day.isToday ? "Heute" : weekdayName(day.date)
            }}<span class="done-list__comma">, </span></span
          >
          <span class="done-list__day-date">{{ shortDate(day.date) }}</span
          >{{ day.items.length ? " " : ""
          }}<span v-if="day.items.length" class="count">{{ day.done }}</span>
        </h3>
        <p v-if="!day.items.length" class="done-list__empty">
          <span aria-hidden="true">–</span
          ><span class="visually-hidden">Nichts erledigt</span>
        </p>
        <ul v-else class="done-list__items">
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
                <span v-for="part in details(item)" :key="part">{{
                  part
                }}</span>
                <CampaignChip v-if="item.campaign" :campaign="item.campaign" />
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

/* Narrower than a week of columns: the days with entries, one under another. */
.done-list__days {
  display: grid;
  margin-top: var(--space-3);
  gap: var(--space-4);
}

.done-list__day--empty {
  display: none;
}

.done-list__date {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  align-items: baseline;
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 800;
}

.done-list__day-date {
  font-weight: 700;
}

.done-list__empty {
  margin: var(--space-2) 0 0;
  color: var(--color-ink-soft);
  font-weight: 700;
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
  gap: 0.125rem var(--space-3);
  align-items: center;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

/*
 * From 64rem the week as seven fixed columns, Monday to Sunday; empty days
 * keep their place. Today is marked like in the day bars: "Heute" and a
 * 2px ink line under its heading, never a frame.
 */
@media (min-width: 64rem) {
  .done-list__days {
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: var(--space-4) var(--space-3);
  }

  .done-list__day--empty {
    display: block;
  }

  .done-list__date {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    padding-bottom: var(--space-1);
    border-bottom: 1px solid var(--color-line);
  }

  .done-list__comma {
    display: none;
  }

  .done-list__day-date {
    grid-row: 2;
    color: var(--color-ink-muted);
    font-size: 0.8125rem;
  }

  .done-list__day--today .done-list__date {
    border-bottom: 2px solid var(--color-ink);
  }

  .done-list__item {
    grid-template-columns: 1rem minmax(0, 1fr);
    gap: var(--space-2);
  }

  .done-list__state {
    width: 1rem;
    height: 1rem;
  }

  .done-list__title {
    font-size: 0.875rem;
  }

  .done-list__meta {
    font-size: 0.8125rem;
  }
}
</style>
