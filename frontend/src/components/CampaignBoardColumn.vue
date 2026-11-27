<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import ItemRow from "./ItemRow.vue";
import { useSortable } from "../composables/useSortable";
import {
  cardDay,
  columnLabel,
  type BoardCard,
  type BoardColumn,
} from "../utils/campaign-board";
import type { MenuEntry } from "../utils/row-actions";
import { formatDuration } from "../utils/today-agenda";

/**
 * One column of a campaign's board (`CampaignBoard`): its name and count,
 * an optional quick add on top (the slot), then its cards on the shared
 * row (`ItemRow`: ring, title that opens the editor, ▶, "…"). A card drags
 * as a whole onto another column; the board decides what that does. The
 * column itself never sorts.
 */
const props = defineProps<{
  column: BoardColumn;
  name: string;
  /** The calm line of an empty column. */
  empty: string;
  cards: readonly BoardCard[];
  /** How many cards the column holds, shown or not ("Ältere zeigen"). */
  count: number;
  today: string;
  busy: boolean;
  menu: (card: BoardCard) => MenuEntry[];
}>();

const emit = defineEmits<{
  /** A card of this column was dropped on column `to`. */
  move: [todoId: number, to: BoardColumn];
  toggle: [card: BoardCard];
  edit: [card: BoardCard];
}>();

const headingId = computed(() => `campaign-board-${props.column}`);

const list = ref<HTMLElement | null>(null);
useSortable(list, {
  item: "[data-todo-id]",
  group: "campaign-board",
  sort: false,
  accepts: () => !props.busy,
  onMove: (_from, _to, { item, list: target }) => {
    const to = target.dataset.column as BoardColumn | undefined;
    const todoId = Number(item.dataset.todoId);
    if (to && todoId && to !== props.column && !props.busy)
      emit("move", todoId, to);
  },
});

function meta(card: BoardCard): string[] {
  const { todo } = card;
  const parts: string[] = [];
  const day = cardDay(todo.scheduledDate, todo.timeOfDay, props.today);
  if (day) parts.push(day);
  if (todo.plannedDurationMinutes !== null)
    parts.push(formatDuration(todo.plannedDurationMinutes));
  return parts;
}
</script>

<template>
  <section
    class="board-column"
    :aria-label="columnLabel(column, count)"
    :data-board-column="column"
  >
    <header class="board-column__head">
      <h3 :id="headingId" class="board-column__title" tabindex="-1">
        {{ name }}
      </h3>
      <span class="board-column__count" aria-hidden="true">{{ count }}</span>
    </header>
    <slot name="add" />
    <ol
      ref="list"
      class="board-column__list"
      :data-column="column"
    >
      <li
        v-for="card in cards"
        :key="card.todo.id"
        :data-todo-id="card.todo.id"
        :data-focus-key="`todo-${card.todo.id}`"
      >
        <ItemRow
          :title="card.todo.title"
          :heading-level="4"
          :state="card.todo.completed ? 'completed' : 'open'"
          :ring-pressed="card.todo.completed"
          :busy="busy"
          draggable
          :measure="
            card.todo.completed
              ? null
              : {
                  kind: 'todo',
                  targetId: card.todo.id,
                  eligible: card.todo.timerEligible,
                }
          "
          :menu="menu(card)"
          :menu-key="card.todo.id"
          @toggle="emit('toggle', card)"
          @edit="emit('edit', card)"
        >
          <template
            v-if="(card.todo.blocked && !card.todo.completed) || meta(card).length"
            #meta
          >
            <!-- A state in words and shape, never in colour alone. -->
            <span
              v-if="card.todo.blocked && !card.todo.completed"
              class="board-column__blocked"
            >
              <AppIcon name="blocked" />Geblockt
            </span>
            <span v-for="part in meta(card)" :key="part">{{ part }}</span>
          </template>
          <template v-if="card.series" #below>
            <p class="board-column__series">
              <AppIcon name="child" /><span class="visually-hidden"
                >Questreihe </span
              >{{ card.series.title }}
            </p>
          </template>
        </ItemRow>
      </li>
      <li v-if="!cards.length" class="board-column__empty">{{ empty }}</li>
    </ol>
    <slot name="more" />
  </section>
</template>

<style scoped>
/* A flat column like a day of the Plan: 35 % white, the card corner. */
.board-column {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
  padding: var(--space-3) 0.375rem 0.375rem;
  border-radius: var(--radius-card);
  background: var(--color-surface-faint);
  transition:
    opacity 160ms var(--ease-out),
    outline-color 160ms var(--ease-out);
}

.board-column__head {
  display: flex;
  gap: var(--space-2);
  align-items: baseline;
  padding: 0 0.625rem;
}

.board-column__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.3;
}

.board-column__count {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* The list is where drops land, so it never collapses. */
.board-column__list {
  display: grid;
  gap: var(--space-2);
  align-content: start;
  min-height: var(--tap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.board-column__empty {
  padding: var(--space-2) 0.625rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  text-wrap: pretty;
}

/* "Geblockt" is a state: ink and a shape, never orange. */
.board-column__blocked {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  color: var(--color-ink);
  font-weight: 800;
}

.board-column__blocked :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.board-column__series {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.board-column__series :deep(svg) {
  width: 0.9375rem;
  height: 0.9375rem;
}
</style>
