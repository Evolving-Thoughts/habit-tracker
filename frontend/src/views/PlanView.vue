<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  getWeekPlan,
  reorderDay,
  rescheduleTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import AppIcon from "../components/AppIcon.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import MoveItemDialog from "../components/MoveItemDialog.vue";
import PlanDay from "../components/PlanDay.vue";
import UndoToast from "../components/UndoToast.vue";
import { useListFocus } from "../composables/useListFocus";
import { useLoader } from "../composables/useLoader";
import {
  focusWhenReady,
  useShortcutHandlers,
} from "../composables/useShortcuts";
import { toggleTimer, useTimer } from "../composables/useTimer";
import { useUndo } from "../composables/useUndo";
import { useWrites } from "../composables/useWrites";
import type { WeekPlanResponse, WeekPlanTodoEntry } from "../types/week-plan";
import { addDays, getCurrentDateInTimeZone, weekStart } from "../utils/date";
import { dayLabel, fullStop, weekLabel } from "../utils/history";
import {
  arrowDrop,
  dropOnDay,
  entryKey,
  isMovable,
  neighbourWeek,
  openEntries,
  weekFromQuery,
  type Drop,
} from "../utils/week-plan";

const route = useRoute();
const router = useRouter();

const page = ref<HTMLElement | null>(null);
const board = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const editing = ref<WeekPlanTodoEntry | null>(null);
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
/* Kept apart from the load error: the quiet reload after a write must not hide it. */
const writeError = ref<string | null>(null);
const writes = useWrites(reload, writeError);

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

function openEditing(entry: WeekPlanTodoEntry): void {
  if (dialogBusy.value || writes.busy.value) return;
  listFocus.remember(entryKey(entry, ""));
  editing.value = entry;
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
const { undo, offer: offerUndo, take: takeUndo } = useUndo<WeekPlanTodoEntry>();
async function complete(entry: WeekPlanTodoEntry): Promise<void> {
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
    const entry = openQuest(key);
    if (!entry) return false;
    return toggleTimer(
      timer,
      { kind: "todo", targetId: entry.todoId, title: entry.title },
      true,
    );
  },
  "row.done": ({ key }) => {
    const entry = openQuest(key);
    if (!entry || writes.busy.value || dialogBusy.value) return false;
    void listFocus.around(key!, () => complete(entry));
  },
  "row.today": ({ key }) => {
    const entry = openQuest(key);
    return !!entry && !!plan.value && moveByShortcut(entry, plan.value.today);
  },
  "row.tomorrow": ({ key }) => {
    const entry = openQuest(key);
    return (
      !!entry &&
      !!plan.value &&
      moveByShortcut(entry, addDays(plan.value.today, 1))
    );
  },
  "row.nextWeek": ({ key }) => {
    const entry = openQuest(key);
    return (
      !!entry &&
      !!plan.value &&
      moveByShortcut(entry, addDays(weekStart(plan.value.today), 7))
    );
  },
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
    <div v-else-if="plan" ref="board" class="plan-view__board">
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
