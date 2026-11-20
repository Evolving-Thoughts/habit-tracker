<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getBacklogTodos,
  getPlan,
  reorderBacklog,
  reorderDay,
  rescheduleTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { planQuest, unplanQuest } from "../api/questlog.api";
import AppIcon from "../components/AppIcon.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import MoveItemDialog from "../components/MoveItemDialog.vue";
import CampaignMoveDialog from "../components/CampaignMoveDialog.vue";
import DeleteItemDialog from "../components/DeleteItemDialog.vue";
import PlanDay from "../components/PlanDay.vue";
import PlanOverdue from "../components/PlanOverdue.vue";
import PlanQuestlog from "../components/PlanQuestlog.vue";
import UndoToast from "../components/UndoToast.vue";
import CampaignCompletionDialog from "../components/CampaignCompletionDialog.vue";
import { useCampaignCompletion } from "../composables/useCampaignCompletion";
import { useListFocus } from "../composables/useListFocus";
import { useLoader } from "../composables/useLoader";
import { useMediaQuery } from "../composables/useMediaQuery";
import {
  focusWhenReady,
  useShortcutHandlers,
} from "../composables/useShortcuts";
import { toggleTimer, useTimer } from "../composables/useTimer";
import { useUndo } from "../composables/useUndo";
import { useWrites } from "../composables/useWrites";
import type { WeekPlanResponse, WeekPlanTodoEntry } from "../types/week-plan";
import {
  quickMoveEntries,
  quickMoves,
  rowMenu,
  timerStep,
  type MenuEntry,
} from "../utils/row-actions";
import { addDays, getCurrentDateInTimeZone, weekStart } from "../utils/date";
import {
  dayLabel,
  fullStop,
  rangeLabel,
  shortDate,
  weekdayName,
} from "../utils/history";
import {
  boardColumns,
  dropOnDay,
  entryKey,
  firstDayFromQuery,
  fittingDays,
  isMovable,
  MAX_PLAN_DAYS,
  openEntries,
  planQuery,
  questlogEntry,
  questlogStartsOpen,
  shelveQuest,
  shiftedStart,
  stepDrop,
  todayScroll,
  type BoardDrop,
  type Drop,
  type QuestlogChoice,
  type QuestlogQuest,
  type ShelfDrop,
} from "../utils/week-plan";

const route = useRoute();
const router = useRouter();

const page = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const board = ref<HTMLElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

/** The quest whose editor is open, from the board or from the Questlog column. */
const editing = ref<{ todoId: number } | null>(null);
const moving = ref<WeekPlanTodoEntry | null>(null);
/** "In Kampagne verschieben …" or "Löschen" for a quest of the board or column. */
const menuDialog = ref<{
  kind: "move" | "delete";
  todoId: number;
  title: string;
} | null>(null);
const dialogBusy = ref(false);
const dialogOpen = () =>
  !!editing.value || !!moving.value || !!menuDialog.value || dialogBusy.value;

/** Asked fresh each time: the app may stay open into the next day. */
const today = (): string => getCurrentDateInTimeZone();
/* The first day lives in the address (#/plan?ab=…), so Back and reload keep it. */
const first = computed(() => firstDayFromQuery(route.query.ab, today()));
function showFrom(day: string): Promise<unknown> {
  return router.push({ query: planQuery(day, today()) });
}
/** "Heute" only shows away from today; there it would change nothing. */
const startsToday = computed(() => first.value === today());
async function showToday(): Promise<void> {
  await showFrom(today());
  // The button leaves with the step; the heading names where it went.
  await nextTick();
  heading.value?.focus();
}

/*
 * As many days as fit: the board measures its frame and fills it with day
 * columns of at least the readable width, beside the Questlog column and
 * the column of what was left behind. Today and the Questlog always show;
 * from 56rem at least two days do, and where even that is too wide the
 * board scrolls sideways. Without layout (tests, before the first measure)
 * it shows a week.
 */
const WITHOUT_LAYOUT_DAYS = 7;
/** One read covers this many days, so a resize rarely needs another. */
const LOADED_DAYS = 14;
const frameWidth = ref(0);
let resizeObserver: ResizeObserver | null = null;
function measure(): void {
  const element = frame.value;
  if (!element) return;
  const rem =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  frameWidth.value = element.clientWidth / rem;
}
onMounted(() => {
  measure();
  if (typeof ResizeObserver === "undefined" || !frame.value) return;
  resizeObserver = new ResizeObserver(measure);
  resizeObserver.observe(frame.value);
});
onBeforeUnmount(() => resizeObserver?.disconnect());

const wide = useMediaQuery("(min-width: 56rem)");
const QUESTLOG_KEY = "plan:questlog";
function readQuestlogChoice(): string | null {
  try {
    return localStorage.getItem(QUESTLOG_KEY);
  } catch {
    return null;
  }
}
/* From 80rem the open column still leaves room for several days. */
const roomy = useMediaQuery("(min-width: 80rem)");
/** A choice made on this device; until then the window's width decides. */
const questlogChoice = ref<string | null>(readQuestlogChoice());
const questlogOpen = computed(() =>
  questlogStartsOpen(questlogChoice.value, roomy.value),
);
function toggleQuestlog(): void {
  const choice: QuestlogChoice = questlogOpen.value ? "closed" : "open";
  questlogChoice.value = choice;
  try {
    localStorage.setItem(QUESTLOG_KEY, choice);
  } catch {
    // Without storage the choice lasts until the page is left.
  }
}

/** The days that fit, with or without the column of what was left behind. */
function daysThatFit(overdue: boolean): number {
  return frameWidth.value > 0
    ? fittingDays(frameWidth.value, {
        questlogOpen: questlogOpen.value,
        overdue,
        least: wide.value ? 2 : 1,
      })
    : WITHOUT_LAYOUT_DAYS;
}
const loadedDays = computed(() =>
  Math.min(MAX_PLAN_DAYS, Math.max(LOADED_DAYS, daysThatFit(false))),
);

const {
  data: plan,
  isLoading,
  errorMessage: loadError,
  reload,
} = useLoader<WeekPlanResponse | null>(
  (signal) => getPlan(first.value, loadedDays.value, signal),
  {
    initial: null,
    fallbackError: "Der Plan konnte nicht geladen werden.",
    params: [first, loadedDays],
    resetOnLoad: true,
    refreshOnChange: () => !dialogOpen() && !writes.busy.value,
  },
);
/* The Questlog column: open quests without a day, in the Questlog's order. */
const {
  data: backlog,
  errorMessage: backlogError,
  reload: reloadBacklog,
} = useLoader<QuestlogQuest[]>(() => getBacklogTodos(), {
  initial: [],
  fallbackError: "Der Questlog konnte nicht geladen werden.",
  refreshOnChange: () => !dialogOpen() && !writes.busy.value,
});

const hasOverdue = computed(() => !!plan.value?.overdue.length);
const shownCount = computed(() => daysThatFit(hasOverdue.value));
const shownDays = computed(() =>
  (plan.value?.days ?? []).slice(0, shownCount.value),
);
/** The board as shown: the arrow keys never move a card out of view. */
const shownPlan = computed<WeekPlanResponse | null>(() =>
  plan.value ? { ...plan.value, days: shownDays.value } : null,
);
const columns = computed(() =>
  boardColumns({
    questlogOpen: questlogOpen.value,
    overdue: hasOverdue.value,
    days: shownCount.value,
  }),
);
const rangeTitle = computed(() =>
  rangeLabel(first.value, addDays(first.value, shownCount.value - 1)),
);

/** Where a quest of the column can go: the days shown. */
const plannableDays = computed(() =>
  shownDays.value.map((day) => ({
    date: day.date,
    label:
      day.date === plan.value!.today
        ? `Heute, ${shortDate(day.date)}`
        : `${weekdayName(day.date)}, ${shortDate(day.date)}`,
  })),
);

/* Kept apart from the load error: the quiet reload after a write must not hide it. */
const writeError = ref<string | null>(null);
const writes = useWrites(async (showPageLoading) => {
  await Promise.all([reload(showPageLoading), reloadBacklog(false)]);
}, writeError);

const nothingPlanned = computed(
  () =>
    !!plan.value &&
    !hasOverdue.value &&
    shownDays.value.every((day) => !day.entries.length),
);

/* The order of a day and moves between days, shown at once. */
const status = ref("");

async function applyDrop(drop: Drop): Promise<void> {
  const before = plan.value;
  if (!before || writes.busy.value) return;
  const result = dropOnDay(before, drop);
  if (!result) return;
  const { write } = result;
  const day = result.plan.days.find(({ date }) => date === drop.toDate)!;
  const entry = openEntries(day).find(
    (item) => item.type === "todo" && item.todoId === write.todoId,
  )!;
  plan.value = result.plan;
  status.value = write.moveTo
    ? fullStop(`„${entry.title}“ steht jetzt am ${dayLabel(drop.toDate)}`)
    : `„${entry.title}“ steht jetzt an Stelle ${
        openEntries(day).indexOf(entry) + 1
      } von ${openEntries(day).length}.`;
  const done = await writes.write(
    async () => {
      if (write.moveTo)
        await rescheduleTodo(write.todoId, write.moveTo, write.confirmFixed);
      if (write.order) await reorderDay(write.order);
    },
    {
      key: "plan",
      fallbackError: "Die Quest konnte nicht verschoben werden.",
    },
  );
  if (done) return;
  // Taken back at once; a quiet reload then shows what the server kept.
  plan.value = before;
  status.value = "";
  void reload(false);
}

/**
 * A step without dragging: "Nach oben" and "Nach unten" in a card's menu,
 * or an arrow key on the focused card (left and right a day). The focus
 * stays with the moved card: on its menu button, or on the card itself.
 */
async function stepEntry(
  entry: WeekPlanTodoEntry,
  direction: "up" | "down" | "left" | "right",
  focusOn: "menu" | "card" = "menu",
): Promise<void> {
  if (!shownPlan.value || writes.busy.value || dialogBusy.value) return;
  const drop = stepDrop(shownPlan.value, entry.todoId, direction);
  if (!drop) return;
  await applyDrop(drop);
  await nextTick();
  focusCard(entry.todoId, focusOn);
}

function focusCard(todoId: number, on: "menu" | "card"): void {
  page.value
    ?.querySelector<HTMLElement>(
      `[data-focus-key="todo-${todoId}"] ${
        on === "menu" ? '[aria-haspopup="menu"]' : "[data-edit-button]"
      }`,
    )
    ?.focus();
}

function openEditing(entry: { todoId: number }): void {
  if (dialogBusy.value || writes.busy.value) return;
  listFocus.remember(`todo-${entry.todoId}`);
  editing.value = { todoId: entry.todoId };
}

/**
 * A quest from the Questlog column lands on a day: shown there at once,
 * gone from the column, then planned with the Questlog's own save and put
 * at its place in the day's order. A failure puts both back.
 */
async function applyQuestlogDrop(drop: Drop): Promise<void> {
  const before = plan.value;
  const backlogBefore = backlog.value;
  const todo = backlogBefore.find((item) => item.id === drop.todoId);
  if (!before || !todo || writes.busy.value) return;
  const result = dropOnDay(before, drop, questlogEntry(todo, drop.toDate));
  if (!result) return;
  plan.value = result.plan;
  backlog.value = backlogBefore.filter((item) => item.id !== todo.id);
  status.value = fullStop(
    `„${todo.title}“ steht jetzt am ${dayLabel(drop.toDate)}`,
  );
  const { order } = result.write;
  const done = await writes.write(
    async () => {
      await planQuest(todo, drop.toDate);
      if (order) await reorderDay(order);
    },
    { key: "plan", fallbackError: "Die Quest konnte nicht eingeplant werden." },
  );
  if (done) return;
  plan.value = before;
  backlog.value = backlogBefore;
  status.value = "";
  void reload(false);
  void reloadBacklog(false);
}

/**
 * A quest dropped into the Questlog column: a quest of the column takes its
 * new place, one from the board loses its day and lands where it was
 * dropped. Shown at once; the Questlog's order is then stored as shown.
 */
async function applyShelve(drop: ShelfDrop): Promise<boolean> {
  const before = plan.value;
  const backlogBefore = backlog.value;
  if (!before || writes.busy.value) return false;
  const result = shelveQuest(before, backlogBefore, drop);
  if (!result) return false;
  const { write } = result;
  const place = write.order.indexOf(write.todoId);
  const quest = result.backlog[place]!;
  plan.value = result.plan;
  backlog.value = result.backlog;
  status.value = `„${quest.title}“ steht jetzt im Questlog an Stelle ${
    place + 1
  } von ${write.order.length}.`;
  const done = await writes.write(
    async () => {
      if (write.unplan) await unplanQuest(write.todoId);
      await reorderBacklog(write.order);
    },
    {
      key: "plan",
      fallbackError: write.unplan
        ? "Die Quest konnte nicht zurück in den Questlog."
        : "Die Reihenfolge konnte nicht gespeichert werden.",
    },
  );
  if (done) return true;
  plan.value = before;
  backlog.value = backlogBefore;
  status.value = "";
  void reload(false);
  void reloadBacklog(false);
  return false;
}

/** A card was dropped: on a day (from wherever it came) or into the column. */
function onMove(move: BoardDrop): void {
  if (move.kind === "questlog") {
    void applyShelve(move.drop);
    return;
  }
  const queued = backlog.value.some((todo) => todo.id === move.drop.todoId);
  void (queued ? applyQuestlogDrop(move.drop) : applyDrop(move.drop));
}

/** "Nach oben" / "Nach unten" in the column; the focus stays on the menu. */
async function stepQuestlog(drop: ShelfDrop): Promise<void> {
  if (dialogBusy.value) return;
  await applyShelve(drop);
  await nextTick();
  focusCard(drop.todoId, "menu");
}

/** The keyboard's way from the column: "Einplanen auf …" puts it at the end of that day. */
function planFromQuestlog(todo: QuestlogQuest, date: string): void {
  const day = plan.value?.days.find((item) => item.date === date);
  if (!day) return;
  void listFocus.around(`todo-${todo.id}`, () =>
    applyQuestlogDrop({
      todoId: todo.id,
      toDate: date,
      index: openEntries(day).length,
    }),
  );
}

function openMoving(entry: WeekPlanTodoEntry): void {
  if (dialogBusy.value || writes.busy.value) return;
  listFocus.remember(entryKey(entry, ""));
  moving.value = entry;
}

function openMenuDialog(
  kind: "move" | "delete",
  todo: { todoId: number; title: string },
): void {
  if (dialogBusy.value || writes.busy.value) return;
  listFocus.remember(`todo-${todo.todoId}`);
  menuDialog.value = { kind, todoId: todo.todoId, title: todo.title };
}

function closeDialogs(): void {
  editing.value = null;
  moving.value = null;
  menuDialog.value = null;
  dialogBusy.value = false;
}

async function onDialogDone(): Promise<void> {
  await writes.applied();
  closeDialogs();
}

/*
 * A freshly shown board starts at its first column while today is in view
 * from there; otherwise (a phone with the Questlog open, the column of
 * what was left behind) it scrolls just far enough for today to stand
 * beside the Questlog column, which stays in place.
 */
watch(
  board,
  (scroller) => {
    if (!scroller || !plan.value) return;
    const todayColumn = scroller.querySelector<HTMLElement>(
      `.plan-day[data-date="${plan.value.today}"]`,
    );
    const questlog = scroller.querySelector<HTMLElement>(".plan-questlog");
    if (!todayColumn || !questlog) return;
    const gap = parseFloat(getComputedStyle(scroller).columnGap) || 0;
    scroller.scrollLeft = todayScroll(
      {
        start: todayColumn.offsetLeft,
        end: todayColumn.offsetLeft + todayColumn.offsetWidth,
      },
      { width: scroller.clientWidth, sticky: questlog.offsetWidth + gap },
    );
  },
  { flush: "post" },
);

/* What the toast takes back after a quest was ticked with X. */
type Ticked = { todoId: number; title: string };
const { undo, offer: offerUndo, take: takeUndo } = useUndo<Ticked>();
const campaignCompletion = useCampaignCompletion();
async function complete(
  entry: Ticked,
  campaign: { id: number } | null,
): Promise<void> {
  // A campaign with open quests asks first, as everywhere.
  const open =
    campaign?.id === entry.todoId
      ? await campaignCompletion.openQuestsBelow(entry.todoId)
      : 0;
  if (!(await campaignCompletion.confirm(entry.title, open))) return;
  const done = await writes.write(
    () => updateTodoCompletion(entry.todoId, true),
    { key: "plan", fallbackError: "Die Quest konnte nicht erledigt werden." },
  );
  if (done)
    offerUndo(
      entry,
      open > 0 ? `„${entry.title}“ abgeschlossen` : `„${entry.title}“ erledigt`,
    );
}
async function undoLast(): Promise<void> {
  const entry = takeUndo();
  if (!entry) return;
  await writes.write(() => updateTodoCompletion(entry.todoId, false), {
    key: "plan",
    fallbackError: "Das Rückgängigmachen hat nicht geklappt.",
  });
}

/**
 * Moves a quest by shortcut the way dragging does: onto a day of the board
 * at the end of its order, shown at once. A day beyond the board goes the
 * way of "Verschieben"; an appointment opens that dialog to be confirmed.
 */
function moveByShortcut(entry: WeekPlanTodoEntry, date: string): boolean {
  const current = plan.value;
  if (!current || writes.busy.value || dialogBusy.value) return false;
  if (date < current.today || entry.scheduledDate === date) return false;
  if (entry.timeOfDay !== null) {
    openMoving(entry);
    return true;
  }
  const key = entryKey(entry, "");
  const day = shownDays.value.find((item) => item.date === date);
  void listFocus.around(key, async () => {
    if (day) {
      await applyDrop({
        todoId: entry.todoId,
        toDate: date,
        index: openEntries(day).length,
      });
      return;
    }
    const moved = await writes.write(
      () => rescheduleTodo(entry.todoId, date, false),
      {
        key: "plan",
        fallbackError: "Die Quest konnte nicht verschoben werden.",
      },
    );
    if (moved)
      status.value = fullStop(
        `„${entry.title}“ steht jetzt am ${dayLabel(date)}`,
      );
  });
  return true;
}

/** A quest of the Questlog column by its row key. */
function questlogQuest(key: string | null): QuestlogQuest | null {
  return backlog.value.find((todo) => `todo-${todo.id}` === key) ?? null;
}

/**
 * T, D and W on a row of the column plan it like its menu: onto that day of
 * the board, or, beyond the board, with the Questlog's own save.
 */
function planQuestlogByKey(todo: QuestlogQuest, date: string): boolean {
  if (!plan.value || writes.busy.value || dialogBusy.value) return false;
  if (date < plan.value.today) return false;
  if (shownDays.value.some((day) => day.date === date)) {
    planFromQuestlog(todo, date);
    return true;
  }
  void listFocus.around(`todo-${todo.id}`, async () => {
    if (
      await writes.write(() => planQuest(todo, date), {
        key: "plan",
        fallbackError: "Die Quest konnte nicht eingeplant werden.",
      })
    )
      status.value = fullStop(
        `„${todo.title}“ steht jetzt am ${dayLabel(date)}`,
      );
  });
  return true;
}

/** An open quest of the board by its row key; dailies and done rows give none. */
function openQuest(key: string | null): WeekPlanTodoEntry | null {
  const current = plan.value;
  if (!current) return null;
  for (const entry of current.overdue)
    if (isMovable(entry) && entryKey(entry, "") === key) return entry;
  for (const day of shownDays.value)
    for (const entry of day.entries)
      if (isMovable(entry) && entryKey(entry, day.date) === key) return entry;
  return null;
}

/** The first column's quick add: today's, unless the board starts later. */
function quickAddField(): HTMLElement | null {
  const day = shownDays.value[0];
  return day
    ? (page.value?.querySelector<HTMLElement>(
        `.plan-day[data-date="${day.date}"] input[name="quickTitle"]`,
      ) ?? null)
    : null;
}

/** T, D and W: a quest of the board moves, one of the column is planned. */
function moveRowByKey(
  key: string | null,
  dateFrom: (today: string) => string,
): boolean {
  if (!plan.value) return false;
  const date = dateFrom(plan.value.today);
  const queued = questlogQuest(key);
  if (queued) return planQuestlogByKey(queued, date);
  const entry = openQuest(key);
  return !!entry && moveByShortcut(entry, date);
}

const timer = useTimer();

/**
 * A card's menu: the quick moves T, D and W run, "Anderer Tag …",
 * Bearbeiten, the stopwatch a compact card has no ▶ for, and up or down in
 * the day (not for what was left behind: it has no place in a day yet).
 */
function entryMenu(entry: WeekPlanTodoEntry): MenuEntry[] {
  const current = shownPlan.value;
  if (!current) return [];
  const busy = writes.busy.value || dialogBusy.value;
  const step = (direction: "up" | "down") =>
    stepDrop(current, entry.todoId, direction)
      ? () => void stepEntry(entry, direction)
      : undefined;
  return rowMenu(
    entry.title,
    {
      quickMoves: quickMoveEntries(
        entry.title,
        quickMoves(current.today, {
          date: entry.scheduledDate,
          timeOfDay: entry.timeOfDay,
        }),
        (move) => void moveByShortcut(entry, move.date),
        { disabled: busy },
      ),
      otherDay: {
        run: () => openMoving(entry),
        appointment: entry.timeOfDay !== null,
      },
      edit: () => openEditing(entry),
      timer: timerStep(
        timer,
        { kind: "todo", targetId: entry.todoId, title: entry.title },
        true,
      ),
      reparent: () => openMenuDialog("move", entry),
      up: step("up"),
      down: step("down"),
      remove: { run: () => openMenuDialog("delete", entry) },
    },
    busy,
  );
}

useShortcutHandlers({
  "quest.new": () => {
    if (isLoading.value) {
      void focusWhenReady(quickAddField);
      return;
    }
    const field = quickAddField();
    if (!field) return false;
    field.focus();
  },
  "row.timer": ({ key }) => {
    const queued = questlogQuest(key);
    if (queued)
      return toggleTimer(
        timer,
        { kind: "todo", targetId: queued.id, title: queued.title },
        queued.timerEligible,
      );
    const entry = openQuest(key);
    if (!entry) return false;
    return toggleTimer(
      timer,
      { kind: "todo", targetId: entry.todoId, title: entry.title },
      true,
    );
  },
  "row.done": ({ key }) => {
    const entry = openQuest(key) ?? questlogQuest(key);
    if (!entry || writes.busy.value || dialogBusy.value) return false;
    const todoId = "todoId" in entry ? entry.todoId : entry.id;
    void listFocus.around(key!, () =>
      complete({ todoId, title: entry.title }, entry.campaign),
    );
  },
  "row.today": ({ key }) => moveRowByKey(key, (today) => today),
  "row.tomorrow": ({ key }) => moveRowByKey(key, (today) => addDays(today, 1)),
  "row.nextWeek": ({ key }) =>
    moveRowByKey(key, (today) => addDays(weekStart(today), 7)),
});
</script>

<template>
  <main ref="page" class="page plan-view">
    <header class="page-header">
      <h1 ref="heading" class="page-title" tabindex="-1">
        <span class="visually-hidden">Plan für </span>{{ rangeTitle }}
      </h1>
      <!-- "Heute" before the arrows, so they keep their place when it leaves. -->
      <div class="plan-view__nav">
        <button
          v-if="!startsToday"
          type="button"
          class="btn"
          @click="showToday"
        >
          Heute
        </button>
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Vorige Tage"
          :disabled="startsToday"
          @click="showFrom(shiftedStart(first, shownCount, -1, today()))"
        >
          <AppIcon name="chevron-left" />
        </button>
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Nächste Tage"
          @click="showFrom(shiftedStart(first, shownCount, 1, today()))"
        >
          <AppIcon name="chevron" />
        </button>
      </div>
    </header>
    <p v-if="nothingPlanned" class="page-lead plan-view__lead">
      Für diese Tage ist noch nichts geplant. Schreib einfach in einen Tag, was
      ansteht.
    </p>

    <EditItemDialog
      v-if="editing"
      :key="editing.todoId"
      kind="todo"
      :entity-id="editing.todoId"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @changed="onDialogDone"
      @close="closeDialogs"
    />
    <MoveItemDialog
      v-if="moving && plan"
      :item="moving"
      :today="plan.today"
      :offer-today="moving.scheduledDate !== plan.today"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @moved="onDialogDone"
      @close="closeDialogs"
    />

    <CampaignMoveDialog
      v-if="menuDialog?.kind === 'move'"
      :todo-id="menuDialog.todoId"
      :title="menuDialog.title"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @moved="onDialogDone"
      @close="closeDialogs"
    />
    <DeleteItemDialog
      v-if="menuDialog?.kind === 'delete'"
      :target="{ kind: 'todo', id: menuDialog.todoId, title: menuDialog.title }"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @deleted="onDialogDone"
      @close="closeDialogs"
    />

    <div v-if="writeError" class="alert plan-view__alert" role="alert">
      <p>{{ writeError }}</p>
    </div>
    <p class="visually-hidden" role="status">{{ status }}</p>

    <!-- Measured for the columns that fit; always there, whatever it holds. -->
    <div ref="frame" class="plan-view__frame">
      <!-- Bones in the board's own layout; they never scroll sideways. -->
      <div
        v-if="isLoading"
        class="plan-view__skeleton"
        :style="{
          gridTemplateColumns: boardColumns({
            questlogOpen,
            overdue: false,
            days: shownCount,
          }),
        }"
        role="status"
        aria-label="Plan wird geladen"
      >
        <span class="plan-view__bone plan-view__bone--questlog" />
        <span v-for="index in shownCount" :key="index" class="plan-view__bone" />
      </div>
      <div v-else-if="loadError" class="alert" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="btn" @click="reload()">
          Erneut versuchen
        </button>
      </div>
      <div
        v-else-if="plan"
        ref="board"
        class="plan-view__board"
        :style="{ gridTemplateColumns: columns }"
      >
        <PlanQuestlog
          :todos="backlog"
          :open="questlogOpen"
          :busy="writes.busy.value || dialogBusy"
          :days="plannableDays"
          @toggle="toggleQuestlog"
          @move="onMove"
          @step="stepQuestlog"
          @plan="planFromQuestlog"
          @edit="(todo) => openEditing({ todoId: todo.id })"
          @reparent="
            (todo) =>
              openMenuDialog('move', { todoId: todo.id, title: todo.title })
          "
          @remove="
            (todo) =>
              openMenuDialog('delete', { todoId: todo.id, title: todo.title })
          "
        />
        <PlanOverdue
          v-if="hasOverdue"
          :entries="plan.overdue"
          :busy="writes.busy.value || dialogBusy"
          :menu="entryMenu"
          @edit="openEditing"
          @move="onMove"
        />
        <PlanDay
          v-for="day in shownDays"
          :key="day.date"
          :day="day"
          :today="plan.today"
          :busy="writes.busy.value || dialogBusy"
          :menu="entryMenu"
          @edit="openEditing"
          @arrow="(entry, key) => void stepEntry(entry, key, 'card')"
          @move="onMove"
          @created="writes.applied()"
        />
      </div>
    </div>
    <p v-if="backlogError" class="plan-view__quiet" role="status">
      {{ backlogError }}
    </p>

    <CampaignCompletionDialog
      v-if="campaignCompletion.question.value"
      :title="campaignCompletion.question.value.title"
      :open="campaignCompletion.question.value.open"
      @confirm="campaignCompletion.reply(true)"
      @cancel="campaignCompletion.reply(false)"
    />
    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
  </main>
</template>

<style scoped>
/* The board takes the window's width: as many days as fit, side by side. */
.plan-view {
  width: min(100% - 2rem, 120rem);
}

.plan-view__nav {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.plan-view__lead {
  margin: calc(var(--space-2) - var(--space-5)) 0 var(--space-4);
}

.plan-view__alert {
  margin-bottom: var(--space-4);
}

/*
 * Questlog, what was left behind, then the days, each day at least as
 * wide as readable titles need (the view counts how many fit, see
 * utils/week-plan.ts). Only where even today does not fit beside the
 * Questlog does the board scroll sideways, inside itself and never the
 * page; the Questlog column then stays at the left edge.
 */
.plan-view__board {
  position: relative;
  display: grid;
  gap: var(--space-2);
  align-items: start;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: var(--space-2);
}

/* The bones take the board's columns but are clipped, never scrolled. */
.plan-view__skeleton {
  display: grid;
  gap: var(--space-2);
  overflow: hidden;
}

.plan-view__bone {
  height: 14rem;
  border-radius: var(--radius-card);
  background: var(--color-surface-flat);
  animation: plan-breathe 1.6s var(--ease-out) infinite alternate;
}

@keyframes plan-breathe {
  to {
    opacity: 0.5;
  }
}

.plan-view__quiet {
  margin: var(--space-2) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
</style>
