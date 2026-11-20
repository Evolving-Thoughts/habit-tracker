<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import PlanEntry from "./PlanEntry.vue";
import { useSortable } from "../composables/useSortable";
import { useTimer } from "../composables/useTimer";
import type { TodoResponse } from "../types/todo";
import { rowMenu, timerStep, type MenuEntry } from "../utils/row-actions";
import { questlogEntry, type Drop } from "../utils/week-plan";

/**
 * The Questlog beside the board (Plan, from 56rem): open quests without a
 * day, each card a drag source onto any day of the board. The keyboard
 * plans through each card's menu (its days first). Collapsed it is a slim
 * rail.
 */
const props = defineProps<{
  todos: TodoResponse[];
  open: boolean;
  busy: boolean;
  /** The days a quest can go to: the board's days from today on. */
  days: { date: string; label: string }[];
}>();

const emit = defineEmits<{
  toggle: [];
  drop: [drop: Drop];
  plan: [todo: TodoResponse, date: string];
  edit: [todo: TodoResponse];
}>();

const list = ref<HTMLElement | null>(null);
useSortable(list, {
  item: "[data-todo-id]",
  group: "week-plan",
  // A quest goes back to the Questlog through its editor, not by dragging.
  accepts: () => false,
  onMove: (_from, _to, { item, list: target, index }) => {
    const todoId = Number(item.dataset.todoId);
    const toDate = target.dataset.date;
    if (!todoId || !toDate || props.busy) return;
    emit("drop", { todoId, toDate, index });
  },
});

/* Shown like the board's rows; the day is only set once it lands. */
const entries = computed(() =>
  props.todos.map((todo) => ({ todo, entry: questlogEntry(todo, "") })),
);

const timer = useTimer();
/* The board's days are this card's quick moves; no ▶ fits the column. */
function menu(todo: TodoResponse): MenuEntry[] {
  return rowMenu(
    todo.title,
    {
      quickMoves: props.days.map((day) => ({
        id: `plan-${day.date}`,
        label: day.label,
        icon: "calendar",
        ariaLabel: `${todo.title} einplanen am ${day.label}`,
        disabled: props.busy,
        run: () => emit("plan", todo, day.date),
      })),
      edit: () => emit("edit", todo),
      timer: timerStep(
        timer,
        { kind: "todo", targetId: todo.id, title: todo.title },
        todo.timerEligible,
      ),
    },
    props.busy,
  );
}
</script>

<template>
  <aside
    class="plan-questlog"
    :class="{ 'plan-questlog--closed': !open }"
    aria-labelledby="plan-questlog-title"
  >
    <header class="plan-questlog__header">
      <h2 id="plan-questlog-title" class="plan-questlog__title">
        <AppIcon name="questlog" />
        <span class="plan-questlog__name">Questlog</span>
        <span class="count">{{ todos.length }}</span>
      </h2>
      <button
        type="button"
        class="btn btn--quiet btn--icon plan-questlog__toggle"
        :aria-expanded="open"
        aria-controls="plan-questlog-list"
        :aria-label="open ? 'Questlog ausblenden' : 'Questlog einblenden'"
        :title="open ? 'Questlog ausblenden' : 'Questlog einblenden'"
        @click="emit('toggle')"
      >
        <AppIcon :name="open ? 'chevron-left' : 'chevron'" />
      </button>
    </header>
    <div v-show="open" id="plan-questlog-list" class="plan-questlog__body">
      <p class="plan-questlog__lead">
        Auf einen Tag ziehen oder über „…“ einplanen.
      </p>
      <ol ref="list" class="plan-questlog__list" aria-label="Quests ohne Tag">
        <li
          v-for="{ todo, entry } in entries"
          :key="todo.id"
          :data-focus-key="`todo-${todo.id}`"
          :data-todo-id="todo.id"
        >
          <PlanEntry
            :entry="entry"
            :busy="busy"
            :menu="menu(todo)"
            @edit="emit('edit', todo)"
          />
        </li>
      </ol>
      <p v-if="!todos.length" class="plan-questlog__empty">
        Nichts im Questlog.
      </p>
    </div>
  </aside>
</template>

<style scoped>
.plan-questlog {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-2) var(--space-2) var(--space-2);
  border-radius: var(--radius-card);
  background: var(--color-surface-faint);
}

.plan-questlog__header {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  justify-content: space-between;
  padding-left: var(--space-2);
}

.plan-questlog__title {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.3;
}

.plan-questlog__title :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
  color: var(--color-ink-muted);
}

.plan-questlog__title .count {
  font-size: 0.875rem;
}

.plan-questlog__lead {
  margin: 0;
  padding: 0 var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.plan-questlog__body {
  display: grid;
  gap: var(--space-2);
}

.plan-questlog__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan-questlog__empty {
  margin: 0;
  padding: var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

/* Collapsed: a rail as wide as its toggle, the count below it. */
.plan-questlog--closed {
  align-items: center;
  width: var(--tap);
  padding-inline: 0;
}

.plan-questlog--closed .plan-questlog__header {
  flex-direction: column-reverse;
  gap: var(--space-2);
  padding-left: 0;
}

.plan-questlog--closed .plan-questlog__title {
  flex-direction: column;
  gap: var(--space-1);
}

.plan-questlog--closed .plan-questlog__name {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.875rem;
}
</style>
