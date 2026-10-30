<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { getHistory } from "../api/history.api";
import MoveItemDialog, { type MoveTarget } from "../components/MoveItemDialog.vue";
import { onDataChanged, notifyDataChanged } from "../composables/data-sync";
import type { HistoryPlannedItem, HistoryResponse } from "../types/history";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  weekStart,
} from "../utils/date";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const month = ref(getCurrentDateInTimeZone().slice(0, 7));
const selected = ref(getCurrentDateInTimeZone());
const result = ref<HistoryResponse | null>(null);
const loading = ref(true);
const error = ref("");
const moving = ref<MoveTarget | null>(null);
let generation = 0;
let abort: AbortController | undefined;

const heading = computed(() =>
  new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month.value}-15T12:00:00Z`)),
);
const leadingBlanks = computed(() => {
  if (!result.value) return 0;
  const first = result.value.startDate;
  return (Date.parse(first) - Date.parse(weekStart(first))) / 86_400_000;
});
const selectedDay = computed(() =>
  result.value?.days.find((day) => day.date === selected.value),
);

function shiftMonth(direction: number): void {
  const [year, value] = month.value.split("-").map(Number);
  const next = new Date(Date.UTC(year, value - 1 + direction, 1));
  month.value = next.toISOString().slice(0, 7);
  selected.value = `${month.value}-01`;
}

function showCurrentMonth(): void {
  selected.value = getCurrentDateInTimeZone();
  month.value = selected.value.slice(0, 7);
}

async function load(showLoading = true): Promise<void> {
  const current = ++generation;
  abort?.abort();
  abort = new AbortController();
  error.value = "";
  if (showLoading) loading.value = true;
  try {
    const response = await getHistory(
      `${month.value}-01`,
      "month",
      "all",
      abort.signal,
    );
    if (current === generation) result.value = response;
  } catch (cause) {
    if (current === generation)
      error.value =
        cause instanceof Error
          ? cause.message
          : "Der Kalender konnte nicht geladen werden.";
  } finally {
    if (current === generation) loading.value = false;
  }
}

function moveTarget(item: HistoryPlannedItem): MoveTarget | null {
  if (item.id === null) return null;
  if (item.type === "todo")
    return {
      type: "todo",
      todoId: item.id,
      title: item.title,
      isFixed: item.isFixed ?? false,
    };
  if (!item.moveUntil || item.moveUntil <= item.date) return null;
  return {
    type: "habit",
    occurrenceId: item.id,
    title: item.title,
    moveUntil: item.moveUntil,
  };
}

async function onMoved(): Promise<void> {
  moving.value = null;
  notifyDataChanged();
  await load(false);
}

watch(month, () => void load());
onMounted(() => void load());
onDataChanged(() => {
  if (!moving.value) void load(false);
});
onUnmounted(() => {
  generation += 1;
  abort?.abort();
});
</script>

<template>
  <main class="calendar-view">
    <header class="calendar-view__header">
      <h1>{{ heading }}</h1>
      <div class="calendar-view__nav">
        <button
          type="button"
          aria-label="Voriger Monat"
          @click="shiftMonth(-1)"
        >
          ‹
        </button>
        <button type="button" @click="showCurrentMonth">Heute</button>
        <button
          type="button"
          aria-label="Nächster Monat"
          @click="shiftMonth(1)"
        >
          ›
        </button>
      </div>
    </header>

    <p v-if="loading" role="status">Kalender wird geladen …</p>
    <p v-else-if="error" class="calendar-view__error" role="alert">
      {{ error }}
    </p>

    <template v-else-if="result">
      <div class="calendar-grid">
        <span
          v-for="weekday in WEEKDAYS"
          :key="weekday"
          class="calendar-grid__weekday"
          >{{ weekday }}</span
        >
        <span v-for="blank in leadingBlanks" :key="`blank-${blank}`" />
        <button
          v-for="day in result.days"
          :key="day.date"
          type="button"
          class="calendar-day"
          :class="{
            'calendar-day--today': day.date === result.today,
            'calendar-day--selected': day.date === selected,
          }"
          :aria-pressed="day.date === selected"
          :aria-label="`${formatDateForGermanDisplay(day.date)}, ${day.items.length + (day.planned?.length ?? 0)} Einträge`"
          @click="selected = day.date"
        >
          <span>{{ Number(day.date.slice(8)) }}</span>
          <small v-if="day.items.length">✓ {{ day.items.length }}</small>
          <small v-if="day.planned?.length">○ {{ day.planned.length }}</small>
        </button>
      </div>

      <section v-if="selectedDay" class="calendar-entries">
        <h2>{{ formatDateForGermanDisplay(selectedDay.date) }}</h2>
        <p v-if="!selectedDay.items.length && !selectedDay.planned?.length">
          Keine Einträge.
        </p>
        <ul>
          <li v-for="item in selectedDay.items" :key="`${item.type}-${item.id}`">
            <span class="calendar-entries__title">{{ item.title }}</span>
            <small>{{
              item.status === "completed" ? "Erledigt" : "Übersprungen"
            }}</small>
          </li>
          <li v-for="item in selectedDay.planned" :key="item.key">
            <span class="calendar-entries__title">{{ item.title }}</span>
            <small v-if="item.id === null">Prognose</small>
            <small v-else-if="item.isOverdue">Überfällig</small>
            <small v-else>Geplant</small>
            <small v-if="item.isFixed">Fester Termin</small>
            <button
              v-if="moveTarget(item)"
              type="button"
              @click="moving = moveTarget(item)"
            >
              Verschieben
            </button>
          </li>
        </ul>
      </section>

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
.calendar-view {
  display: grid;
  gap: 1rem;
  width: min(100%, 46rem);
  margin: 0 auto;
  padding: 1.5rem 1rem;
  box-sizing: border-box;
}

.calendar-view h1,
.calendar-view h2,
.calendar-view p {
  margin: 0;
}

.calendar-view__header,
.calendar-view__nav {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
}

.calendar-view button {
  min-height: 2.75rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
  cursor: pointer;
}

.calendar-view__nav button,
.calendar-entries button {
  padding: 0 0.875rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.25rem;
}

.calendar-grid__weekday {
  color: #697386;
  font-size: 0.8125rem;
  text-align: center;
}

.calendar-view .calendar-day {
  display: grid;
  gap: 0.125rem;
  align-content: start;
  justify-items: center;
  min-height: 4rem;
  padding: 0.25rem 0;
}

.calendar-day small {
  color: #697386;
  font-size: 0.6875rem;
}

.calendar-view .calendar-day--today {
  border-color: #182033;
}

.calendar-view .calendar-day--selected {
  background: #eef1f5;
}

.calendar-entries {
  display: grid;
  gap: 0.5rem;
}

.calendar-entries ul {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.calendar-entries li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #ffffff;
}

.calendar-entries__title {
  flex: 1 1 10rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.calendar-entries small {
  color: #697386;
}

.calendar-view__error {
  color: #b42318;
}
</style>
