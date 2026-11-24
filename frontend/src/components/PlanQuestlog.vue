<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import PlanEntry from "./PlanEntry.vue";
import QuickAddQuest from "./QuickAddQuest.vue";
import { useSortable } from "../composables/useSortable";
import { useTimer } from "../composables/useTimer";
import { rowMenu, timerStep, type MenuEntry } from "../utils/row-actions";
import {
  boardDrop,
  questlogEntry,
  type BoardDrop,
  type QuestlogQuest,
  type ShelfDrop,
} from "../utils/week-plan";

/**
 * The Questlog at the far left of the board: open quests without a day in
 * the Questlog's own order. Each card drags onto any day, or to another
 * place in the column; a quest from the board dropped here loses its day.
 * The keyboard plans and sorts through each card's menu (its days first).
 * On top a quick add puts a new quest at the head or the end of its order.
 * Collapsed it is a slim rail.
 */
const props = defineProps<{
  todos: QuestlogQuest[];
  open: boolean;
  busy: boolean;
  /** The days a quest can go to: the board's days from today on. */
  days: { date: string; label: string }[];
}>();

const emit = defineEmits<{
  toggle: [];
  /** A card was dropped on a day or at a place in the column. */
  move: [drop: BoardDrop];
  /** "Nach oben" / "Nach unten": a card to another place in the column. */
  step: [drop: ShelfDrop];
  plan: [todo: QuestlogQuest, date: string];
  edit: [todo: QuestlogQuest];
  /** "In Kampagne verschieben …" */
  reparent: [todo: QuestlogQuest];
  remove: [todo: QuestlogQuest];
  /** The quick add made a quest. */
  created: [];
}>();

const list = ref<HTMLElement | null>(null);
useSortable(list, {
  item: "[data-todo-id]",
  group: "week-plan",
  accepts: () => props.open && !props.busy,
  onMove: (_from, _to, { item, list: target, index }) => {
    const drop = boardDrop(item, target, index);
    if (drop && !props.busy) emit("move", drop);
  },
});

/* Shown like the board's rows; the day is only set once it lands. */
const entries = computed(() =>
  props.todos.map((todo) => ({ todo, entry: questlogEntry(todo, "") })),
);

const timer = useTimer();
/** "Nach oben" / "Nach unten": the keyboard's way to sort the column. */
function step(todo: QuestlogQuest, direction: -1 | 1): (() => void) | undefined {
  const index = props.todos.indexOf(todo) + direction;
  if (index < 0 || index >= props.todos.length) return undefined;
  return () => emit("step", { todoId: todo.id, index });
}

/* The board's days are this card's quick moves; no ▶ fits the column. */
function menu(todo: QuestlogQuest): MenuEntry[] {
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
      reparent: () => emit("reparent", todo),
      up: step(todo, -1),
      down: step(todo, 1),
      remove: { run: () => emit("remove", todo) },
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
      <QuickAddQuest
        class="plan-questlog__add"
        :date="null"
        label="Quest ins Questlog hinzufügen"
        @created="emit('created')"
      />
      <p class="plan-questlog__lead">
        Auf einen Tag ziehen oder über „…“ einplanen.
      </p>
      <ol
        ref="list"
        class="plan-questlog__list"
        aria-label="Quests ohne Tag"
        data-questlog
      >
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
        <li v-if="!todos.length" class="plan-questlog__empty">
          Nichts im Questlog.
        </li>
      </ol>
    </div>
  </aside>
</template>

<style scoped>
/*
 * It stays at the left edge when the board has to scroll sideways, so the
 * Questlog never leaves the view: its translucent surface lies on an opaque
 * ground, and the ground also covers the gap the days scroll through.
 */
.plan-questlog {
  position: sticky;
  left: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-2) var(--space-2) var(--space-2);
  border-radius: var(--radius-card);
  background-color: var(--color-ground);
  background-image: linear-gradient(
    var(--color-surface-faint),
    var(--color-surface-faint)
  );
  box-shadow: var(--space-2) 0 0 0 var(--color-ground);
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

/* Like the quick add of a day: a translucent field without a frame. */
.plan-questlog__add {
  margin: 0;
}

.plan-questlog__add :deep(.input) {
  min-height: var(--tap);
  border-color: transparent;
  background: var(--color-surface-quiet);
  font-size: 0.9375rem;
}

.plan-questlog__add :deep(.input:focus) {
  border-color: var(--color-line);
  background: var(--color-surface);
}

/* The list is also where drops land, so it never collapses. */
.plan-questlog__list {
  display: grid;
  gap: var(--space-2);
  align-content: start;
  min-height: var(--tap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.plan-questlog__empty {
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

/*
 * On a phone the Questlog is the board's first column like any other, a
 * screen wide: it neither sticks nor folds away, the chips above reach it.
 */
@media (max-width: 39.99rem) {
  .plan-questlog {
    position: static;
    padding: var(--space-3) 0.375rem 0.375rem;
    box-shadow: none;
  }

  .plan-questlog__header {
    min-height: var(--tap);
  }

  .plan-questlog__toggle {
    display: none;
  }
}

/* A finger's field: 16px, so a phone does not zoom in on focus. */
@media (max-width: 39.99rem), (pointer: coarse) {
  .plan-questlog__add :deep(.input) {
    font-size: 1rem;
  }
}
</style>
