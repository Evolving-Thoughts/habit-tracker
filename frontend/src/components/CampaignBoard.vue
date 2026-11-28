<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import {
  getBacklogTodos,
  rescheduleTodo,
  setAsideTodo,
  startWorkOnTodo,
  setTodoBlocked,
} from "../api/day-planner.api";
import { planQuest, unplanQuest } from "../api/questlog.api";
import AppIcon from "./AppIcon.vue";
import CampaignBoardColumn from "./CampaignBoardColumn.vue";
import ColumnChips from "./ColumnChips.vue";
import ModalDialog from "./ModalDialog.vue";
import MoveItemDialog from "./MoveItemDialog.vue";
import QuickAddQuest from "./QuickAddQuest.vue";
import { useLoader } from "../composables/useLoader";
import { SHEET_QUERY, useMediaQuery } from "../composables/useMediaQuery";
import { useShortcutHandlers } from "../composables/useShortcuts";
import { useSnapColumns } from "../composables/useSnapColumns";
import { writeDone, type useTicks } from "../composables/useTicks";
import { timerStateOf, useTimer } from "../composables/useTimer";
import type { useWrites } from "../composables/useWrites";
import type { RowDialogs } from "../composables/useRowDialogs";
import { useRowActions, type RowCall } from "../composables/useRowActions";
import type { TodoResponse } from "../types/todo";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  BOARD_COLUMNS,
  boardColumns,
  campaignCards,
  columnLabel,
  columnOf,
  DONE_SHOWN,
  landedLine,
  movedLine,
  planBoardMove,
  type BoardCard,
  type BoardColumn,
  type BoardQuestion,
  type BoardWrite,
  type FinishedMove,
  type MoveAnswers,
  type MovePlan,
  type MoveRequest,
  type PlannedStep,
} from "../utils/campaign-board";
import { getCurrentDateInTimeZone } from "../utils/date";
import {
  questRow,
  rowControl,
  targetOf,
  type MenuEntry,
} from "../utils/row-actions";

/**
 * An opened campaign as a board (DESIGN.md › Kampagnen-Board): its single
 * quests in To-Do, Geplant, In Arbeit and Erledigt. A card drags onto
 * another column, and its "…" offers the same steps for keys and taps:
 * Geplant asks the day, Erledigt completes with the undo toast, To-Do takes
 * the day away; In Arbeit takes the quest into work by hand.
 * What leaves In Arbeit for To-Do or Geplant first answers "Als geblockt
 * markieren?". Marked cards (Ctrl-click, a long press, then taps) travel
 * together, with each question asked once. Every move shows at once and
 * the reload confirms it, or takes it back. A card's editor, "In Kampagne
 * verschieben …" and Löschen are the view's row dialogs (`dialogs`); the
 * view also keeps the campaign question and the undo toast.
 */
type Writes = Pick<ReturnType<typeof useWrites>, "writeShown">;
type Ticks = Pick<ReturnType<typeof useTicks>, "complete" | "reopen">;

const props = defineProps<{
  /** The loaded hierarchy, the same the list of the campaign shows. */
  todos: readonly HierarchyTodo[];
  campaign: Pick<HierarchyTodo, "id" | "title" | "categoryId">;
  /** A write or a dialog of the view runs: controls wait. */
  busy: boolean;
  writes: Writes;
  ticks: Ticks;
  /** The view's row dialogs: editor, campaign move, delete. */
  dialogs: Pick<RowDialogs, "edit" | "reparent" | "remove">;
}>();

const emit = defineEmits<{
  /** The quests changed from outside the board's writes: a quick add, a stopwatch that ended. */
  changed: [];
}>();

const root = ref<HTMLElement | null>(null);
const board = ref<HTMLElement | null>(null);
/** Asked fresh each time: the app may stay open into the next day. */
const today = (): string => getCurrentDateInTimeZone();

/* A move shows at once: these changes lie over the loaded quests until the reload. */
const shownChanges = ref(new Map<number, Partial<HierarchyTodo>>());
function showChange(id: number, changes: Partial<HierarchyTodo>): () => void {
  const next = new Map(shownChanges.value);
  next.set(id, { ...next.get(id), ...changes });
  shownChanges.value = next;
  return () => forgetChange(id);
}
function forgetChange(id: number): void {
  if (!shownChanges.value.has(id)) return;
  const next = new Map(shownChanges.value);
  next.delete(id);
  shownChanges.value = next;
}
const timer = useTimer();
const shown = computed(() =>
  props.todos.map((todo) => {
    const changes = shownChanges.value.get(todo.id);
    // A stopwatch on a quest puts it in "In Arbeit" before the reload says so.
    const working =
      !todo.completed &&
      !todo.inProgress &&
      timerStateOf(timer, targetOf(questRow(todo))) !== null;
    return changes || working
      ? { ...todo, ...(working ? { inProgress: true } : {}), ...changes }
      : todo;
  }),
);
const cards = computed(() => campaignCards(shown.value, props.campaign.id));

/* To-Do in the Questlog's order; without it the page's order, silently. */
const { data: questlog } = useLoader<TodoResponse[]>(
  () => getBacklogTodos(),
  {
    initial: [],
    fallbackError: "",
    refreshOnChange: () => !props.busy,
  },
);
const active = computed(
  () =>
    cards.value.find((card) =>
      timerStateOf(timer, targetOf(questRow(card.todo))),
    )?.todo.id ?? null,
);
/* A stopwatch that ends leaves its time in the Logbuch: the server says
   whether its quest stays in "In Arbeit". */
watch(active, (now, before) => {
  if (before !== null && now !== before) emit("changed");
});
const columns = computed(() =>
  boardColumns(cards.value, {
    questlog: questlog.value.map((todo) => todo.id),
    active: active.value,
  }),
);

/* Erledigt shows the newest; the rest waits behind "Ältere zeigen". */
const olderShown = ref(false);
const hiddenDone = computed(() =>
  olderShown.value ? 0 : Math.max(0, columns.value.done.length - DONE_SHOWN),
);
function cardsOf(column: BoardColumn): BoardCard[] {
  return column === "done" && !olderShown.value
    ? columns.value.done.slice(0, DONE_SHOWN)
    : columns.value[column];
}

/* A phone: one column per screen, the chips above (shared with the Plan). */
const phone = useMediaQuery(SHEET_QUERY);
const { current, onScroll, showColumn } = useSnapColumns(board, {
  active: phone,
  count: () => BOARD_COLUMNS.length,
});
const chips = computed(() =>
  BOARD_COLUMNS.map((column) => ({
    key: column.key,
    label: column.name,
    name: columnLabel(column.key, columns.value[column.key].length),
    count: columns.value[column.key].length,
  })),
);

/** What the live region says: where a card stands now. */
const status = ref("");

/** Where a card stood, for the focus after a step from its menu. */
type Place = { column: BoardColumn; index: number };
function placeOf(card: BoardCard): Place {
  const column = columnOf(card.todo);
  return {
    column,
    index: cardsOf(column).findIndex((item) => item.todo.id === card.todo.id),
  };
}

/**
 * A move under way: what was asked for (the plan comes from `planBoardMove`),
 * the answers so far, where its cards stood (for the focus afterwards) and
 * whether it came from a card's menu.
 */
type Move = {
  request: MoveRequest;
  answers: MoveAnswers;
  from: Map<number, Place>;
  fromMenu: boolean;
};
const question = ref<(BoardQuestion & { move: Move }) | null>(null);
/** The move a question was last asked for; kept once its dialog closes. */
let asking: Move | null = null;
const timestamp = (): string => new Date().toISOString();

/**
 * Starts a move by drop, menu or key, unless a write or a question is
 * under way. False where nothing moves. A marked card moved alone lets go
 * of the marks at once; a group does when its writes start.
 */
function startMove(request: MoveRequest, fromMenu = false): boolean {
  if (props.busy || question.value) return false;
  const plan = planBoardMove(request, {}, timestamp());
  if (!plan) return false;
  const from = new Map(plan.cards.map((card) => [card.todo.id, placeOf(card)]));
  proceed({ request, answers: {}, from, fromMenu }, plan);
  if (plan.clearMarks === "at-once") clearSelection();
  return true;
}

/** Asks the plan's next question, or writes once everything is answered. */
function proceed(move: Move, plan: MovePlan): void {
  asking = move;
  if (plan.question === null) void execute(plan, move);
  else question.value = { ...plan.question, move };
}
/** One answer for every card that waits for it; then the next step. */
function answer(answers: MoveAnswers): void {
  const asked = question.value;
  if (!asked) return;
  question.value = null;
  const move = {
    ...asked.move,
    answers: { ...asked.move.answers, ...answers },
  };
  proceed(move, planBoardMove(move.request, move.answers, timestamp())!);
}
/** Closed without an answer: no card moves, the marks stay. */
function dismissQuestion(): void {
  question.value = null;
}

/**
 * Writes a finished plan, one card after the other: each through its own
 * path, shown at once and confirmed by the reload. A group shows every card
 * in its new column right away, then says how many made it.
 */
async function execute(plan: FinishedMove, move: Move): Promise<void> {
  const { group } = plan;
  if (group) {
    for (const step of plan.steps) showChange(step.card.todo.id, step.changes);
    status.value = plan.line ?? "";
  }
  if (plan.clearMarks === "on-write") clearSelection();
  for (const step of plan.steps) {
    const options = { fromMenu: move.fromMenu, quiet: group };
    if (step.kind === "complete") await complete(step.card, options);
    else await write(step, move.from.get(step.card.todo.id)!, options);
  }
  if (group) status.value = landedLine(plan, cards.value);
}

/** How a single write behaves: focus after a menu step; a group speaks once. */
type WriteOptions = { fromMenu?: boolean; quiet?: boolean };

/**
 * One card's planned move or start into In Arbeit: shown at once with its
 * line, its calls sent in order, taken back when the server refuses.
 */
async function write(
  step: Exclude<PlannedStep, { kind: "complete" }>,
  from: Place,
  options: WriteOptions,
): Promise<void> {
  const { todo } = step.card;
  const done = await props.writes.writeShown(
    () => {
      const takeBack = showChange(todo.id, step.changes);
      if (!options.quiet) status.value = movedLine(todo.title, step.to);
      return () => {
        takeBack();
        if (!options.quiet) status.value = "";
      };
    },
    async () => {
      for (const call of step.writes) await send(todo, call);
    },
    {
      key: `board-${todo.id}`,
      fallbackError:
        step.kind === "start"
          ? "Die Quest konnte nicht in Arbeit genommen werden."
          : "Die Quest konnte nicht verschoben werden.",
    },
  );
  if (done) settle(todo.id, options.quiet);
  if (options.fromMenu) await focusAfter(todo.id, from);
}

/** One server call of a planned step. */
function send(todo: HierarchyTodo, call: BoardWrite): Promise<unknown> {
  switch (call.kind) {
    case "reopen":
      return writeDone(targetOf(questRow(todo)), false);
    case "setAside":
      return setAsideTodo(todo.id, call.blocked);
    case "unplan":
      return unplanQuest(todo.id);
    case "reschedule":
      // An appointment keeps its time; its move was confirmed in the dialog.
      return rescheduleTodo(todo.id, call.day, true);
    case "plan":
      return planQuest(todo, call.day);
    case "start":
      return startWorkOnTodo(todo.id);
  }
}

/** The reload is in: the server's column counts, and the line says so. */
function settle(id: number, quiet = false): void {
  forgetChange(id);
  if (quiet) return;
  const card = cards.value.find((item) => item.todo.id === id);
  if (card) status.value = movedLine(card.todo.title, columnOf(card.todo));
}

/** Erledigt: through the ring's path, with the undo toast. */
async function complete(
  card: BoardCard,
  options: WriteOptions = {},
): Promise<void> {
  const { todo } = card;
  const from = placeOf(card);
  let confirmed = false;
  try {
    confirmed = await props.ticks.complete(
      targetOf(questRow(todo)),
      {
        key: `board-${todo.id}`,
        fallbackError: "Die Quest konnte nicht erledigt werden.",
        onConfirmed: () => {
          showChange(todo.id, {
            completed: true,
            completedAt: new Date().toISOString(),
          });
          if (!options.quiet) status.value = movedLine(todo.title, "done");
        },
      },
    );
  } finally {
    forgetChange(todo.id);
  }
  if (!confirmed && !options.quiet) status.value = "";
  if (options.fromMenu) await focusAfter(todo.id, from);
}

/** The ring: done, or open again. */
async function toggle(card: BoardCard): Promise<void> {
  if (props.busy) return;
  if (!card.todo.completed) {
    await complete(card);
    return;
  }
  const { todo } = card;
  showChange(todo.id, { completed: false, completedAt: null });
  try {
    if (
      await props.ticks.reopen(
        targetOf(questRow(todo)),
        { key: `board-${todo.id}` },
      )
    )
      settle(todo.id);
  } finally {
    forgetChange(todo.id);
  }
}

/** "Als geblockt markieren" and "Blocker aufheben". */
async function toggleBlocked(card: BoardCard): Promise<void> {
  if (props.busy) return;
  const { todo } = card;
  const blocked = !todo.blocked;
  const done = await props.writes.writeShown(
    () => {
      const takeBack = showChange(todo.id, { blocked });
      status.value = blocked
        ? `„${todo.title}“ ist jetzt als geblockt markiert.`
        : `„${todo.title}“ ist nicht mehr geblockt.`;
      return () => {
        takeBack();
        status.value = "";
      };
    },
    () => setTodoBlocked(todo.id, blocked),
    {
      key: `board-${todo.id}`,
      fallbackError: "Die Quest konnte nicht geändert werden.",
    },
  );
  if (done) forgetChange(todo.id);
}

/**
 * Where the focus goes after a step from a card's menu: wide, it follows
 * the card into its new column; on a phone, where that column is out of
 * view, it stays in the column the card left, on the card now in its place.
 */
function focusTarget(id: number, from: Place): HTMLElement | null {
  const element = root.value;
  if (!element) return null;
  if (!phone.value) {
    const trigger = rowControl(element, `todo-${id}`);
    if (trigger) return trigger;
  }
  const titles = element.querySelectorAll<HTMLElement>(
    `[data-column="${from.column}"] [data-edit-button]`,
  );
  return (
    titles[Math.min(Math.max(from.index, 0), titles.length - 1)] ??
    element.querySelector<HTMLElement>(`#campaign-board-${from.column}`)
  );
}
async function focusAfter(id: number, from: Place): Promise<void> {
  await nextTick();
  focusTarget(id, from)?.focus();
}
/** A question closes: the focus goes where the card now is (or still is). */
function questionFocus(): HTMLElement | null {
  const [first] = asking?.from ?? [];
  return first ? focusTarget(...first) : null;
}

/*
 * Marked cards (Ctrl-click, a long press, then taps on a touch screen):
 * carried together when one of them is dragged. Done cards stay markable,
 * they can be dragged back. Marks of cards that left the board go.
 */
const selected = ref(new Set<number>());
function toggleSelected(todoId: number): void {
  const next = new Set(selected.value);
  if (!next.delete(todoId)) next.add(todoId);
  selected.value = next;
}
function clearSelection(): void {
  if (selected.value.size) selected.value = new Set();
}
watch(cards, (now) => {
  const ids = new Set(now.map((card) => card.todo.id));
  if ([...selected.value].some((id) => !ids.has(id)))
    selected.value = new Set([...selected.value].filter((id) => ids.has(id)));
});
/** "Auswahl aufheben": the focus goes to the first card that was marked. */
async function dropSelection(): Promise<void> {
  const [first] = selected.value;
  clearSelection();
  await nextTick();
  rowControl(root.value, `todo-${first}`, "card")?.focus();
}
/* Escape lets go of the marks, unless it closes a dialog or a menu first. */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !selected.value.size || question.value) return;
  if (event.defaultPrevented) return;
  if (document.querySelector("dialog[open], [role='menu']")) return;
  clearSelection();
}
onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));

/**
 * A card was dropped onto another column: a marked one brings every marked
 * card along, an unmarked one moves alone and leaves the marks be.
 */
function onDrop(todoId: number, to: BoardColumn): void {
  const card = cards.value.find((item) => item.todo.id === todoId);
  if (card)
    startMove({
      via: "drop",
      card,
      to,
      cards: cards.value,
      marked: selected.value,
    });
}

/*
 * What a card can do: its "…" and its keys. Its column steps are the
 * board's own: each runs the same move as a drop, and Geplant asks the day
 * unless the step names it. The editor, the campaign move, Löschen and the
 * stopwatch are every row's (`useRowActions`).
 */
const rowActions = useRowActions({
  today,
  dialogs: props.dialogs,
  timer,
  busy: () => props.busy,
});
function callOf(card: BoardCard): RowCall {
  const { todo } = card;
  return {
    key: `todo-${todo.id}`,
    row: questRow(todo, {
      board: { column: columnOf(todo), blocked: todo.blocked },
    }),
    boardSteps: {
      move: (date) =>
        startMove({ via: "menu", card, to: "planned", date }, true),
      pickDay: () => void startMove({ via: "menu", card, to: "planned" }, true),
      unplan: () => void startMove({ via: "menu", card, to: "todo" }, true),
      complete: () => void complete(card, { fromMenu: true }),
      startWork: () =>
        void startMove({ via: "menu", card, to: "working" }, true),
      setAside: () => void startMove({ via: "setAside", card }, true),
      toggleBlocked: () => void toggleBlocked(card),
    },
  };
}
function menuOf(card: BoardCard): MenuEntry[] {
  return rowActions.menu(callOf(card));
}

/* The keys work on the card under the pointer or focus. */
useShortcutHandlers(
  rowActions.shortcuts((key) => {
    const card = cards.value.find((item) => `todo-${item.todo.id}` === key);
    return card ? callOf(card) : null;
  }),
);

/** The quest a question is asked about. */
const asked = computed(() => {
  const open = question.value;
  if (!open) return null;
  const { todos, group } = open;
  return {
    todos,
    group,
    /** One quest by its title, a group by all of theirs. */
    title: group
      ? todos.map((todo) => `„${todo.title}“`).join(", ")
      : (todos[0]?.title ?? ""),
    first: todos[0]!,
    /** An appointment among them still asks to be moved on purpose. */
    timeOfDay: todos.find((todo) => todo.timeOfDay)?.timeOfDay ?? null,
    timing: todos.some((todo) =>
      timerStateOf(timer, targetOf(questRow(todo))),
    ),
  };
});
</script>

<template>
  <div ref="root" class="campaign-board">
    <p
      class="campaign-board__status"
      :class="{ 'campaign-board__status--empty': !status }"
      role="status"
    >
      {{ status }}
    </p>
    <!-- The marks: how many, and the way out; its own live region. -->
    <div
      class="campaign-board__selection"
      :class="{ 'campaign-board__selection--empty': !selected.size }"
    >
      <p class="campaign-board__selection-count" role="status">
        <template v-if="selected.size"
          ><strong>{{ selected.size }} ausgewählt</strong>
          {{
            selected.size > 1
              ? "Ziehen nimmt alle mit."
              : "Weitere Karten antippen oder mit Strg anklicken."
          }}</template
        >
      </p>
      <button
        v-if="selected.size"
        type="button"
        class="btn btn--quiet"
        @click="dropSelection"
      >
        Auswahl aufheben
      </button>
    </div>
    <ColumnChips
      v-if="phone"
      :chips="chips"
      :current="current"
      label="Spalten des Boards"
      @show="showColumn"
    />
    <div
      ref="board"
      class="campaign-board__columns"
      :class="{ 'snap-board': phone }"
      @scroll.passive="onScroll"
    >
      <CampaignBoardColumn
        v-for="column in BOARD_COLUMNS"
        :key="column.key"
        :column="column.key"
        :name="column.name"
        :empty="column.empty"
        :cards="cardsOf(column.key)"
        :count="columns[column.key].length"
        :today="today()"
        :busy="busy"
        :menu="menuOf"
        :selected="selected"
        @move="onDrop"
        @select="toggleSelected"
        @toggle="toggle"
        @edit="(card) => rowActions.edit(callOf(card))"
      >
        <template
          v-if="column.key === 'todo' || column.key === 'planned'"
          v-slot:add
        >
          <QuickAddQuest
            column
            :date="column.key === 'planned' ? today() : null"
            :parent="{ id: campaign.id, categoryId: campaign.categoryId }"
            :label="
              column.key === 'planned'
                ? `Quest für heute in „${campaign.title}“ einplanen`
                : `Quest ins To-Do von „${campaign.title}“ hinzufügen`
            "
            :place-toggle="false"
            @created="emit('changed')"
          />
        </template>
        <template v-if="column.key === 'done' && hiddenDone" #more>
          <button
            type="button"
            class="btn btn--quiet campaign-board__older"
            @click="olderShown = true"
          >
            Ältere zeigen ({{ hiddenDone }})
          </button>
        </template>
      </CampaignBoardColumn>
    </div>

    <MoveItemDialog
      v-if="question?.kind === 'day' && asked"
      choose
      :heading="asked.group ? `${asked.todos.length} Quests einplanen` : undefined"
      :item="{
        type: 'todo',
        todoId: asked.first.id,
        title: asked.title,
        timeOfDay: asked.timeOfDay,
      }"
      :today="today()"
      offer-today
      :return-focus="questionFocus"
      @chosen="(day) => answer({ day })"
      @close="dismissQuestion"
    />
    <ModalDialog
      v-else-if="question?.kind === 'blocked' && asked"
      title="Als geblockt markieren?"
      focus-selector="[data-blocked-answer]"
      :return-focus="questionFocus"
      @close="dismissQuestion"
    >
      <p v-if="asked.group" class="campaign-board__lead">
        {{ asked.todos.length }} Quests kommen aus In Arbeit zurück:
        {{ asked.title }}. Warten sie auf etwas, das gerade nicht weitergeht?
        Die Antwort gilt für alle.
        <template v-if="asked.timing"
          >Die laufende Stoppuhr endet dabei, die Zeit bleibt im
          Logbuch.</template
        >
      </p>
      <p v-else class="campaign-board__lead">
        „{{ asked.title }}“ kommt aus In Arbeit zurück. Wartet sie auf etwas,
        das gerade nicht weitergeht?
        <template v-if="asked.timing"
          >Ihre Stoppuhr endet dabei, die Zeit bleibt im Logbuch.</template
        >
      </p>
      <div class="campaign-board__answers">
        <button type="button" data-blocked-answer @click="answer({ blocked: true })">
          <AppIcon name="blocked" />Ja, geblockt
        </button>
        <button type="button" @click="answer({ blocked: false })">
          Nein, nur zurückstellen
        </button>
      </div>
    </ModalDialog>
  </div>
</template>

<style scoped>
/* What just moved, said in sight and to screen readers; no room while quiet. */
.campaign-board__status {
  margin: 0 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  font-weight: 600;
}

.campaign-board__status--empty {
  position: absolute;
  margin: 0;
}

/* "3 ausgewählt · Auswahl aufheben": a quiet line over the board. */
.campaign-board__selection {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  align-items: center;
  margin: 0 0 var(--space-2);
}

.campaign-board__selection--empty {
  position: absolute;
  margin: 0;
}

.campaign-board__selection-count {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.campaign-board__selection-count strong {
  color: var(--color-ink);
  font-weight: 800;
}

/*
 * A marked card carried: the other marked cards step back, and the
 * floating copy says how many travel ("3 Karten").
 */
.campaign-board__columns:has(.sortable-fallback[data-selected])
  :deep(li[data-selected]:not(.sortable-fallback):not(.sortable-ghost)) {
  opacity: 0.4;
}

.campaign-board__columns :deep(.sortable-fallback[data-travel]::after) {
  position: absolute;
  top: -0.625rem;
  right: var(--space-3);
  padding: 0.125rem var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-ink);
  color: var(--color-surface);
  font-size: 0.8125rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  content: attr(data-travel);
}

/*
 * Four columns side by side, each wide enough for a card with ring, ▶ and
 * "…"; where they do not fit, the board scrolls sideways in itself, never
 * the page. Each column scrolls on its own, so a long Erledigt does not
 * stretch the board.
 */
.campaign-board__columns {
  /* Holds what is positioned inside its columns (hidden labels), so it
     cannot widen the page past the scroller. */
  position: relative;
  display: grid;
  grid-template-columns: repeat(4, minmax(17rem, 1fr));
  gap: var(--space-2);
  /* Every column as tall as the tallest: a card dropped anywhere in a
     column's lane lands in it, below its last card too. */
  align-items: stretch;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: var(--space-2);
}

.campaign-board__columns:not(.snap-board) > :deep(.board-column) {
  min-height: 14rem;
  max-height: min(48rem, calc(100dvh - 7rem));
}

.campaign-board__columns:not(.snap-board) :deep(.board-column__list) {
  flex: 1 1 auto;
  margin: -0.25rem;
  padding: 0.25rem;
  overflow-y: auto;
  overscroll-behavior-y: contain;
}

/* A phone: one column per screen (`.snap-board`); the page scrolls down. */
.campaign-board__columns.snap-board {
  grid-template-columns: repeat(4, 100%);
  gap: var(--space-3);
}

/* A card carried in from the neighbour lands where the finger is: the list
   reaches down the column. */
.campaign-board__columns.snap-board > :deep(.board-column) {
  min-height: 60dvh;
}

.campaign-board__columns.snap-board :deep(.board-column__list) {
  flex: 1 1 auto;
}

/*
 * While a card is carried: every other column shows the drop edge (2px
 * dashed, muted ink), the one it came from does not.
 */
.campaign-board__columns:has(.sortable-fallback)
  > :deep(.board-column:not(:has(.sortable-fallback))) {
  outline: 2px dashed var(--color-ink-muted);
  outline-offset: -2px;
}

.campaign-board__older {
  align-self: center;
}

.campaign-board__lead {
  margin: 0 0 var(--space-4);
  color: var(--color-ink-muted);
}

.campaign-board__answers {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.campaign-board__answers button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
}
</style>
