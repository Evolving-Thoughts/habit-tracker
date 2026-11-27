<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
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
import {
  timerStateOf,
  toggleTimer,
  useTimer,
} from "../composables/useTimer";
import type { useWrites } from "../composables/useWrites";
import type { TodoResponse } from "../types/todo";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import {
  BOARD_COLUMNS,
  boardColumns,
  campaignCards,
  columnLabel,
  columnOf,
  DONE_SHOWN,
  dropAction,
  movedLine,
  type BoardCard,
  type BoardColumn,
} from "../utils/campaign-board";
import { addDays, getCurrentDateInTimeZone, weekStart } from "../utils/date";
import {
  quickMoveEntries,
  quickMoves,
  rowMenu,
  type MenuEntry,
} from "../utils/row-actions";

/**
 * An opened campaign as a board (DESIGN.md › Kampagnen-Board): its single
 * quests in To-Do, Geplant, In Arbeit and Erledigt. A card drags onto
 * another column, and its "…" offers the same steps for keys and taps:
 * Geplant asks the day, Erledigt completes with the undo toast, To-Do takes
 * the day away; In Arbeit takes nothing, it fills through the stopwatch.
 * What leaves In Arbeit for To-Do or Geplant first answers "Als geblockt
 * markieren?". Every move shows at once and the reload confirms it, or
 * takes it back. The view keeps the editor, the move and delete dialogs,
 * the campaign question and the undo toast; the board asks for them.
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
}>();

const emit = defineEmits<{
  edit: [todo: HierarchyTodo];
  reparent: [todo: HierarchyTodo];
  remove: [todo: HierarchyTodo];
  /** The quests changed from outside the board's writes: a quick add, a stopwatch that ended. */
  created: [];
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
      timerStateOf(timer, "todo", todo.id) !== null;
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
    cards.value.find((card) => timerStateOf(timer, "todo", card.todo.id))?.todo
      .id ?? null,
);
/* A stopwatch that ends leaves its time in the Logbuch: the server says
   whether its quest stays in "In Arbeit". */
watch(active, (now, before) => {
  if (before !== null && now !== before) emit("created");
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
 * One move, as the drop rules ask for it (`dropAction`): open again first,
 * set aside with the answer to "Als geblockt markieren?", then the day.
 * `day`: a date for Geplant, null for To-Do, undefined while still to ask.
 */
type Step = {
  card: BoardCard;
  to: BoardColumn;
  reopen: boolean;
  setAside: boolean;
  /** The day stays as it is ("Zurückstellen …"). */
  keepDay: boolean;
  day?: string | null;
  blocked?: boolean;
  fromMenu: boolean;
  from: Place;
};
const question = ref<{ kind: "blocked" | "day"; step: Step } | null>(null);
/** The step a question was last asked for; kept once its dialog closes. */
let asking: Step | null = null;

/** Moves a card onto another column, by drop or by its menu. */
function moveCard(
  card: BoardCard,
  to: BoardColumn,
  options: { date?: string; fromMenu?: boolean } = {},
): boolean {
  if (props.busy || question.value) return false;
  const action = dropAction(columnOf(card.todo), to);
  if (!action) return false;
  if (action.kind === "complete") {
    void complete(card, options.fromMenu);
    return true;
  }
  if (action.kind === "start") {
    void startWork(card, action.reopen, options.fromMenu);
    return true;
  }
  proceed({
    card,
    to,
    reopen: action.reopen,
    setAside: action.setAside,
    keepDay: false,
    day: action.kind === "unplan" ? null : options.date,
    fromMenu: options.fromMenu ?? false,
    from: placeOf(card),
  });
  return true;
}

/** A day for a card, from its menu or a key: Geplant moves within itself. */
function planCard(card: BoardCard, date?: string): boolean {
  if (props.busy || question.value) return false;
  if (columnOf(card.todo) !== "planned")
    return moveCard(card, "planned", { date, fromMenu: true });
  if (date === card.todo.scheduledDate) return false;
  proceed({
    card,
    to: "planned",
    reopen: false,
    setAside: false,
    keepDay: false,
    day: date,
    fromMenu: true,
    from: placeOf(card),
  });
  return true;
}

/** "Zurückstellen …": out of In Arbeit, the day stays. */
function setAsideCard(card: BoardCard): void {
  if (props.busy || question.value) return;
  proceed({
    card,
    to: card.todo.scheduledDate ? "planned" : "todo",
    reopen: false,
    setAside: true,
    keepDay: true,
    fromMenu: true,
    from: placeOf(card),
  });
}

/** Asks what is still open, the blocked question first; then writes. */
function proceed(step: Step): void {
  asking = step;
  if (step.setAside && step.blocked === undefined)
    question.value = { kind: "blocked", step };
  else if (!step.keepDay && step.day === undefined)
    question.value = { kind: "day", step };
  else void apply(step);
}
function answerBlocked(blocked: boolean): void {
  const asked = question.value;
  if (!asked) return;
  question.value = null;
  proceed({ ...asked.step, blocked });
}
function answerDay(date: string): void {
  const asked = question.value;
  if (!asked) return;
  question.value = null;
  proceed({ ...asked.step, day: date });
}
/** Closed without an answer: the card stays where it was. */
function dismissQuestion(): void {
  question.value = null;
}

async function apply(step: Step): Promise<void> {
  const { todo } = step.card;
  const changes: Partial<HierarchyTodo> = { inProgress: false };
  if (step.reopen) Object.assign(changes, { completed: false, completedAt: null });
  if (step.blocked !== undefined) changes.blocked = step.blocked;
  if (!step.keepDay) {
    changes.scheduledDate = step.day ?? null;
    if (!step.day) changes.timeOfDay = null;
  }
  const done = await props.writes.writeShown(
    () => {
      const takeBack = showChange(todo.id, changes);
      status.value = movedLine(todo.title, step.to);
      return () => {
        takeBack();
        status.value = "";
      };
    },
    async () => {
      if (step.reopen)
        await writeDone({ kind: "todo", id: todo.id, title: todo.title }, false);
      if (step.setAside) await setAsideTodo(todo.id, step.blocked ?? false);
      if (step.keepDay) return;
      if (!step.day) {
        if (todo.scheduledDate) await unplanQuest(todo.id);
      } else if (todo.scheduledDate)
        // An appointment keeps its time; its move was confirmed in the dialog.
        await rescheduleTodo(todo.id, step.day, true);
      else await planQuest(todo, step.day);
    },
    {
      key: `board-${todo.id}`,
      fallbackError: "Die Quest konnte nicht verschoben werden.",
    },
  );
  if (done) settle(todo.id);
  if (step.fromMenu) await focusAfter(todo.id, step.from);
}

/** Into In Arbeit by hand: no stopwatch, so several quests can be in work. */
async function startWork(
  card: BoardCard,
  reopen: boolean,
  fromMenu = false,
): Promise<void> {
  const { todo } = card;
  const from = placeOf(card);
  const changes: Partial<HierarchyTodo> = { inProgress: true, blocked: false };
  if (reopen) Object.assign(changes, { completed: false, completedAt: null });
  const done = await props.writes.writeShown(
    () => {
      const takeBack = showChange(todo.id, changes);
      status.value = movedLine(todo.title, "working");
      return () => {
        takeBack();
        status.value = "";
      };
    },
    async () => {
      if (reopen)
        await writeDone({ kind: "todo", id: todo.id, title: todo.title }, false);
      await startWorkOnTodo(todo.id);
    },
    {
      key: `board-${todo.id}`,
      fallbackError: "Die Quest konnte nicht in Arbeit genommen werden.",
    },
  );
  if (done) settle(todo.id);
  if (fromMenu) await focusAfter(todo.id, from);
}

/** The reload is in: the server's column counts, and the line says so. */
function settle(id: number): void {
  forgetChange(id);
  const card = cards.value.find((item) => item.todo.id === id);
  if (card) status.value = movedLine(card.todo.title, columnOf(card.todo));
}

/** Erledigt: through the ring's path, with the undo toast. */
async function complete(card: BoardCard, fromMenu = false): Promise<void> {
  const { todo } = card;
  const from = placeOf(card);
  let confirmed = false;
  try {
    confirmed = await props.ticks.complete(
      { kind: "todo", id: todo.id, title: todo.title },
      {
        key: `board-${todo.id}`,
        fallbackError: "Die Quest konnte nicht erledigt werden.",
        onConfirmed: () => {
          showChange(todo.id, {
            completed: true,
            completedAt: new Date().toISOString(),
          });
          status.value = movedLine(todo.title, "done");
        },
      },
    );
  } finally {
    forgetChange(todo.id);
  }
  if (!confirmed) status.value = "";
  if (fromMenu) await focusAfter(todo.id, from);
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
        { kind: "todo", id: todo.id, title: todo.title },
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
    const trigger = element.querySelector<HTMLElement>(
      `[data-focus-key="todo-${id}"] [aria-haspopup="menu"]`,
    );
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
  return asking ? focusTarget(asking.card.todo.id, asking.from) : null;
}

/** A card was dropped onto another column. */
function onDrop(todoId: number, to: BoardColumn): void {
  const card = cards.value.find((item) => item.todo.id === todoId);
  if (card) moveCard(card, to);
}

/** "Aktionen für …" of a card, in the one order of every view (`rowMenu`). */
function menuOf(card: BoardCard): MenuEntry[] {
  const { todo } = card;
  const column = columnOf(todo);
  const open = column !== "done";
  return rowMenu(
    todo.title,
    {
      quickMoves: open
        ? quickMoveEntries(
            todo.title,
            quickMoves(today(), {
              date: todo.scheduledDate,
              timeOfDay: todo.timeOfDay,
            }),
            (move) => void planCard(card, move.date),
            { disabled: props.busy, plan: !todo.scheduledDate },
          )
        : [],
      otherDay: {
        run: () => void planCard(card),
        appointment: todo.timeOfDay !== null,
        plan: !todo.scheduledDate,
      },
      unplan:
        todo.scheduledDate || !open
          ? () => void moveCard(card, "todo", { fromMenu: true })
          : undefined,
      complete: open ? () => void complete(card, true) : undefined,
      startWork:
        column !== "working"
          ? () => void moveCard(card, "working", { fromMenu: true })
          : undefined,
      setAside: column === "working" ? () => setAsideCard(card) : undefined,
      // In Arbeit asks it with "Zurückstellen …"; lifting a blocker works anywhere.
      block:
        open && (todo.blocked || column !== "working")
          ? { blocked: todo.blocked, run: () => void toggleBlocked(card) }
          : undefined,
      edit: () => emit("edit", todo),
      reparent: () => emit("reparent", todo),
      remove: { run: () => emit("remove", todo) },
    },
    props.busy,
  );
}

/* The keys of the cards' menus work on the card under the pointer or focus. */
function cardOf(key: string | null): BoardCard | null {
  return cards.value.find((card) => `todo-${card.todo.id}` === key) ?? null;
}
function planByKey(key: string | null, date: (today: string) => string) {
  const card = cardOf(key);
  if (!card || card.todo.completed || card.todo.timeOfDay) return false;
  return planCard(card, date(today()));
}
useShortcutHandlers({
  "row.today": ({ key }) => planByKey(key, (day) => day),
  "row.tomorrow": ({ key }) => planByKey(key, (day) => addDays(day, 1)),
  "row.nextWeek": ({ key }) =>
    planByKey(key, (day) => addDays(weekStart(day), 7)),
  "row.done": ({ key }) => {
    const card = cardOf(key);
    if (!card || card.todo.completed || props.busy) return false;
    void complete(card, true);
  },
  "row.timer": ({ key }) => {
    const card = cardOf(key);
    if (!card || card.todo.completed) return false;
    return toggleTimer(
      timer,
      { kind: "todo", targetId: card.todo.id, title: card.todo.title },
      card.todo.timerEligible,
    );
  },
});

/** The quest a question is asked about. */
const asked = computed(() => question.value?.step.card.todo ?? null);
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
        @move="onDrop"
        @toggle="toggle"
        @edit="(card) => emit('edit', card.todo)"
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
            @created="emit('created')"
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
      :item="{
        type: 'todo',
        todoId: asked.id,
        title: asked.title,
        timeOfDay: asked.timeOfDay,
      }"
      :today="today()"
      offer-today
      :return-focus="questionFocus"
      @chosen="answerDay"
      @close="dismissQuestion"
    />
    <ModalDialog
      v-else-if="question?.kind === 'blocked' && asked"
      title="Als geblockt markieren?"
      focus-selector="[data-blocked-answer]"
      :return-focus="questionFocus"
      @close="dismissQuestion"
    >
      <p class="campaign-board__lead">
        „{{ asked.title }}“ kommt aus In Arbeit zurück. Wartet sie auf etwas,
        das gerade nicht weitergeht?
        <template v-if="timerStateOf(timer, 'todo', asked.id)"
          >Ihre Stoppuhr endet dabei, die Zeit bleibt im Logbuch.</template
        >
      </p>
      <div class="campaign-board__answers">
        <button type="button" data-blocked-answer @click="answerBlocked(true)">
          <AppIcon name="blocked" />Ja, geblockt
        </button>
        <button type="button" @click="answerBlocked(false)">
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
