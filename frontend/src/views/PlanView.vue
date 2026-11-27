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
  rescheduleOccurrence,
  rescheduleTodo,
} from "../api/day-planner.api";
import { planQuest, unplanQuest } from "../api/questlog.api";
import AppIcon from "../components/AppIcon.vue";
import InsertPlaceToggle from "../components/InsertPlaceToggle.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import MoveItemDialog, {
  type MoveTarget,
} from "../components/MoveItemDialog.vue";
import CampaignMoveDialog from "../components/CampaignMoveDialog.vue";
import DeleteItemDialog, {
  type DeleteTarget,
} from "../components/DeleteItemDialog.vue";
import PlanDay from "../components/PlanDay.vue";
import PlanOverdue from "../components/PlanOverdue.vue";
import PlanQuestlog from "../components/PlanQuestlog.vue";
import ColumnChips from "../components/ColumnChips.vue";
import UndoToast from "../components/UndoToast.vue";
import CampaignCompletionDialog from "../components/CampaignCompletionDialog.vue";
import { useListFocus } from "../composables/useListFocus";
import { useSnapColumns } from "../composables/useSnapColumns";
import { useLoader } from "../composables/useLoader";
import { SHEET_QUERY, useMediaQuery } from "../composables/useMediaQuery";
import {
  focusWhenReady,
  useShortcutHandlers,
} from "../composables/useShortcuts";
import { useTimer } from "../composables/useTimer";
import { useTicks } from "../composables/useTicks";
import { useWrites } from "../composables/useWrites";
import { useEventDrop, useForecastDrop } from "../composables/useEventDrop";
import { forecastStaysLine } from "../utils/day-drop";
import type {
  WeekPlanEntry,
  WeekPlanResponse,
  WeekPlanTodoEntry,
} from "../types/week-plan";
import {
  planRow,
  questRow,
  rowControl,
  rowMenu,
  rowShortcuts,
  type MenuEntry,
  type RowActions,
} from "../utils/row-actions";
import { addDays, getCurrentDateInTimeZone } from "../utils/date";
import {
  dayLabel,
  fullStop,
  rangeLabel,
  shortDate,
  weekdayName,
} from "../utils/history";
import {
  BOARD,
  boardColumns,
  dropOnDay,
  dropRunOnDay,
  entryKey,
  firstDayFromQuery,
  fittingDays,
  isMovable,
  isMovableRun,
  MAX_PLAN_DAYS,
  openEntries,
  PHONE_PLAN_DAYS,
  planChips,
  planQuery,
  questlogEntry,
  questlogStartsOpen,
  shelveQuest,
  shiftedStart,
  startColumn,
  stepDrop,
  stepRunDrop,
  todayScroll,
  type BoardDrop,
  type Drop,
  type OpenRun,
  type QuestlogChoice,
  type QuestlogQuest,
  type RunDrop,
  type ShelfDrop,
} from "../utils/week-plan";

const route = useRoute();
const router = useRouter();

const page = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const board = ref<HTMLElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

/**
 * The editor that is open: a quest's (from the board or the Questlog
 * column) or a daily's, with the notes of the run it was opened from.
 */
const editing = ref<
  | { kind: "todo"; id: number }
  | { kind: "habit"; id: number; occurrenceId: number | null }
  | null
>(null);
/** "Anderer Tag …" for a quest or a run, and the day it is on now. */
const moving = ref<{ target: MoveTarget; date: string } | null>(null);
/** "In Kampagne verschieben …" (quests) or "Löschen" for a card. */
const menuDialog = ref<
  | { kind: "move"; todoId: number; title: string }
  | { kind: "delete"; target: DeleteTarget }
  | null
>(null);
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
/**
 * Below 40rem every column is a screen wide and snaps into place, the
 * Questlog among them; chips above jump between the columns.
 */
const phone = useMediaQuery(SHEET_QUERY);
const QUESTLOG_KEY = "plan:questlog";
function readQuestlogChoice(): string | null {
  try {
    return localStorage.getItem(QUESTLOG_KEY);
  } catch {
    return null;
  }
}
/** "Liegen geblieben" stays as it was left on this device; open by default. */
const OVERDUE_KEY = "plan:overdue";
function readOverdueOpen(): boolean {
  try {
    return localStorage.getItem(OVERDUE_KEY) !== "closed";
  } catch {
    return true;
  }
}
const overdueOpen = ref(readOverdueOpen());
/** A phone shows it open: a column of its own needs no folding. */
const overdueShown = computed(() => phone.value || overdueOpen.value);
function toggleOverdue(): void {
  overdueOpen.value = !overdueOpen.value;
  try {
    localStorage.setItem(OVERDUE_KEY, overdueOpen.value ? "open" : "closed");
  } catch {
    // Without storage the choice lasts until the page is left.
  }
}
/** A choice made on this device; until then the window's width decides. */
const questlogChoice = ref<string | null>(readQuestlogChoice());
const questlogOpen = computed(() =>
  phone.value ||
  questlogStartsOpen(questlogChoice.value, frameWidth.value ? frameWidth.value >= BOARD.questlogOpen + BOARD.column + BOARD.gap : wide.value),
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
  if (phone.value) return PHONE_PLAN_DAYS;
  return frameWidth.value > 0
    ? fittingDays(frameWidth.value, {
        questlogOpen: questlogOpen.value,
        overdue,
        overdueOpen: overdueShown.value,
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
  phone.value
    ? `repeat(${chips.value.length}, 100%)`
    : boardColumns({
        questlogOpen: questlogOpen.value,
        overdue: hasOverdue.value,
        overdueOpen: overdueShown.value,
        days: shownCount.value,
      }),
);
/** The phone's strip: one chip per column, Questlog · Liegen geblieben · Heute · Mi … */
const chips = computed(() =>
  plan.value
    ? planChips({
        overdue: hasOverdue.value,
        days: shownDays.value.map((day) => day.date),
        today: plan.value.today,
      })
    : [],
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
/* A Google event sorted within its day: the rule all day views share. */
const applyEventDrop = useEventDrop(plan, writes, {
  key: "plan",
  said: (line) => {
    notice.value = "";
    status.value = line;
  },
});
/** Said in sight when a drop could not land, such as a run beyond its window. */
const notice = ref("");
/* A forecast run sorted within its day: its place waits for that day. */
const applyForecastDrop = useForecastDrop(plan, writes, {
  key: "plan",
  said: (line) => {
    notice.value = "";
    status.value = line;
  },
});

/** Where an open entry now stands, for the live region. */
function placeLine(
  plan: WeekPlanResponse,
  toDate: string,
  matches: (entry: WeekPlanEntry) => boolean,
  moved: boolean,
): string {
  const day = plan.days.find(({ date }) => date === toDate)!;
  const open = openEntries(day);
  const entry = open.find(matches)!;
  return moved
    ? fullStop(`„${entry.title}“ steht jetzt am ${dayLabel(toDate)}`)
    : `„${entry.title}“ steht jetzt an Stelle ${open.indexOf(entry) + 1} von ${
        open.length
      }.`;
}

async function applyDrop(drop: Drop): Promise<void> {
  const before = plan.value;
  if (!before || writes.busy.value) return;
  const result = dropOnDay(before, drop);
  if (!result) return;
  const { write } = result;
  await writes.writeShown(
    () => {
      plan.value = result.plan;
      notice.value = "";
      status.value = placeLine(
        result.plan,
        drop.toDate,
        (item) => item.type === "todo" && item.todoId === write.todoId,
        !!write.moveTo,
      );
      return () => {
        plan.value = before;
        status.value = "";
      };
    },
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
}

/** An open stored run on the board or left behind, with the day it is on. */
function findRun(occurrenceId: number): { run: OpenRun; date: string | null } | null {
  const current = plan.value;
  if (!current) return null;
  for (const entry of current.overdue)
    if (isMovableRun(entry) && entry.occurrenceId === occurrenceId)
      return { run: entry, date: null };
  for (const day of current.days)
    for (const entry of day.entries)
      if (isMovableRun(entry) && entry.occurrenceId === occurrenceId)
        return { run: entry, date: day.date };
  return null;
}

/** "bis Freitag, 21. Nov." or, when it may stay only where it is, nothing. */
function windowLine(run: OpenRun): string {
  return run.moveUntil
    ? fullStop(`„${run.title}“ kann höchstens bis ${dayLabel(run.moveUntil)} warten`)
    : `„${run.title}“ bleibt an seinem Tag.`;
}

/**
 * A daily's run dropped or stepped onto a day: shown at once, then moved
 * through the same path as Heute's "Morgen" and sorted into its new day.
 * Beyond its window it stays and the board says how far it may go.
 */
async function applyRunDrop(drop: RunDrop): Promise<boolean> {
  const before = plan.value;
  if (!before || writes.busy.value) return false;
  const result = dropRunOnDay(before, drop);
  if (!result) {
    const found = findRun(drop.occurrenceId);
    if (found && found.date !== drop.toDate)
      notice.value = windowLine(found.run);
    return false;
  }
  const { write } = result;
  return writes.writeShown(
    () => {
      plan.value = result.plan;
      notice.value = "";
      status.value = placeLine(
        result.plan,
        drop.toDate,
        (item) =>
          isMovableRun(item) && item.occurrenceId === write.occurrenceId,
        !!write.moveTo,
      );
      return () => {
        plan.value = before;
        status.value = "";
      };
    },
    async () => {
      if (write.moveTo)
        await rescheduleOccurrence(write.occurrenceId, write.moveTo);
      if (write.order) await reorderDay(write.order);
    },
    {
      key: "plan",
      fallbackError: "Das Daily konnte nicht verschoben werden.",
    },
  );
}

/**
 * A step without dragging: "Nach oben" and "Nach unten" in a card's menu,
 * or an arrow key on the focused card (left and right a day). The focus
 * stays with the moved card: on its menu button, or on the card itself.
 */
async function stepEntry(
  entry: WeekPlanEntry,
  direction: "up" | "down" | "left" | "right",
  focusOn: "menu" | "card" = "menu",
): Promise<void> {
  if (!shownPlan.value || writes.busy.value || dialogBusy.value) return;
  if (isMovable(entry)) {
    const drop = stepDrop(shownPlan.value, entry.todoId, direction);
    if (!drop) return;
    await applyDrop(drop);
  } else if (isMovableRun(entry)) {
    const drop = stepRunDrop(shownPlan.value, entry.occurrenceId, direction);
    if (!drop) {
      if (direction === "left" || direction === "right")
        notice.value = windowLine(entry);
      return;
    }
    await applyRunDrop(drop);
  } else return;
  await nextTick();
  focusCard(entryKey(entry, ""), focusOn);
}

function focusCard(key: string, on: "menu" | "card"): void {
  rowControl(page.value, key, on)?.focus();
}

/**
 * Opens the card's editor: a quest's, or a daily's with the notes of this
 * run (a run the schedule only forecasts has none yet). `date` is the
 * column the card stands in, for the focus to come back to.
 */
function openEditing(entry: WeekPlanEntry | { todoId: number }, date = ""): void {
  if (dialogBusy.value || writes.busy.value) return;
  // A Google event has no editor here: it is changed in Google.
  if ("type" in entry && entry.type === "event") return;
  if ("type" in entry && entry.type === "habit") {
    listFocus.remember(entryKey(entry, date));
    editing.value = {
      kind: "habit",
      id: entry.habitId,
      occurrenceId: entry.occurrenceId,
    };
    return;
  }
  listFocus.remember(`todo-${entry.todoId}`);
  editing.value = { kind: "todo", id: entry.todoId };
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
  const { order } = result.write;
  await writes.writeShown(
    () => {
      plan.value = result.plan;
      backlog.value = backlogBefore.filter((item) => item.id !== todo.id);
      status.value = fullStop(
        `„${todo.title}“ steht jetzt am ${dayLabel(drop.toDate)}`,
      );
      return () => {
        plan.value = before;
        backlog.value = backlogBefore;
        status.value = "";
      };
    },
    async () => {
      await planQuest(todo, drop.toDate);
      if (order) await reorderDay(order);
    },
    { key: "plan", fallbackError: "Die Quest konnte nicht eingeplant werden." },
  );
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
  return writes.writeShown(
    () => {
      plan.value = result.plan;
      backlog.value = result.backlog;
      status.value = `„${quest.title}“ steht jetzt im Questlog an Stelle ${
        place + 1
      } von ${write.order.length}.`;
      return () => {
        plan.value = before;
        backlog.value = backlogBefore;
        status.value = "";
      };
    },
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
}

/** A card was dropped: on a day (from wherever it came) or into the column. */
function onMove(move: BoardDrop): void {
  if (move.kind === "questlog") {
    void applyShelve(move.drop);
    return;
  }
  if (move.kind === "run") {
    void applyRunDrop(move.drop);
    return;
  }
  if (move.kind === "event") {
    void applyEventDrop(move.drop);
    return;
  }
  if (move.kind === "forecast") {
    void applyForecastDrop(move.drop);
    return;
  }
  if (move.kind === "refused") {
    notice.value = forecastStaysLine(move.title);
    return;
  }
  const drop = move.drop;
  const queued = backlog.value.some((todo) => todo.id === drop.todoId);
  void (queued ? applyQuestlogDrop(drop) : applyDrop(drop));
}

/** "Nach oben" / "Nach unten" in the column; the focus stays on the menu. */
async function stepQuestlog(drop: ShelfDrop): Promise<void> {
  if (dialogBusy.value) return;
  await applyShelve(drop);
  await nextTick();
  focusCard(`todo-${drop.todoId}`, "menu");
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
  moving.value = {
    target: {
      type: "todo",
      todoId: entry.todoId,
      title: entry.title,
      timeOfDay: entry.timeOfDay,
    },
    date: entry.scheduledDate,
  };
}

/** "Anderer Tag …" of a run: any day of its window, as on Heute. */
function openMovingRun(run: OpenRun, date: string | null): void {
  if (dialogBusy.value || writes.busy.value) return;
  listFocus.remember(entryKey(run, ""));
  moving.value = {
    target: {
      type: "habit",
      occurrenceId: run.occurrenceId,
      title: run.title,
      moveUntil: run.moveUntil,
    },
    date: date ?? "",
  };
}

function openMenuDialog(
  kind: "move" | "delete",
  todo: { todoId: number; title: string },
): void {
  if (dialogBusy.value || writes.busy.value) return;
  listFocus.remember(`todo-${todo.todoId}`);
  menuDialog.value =
    kind === "move"
      ? { kind, todoId: todo.todoId, title: todo.title }
      : { kind, target: { kind: "todo", id: todo.todoId, title: todo.title } };
}

/** "Löschen" of a daily, from any of its runs: the whole daily goes. */
function openDeleteDaily(entry: WeekPlanEntry, date: string): void {
  if (entry.type !== "habit" || dialogBusy.value || writes.busy.value) return;
  listFocus.remember(entryKey(entry, date));
  menuDialog.value = {
    kind: "delete",
    target: { kind: "habit", id: entry.habitId, title: entry.title },
  };
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
 * On a phone the board shows one column at a time; the chip of the column
 * in view is marked, and a tap on a chip brings its column (shared with
 * the campaign board: `useSnapColumns`, `ColumnChips`).
 */
const {
  current,
  onScroll: onBoardScroll,
  showColumn,
} = useSnapColumns(board, { active: phone, count: () => chips.value.length });

/*
 * A freshly shown board opens on today. On a phone that is today's column
 * (or the first day's, when the board starts later). Wider, the board starts
 * at its first column while today is in view from there; otherwise (the
 * Questlog open in a narrow window, the column of what was left behind) it
 * scrolls just far enough for today to stand beside the Questlog column,
 * which stays in place.
 */
function openOnToday(scroller: HTMLElement | null): void {
  if (!scroller || !plan.value) return;
  if (phone.value) {
    showColumn(startColumn(chips.value, plan.value.today), false);
    return;
  }
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
}
watch(board, openOnToday, { flush: "post" });
watch(phone, () => openOnToday(board.value), { flush: "post" });

/* Ticking with X, its undo toast and the campaign question: `useTicks`. */
const ticks = useTicks(writes.write);
const { undo, undoLast } = ticks;
async function complete(
  entry: { todoId: number; title: string },
  campaign: { id: number } | null,
): Promise<void> {
  // A campaign with open quests asks first, as everywhere.
  await ticks.complete(
    { kind: "todo", id: entry.todoId, title: entry.title },
    {
      key: "plan",
      campaign: campaign?.id === entry.todoId ? "lookup" : undefined,
    },
  );
}
/** X on a run due by today: done through the same path as Heute's ring. */
async function completeRun(run: OpenRun): Promise<void> {
  await ticks.complete(
    { kind: "occurrence", id: run.occurrenceId, title: run.title },
    { key: "plan" },
  );
}

/** "Überspringen": this run is left out, the daily goes on. */
async function skipRun(run: OpenRun): Promise<void> {
  if (writes.busy.value || dialogBusy.value) return;
  const key = entryKey(run, "");
  await listFocus.around(key, async () => {
    if (
      await ticks.skip(
        { kind: "occurrence", id: run.occurrenceId, title: run.title },
        "plan",
      )
    )
      status.value = `„${run.title}“ übersprungen.`;
  });
}

/**
 * Moves a quest by key or menu the way dragging does: onto a day of the
 * board at the end of its order, shown at once, or beyond the board the
 * way of "Verschieben". Where it may go is row-actions' rule.
 */
function moveQuest(entry: WeekPlanTodoEntry, date: string): boolean {
  if (writes.busy.value || dialogBusy.value) return false;
  const day = shownDays.value.find((item) => item.date === date);
  void listFocus.around(entryKey(entry, ""), async () => {
    if (day) {
      await applyDrop({
        todoId: entry.todoId,
        toDate: date,
        index: openEntries(day).length,
      });
      return;
    }
    const moved = await ticks.move(
      { kind: "todo", id: entry.todoId, title: entry.title },
      date,
      { key: "plan" },
    );
    if (moved)
      status.value = fullStop(
        `„${entry.title}“ steht jetzt am ${dayLabel(date)}`,
      );
  });
  return true;
}

/**
 * Moves a run by key or menu like Heute: onto the end of that day of the
 * board, or beyond the board straight away; within its window only.
 */
function moveRun(run: OpenRun, date: string): boolean {
  if (writes.busy.value || dialogBusy.value) return false;
  const day = shownDays.value.find((item) => item.date === date);
  void listFocus.around(entryKey(run, ""), async () => {
    if (day) {
      await applyRunDrop({
        occurrenceId: run.occurrenceId,
        toDate: date,
        index: openEntries(day).length,
      });
      return;
    }
    const moved = await ticks.move(
      { kind: "occurrence", id: run.occurrenceId, title: run.title },
      date,
      { key: "plan" },
    );
    if (moved)
      status.value = fullStop(`„${run.title}“ steht jetzt am ${dayLabel(date)}`);
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
function planQueued(todo: QuestlogQuest, date: string): boolean {
  if (writes.busy.value || dialogBusy.value) return false;
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

/** An open stored run of the board by its row key, with its day (null: left behind). */
function openRun(key: string | null): { run: OpenRun; date: string | null } | null {
  const current = plan.value;
  if (!current) return null;
  for (const entry of current.overdue)
    if (isMovableRun(entry) && entryKey(entry, "") === key)
      return { run: entry, date: null };
  for (const day of shownDays.value)
    for (const entry of day.entries)
      if (isMovableRun(entry) && entryKey(entry, day.date) === key)
        return { run: entry, date: day.date };
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

const timer = useTimer();

/**
 * What a card of the board can do, by what it is: its menu and its keys
 * (row-actions). `date` is the column it stands in; null for what was left
 * behind (it has no place in a day yet, so no up or down). Compact cards
 * have no ▶, so the menu carries the stopwatch. A forecast run can only
 * have its daily edited or deleted yet.
 */
function entryActions(
  entry: WeekPlanEntry,
  date: string | null,
  current: WeekPlanResponse,
): RowActions {
  const base = {
    row: planRow(entry, date),
    today: current.today,
    busy: writes.busy.value || dialogBusy.value,
  };
  if (isMovable(entry))
    return {
      ...base,
      move: (to) => moveQuest(entry, to),
      pickDay: () => openMoving(entry),
      complete: () =>
        void listFocus.around(entryKey(entry, ""), () =>
          complete(entry, entry.campaign),
        ),
      edit: () => openEditing(entry),
      menuTimer: timer,
      reparent: () => openMenuDialog("move", entry),
      step: (direction) =>
        stepDrop(current, entry.todoId, direction)
          ? () => void stepEntry(entry, direction)
          : undefined,
      remove: () => openMenuDialog("delete", entry),
    };
  if (isMovableRun(entry))
    return {
      ...base,
      move: (to) => moveRun(entry, to),
      pickDay: () => openMovingRun(entry, date),
      complete: () =>
        void listFocus.around(entryKey(entry, ""), () => completeRun(entry)),
      skip: () => void skipRun(entry),
      edit: () => openEditing(entry, date ?? ""),
      menuTimer: timer,
      step: (direction) =>
        date !== null && stepRunDrop(current, entry.occurrenceId, direction)
          ? () => void stepEntry(entry, direction)
          : undefined,
      remove: () => openDeleteDaily(entry, date ?? ""),
    };
  return {
    ...base,
    edit: () => openEditing(entry, date ?? ""),
    remove: () => openDeleteDaily(entry, date ?? ""),
  };
}

/** A card's menu, in the column of `date` (null: left behind). */
function entryMenu(entry: WeekPlanEntry, date: string | null): MenuEntry[] {
  const current = shownPlan.value;
  return current ? rowMenu(entryActions(entry, date, current)) : [];
}

/**
 * The keys on a quest of the Questlog column: planned like its menu, done
 * and measured like any quest. Its menu is the column's own (PlanQuestlog).
 */
function queuedActions(
  todo: QuestlogQuest,
  current: WeekPlanResponse | null,
): RowActions {
  return {
    row: questRow(todo),
    today: current?.today ?? today(),
    busy: writes.busy.value || dialogBusy.value,
    move: current ? (date) => planQueued(todo, date) : undefined,
    complete: () =>
      void listFocus.around(`todo-${todo.id}`, () =>
        complete({ todoId: todo.id, title: todo.title }, todo.campaign),
      ),
  };
}

/** The row the keys mean: a quest of the column, an open run or quest of the board. */
function rowByKey(key: string | null): RowActions | null {
  const current = plan.value;
  const queued = questlogQuest(key);
  if (queued) return queuedActions(queued, current);
  if (!current) return null;
  const found = openRun(key);
  if (found) return entryActions(found.run, found.date, current);
  const entry = openQuest(key);
  return entry ? entryActions(entry, null, current) : null;
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
  ...rowShortcuts(rowByKey, timer),
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
        <!--
          Where new quests go, once for every column's quick add. A word and a
          divider keep it from reading as part of the day arrows; the group's
          own name ("Neue Quests einfügen") is what screen readers hear.
        -->
        <div class="plan-view__place">
          <span class="plan-view__place-label" aria-hidden="true">Neue</span>
          <InsertPlaceToggle />
        </div>
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
      :key="`${editing.kind}-${editing.id}`"
      :kind="editing.kind"
      :entity-id="editing.id"
      :occurrence-id="editing.kind === 'habit' ? editing.occurrenceId : null"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @changed="onDialogDone"
      @close="closeDialogs"
    />
    <MoveItemDialog
      v-if="moving && plan"
      :item="moving.target"
      :today="plan.today"
      :offer-today="moving.date !== plan.today"
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
      :target="menuDialog.target"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @deleted="onDialogDone"
      @close="closeDialogs"
    />

    <div v-if="writeError" class="alert plan-view__alert" role="alert">
      <p>{{ writeError }}</p>
    </div>
    <p class="visually-hidden" role="status">{{ status }}</p>
    <p v-if="notice" class="plan-view__notice" role="status">{{ notice }}</p>

    <!--
      A phone's chips: one per column, the one in view marked by its frame and
      weight (aria-current); a tap brings its column.
    -->
    <ColumnChips
      v-if="phone && plan && !isLoading && !loadError"
      :chips="chips"
      :current="current"
      label="Spalten des Plans"
      @show="showColumn"
    />

    <!-- Measured for the columns that fit; always there, whatever it holds. -->
    <div ref="frame" class="plan-view__frame">
      <!-- Bones in the board's own layout; they never scroll sideways. -->
      <div
        v-if="isLoading"
        class="plan-view__skeleton"
        :style="{
          gridTemplateColumns: phone
            ? '100%'
            : boardColumns({
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
        :class="{ 'snap-board': phone }"
        :style="{ gridTemplateColumns: columns }"
        @scroll.passive="onBoardScroll"
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
          @created="writes.applied()"
        />
        <PlanOverdue
          v-if="hasOverdue"
          :entries="plan.overdue"
          :open="overdueShown"
          @toggle="toggleOverdue"
          :busy="writes.busy.value || dialogBusy"
          :menu="(entry) => entryMenu(entry, null)"
          @edit="(entry) => openEditing(entry, 'overdue')"
          @move="onMove"
        />
        <PlanDay
          v-for="day in shownDays"
          :key="day.date"
          :day="day"
          :today="plan.today"
          :busy="writes.busy.value || dialogBusy"
          :menu="(entry) => entryMenu(entry, day.date)"
          @edit="(entry) => openEditing(entry, day.date)"
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
      v-if="ticks.campaignQuestion.value"
      :title="ticks.campaignQuestion.value.title"
      :open="ticks.campaignQuestion.value.open"
      @confirm="ticks.answerCampaign(true)"
      @cancel="ticks.answerCampaign(false)"
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

/* The insert choice stands apart from the day arrows: a word, then a rule. */
.plan-view__place {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-right: var(--space-1);
  padding-right: var(--space-2);
  border-right: 1px solid var(--color-line-strong);
}

.plan-view__place-label {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
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

/* A phone: one column per screen, snapping (`.snap-board` in style.css). */
.plan-view__board.snap-board {
  gap: var(--space-3);
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

.plan-view__notice {
  margin: 0 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  font-weight: 600;
}

.plan-view__quiet {
  margin: var(--space-2) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
</style>
