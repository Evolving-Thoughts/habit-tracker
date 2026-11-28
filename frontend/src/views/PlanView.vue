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
import { getBacklogTodos, getPlan } from "../api/day-planner.api";
import { planQuest } from "../api/questlog.api";
import AppIcon from "../components/AppIcon.vue";
import InsertPlaceToggle from "../components/InsertPlaceToggle.vue";
import RowDialogs from "../components/RowDialogs.vue";
import PlanDay from "../components/PlanDay.vue";
import PlanOverdue from "../components/PlanOverdue.vue";
import PlanQuestlog from "../components/PlanQuestlog.vue";
import ColumnChips from "../components/ColumnChips.vue";
import UndoToast from "../components/UndoToast.vue";
import CampaignCompletionDialog from "../components/CampaignCompletionDialog.vue";
import { useListFocus } from "../composables/useListFocus";
import {
  deleteTargetOf,
  editTargetOf,
  moveTargetOf,
  useRowDialogs,
} from "../composables/useRowDialogs";
import { useSnapColumns } from "../composables/useSnapColumns";
import { useViewSession } from "../composables/useViewSession";
import { SHEET_QUERY, useMediaQuery } from "../composables/useMediaQuery";
import {
  focusWhenReady,
  useShortcutHandlers,
} from "../composables/useShortcuts";
import { useTimer } from "../composables/useTimer";
import { useTicks } from "../composables/useTicks";
import { usePlanMove } from "../composables/usePlanMove";
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
  dropAt,
  entryTarget,
  stepDrop,
  type BoardDrop,
  type ShelfDrop,
} from "../utils/plan-move";
import {
  BOARD,
  boardColumns,
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
  questlogStartsOpen,
  shiftedStart,
  startColumn,
  todayScroll,
  type OpenRun,
  type QuestlogChoice,
  type QuestlogQuest,
} from "../utils/week-plan";

const route = useRoute();
const router = useRouter();

const page = ref<HTMLElement | null>(null);
const frame = ref<HTMLElement | null>(null);
const board = ref<HTMLElement | null>(null);
const heading = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

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

/* Kept apart from the load error: the quiet reload after a write must not hide it. */
const writeError = ref<string | null>(null);
const session = useViewSession({ holding: () => rows.holding(), writeError });
/* A card's editor, "Anderer Tag …", campaign move and delete. */
const rows = useRowDialogs({
  root: page,
  session,
  today: () => plan.value?.today ?? today(),
});
const {
  data: plan,
  isLoading,
  errorMessage: loadError,
  reload,
} = session.resource<WeekPlanResponse | null>(
  (signal) => getPlan(first.value, loadedDays.value, signal),
  {
    initial: null,
    fallbackError: "Der Plan konnte nicht geladen werden.",
    params: [first, loadedDays],
    resetOnLoad: true,
  },
);
/* The Questlog column: open quests without a day, in the Questlog's order. */
const { data: backlog, errorMessage: backlogError } = session.resource<
  QuestlogQuest[]
>(() => getBacklogTodos(), {
  initial: [],
  fallbackError: "Der Questlog konnte nicht geladen werden.",
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

const nothingPlanned = computed(
  () =>
    !!plan.value &&
    !hasOverdue.value &&
    shownDays.value.every((day) => !day.entries.length),
);

/* The order of a day and moves between days, shown at once. */
const status = ref("");
/** Said in sight when a drop could not land, such as a run beyond its window. */
const notice = ref("");
/*
 * Every move on the board (a drag, a menu step, an arrow key), whatever it
 * moves: shown at once, written, taken back on failure (`usePlanMove`).
 */
const moves = usePlanMove({ plan, backlog }, session, {
  key: "plan",
  words: "plan",
  said: (line) => {
    notice.value = "";
    status.value = line;
  },
  refused: (line) => (notice.value = line),
});

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
  if (!shownPlan.value || session.busy.value || rows.busy.value) return;
  if (!(await moves.step(entry, direction, shownPlan.value))) return;
  await nextTick();
  focusCard(entryKey(entry, ""), focusOn);
}

function focusCard(key: string, on: "menu" | "card"): void {
  rowControl(page.value, key, on)?.focus();
}

/**
 * Opens the card's editor: a quest's, or a daily's with the notes of this
 * run (a run the schedule only forecasts has none yet). `date` is the
 * column the card stands in, for the focus to come back to; a Google event
 * has no editor here, it is changed in Google.
 */
function openEditing(entry: WeekPlanEntry, date = ""): void {
  if (entry.type !== "event")
    rows.edit(entryKey(entry, date), editTargetOf(entry));
}

/**
 * A card was dropped: on a day (from wherever it came, the Questlog column
 * too) or into the column; what that means is `planMove`'s rule.
 */
function onMove(move: BoardDrop): void {
  void moves.move(move);
}

/** "Nach oben" / "Nach unten" in the column; the focus stays on the menu. */
async function stepQuestlog(drop: ShelfDrop): Promise<void> {
  if (rows.busy.value) return;
  await moves.move({ kind: "questlog", drop });
  await nextTick();
  focusCard(`todo-${drop.todoId}`, "menu");
}

/** The keyboard's way from the column: "Einplanen auf …" puts it at the end of that day. */
function planFromQuestlog(todo: QuestlogQuest, date: string): void {
  const day = plan.value?.days.find((item) => item.date === date);
  if (!day) return;
  void listFocus.around(`todo-${todo.id}`, () =>
    moves.move({
      kind: "day",
      drop: { todoId: todo.id, toDate: date, index: openEntries(day).length },
    }),
  );
}

/**
 * "Anderer Tag …": a quest to any day (an appointment's move is confirmed
 * there), a run to any day of its window, as on Heute. `date` is the
 * column a run stands in; null for one left behind. What is not on today
 * may come back to today in one tap.
 */
function openMoving(entry: WeekPlanTodoEntry | OpenRun, date: string | null): void {
  const on = entry.type === "todo" ? entry.scheduledDate : (date ?? "");
  rows.pickDay(entryKey(entry, ""), moveTargetOf(entry), {
    offerToday: on !== plan.value?.today,
  });
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
const ticks = useTicks(session.write);
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
  await ticks.complete(entryTarget(run), { key: "plan" });
}

/** "Überspringen": this run is left out, the daily goes on. */
async function skipRun(run: OpenRun): Promise<void> {
  if (session.busy.value || rows.busy.value) return;
  const key = entryKey(run, "");
  await listFocus.around(key, async () => {
    if (await ticks.skip(entryTarget(run), "plan"))
      status.value = `„${run.title}“ übersprungen.`;
  });
}

/**
 * Moves an open quest or run by key or menu the way dragging does: onto a
 * day of the board at the end of its order, shown at once, or beyond the
 * board straight away (`useTicks`). Where it may go (a run within its
 * window) is row-actions' rule.
 */
function moveEntry(entry: WeekPlanTodoEntry | OpenRun, date: string): boolean {
  if (session.busy.value || rows.busy.value) return false;
  const day = shownDays.value.find((item) => item.date === date);
  void listFocus.around(entryKey(entry, ""), async () => {
    if (day) {
      await moves.move(dropAt(entry, date, openEntries(day).length));
      return;
    }
    const moved = await ticks.move(entryTarget(entry), date, { key: "plan" });
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
function planQueued(todo: QuestlogQuest, date: string): boolean {
  if (session.busy.value || rows.busy.value) return false;
  if (shownDays.value.some((day) => day.date === date)) {
    planFromQuestlog(todo, date);
    return true;
  }
  void listFocus.around(`todo-${todo.id}`, async () => {
    if (
      await session.write(() => planQuest(todo, date), {
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

/** An open quest or stored run: what moves, ticks and takes the row keys. */
function isOwnOpen(entry: WeekPlanEntry): entry is WeekPlanTodoEntry | OpenRun {
  return isMovable(entry) || isMovableRun(entry);
}

/**
 * An open quest or stored run of the board by its row key, with the column
 * it stands in (null: left behind); events, forecasts and done rows give none.
 */
function openEntry(
  key: string | null,
): { entry: WeekPlanTodoEntry | OpenRun; date: string | null } | null {
  const current = plan.value;
  if (!current) return null;
  for (const entry of current.overdue)
    if (isOwnOpen(entry) && entryKey(entry, "") === key)
      return { entry, date: null };
  for (const day of shownDays.value)
    for (const entry of day.entries)
      if (isOwnOpen(entry) && entryKey(entry, day.date) === key)
        return { entry, date: day.date };
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
    busy: session.busy.value || rows.busy.value,
  };
  const step: RowActions["step"] = (direction) =>
    stepDrop(current, entry, direction)
      ? () => void stepEntry(entry, direction)
      : undefined;
  if (isMovable(entry))
    return {
      ...base,
      move: (to) => moveEntry(entry, to),
      pickDay: () => openMoving(entry, date),
      complete: () =>
        void listFocus.around(entryKey(entry, ""), () =>
          complete(entry, entry.campaign),
        ),
      edit: () => openEditing(entry),
      menuTimer: timer,
      reparent: () =>
        rows.reparent(entryKey(entry, ""), {
          todoId: entry.todoId,
          title: entry.title,
        }),
      step,
      remove: () => rows.remove(entryKey(entry, ""), deleteTargetOf(entry)),
    };
  if (isMovableRun(entry))
    return {
      ...base,
      move: (to) => moveEntry(entry, to),
      pickDay: () => openMoving(entry, date),
      complete: () =>
        void listFocus.around(entryKey(entry, ""), () => completeRun(entry)),
      skip: () => void skipRun(entry),
      edit: () => openEditing(entry, date ?? ""),
      menuTimer: timer,
      step,
      remove: () =>
        rows.remove(entryKey(entry, date ?? ""), deleteTargetOf(entry)),
    };
  return {
    ...base,
    edit: () => openEditing(entry, date ?? ""),
    remove:
      entry.type === "habit"
        ? () => rows.remove(entryKey(entry, date ?? ""), deleteTargetOf(entry))
        : undefined,
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
    busy: session.busy.value || rows.busy.value,
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
  const found = openEntry(key);
  return found ? entryActions(found.entry, found.date, current) : null;
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

    <RowDialogs :dialogs="rows" />

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
          :busy="session.busy.value || rows.busy.value"
          :days="plannableDays"
          @toggle="toggleQuestlog"
          @move="onMove"
          @step="stepQuestlog"
          @plan="planFromQuestlog"
          @edit="(todo) => rows.edit(`todo-${todo.id}`, { kind: 'todo', id: todo.id })"
          @reparent="
            (todo) =>
              rows.reparent(`todo-${todo.id}`, { todoId: todo.id, title: todo.title })
          "
          @remove="
            (todo) =>
              rows.remove(`todo-${todo.id}`, {
                kind: 'todo',
                id: todo.id,
                title: todo.title,
              })
          "
          @created="session.applied()"
        />
        <PlanOverdue
          v-if="hasOverdue"
          :entries="plan.overdue"
          :open="overdueShown"
          @toggle="toggleOverdue"
          :busy="session.busy.value || rows.busy.value"
          :menu="(entry) => entryMenu(entry, null)"
          @edit="(entry) => openEditing(entry, 'overdue')"
          @move="onMove"
        />
        <PlanDay
          v-for="day in shownDays"
          :key="day.date"
          :day="day"
          :today="plan.today"
          :busy="session.busy.value || rows.busy.value"
          :menu="(entry) => entryMenu(entry, day.date)"
          @edit="(entry) => openEditing(entry, day.date)"
          @arrow="(entry, key) => void stepEntry(entry, key, 'card')"
          @move="onMove"
          @created="session.applied()"
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
