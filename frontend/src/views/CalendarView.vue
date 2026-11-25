<script setup lang="ts">
import { useOverlay } from "../composables/useOverlayStack";
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { routeLocationKey, routerKey } from "vue-router";
import { openRunToday } from "../api/day-planner.api";
import { getHistory } from "../api/history.api";
import AppIcon from "../components/AppIcon.vue";
import CalendarDay from "../components/CalendarDay.vue";
import CalendarMonth from "../components/CalendarMonth.vue";
import CalendarWeek from "../components/CalendarWeek.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import CampaignMoveDialog from "../components/CampaignMoveDialog.vue";
import DeleteItemDialog, {
  type DeleteTarget,
} from "../components/DeleteItemDialog.vue";
import type { PlannedActions } from "../components/HistoryPlannedItems.vue";
import MoveItemDialog, {
  type MoveTarget,
} from "../components/MoveItemDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import { useListFocus } from "../composables/useListFocus";
import { useLoader } from "../composables/useLoader";
import { useLogRemoval } from "../composables/useLogRemoval";
import { tickLabel, useTicks, writeDone } from "../composables/useTicks";
import { useWrites } from "../composables/useWrites";
import type {
  HistoryFilter,
  HistoryPlannedItem,
  HistoryResponse,
} from "../types/history";
import { DAY_QUERY } from "../routes";
import { getCurrentDateInTimeZone, isValidIsoDate } from "../utils/date";
import {
  addDays,
  dayLabel,
  monthLabel,
  rangeContains,
  supportedHistoryDate,
  weekLabel,
} from "../utils/history";
import { quickMoveEntries, quickMoves, rowMenu } from "../utils/row-actions";

type Mode = "month" | "week" | "day";

const MODES: { value: Mode; label: string }[] = [
  { value: "month", label: "Monat" },
  { value: "week", label: "Woche" },
  { value: "day", label: "Tag" },
];
const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "todos", label: "Quests" },
  { value: "habits", label: "Dailies" },
];

const mode = ref<Mode>("month");
const date = ref(getCurrentDateInTimeZone());
const filter = ref<HistoryFilter>("all");
const moving = ref<MoveTarget | null>(null);
const editing = ref<{
  kind: "todo" | "habit";
  id: number;
  /** The stored run a daily was opened from, for its notes. */
  occurrenceId?: number;
} | null>(null);
/** "In Kampagne verschieben …" and "Löschen" from a row's menu. */
const campaignMoving = ref<{ todoId: number; title: string } | null>(null);
const deleting = ref<DeleteTarget | null>(null);
const editorBusy = ref(false);
const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

/** A month loads once; picking another day inside it needs no request. */
const requestDate = computed(() =>
  mode.value === "month" && isValidIsoDate(date.value)
    ? `${date.value.slice(0, 7)}-01`
    : date.value,
);

const {
  data: result,
  isLoading: loading,
  errorMessage: error,
  reload,
} = useLoader<HistoryResponse | null>(
  async (signal) => {
    if (!supportedHistoryDate(date.value, mode.value))
      throw new Error("Bitte wähle ein gültiges Datum.");
    return getHistory(requestDate.value, mode.value, filter.value, signal);
  },
  {
    initial: null,
    fallbackError: "Der Kalender konnte nicht geladen werden.",
    params: [requestDate, mode, filter],
    resetOnLoad: true,
    refreshOnChange: () =>
      !moving.value &&
      !editing.value &&
      !campaignMoving.value &&
      !deleting.value &&
      !editorBusy.value &&
      !writes.busy.value,
  },
);
/* Kept apart from the load error: a failed tick must not hide the calendar. */
const writeError = ref<string | null>(null);
const writes = useWrites(reload, writeError);

const title = computed(() => {
  if (!isValidIsoDate(date.value)) return "Kalender";
  if (mode.value === "month") return monthLabel(date.value);
  if (mode.value === "week") return weekLabel(date.value);
  return dayLabel(date.value);
});

const filterLabel = computed(
  () => FILTERS.find((item) => item.value === filter.value)!.label,
);

/* Date picker: the title opens the native picker of a hidden date field. */
const dateInput = ref<HTMLInputElement | null>(null);
function pickDate(): void {
  const input = dateInput.value;
  if (!input) return;
  input.focus();
  if (typeof input.showPicker === "function") {
    try {
      input.showPicker();
      return;
    } catch {
      // Some browsers refuse the picker; fall back to a click.
    }
  }
  input.click();
}

/* Filter menu */
const filterOpen = ref(false);
/* The phone's Back closes the filter first, as Escape does. */
useOverlay(filterOpen, () => closeFilter());
const filterButton = ref<HTMLButtonElement | null>(null);
const filterMenu = ref<HTMLElement | null>(null);
function menuItems(): HTMLButtonElement[] {
  return Array.from(
    filterMenu.value?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitemradio"]',
    ) ?? [],
  );
}
async function openFilter(): Promise<void> {
  filterOpen.value = true;
  await nextTick();
  const items = menuItems();
  (
    items.find((item) => item.getAttribute("aria-checked") === "true") ??
    items[0]
  )?.focus();
}
function closeFilter(returnFocus = true): void {
  if (!filterOpen.value) return;
  filterOpen.value = false;
  if (returnFocus) filterButton.value?.focus();
}
function toggleFilter(): void {
  if (filterOpen.value) closeFilter();
  else void openFilter();
}
function chooseFilter(value: HistoryFilter): void {
  filter.value = value;
  closeFilter();
}
function onMenuKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    closeFilter();
    return;
  }
  if (event.key === "Tab") {
    closeFilter(false);
    return;
  }
  const items = menuItems();
  const index = items.indexOf(document.activeElement as HTMLButtonElement);
  const moves: Record<string, number> = {
    ArrowDown: (index + 1) % items.length,
    ArrowUp: (index - 1 + items.length) % items.length,
    Home: 0,
    End: items.length - 1,
  };
  const next = moves[event.key];
  if (next === undefined) return;
  event.preventDefault();
  items[next]?.focus();
}
function onDocumentPointer(event: PointerEvent): void {
  const target = event.target as Node | null;
  if (
    target &&
    !filterMenu.value?.contains(target) &&
    !filterButton.value?.contains(target)
  )
    closeFilter(false);
}
watch(filterOpen, (open) => {
  if (open) document.addEventListener("pointerdown", onDocumentPointer);
  else document.removeEventListener("pointerdown", onDocumentPointer);
});
onBeforeUnmount(() =>
  document.removeEventListener("pointerdown", onDocumentPointer),
);

/** The day shown in Tag: the chosen one, or the only one loaded. */
const shownDay = computed(
  () =>
    result.value?.days.find((day) => day.date === date.value) ??
    result.value?.days[0],
);

/* Navigation */
function adjacent(direction: number): string | null {
  if (!isValidIsoDate(date.value)) return null;
  if (mode.value !== "month")
    return addDays(date.value, direction * (mode.value === "week" ? 7 : 1));
  const [year, month] = date.value.split("-").map(Number);
  const first = new Date(Date.UTC(year!, month! - 1 + direction, 1))
    .toISOString()
    .slice(0, 10);
  const today = getCurrentDateInTimeZone();
  return today.startsWith(first.slice(0, 7)) ? today : first;
}
function canMove(direction: number): boolean {
  const next = adjacent(direction);
  return next !== null && supportedHistoryDate(next, mode.value);
}
function step(direction: number): void {
  const next = adjacent(direction);
  if (next !== null && canMove(direction)) date.value = next;
}
/** "Heute" only shows when it would change something. */
const showsToday = computed(() =>
  rangeContains(mode.value, date.value, getCurrentDateInTimeZone()),
);
const titleButton = ref<HTMLButtonElement | null>(null);
async function showToday(): Promise<void> {
  date.value = getCurrentDateInTimeZone();
  // The button leaves with the step; the title names where it went.
  await nextTick();
  titleButton.value?.focus();
}
function openDay(value: string): void {
  date.value = value;
  mode.value = "day";
}

/*
 * `#/kalender?tag=<day>` opens that day, e.g. for a reflection the search
 * found; the address then drops it, so paging on leaves no stale day.
 * Injected rather than used: a spec may mount the view without a router.
 */
const route = inject(routeLocationKey, null);
const router = inject(routerKey, null);
watch(
  () => route?.query[DAY_QUERY],
  (day) => {
    if (typeof day !== "string" || !isValidIsoDate(day)) return;
    openDay(day);
    void router?.replace({ query: {} });
  },
  { immediate: true },
);

/* Moving planned entries */
function moveTarget(item: HistoryPlannedItem): MoveTarget | null {
  if (item.id === null) return null;
  if (item.type === "todo")
    return {
      type: "todo",
      todoId: item.id,
      title: item.title,
      timeOfDay: item.timeOfDay,
    };
  if (!item.moveUntil || item.moveUntil <= item.date) return null;
  return {
    type: "habit",
    occurrenceId: item.id,
    title: item.title,
    moveUntil: item.moveUntil,
  };
}
function startMoving(item: HistoryPlannedItem): void {
  listFocus.remember(item.key);
  moving.value = moveTarget(item);
}
async function onDialogDone(): Promise<void> {
  await writes.applied();
  closeDialogs();
}
function closeDialogs(): void {
  moving.value = null;
  editing.value = null;
  campaignMoving.value = null;
  deleting.value = null;
  editorBusy.value = false;
}

/*
 * The planned rows follow the row contract: open quests get the ring (with
 * undo, as on Heute), the title opens the editor, and moving sits in the
 * menu "Aktionen für …" with the same quick days as Heute.
 *
 * Deleting a Logbuch stretch shares the toast; its DELETE waits until the
 * offer ends (`useLogRemoval`).
 */
const ticks = useTicks(writes.write, {
  onOtherUndo: (held) => restoreLog(held.id),
});
const { undo, undoLast, flushUndo } = ticks;
const { hiddenLogs, removeLog, restoreLog } = useLogRemoval(
  ticks.offerUndo,
  writes.write,
);
/* Closing or reloading the page sends a held delete on its way. */
onMounted(() => window.addEventListener("pagehide", flushUndo));
onBeforeUnmount(() => window.removeEventListener("pagehide", flushUndo));
const busyKey = (item: HistoryPlannedItem) => `planned-${item.key}`;
function quickMove(item: HistoryPlannedItem, date: string): void {
  if (item.id === null) return;
  const id = item.id;
  void listFocus.around(item.key, () =>
    ticks.move(
      {
        kind: item.type === "todo" ? "todo" : "occurrence",
        id,
        title: item.title,
      },
      date,
      {
        key: busyKey(item),
        fallbackError: "Der Eintrag konnte nicht verschoben werden.",
      },
    ),
  );
}
/*
 * A Daily run can be ticked where it is due: today (the server refuses
 * runs of later days). A forecast run has no stored occurrence yet; the
 * ring asks for today's runs first, so it runs the occurrence path Heute
 * runs, with the same undo.
 */
function completeRun(item: HistoryPlannedItem): void {
  const habitId = item.habitId;
  if (habitId === null) return;
  void listFocus.around(item.key, async () => {
    let id = item.id;
    const done = await writes.write(
      async () => {
        id ??= await openRunToday(habitId, item.scheduledDate);
        if (id === null)
          throw new Error("Dieses Daily ist heute nicht mehr fällig.");
        await writeDone({ kind: "occurrence", id, title: item.title }, true);
      },
      {
        key: busyKey(item),
        fallbackError: "Das Daily konnte nicht erledigt werden.",
      },
    );
    if (done && id !== null)
      ticks.offerUndo(
        {
          kind: "tick",
          target: { kind: "occurrence", id, title: item.title },
        },
        tickLabel(item.title),
      );
  });
}
const plannedActions: PlannedActions = {
  checkable: (item) =>
    item.type === "todo"
      ? item.id !== null
      : item.habitId !== null && item.date === result.value?.today,
  complete: (item) => {
    if (item.type === "habit") return completeRun(item);
    if (item.id === null) return;
    const id = item.id;
    // The calendar's rows do not ask about a campaign (todo-hierarchy.md).
    void listFocus.around(item.key, () =>
      ticks.complete(
        { kind: "todo", id, title: item.title },
        { key: busyKey(item) },
      ),
    );
  },
  editable: (item) =>
    item.type === "todo" ? item.id !== null : item.habitId !== null,
  edit: (item) => {
    const id = item.type === "todo" ? item.id : item.habitId;
    if (id === null || writes.busy.value) return;
    listFocus.remember(item.key);
    editing.value = {
      kind: item.type,
      id,
      occurrenceId:
        item.type === "habit" && item.id !== null ? item.id : undefined,
    };
  },
  menu: (item) => {
    const today = result.value?.today;
    if (!today) return [];
    const disabled = writes.busy.value;
    const movable = !!moveTarget(item);
    return rowMenu(
      item.title,
      {
        quickMoves: movable
          ? quickMoveEntries(
              item.title,
              quickMoves(today, {
                date: item.scheduledDate,
                timeOfDay: item.timeOfDay,
                moveUntil: item.type === "habit" ? item.moveUntil : undefined,
              }),
              (move) => quickMove(item, move.date),
              { disabled },
            )
          : [],
        otherDay: movable
          ? {
              run: () => startMoving(item),
              appointment: item.type === "todo" && !!item.timeOfDay,
            }
          : undefined,
        edit: plannedActions.editable(item)
          ? () => plannedActions.edit(item)
          : undefined,
        reparent:
          item.type === "todo" && item.id !== null
            ? () => {
                listFocus.remember(item.key);
                campaignMoving.value = { todoId: item.id!, title: item.title };
              }
            : undefined,
        remove: plannedActions.editable(item)
          ? {
              run: () => {
                const id = item.type === "todo" ? item.id : item.habitId;
                if (id === null || writes.busy.value) return;
                listFocus.remember(item.key);
                deleting.value = { kind: item.type, id, title: item.title };
              },
              ariaLabel:
                item.type === "habit"
                  ? `Daily ${item.title} ganz löschen`
                  : undefined,
            }
          : undefined,
      },
      disabled,
    );
  },
  measure: (item) => {
    if (item.id === null) return null;
    if (item.type === "todo")
      return { kind: "todo", targetId: item.id, eligible: true };
    const today = result.value?.today;
    // A stored run can be measured once it is due.
    return today && item.date <= today
      ? { kind: "occurrence", targetId: item.id, eligible: true }
      : null;
  },
  busy: (item) => writes.isWriting(busyKey(item)),
};
</script>

<template>
  <main
    ref="page"
    class="page calendar-view"
    :class="{
      'calendar-view--day': mode === 'day',
      'calendar-view--week': mode === 'week',
    }"
  >
    <!--
      Two rows instead of a wall of controls: the range as title (it opens
      the date picker) with the filter as a quiet icon beside it, then the
      mode and the steps. "Heute" only appears once the range left today.
    -->
    <header class="calendar-view__header">
      <div class="calendar-view__top">
        <h1 class="page-title calendar-view__title">
          <button
            ref="titleButton"
            type="button"
            class="calendar-view__title-button"
            :aria-label="`Datum wählen, ${title}`"
            @click="pickDate"
          >
            {{ title }}
            <AppIcon name="chevron-down" />
          </button>
        </h1>
        <div class="calendar-view__filter">
          <button
            ref="filterButton"
            type="button"
            class="btn btn--quiet calendar-view__filter-button"
            :class="{
              'btn--icon': filter === 'all',
              'calendar-view__filter-button--active': filter !== 'all',
            }"
            aria-haspopup="menu"
            :aria-expanded="filterOpen"
            aria-controls="calendar-filter-menu"
            :aria-label="`Einträge: ${filterLabel}`"
            :title="`Einträge: ${filterLabel}`"
            @click="toggleFilter"
          >
            <AppIcon name="filter" />
            <template v-if="filter !== 'all'">{{ filterLabel }}</template>
          </button>
          <div
            v-if="filterOpen"
            id="calendar-filter-menu"
            ref="filterMenu"
            class="calendar-view__filter-menu"
            role="menu"
            aria-label="Einträge"
            @keydown="onMenuKeydown"
          >
            <button
              v-for="option in FILTERS"
              :key="option.value"
              type="button"
              role="menuitemradio"
              class="calendar-view__filter-option"
              :aria-checked="filter === option.value"
              @click="chooseFilter(option.value)"
            >
              {{ option.label }}
              <AppIcon v-if="filter === option.value" name="check" />
            </button>
          </div>
        </div>
      </div>
      <input
        ref="dateInput"
        v-model="date"
        class="visually-hidden"
        name="historyDate"
        type="date"
        aria-label="Datum"
        tabindex="-1"
        min="1000-01-01"
        max="9999-12-30"
      />
      <div class="calendar-view__controls">
        <div
          class="segmented calendar-view__modes"
          role="group"
          aria-label="Ansicht"
        >
          <button
            v-for="option in MODES"
            :key="option.value"
            type="button"
            :aria-pressed="mode === option.value"
            @click="mode = option.value"
          >
            {{ option.label }}
          </button>
        </div>
        <div class="calendar-view__nav">
          <button
            v-if="!showsToday"
            type="button"
            class="btn"
            @click="showToday"
          >
            Heute
          </button>
          <button
            type="button"
            class="btn btn--icon"
            aria-label="Voriger Zeitraum"
            :disabled="!canMove(-1)"
            @click="step(-1)"
          >
            <AppIcon name="chevron-left" />
          </button>
          <button
            type="button"
            class="btn btn--icon"
            aria-label="Nächster Zeitraum"
            :disabled="!canMove(1)"
            @click="step(1)"
          >
            <AppIcon name="chevron" />
          </button>
        </div>
      </div>
    </header>

    <div
      v-if="loading"
      class="skeleton"
      role="status"
      aria-label="Kalender wird geladen"
    >
      <span />
      <span />
      <span />
    </div>
    <div v-else-if="error" class="alert" role="alert">
      <p>{{ error }}</p>
      <button type="button" class="btn" @click="reload()">
        Erneut versuchen
      </button>
    </div>

    <template v-else-if="result">
      <div v-if="writeError" class="alert calendar-view__alert" role="alert">
        <p>{{ writeError }}</p>
      </div>
      <CalendarMonth
        v-if="mode === 'month'"
        :result="result"
        :date="date"
        :actions="plannedActions"
        @select="date = $event"
        @open-day="openDay"
      />
      <CalendarWeek
        v-else-if="mode === 'week'"
        :result="result"
        :filter="filter"
        :filter-label="filterLabel"
        :reload="reload"
        :hidden-logs="hiddenLogs"
        @open-day="openDay"
        @show-all="filter = 'all'"
        @remove-log="removeLog"
      />
      <CalendarDay
        v-else-if="shownDay"
        :day="shownDay"
        :today="result.today"
        :weekly-targets="result.weeklyTargets ?? []"
        :filter="filter"
        :filter-label="filterLabel"
        :actions="plannedActions"
        :reload="reload"
        :hidden-logs="hiddenLogs"
        @show-all="filter = 'all'"
        @remove-log="removeLog"
      />

      <MoveItemDialog
        v-if="moving"
        :item="moving"
        :today="result.today"
        :return-focus="listFocus.returnFocus"
        @busy="editorBusy = $event"
        @moved="onDialogDone"
        @close="closeDialogs"
      />
      <CampaignMoveDialog
        v-if="campaignMoving"
        :todo-id="campaignMoving.todoId"
        :title="campaignMoving.title"
        :return-focus="listFocus.returnFocus"
        @busy="editorBusy = $event"
        @moved="onDialogDone"
        @close="closeDialogs"
      />
      <DeleteItemDialog
        v-if="deleting"
        :target="deleting"
        :return-focus="listFocus.returnFocus"
        @busy="editorBusy = $event"
        @deleted="onDialogDone"
        @close="closeDialogs"
      />
      <EditItemDialog
        v-if="editing"
        :key="`${editing.kind}-${editing.id}`"
        :kind="editing.kind"
        :entity-id="editing.id"
        :occurrence-id="editing.occurrenceId"
        :return-focus="listFocus.returnFocus"
        @busy="editorBusy = $event"
        @changed="onDialogDone"
        @close="closeDialogs"
      />
    </template>
    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
  </main>
</template>

<style scoped>
.calendar-view__header {
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.calendar-view__top {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  justify-content: space-between;
}

.calendar-view__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  justify-content: space-between;
}

/* On a phone the modes take what the steps leave; wider they keep their size. */
.calendar-view__modes {
  display: flex;
  flex: 1 1 12rem;
  max-width: 22rem;
}

.calendar-view__modes > button {
  flex: 1 1 0;
  padding: 0 var(--space-2);
}

.calendar-view__nav {
  display: flex;
  flex: none;
  gap: var(--space-2);
  align-items: center;
  margin-left: auto;
}

/* Takes the row beside the filter, so the range wraps only when it must. */
.calendar-view__title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
}

.calendar-view__title-button {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  max-width: 100%;
  min-height: var(--tap);
  margin-left: calc(var(--space-2) * -1);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out);
}

.calendar-view__title-button:hover {
  background: var(--color-surface-flat);
}

.calendar-view__title-button:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.calendar-view__title-button :deep(svg) {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-ink-muted);
}

.calendar-view__filter {
  position: relative;
  flex: none;
}

/* Quiet while everything shows; a chosen filter names itself in ink on white. */
.calendar-view__filter-button--active {
  padding: 0 var(--space-4) 0 var(--space-3);
  box-shadow: inset 0 0 0 1.5px var(--color-ink);
  background: var(--color-surface);
  color: var(--color-ink);
}

.calendar-view__filter-menu {
  position: absolute;
  z-index: 10;
  top: calc(100% + var(--space-1));
  right: 0;
  display: grid;
  min-width: 10rem;
  padding: var(--space-1);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.calendar-view__filter-option {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: calc(var(--radius-control) - var(--space-1));
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.calendar-view__filter-option:hover,
.calendar-view__filter-option:focus-visible {
  background: var(--color-ground);
}

.calendar-view__filter-option :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
}

@media (min-width: 40rem) {
  .calendar-view__modes {
    display: inline-flex;
    flex: 0 1 auto;
  }

  .calendar-view__modes > button {
    padding: 0 var(--space-4);
  }
}

.calendar-view__alert {
  margin-bottom: var(--space-4);
}

/*
 * Tag puts the list beside its day calendar on wide screens; the week needs
 * room for seven columns, like the plan.
 */
@media (min-width: 56rem) {
  .calendar-view--day {
    width: min(100% - 2rem, 80rem);
  }

  .calendar-view--week {
    width: min(100% - 2rem, 90rem);
  }
}
</style>
