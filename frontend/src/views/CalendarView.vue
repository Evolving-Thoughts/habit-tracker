<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { getHistory } from "../api/history.api";
import AppIcon from "../components/AppIcon.vue";
import DayReflection from "../components/DayReflection.vue";
import DayWorkLogs from "../components/DayWorkLogs.vue";
import HistoryItem from "../components/HistoryItem.vue";
import HistoryPlannedItems from "../components/HistoryPlannedItems.vue";
import MoveItemDialog, {
  type MoveTarget,
} from "../components/MoveItemDialog.vue";
import { notifyDataChanged } from "../composables/data-sync";
import { useLoader } from "../composables/useLoader";
import type {
  HistoryFilter,
  HistoryPlannedItem,
  HistoryResponse,
} from "../types/history";
import { categoryMark } from "../utils/category-mark";
import {
  formatTimeForGermanDisplay,
  getCurrentDateInTimeZone,
  isValidIsoDate,
} from "../utils/date";
import {
  addDays,
  dayCounts,
  dayLabel,
  daySummary,
  longDate,
  monthLabel,
  supportedHistoryDate,
  weekLabel,
  weekStart,
} from "../utils/history";

type Mode = "month" | "week" | "day";
type Day = HistoryResponse["days"][number];

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MODES: { value: Mode; label: string }[] = [
  { value: "month", label: "Monat" },
  { value: "week", label: "Woche" },
  { value: "day", label: "Tag" },
];
const FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "todos", label: "Todos" },
  { value: "habits", label: "Habits" },
];

const mode = ref<Mode>("month");
const date = ref(getCurrentDateInTimeZone());
const filter = ref<HistoryFilter>("all");
const moving = ref<MoveTarget | null>(null);
const workLogsOpen = ref(false);

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
    try {
      return await getHistory(
        requestDate.value,
        mode.value,
        filter.value,
        signal,
      );
    } catch (cause) {
      if (cause instanceof TypeError)
        throw new Error(
          "Keine Verbindung zum Server. Prüfe die Verbindung und versuch es noch einmal.",
        );
      throw cause;
    }
  },
  {
    initial: null,
    fallbackError: "Der Kalender konnte nicht geladen werden.",
    params: [requestDate, mode, filter],
    resetOnLoad: true,
    refreshOnChange: () => !moving.value,
  },
);

watch([date, mode], () => {
  workLogsOpen.value = false;
});

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

/* Month */
const leadingBlanks = computed(() => {
  if (!result.value) return 0;
  const first = result.value.startDate;
  return (Date.parse(first) - Date.parse(weekStart(first))) / 86_400_000;
});
const selectedDay = computed(() =>
  result.value?.days.find((day) => day.date === date.value),
);

function cellLabel(day: Day): string {
  const counts = dayCounts(day);
  const parts = [
    counts.completed && `${counts.completed} erledigt`,
    counts.skipped && `${counts.skipped} übersprungen`,
    counts.open && `${counts.open} offen`,
    counts.events &&
      `${counts.events} ${counts.events === 1 ? "Termin" : "Termine"}`,
  ].filter(Boolean);
  const today = day.date === result.value?.today ? ", heute" : "";
  return `${longDate(day.date)}${today}, ${parts.length ? parts.join(", ") : "nichts geplant"}`;
}

/* Day */
const shownDay = computed<Day | undefined>(
  () =>
    result.value?.days.find((day) => day.date === date.value) ??
    result.value?.days[0],
);
const completedItems = computed(
  () =>
    shownDay.value?.items.filter((item) => item.status === "completed") ?? [],
);
const skippedItems = computed(
  () => shownDay.value?.items.filter((item) => item.status === "skipped") ?? [],
);
const plannedItems = computed(() => shownDay.value?.planned ?? []);
const isPastOrToday = computed(
  () =>
    !!result.value &&
    !!shownDay.value &&
    shownDay.value.date <= result.value.today,
);
/** Entries of the shown day that can take a manual work log. */
const workTargets = computed(() => {
  const shown = shownDay.value;
  if (!shown) return [];
  const entries = [...shown.items, ...(shown.planned ?? [])];
  const seen = new Set<string>();
  return entries.flatMap((entry) => {
    if (entry.id === null) return [];
    const kind =
      entry.type === "todo" ? ("todo" as const) : ("occurrence" as const);
    const key = `${kind}-${entry.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ kind, targetId: entry.id, title: entry.title }];
  });
});

const hasEntries = (day: Day) =>
  day.items.length > 0 ||
  (day.planned?.length ?? 0) > 0 ||
  (day.external?.length ?? 0) > 0;
const weeklyTargets = computed(() => result.value?.weeklyTargets ?? []);
const isEmpty = computed(() => {
  if (!result.value || weeklyTargets.value.length) return false;
  if (mode.value === "day")
    return !shownDay.value || !hasEntries(shownDay.value);
  return !result.value.days.some(hasEntries);
});

/* Week */
const quota = computed(() => {
  const value = result.value?.weekQuota;
  return value && value.total > 0 ? value : null;
});
const perfectWeek = computed(() =>
  result.value?.perfectWeek?.categories.length
    ? result.value.perfectWeek
    : null,
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
function showToday(): void {
  date.value = getCurrentDateInTimeZone();
}
function openDay(value: string): void {
  date.value = value;
  mode.value = "day";
}

/* Moving planned entries */
function moveTarget(item: HistoryPlannedItem): MoveTarget | null {
  if (item.id === null) return null;
  if (item.type === "todo")
    return {
      type: "todo",
      todoId: item.id,
      title: item.title,
      isFixed: item.isFixed,
    };
  if (!item.moveUntil || item.moveUntil <= item.date) return null;
  return {
    type: "habit",
    occurrenceId: item.id,
    title: item.title,
    moveUntil: item.moveUntil,
  };
}
const canMoveItem = (item: HistoryPlannedItem) => moveTarget(item) !== null;
function startMoving(item: HistoryPlannedItem): void {
  moving.value = moveTarget(item);
}
function onMoved(): void {
  moving.value = null;
  notifyDataChanged();
}
</script>

<template>
  <main class="page calendar-view">
    <header class="calendar-view__header">
      <h1 class="page-title calendar-view__title">
        <button
          type="button"
          class="calendar-view__title-button"
          :aria-label="`Datum wählen, ${title}`"
          @click="pickDate"
        >
          {{ title }}
          <AppIcon name="chevron-down" />
        </button>
      </h1>
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
            type="button"
            class="btn btn--icon"
            aria-label="Voriger Zeitraum"
            :disabled="!canMove(-1)"
            @click="step(-1)"
          >
            <AppIcon name="chevron-left" />
          </button>
          <button type="button" class="btn" @click="showToday">Heute</button>
          <button
            type="button"
            class="btn btn--icon"
            aria-label="Nächster Zeitraum"
            :disabled="!canMove(1)"
            @click="step(1)"
          >
            <AppIcon name="chevron" />
          </button>
          <div class="calendar-view__filter">
            <button
              ref="filterButton"
              type="button"
              class="chip calendar-view__filter-button"
              aria-haspopup="menu"
              :aria-expanded="filterOpen"
              aria-controls="calendar-filter-menu"
              :aria-label="`Einträge: ${filterLabel}`"
              @click="toggleFilter"
            >
              {{ filterLabel }}
              <AppIcon name="chevron-down" />
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
      <!-- Monat -->
      <template v-if="mode === 'month'">
        <div class="month-grid">
          <span
            v-for="weekday in WEEKDAYS"
            :key="weekday"
            class="month-grid__weekday"
            aria-hidden="true"
            >{{ weekday }}</span
          >
          <span
            v-for="blank in leadingBlanks"
            :key="`blank-${blank}`"
            class="month-grid__blank"
          />
          <button
            v-for="day in result.days"
            :key="day.date"
            type="button"
            class="month-day"
            :class="{ 'month-day--today': day.date === result.today }"
            :data-date="day.date"
            :aria-pressed="day.date === date"
            :aria-label="cellLabel(day)"
            @click="date = day.date"
          >
            <span class="month-day__number">{{
              Number(day.date.slice(8))
            }}</span>
            <span class="month-day__marks" aria-hidden="true">
              <i v-if="dayCounts(day).completed" class="mark mark--done" />
              <i v-if="dayCounts(day).open" class="mark mark--open" />
              <i v-if="dayCounts(day).events" class="mark mark--event" />
            </span>
          </button>
        </div>
        <p class="legend" aria-hidden="true">
          <span><i class="mark mark--done" />erledigt</span>
          <span><i class="mark mark--open" />offen</span>
          <span><i class="mark mark--event" />Termin</span>
        </p>

        <section
          v-if="selectedDay"
          class="selected-day"
          aria-labelledby="selected-day-title"
        >
          <div class="selected-day__header">
            <h2 id="selected-day-title" class="section-title">
              {{ dayLabel(selectedDay.date) }}
            </h2>
            <button
              type="button"
              class="btn"
              :aria-label="`Tag öffnen: ${dayLabel(selectedDay.date)}`"
              @click="openDay(selectedDay.date)"
            >
              Tag öffnen
            </button>
          </div>
          <div v-if="!hasEntries(selectedDay)" class="empty-state">
            <strong>Für diesen Tag gibt es nichts.</strong>
          </div>
          <div v-else class="entries">
            <ul v-if="selectedDay.external?.length" class="events">
              <li
                v-for="event in selectedDay.external"
                :key="`external-${event.id}`"
                class="event"
              >
                <span class="event__time">{{
                  formatTimeForGermanDisplay(event.start)
                }}</span>
                <span class="event__title">{{ event.title }}</span>
                <span class="event__source">Google Kalender</span>
              </li>
            </ul>
            <HistoryPlannedItems
              v-if="selectedDay.planned?.length"
              :items="selectedDay.planned"
              :can-move="canMoveItem"
              @move="startMoving"
            />
            <ul v-if="selectedDay.items.length" class="entries__list">
              <HistoryItem
                v-for="item in selectedDay.items"
                :key="`${item.type}-${item.id}`"
                :item="item"
              />
            </ul>
          </div>
        </section>
      </template>

      <!-- Woche -->
      <template v-else-if="mode === 'week'">
        <div v-if="isEmpty" class="empty-state">
          <strong>Für diesen Zeitraum gibt es nichts.</strong>
          <template v-if="filter !== 'all'">
            <span>Gezeigt werden nur {{ filterLabel }}.</span>
            <button type="button" class="btn" @click="filter = 'all'">
              Alle zeigen
            </button>
          </template>
        </div>
        <template v-else>
          <section
            v-if="quota"
            class="quota card"
            aria-labelledby="quota-label"
          >
            <p class="quota__value">
              {{ quota.completed }} von {{ quota.total }}
            </p>
            <p id="quota-label" class="quota__label">Habits diese Woche</p>
            <div
              class="quota__bar"
              role="progressbar"
              aria-labelledby="quota-label"
              :aria-valuenow="quota.completed"
              aria-valuemin="0"
              :aria-valuemax="quota.total"
            >
              <span
                :style="{
                  width: `${Math.min(100, (quota.completed / quota.total) * 100)}%`,
                }"
              />
            </div>
          </section>

          <section
            v-if="perfectWeek"
            class="perfect-week"
            aria-labelledby="perfect-week-title"
          >
            <h2 id="perfect-week-title" class="section-title">
              {{ perfectWeek.perfect ? "Perfekte Woche!" : "Perfekte Woche" }}
            </h2>
            <ul class="rows card">
              <li
                v-for="category in perfectWeek.categories"
                :key="category.id"
                class="row"
              >
                <span class="row__name">
                  <i
                    class="category-mark"
                    :style="{ background: categoryMark(category.name) }"
                    aria-hidden="true"
                  />{{ category.name }}
                </span>
                <span class="count"
                  >{{ category.completed }} von {{ category.target }}</span
                >
                <span class="row__check">
                  <template v-if="category.reached">
                    <AppIcon name="check" />
                    <span class="visually-hidden">erreicht</span>
                  </template>
                </span>
              </li>
            </ul>
          </section>

          <section
            v-if="weeklyTargets.length"
            class="weekly-targets"
            aria-label="Wochenziele"
          >
            <h2 class="section-title">Wochenziele</h2>
            <ul class="rows card">
              <li v-for="target in weeklyTargets" :key="target.key" class="row">
                <strong class="row__name">{{ target.title }}</strong>
                <span class="count"
                  >Noch {{ target.remaining }} von {{ target.target }} ·
                  {{ target.completed }} erledigt</span
                >
              </li>
            </ul>
          </section>

          <h2 class="section-title">Tage</h2>
          <ul class="week-days">
            <li v-for="day in result.days" :key="day.date">
              <button
                type="button"
                class="week-day"
                :class="{ 'week-day--today': day.date === result.today }"
                :data-date="day.date"
                :aria-label="`${dayLabel(day.date)} öffnen`"
                @click="openDay(day.date)"
              >
                <span class="week-day__text">
                  <strong>{{ dayLabel(day.date) }}</strong>
                  <span class="week-day__summary">{{
                    daySummary(dayCounts(day))
                  }}</span>
                </span>
                <AppIcon name="chevron" />
              </button>
            </li>
          </ul>
        </template>
      </template>

      <!-- Tag -->
      <template v-else>
        <DayReflection v-if="isPastOrToday && shownDay" :date="shownDay.date" />

        <div v-if="isEmpty" class="empty-state calendar-view__day-empty">
          <strong>Für diesen Zeitraum gibt es nichts.</strong>
          <template v-if="filter !== 'all'">
            <span>Gezeigt werden nur {{ filterLabel }}.</span>
            <button type="button" class="btn" @click="filter = 'all'">
              Alle zeigen
            </button>
          </template>
        </div>

        <section
          v-if="completedItems.length"
          aria-label="Erledigt"
          class="day-group"
        >
          <h2 class="section-title">
            Erledigt <span class="count">{{ completedItems.length }}</span>
          </h2>
          <ul class="entries__list">
            <HistoryItem
              v-for="item in completedItems"
              :key="`${item.type}-${item.id}`"
              :item="item"
            />
          </ul>
        </section>
        <section
          v-if="skippedItems.length"
          aria-label="Übersprungen"
          class="day-group"
        >
          <h2 class="section-title">
            Übersprungen <span class="count">{{ skippedItems.length }}</span>
          </h2>
          <ul class="entries__list">
            <HistoryItem
              v-for="item in skippedItems"
              :key="`${item.type}-${item.id}`"
              :item="item"
            />
          </ul>
        </section>
        <section
          v-if="plannedItems.length"
          aria-label="Offen / geplant"
          class="day-group"
        >
          <h2 class="section-title">
            Offen / geplant <span class="count">{{ plannedItems.length }}</span>
          </h2>
          <HistoryPlannedItems
            :items="plannedItems"
            :can-move="canMoveItem"
            @move="startMoving"
          />
        </section>

        <section
          v-if="weeklyTargets.length"
          class="weekly-targets"
          aria-label="Wochenziele"
        >
          <h2 class="section-title">Wochenziele</h2>
          <ul class="rows card">
            <li v-for="target in weeklyTargets" :key="target.key" class="row">
              <strong class="row__name">{{ target.title }}</strong>
              <span class="count"
                >Noch {{ target.remaining }} von {{ target.target }} ·
                {{ target.completed }} erledigt</span
              >
            </li>
          </ul>
        </section>

        <section v-if="isPastOrToday && shownDay" class="work-time">
          <button
            type="button"
            class="work-time__toggle"
            :aria-expanded="workLogsOpen"
            aria-controls="work-time-panel"
            @click="workLogsOpen = !workLogsOpen"
          >
            Zeit nachtragen
            <AppIcon name="chevron" />
          </button>
          <div v-if="workLogsOpen" id="work-time-panel" class="card">
            <DayWorkLogs :date="shownDay.date" :targets="workTargets" />
          </div>
        </section>
      </template>

      <MoveItemDialog
        v-if="moving"
        :item="moving"
        :today="result.today"
        :return-focus="() => null"
        @moved="onMoved"
        @close="moving = null"
      />
    </template>
  </main>
</template>

<style scoped>
.calendar-view__header {
  display: grid;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.calendar-view__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
}

.calendar-view__modes {
  display: flex;
  flex: 1 1 100%;
}

.calendar-view__modes > button {
  flex: 1 1 0;
}

.calendar-view__nav {
  display: flex;
  flex: 1 1 100%;
  gap: var(--space-2);
  align-items: center;
}

.calendar-view__title {
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
  background: rgb(255 255 255 / 55%);
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
  margin-left: auto;
}

.calendar-view__filter-button {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  border-color: var(--color-ink);
  background: var(--color-surface);
  color: var(--color-ink);
  transition: transform 420ms var(--spring);
}

.calendar-view__filter-button:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.calendar-view__filter-button :deep(svg) {
  width: 1rem;
  height: 1rem;
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

  .calendar-view__nav {
    flex: 1 1 auto;
  }
}

/* Month */
.month-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--space-1);
}

.month-grid__weekday {
  padding-bottom: var(--space-1);
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: center;
}

.month-day {
  display: grid;
  grid-template-rows: auto 0.5rem;
  gap: 0.3rem;
  align-content: center;
  justify-items: center;
  min-width: 0;
  min-height: 3.25rem;
  padding: var(--space-1) 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out);
}

.month-day:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.month-day--today {
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

.month-day[aria-pressed="true"] {
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.month-day--today[aria-pressed="true"] {
  box-shadow:
    inset 0 0 0 2px var(--color-ink),
    var(--shadow-card);
}

.month-day__marks {
  display: flex;
  gap: 0.1875rem;
  align-items: center;
  height: 0.5rem;
}

.mark {
  display: inline-block;
  flex: none;
}

.mark--done,
.mark--open {
  width: 0.4375rem;
  height: 0.4375rem;
  border-radius: 50%;
}

.mark--done {
  background: var(--color-ink-muted);
}

.mark--open {
  border: 1.5px solid var(--color-ink-muted);
}

.mark--event {
  width: 0.75rem;
  height: 0.1875rem;
  border-radius: var(--radius-pill);
  background: var(--color-ink-soft);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.legend span {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.selected-day__header {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  justify-content: space-between;
  margin: var(--space-6) 0 var(--space-3);
}

.selected-day__header .section-title {
  margin: 0;
}

.entries,
.entries__list,
.events,
.week-days {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.event {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: 0 calc(var(--tap) + var(--space-4));
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
  border-radius: var(--radius-card);
  background: rgb(255 255 255 / 55%);
}

.event__time {
  grid-row: span 2;
  padding-top: 0.1rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.event__title {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.event__source {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

/* Week */
.quota {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
}

.quota p {
  margin: 0;
}

.quota__value {
  font-size: clamp(2.25rem, 10vw, 3rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.quota__label {
  color: var(--color-ink-muted);
  font-weight: 700;
}

.quota__bar {
  height: 0.625rem;
  margin-top: var(--space-3);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.quota__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
}

.rows {
  display: grid;
  margin: 0;
  padding: var(--space-1) var(--space-4);
  list-style: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  align-items: center;
  min-height: var(--tap);
  padding: var(--space-2) 0;
}

.row + .row {
  border-top: 1px solid var(--color-line);
}

.row__name {
  display: inline-flex;
  flex: 1 1 10rem;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.row__check {
  display: inline-grid;
  width: 1.25rem;
  place-items: center;
  color: var(--color-ink);
}

.row__check :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2.6;
}

.category-mark {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

.week-day {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--tap-large);
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.week-day:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.week-day--today {
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

.week-day__text {
  display: grid;
  min-width: 0;
}

.week-day__summary {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.week-day :deep(svg) {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-ink-muted);
}

/* Day */
.calendar-view__day-empty {
  margin-top: var(--space-5);
}

.work-time {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-6);
}

.work-time__toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap-large);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-card);
  background: rgb(255 255 255 / 55%);
  color: var(--color-ink);
  font-weight: 800;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.work-time__toggle:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.work-time__toggle :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 200ms var(--ease-out);
}

.work-time__toggle[aria-expanded="true"] :deep(svg) {
  transform: rotate(90deg);
}

@media (min-width: 40rem) {
  .month-day {
    min-height: 4.5rem;
  }
}
</style>
