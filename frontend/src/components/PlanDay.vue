<script setup lang="ts">
import { computed, ref } from "vue";
import PlanEntry from "./PlanEntry.vue";
import QuickAddQuest from "./QuickAddQuest.vue";
import { useSortable } from "../composables/useSortable";
import type { WeekPlanDay, WeekPlanEntry } from "../types/week-plan";
import { dayLabel, shortDate, weekdayName } from "../utils/history";
import type { MenuEntry } from "../utils/row-actions";
import {
  boardDrop,
  dayOrder,
  doneEntries,
  DRAGGABLE,
  entryKey,
  isMovable,
  isMovableRun,
  openEntries,
  openSummary,
  type BoardDrop,
} from "../utils/week-plan";

/**
 * One day of the Plan: a quick add on top, its open rows in the order of
 * the day, then what is done. Open quests are dragged by the whole card
 * within the day, onto another day of the board or into the Questlog
 * column; a daily's stored run within the day or onto another day of its
 * window. For keys and taps the focused card's arrow keys and its menu,
 * which the view builds, do the same.
 */
const props = defineProps<{
  day: WeekPlanDay;
  today: string;
  busy: boolean;
  /** "Aktionen für …" of an open entry (empty for none). */
  menu: (entry: WeekPlanEntry) => MenuEntry[];
}>();

const emit = defineEmits<{
  edit: [entry: WeekPlanEntry];
  arrow: [entry: WeekPlanEntry, key: "up" | "down" | "left" | "right"];
  /** A card of this day was dropped on a day or into the Questlog column. */
  move: [drop: BoardDrop];
  created: [];
}>();

const open = computed(() => openEntries(props.day));
const done = computed(() => doneEntries(props.day));
const summary = computed(() => openSummary(props.day));
const isToday = computed(() => props.day.date === props.today);
const headingId = computed(() => `plan-day-${props.day.date}`);

const list = ref<HTMLElement | null>(null);
useSortable(list, {
  item: DRAGGABLE,
  group: "week-plan",
  accepts: () => !props.busy,
  onMove: (_from, _to, { item, list: target, index }) => {
    const drop = boardDrop(item, target, index);
    if (drop && !props.busy) emit("move", drop);
  },
});
</script>

<template>
  <section
    class="plan-day"
    :class="{ 'plan-day--today': isToday }"
    :aria-labelledby="headingId"
    :aria-current="isToday ? 'date' : undefined"
    :data-date="day.date"
  >
    <header class="plan-day__header">
      <h2 :id="headingId" class="plan-day__title">
        <span>{{ weekdayName(day.date) }}</span>
        <span class="plan-day__date">{{ shortDate(day.date) }}</span>
        <span v-if="isToday" class="plan-day__today">Heute</span>
      </h2>
      <!-- Each figure stays with its words when a narrow column wraps the line. -->
      <p v-if="summary" class="plan-day__summary">
        <template v-for="(part, index) in summary.split(' · ')" :key="index"
          >{{ index ? " · " : "" }}<span class="plan-day__figure">{{
            part
          }}</span></template
        >
      </p>
    </header>

    <QuickAddQuest
      class="plan-day__add"
      :date="day.date"
      :order="dayOrder(open)"
      :label="`Quest für ${dayLabel(day.date)} hinzufügen`"
      @created="emit('created')"
    />

    <ol
      ref="list"
      class="plan-day__list"
      :data-date="day.date"
      :aria-label="`Offen am ${dayLabel(day.date)}`"
    >
      <li
        v-for="entry in open"
        :key="entryKey(entry, day.date)"
        :data-focus-key="entryKey(entry, day.date)"
        :data-todo-id="isMovable(entry) ? entry.todoId : undefined"
        :data-run-id="isMovableRun(entry) ? entry.occurrenceId : undefined"
      >
        <PlanEntry
          :entry="entry"
          :busy="busy"
          :menu="menu(entry)"
          :arrows="isMovable(entry) || isMovableRun(entry)"
          @edit="emit('edit', entry)"
          @arrow="(key) => emit('arrow', entry, key)"
        />
      </li>
      <li v-if="!open.length" class="plan-day__empty">Noch frei.</li>
    </ol>

    <ol
      v-if="done.length"
      class="plan-day__list plan-day__list--done"
      :aria-label="`Erledigt am ${dayLabel(day.date)}`"
    >
      <li
        v-for="entry in done"
        :key="entryKey(entry, day.date)"
        :data-focus-key="entryKey(entry, day.date)"
      >
        <PlanEntry :entry="entry" :busy="busy" @edit="emit('edit', entry)" />
      </li>
    </ol>
  </section>
</template>

<style scoped>
/* Slim side padding: in a desktop column every pixel goes to the titles. */
.plan-day {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3) 0.375rem 0.375rem;
  border-radius: var(--radius-card);
  background: var(--color-surface-faint);
}

/* Today wears the calendar's ink frame. */
.plan-day--today {
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

/* Text lines up with the titles of the rows below. */
.plan-day__header {
  padding: 0 0.625rem;
}

.plan-day__title {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  align-items: baseline;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.3;
}

.plan-day__date {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.plan-day__today {
  font-size: 0.875rem;
  font-weight: 800;
}

.plan-day__summary {
  margin: 0.125rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.plan-day__figure {
  white-space: nowrap;
}

.plan-day__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* The open list is also where drops land, so it never collapses. */
.plan-day__list:not(.plan-day__list--done) {
  min-height: var(--tap);
  align-content: start;
}

.plan-day__list--done {
  opacity: 0.85;
}

.plan-day__empty {
  padding: var(--space-2) 0.625rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.plan-day__add {
  margin: 0;
}

.plan-day__add :deep(.input) {
  min-height: var(--tap);
  border-color: transparent;
  background: var(--color-surface-quiet);
  font-size: 0.9375rem;
}

/* A finger's field: 16px, so a phone does not zoom in on focus. */
@media (max-width: 39.99rem), (pointer: coarse) {
  .plan-day__add :deep(.input) {
    font-size: 1rem;
  }
}

.plan-day__add :deep(.input:focus) {
  border-color: var(--color-line);
  background: var(--color-surface);
}
</style>
