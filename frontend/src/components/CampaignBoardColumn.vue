<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import ItemRow from "./ItemRow.vue";
import { useSortable } from "../composables/useSortable";
import {
  cardDay,
  columnLabel,
  travelLabel,
  type BoardCard,
  type BoardColumn,
} from "../utils/campaign-board";
import { measureOf, questRow, type MenuEntry } from "../utils/row-actions";
import { formatDuration } from "../utils/today-agenda";
import { CARD_CONTROLS, justDragged } from "../utils/card-click";

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
  /** The marked cards of the board (ids), shown and carried together. */
  selected: ReadonlySet<number>;
}>();

const emit = defineEmits<{
  /** A card of this column was dropped on column `to`. */
  move: [todoId: number, to: BoardColumn];
  toggle: [card: BoardCard];
  edit: [card: BoardCard];
  /** Mark or unmark a card (Ctrl-click, a tap while marking, a long press). */
  select: [todoId: number];
}>();

const headingId = computed(() => `campaign-board-${props.column}`);

const list = ref<HTMLElement | null>(null);
useSortable(list, {
  item: "[data-todo-id]",
  group: "campaign-board",
  sort: false,
  accepts: () => !props.busy,
  onHold: (item) => {
    const todoId = Number(item.dataset.todoId);
    if (todoId && !props.busy) emit("select", todoId);
  },
  onMove: (_from, _to, { item, list: target }) => {
    const to = target.dataset.column as BoardColumn | undefined;
    const todoId = Number(item.dataset.todoId);
    if (to && todoId && to !== props.column && !props.busy)
      emit("move", todoId, to);
  },
});

/*
 * Marking cards: Ctrl-click (Cmd on a Mac), and on a touch screen, once a
 * card is marked, a plain tap. The card's own controls (ring, ▶, "…")
 * keep their tap; the title counts as the card. Caught before the card
 * sees the click, so it opens no editor.
 */
let pointerType = "";
function notePress(event: PointerEvent): void {
  pointerType = event.pointerType;
}
function pick(event: MouseEvent, card: BoardCard): void {
  if (event.button !== 0 || props.busy || justDragged()) return;
  const marking =
    event.ctrlKey ||
    event.metaKey ||
    (pointerType === "touch" && props.selected.size > 0);
  if (!marking) return;
  const target = event.target;
  const row = event.currentTarget;
  if (!(target instanceof Element) || !(row instanceof Element)) return;
  const control = target.closest(CARD_CONTROLS);
  if (control && row.contains(control) && !control.matches("[data-edit-button]"))
    return;
  event.preventDefault();
  event.stopPropagation();
  emit("select", card.todo.id);
}

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
        :data-selected="selected.has(card.todo.id) || undefined"
        :data-travel="
          selected.has(card.todo.id) && selected.size > 1
            ? travelLabel(selected.size)
            : undefined
        "
        @pointerdown.capture="notePress"
        @click.capture="pick($event, card)"
      >
        <ItemRow
          :title="card.todo.title"
          :heading-level="4"
          :state="card.todo.completed ? 'completed' : 'open'"
          :ring-pressed="card.todo.completed"
          :busy="busy"
          draggable
          :measure="card.todo.completed ? null : measureOf(questRow(card.todo))"
          :menu="menu(card)"
          :menu-key="card.todo.id"
          @toggle="emit('toggle', card)"
          @edit="emit('edit', card)"
        >
          <template
            v-if="
              selected.has(card.todo.id) ||
              (card.todo.blocked && !card.todo.completed) ||
              meta(card).length
            "
            #meta
          >
            <!-- States in words and shape, never in colour alone. -->
            <span
              v-if="selected.has(card.todo.id)"
              class="board-column__selected"
            >
              <AppIcon name="check" />Ausgewählt
            </span>
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

/* Marked: a check and the word, with an ink frame around the card as extra. */
.board-column__selected {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  color: var(--color-ink);
  font-weight: 800;
}

.board-column__selected :deep(svg) {
  width: 1rem;
  height: 1rem;
  stroke-width: 3;
}

[data-selected] > :deep(.item-row) {
  outline: 2px solid var(--color-ink);
  outline-offset: -2px;
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
