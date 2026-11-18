<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getBacklogTodos,
  getWeekPlan,
  reorderDay,
  rescheduleTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { planQuest } from "../api/questlog.api";
import AppIcon from "../components/AppIcon.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import MoveItemDialog from "../components/MoveItemDialog.vue";
import PlanDay from "../components/PlanDay.vue";
import PlanQuestlog from "../components/PlanQuestlog.vue";
import UndoToast from "../components/UndoToast.vue";
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
import type { TodoResponse } from "../types/todo";
import type { WeekPlanResponse, WeekPlanTodoEntry } from "../types/week-plan";
import { addDays, getCurrentDateInTimeZone, weekStart } from "../utils/date";
import {
  dayLabel,
  fullStop,
  shortDate,
  weekdayName,
  weekLabel,
} from "../utils/history";
import {
  arrowDrop,
  dropOnDay,
  entryKey,
  isMovable,
  neighbourWeek,
  openEntries,
  questlogEntry,
  weekFromQuery,
  type Drop,
} from "../utils/week-plan";

const route = useRoute();
const router = useRouter();

const page = ref<HTMLElement | null>(null);
const board = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

/** The quest whose editor is open, from the board or from the Questlog column. */
const editing = ref<{ todoId: number } | null>(null);
const moving = ref<WeekPlanTodoEntry | null>(null);
const dialogBusy = ref(false);

/* The week lives in the address (#/plan?woche=…), so Back and reload keep it. */
const week = computed(() =>
  weekFromQuery(route.query.woche, getCurrentDateInTimeZone()),
);
/** Asked fresh each time: the app may stay open into the next week. */
const thisWeek = (): string =>
  weekFromQuery(null, getCurrentDateInTimeZone());
function showWeek(start: string): void {
  void router.push({
    query: start === thisWeek() ? {} : { woche: start },
  });
}

const {
  data: plan,
  isLoading,
  errorMessage: loadError,
  reload,
} = useLoader<WeekPlanResponse | null>(
  (signal) => getWeekPlan(week.value, signal),
  {
    initial: null,
    fallbackError: "Der Plan konnte nicht geladen werden.",
    params: [week],
    resetOnLoad: true,
    refreshOnChange: () =>
      !editing.value && !moving.value && !dialogBusy.value && !writes.busy.value,
  },
);
/*
 * The Questlog column (from 56rem): open quests without a day, to drag onto
 * the board. A phone shows the Plan as before and loads nothing for it.
 */
const wide = useMediaQuery("(min-width: 56rem)");
const {
  data: backlog,
  errorMessage: backlogError,
  reload: reloadBacklog,
} = useLoader<TodoResponse[]>(
  () => (wide.value ? getBacklogTodos() : Promise.resolve([])),
  {
    initial: [],
    fallbackError: "Der Questlog konnte nicht geladen werden.",
    params: [wide],
    refreshOnChange: () =>
      !editing.value &&
      !moving.value &&
      !dialogBusy.value &&
      !writes.busy.value,
  },
);
const QUESTLOG_KEY = "plan:questlog";
function readQuestlogOpen(): boolean {
  try {
    return localStorage.getItem(QUESTLOG_KEY) !== "closed";
  } catch {
    return true;
  }
}
/** Open or collapsed, remembered per device. */
const questlogOpen = ref(readQuestlogOpen());
function toggleQuestlog(): void {
  questlogOpen.value = !questlogOpen.value;
  try {
    if (questlogOpen.value) localStorage.removeItem(QUESTLOG_KEY);
    else localStorage.setItem(QUESTLOG_KEY, "closed");
  } catch {
    // Without storage the choice lasts until the page is left.
  }
}
/** Where a quest of the column can go: the board's days from today on. */
const plannableDays = computed(() =>
  (plan.value?.days ?? [])
    .filter((day) => day.date >= plan.value!.today)
    .map((day) => ({
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

/* Only a week still ahead invites planning; a past one just stays quiet. */
const nothingPlanned = computed(
  () =>
    !!plan.value &&
    plan.value.endDate >= plan.value.today &&
    plan.value.days.every((day) => !day.entries.length),
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

/** The grip's arrow keys move the quest and keep its grip focused. */
async function onArrow(
  entry: WeekPlanTodoEntry,
  key: "up" | "down" | "left" | "right",
): Promise<void> {
  if (!plan.value) return;
  const drop = arrowDrop(plan.value, entry.todoId, key);
  if (!drop) return;
  await applyDrop(drop);
  await nextTick();
  page.value
    ?.querySelector<HTMLElement>(
      `[data-focus-key="todo-${entry.todoId}"] .sort-handle`,
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

/** The keyboard's way from the column: "Einplanen auf …" puts it at the end of that day. */
function planFromQuestlog(todo: TodoResponse, date: string): void {
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

function closeDialogs(): void {
  editing.value = null;
  moving.value = null;
  dialogBusy.value = false;
}

async function onDialogDone(): Promise<void> {
  await writes.applied();
  closeDialogs();
}

/* A phone shows one day at a time; a freshly shown current week opens on today. */
watch(
  board,
  (scroller) => {
    const column = scroller?.querySelector<HTMLElement>(
      `.plan-day[data-date="${plan.value?.today}"]`,
    );
    if (!scroller || !column) return;
    const padding = parseFloat(getComputedStyle(scroller).scrollPaddingLeft);
    scroller.scrollLeft = column.offsetLeft - (padding || 0);
  },
  { flush: "post" },
);

/* What the toast takes back after a quest was ticked with X. */
type Ticked = { todoId: number; title: string };
const { undo, offer: offerUndo, take: takeUndo } = useUndo<Ticked>();
async function complete(entry: Ticked): Promise<void> {
  const done = await writes.write(
    () => updateTodoCompletion(entry.todoId, true),
    { key: "plan", fallbackError: "Die Quest konnte nicht erledigt werden." },
  );
  if (done) offerUndo(entry, `„${entry.title}“ erledigt`);
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
  const day = current.days.find((item) => item.date === date);
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
function questlogQuest(key: string | null): TodoResponse | null {
  if (!wide.value) return null;
  return backlog.value.find((todo) => `todo-${todo.id}` === key) ?? null;
}

/**
 * T, D and W on a row of the column plan it like its menu: onto that day of
 * the board, or, beyond the board, with the Questlog's own save.
 */
function planQuestlogByKey(todo: TodoResponse, date: string): boolean {
  if (!plan.value || writes.busy.value || dialogBusy.value) return false;
  if (date < plan.value.today) return false;
  if (plan.value.days.some((day) => day.date === date)) {
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
  for (const day of plan.value?.days ?? [])
    for (const entry of day.entries)
      if (isMovable(entry) && entryKey(entry, day.date) === key) return entry;
  return null;
}

/** Today's quick add, or the first day's when this week has not begun. */
function quickAddField(): HTMLElement | null {
  const current = plan.value;
  if (!current) return null;
  const ahead = current.days.filter((day) => day.date >= current.today);
  const day = ahead.find((item) => item.date === current.today) ?? ahead[0];
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
useShortcutHandlers({
  "quest.new": () => {
    if (isLoading.value) {
      void focusWhenReady(quickAddField);
      return;
    }
    // A past week takes nothing new; the app-wide default goes to Heute.
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
    void listFocus.around(key!, () => complete({ todoId, title: entry.title }));
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
      <h1 class="page-title">
        <span class="visually-hidden">Plan für </span>{{ weekLabel(week) }}
      </h1>
      <div class="plan-view__nav">
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Vorige Woche"
          @click="showWeek(neighbourWeek(week, -1))"
        >
          <AppIcon name="chevron-left" />
        </button>
        <button type="button" class="btn" @click="showWeek(thisWeek())">
          Diese Woche
        </button>
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Nächste Woche"
          @click="showWeek(neighbourWeek(week, 1))"
        >
          <AppIcon name="chevron" />
        </button>
      </div>
    </header>
    <p v-if="nothingPlanned" class="page-lead plan-view__lead">
      Für diese Woche ist noch nichts geplant. Schreib einfach in einen Tag,
      was ansteht.
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

    <div v-if="writeError" class="alert plan-view__alert" role="alert">
      <p>{{ writeError }}</p>
    </div>
    <p class="visually-hidden" role="status">{{ status }}</p>

    <div
      v-if="isLoading"
      class="plan-view__board"
      role="status"
      aria-label="Plan wird geladen"
    >
      <span v-for="index in 7" :key="index" class="plan-view__bone" />
    </div>
    <div v-else-if="loadError" class="alert" role="alert">
      <p>{{ loadError }}</p>
      <button type="button" class="btn" @click="reload()">
        Erneut versuchen
      </button>
    </div>
    <div
      v-else-if="plan"
      class="plan-view__layout"
      :class="{
        'plan-view__layout--questlog': wide,
        'plan-view__layout--questlog-open': wide && questlogOpen,
      }"
    >
      <PlanQuestlog
        v-if="wide"
        :todos="backlog"
        :open="questlogOpen"
        :busy="writes.busy.value || dialogBusy"
        :days="plannableDays"
        @toggle="toggleQuestlog"
        @drop="applyQuestlogDrop"
        @plan="planFromQuestlog"
        @edit="(todo) => openEditing({ todoId: todo.id })"
      />
      <div ref="board" class="plan-view__board">
        <PlanDay
          v-for="day in plan.days"
          :key="day.date"
          :day="day"
          :today="plan.today"
          :busy="writes.busy.value || dialogBusy"
          @edit="openEditing"
          @move="openMoving"
          @arrow="onArrow"
          @drop="applyDrop"
          @created="writes.applied()"
        />
      </div>
    </div>
    <p v-if="wide && backlogError" class="plan-view__quiet" role="status">
      {{ backlogError }}
    </p>

    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
  </main>
</template>

<style scoped>
/* The board needs more room than a page column: seven days side by side. */
.plan-view {
  width: min(100% - 2rem, 90rem);
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
 * Seven columns where they fit; otherwise the days scroll sideways inside
 * the board, never the page.
 */
.plan-view__board {
  position: relative;
  display: grid;
  grid-auto-columns: minmax(10.5rem, 1fr);
  grid-auto-flow: column;
  gap: var(--space-2);
  align-items: start;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-padding-inline: 0;
  scroll-snap-type: x proximity;
  padding-bottom: var(--space-2);
}

.plan-view__board > * {
  scroll-snap-align: start;
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

/*
 * From 56rem the Questlog column stands left of the board. Open, the days
 * narrow a little, so a usual window still shows the whole week.
 */
.plan-view__layout--questlog {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
}

.plan-view__layout--questlog .plan-view__board {
  grid-auto-columns: minmax(9.5rem, 1fr);
}

.plan-view__layout--questlog-open {
  grid-template-columns: 12rem minmax(0, 1fr);
}

.plan-view__layout--questlog-open .plan-view__board {
  grid-auto-columns: minmax(8.75rem, 1fr);
}

.plan-view__quiet {
  margin: var(--space-2) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

/* A phone shows one day at a time, the next one peeking in. */
@media (max-width: 40rem) {
  .plan-view__board {
    grid-auto-columns: 85%;
    margin-inline: -1rem;
    padding-inline: 1rem;
    scroll-padding-inline: 1rem;
    scroll-snap-type: x mandatory;
  }
}
</style>
