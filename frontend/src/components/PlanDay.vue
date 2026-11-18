<script setup lang="ts">
import { computed, ref } from "vue";
import PlanEntry from "./PlanEntry.vue";
import QuickAddQuest from "./QuickAddQuest.vue";
import { useSortable } from "../composables/useSortable";
import type { WeekPlanDay, WeekPlanTodoEntry } from "../types/week-plan";
import { dayLabel, shortDate, weekdayName } from "../utils/history";
import {
  dayOrder,
  doneEntries,
  entryKey,
  isMovable,
  openEntries,
  openSummary,
  type Drop,
} from "../utils/week-plan";

/**
 * One day of the week plan: its open rows in the order of the day, a quick
 * add, then what is done. Open quests are dragged within the day or onto
 * another day of the same board.
 */
const props = defineProps<{
  day: WeekPlanDay;
  today: string;
  busy: boolean;
}>();

const emit = defineEmits<{
  edit: [entry: WeekPlanTodoEntry];
  move: [entry: WeekPlanTodoEntry];
  arrow: [entry: WeekPlanTodoEntry, key: "up" | "down" | "left" | "right"];
  drop: [drop: Drop];
  created: [];
}>();

const open = computed(() => openEntries(props.day));
const done = computed(() => doneEntries(props.day));
const summary = computed(() => openSummary(props.day));
const isToday = computed(() => props.day.date === props.today);
/** Past days only show what happened; nothing new goes there. */
const isPast = computed(() => props.day.date < props.today);
const headingId = computed(() => `plan-day-${props.day.date}`);

const list = ref<HTMLElement | null>(null);
useSortable(list, {
  item: "[data-todo-id]",
  handle: ".sort-handle",
  group: "week-plan",
  accepts: () => !isPast.value && !props.busy,
  onMove: (_from, _to, { item, list: target, index }) => {
    const todoId = Number(item.dataset.todoId);
    const toDate = target.dataset.date;
    if (!todoId || !toDate || props.busy) return;
    emit("drop", { todoId, toDate, index });
  },
});
</script>

<template>
  <section
    class="plan-day"
    :class="{ 'plan-day--today': isToday, 'plan-day--past': isPast }"
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
      >
        <PlanEntry
          :entry="entry"
          :busy="busy"
          @edit="isMovable(entry) && emit('edit', entry)"
          @move="isMovable(entry) && emit('move', entry)"
          @arrow="(key) => isMovable(entry) && emit('arrow', entry, key)"
        />
      </li>
      <li v-if="!open.length" class="plan-day__empty">
        {{ isPast ? "Nichts mehr offen." : "Noch frei." }}
      </li>
    </ol>

    <QuickAddQuest
      v-if="!isPast"
      class="plan-day__add"
      :date="day.date"
      :order="dayOrder(open)"
      :label="`Quest für ${dayLabel(day.date)} hinzufügen`"
      :choose-place="false"
      @created="emit('created')"
    />

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
        <PlanEntry
          :entry="entry"
          :busy="busy"
          @edit="entry.type === 'todo' && emit('edit', entry)"
        />
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

.plan-day__add :deep(.input:focus) {
  border-color: var(--color-line);
  background: var(--color-surface);
}

/* What is being dragged, and the gap it leaves behind. */
.plan-day__list :deep(.sortable-ghost) {
  opacity: 0.35;
}

.plan-day__list :deep(.sortable-fallback) {
  box-shadow: var(--shadow-card);
  cursor: grabbing;
}
</style>
