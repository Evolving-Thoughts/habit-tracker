<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { getHistory } from "../api/history.api";
import HistoryItem from "../components/HistoryItem.vue";
import type {
  HistoryResponse,
  HistoryFilter,
  HistoryView,
} from "../types/history";
import {
  getCurrentDateInTimeZone,
  formatDateForGermanDisplay,
} from "../utils/date";
import {
  addDays,
  dayLabel,
  daySummary,
  supportedHistoryDate,
} from "../utils/history";
const date = ref(getCurrentDateInTimeZone());
const view = ref<HistoryView>("day");
const filter = ref<HistoryFilter>("all");
const result = ref<HistoryResponse | null>(null);
const loading = ref(true);
const error = ref("");
let generation = 0;
let abort: AbortController | undefined;
const groups = [
  { status: "completed" as const, label: "Erledigt" },
  { status: "skipped" as const, label: "Übersprungen" },
];
const heading = computed(() => {
  if (!result.value) return "";
  return view.value === "day"
    ? dayLabel(result.value.startDate)
    : `${formatDateForGermanDisplay(result.value.startDate)} – ${formatDateForGermanDisplay(result.value.endDate)}`;
});
const hasItems = computed(() =>
  result.value?.days.some((day) => day.items.length),
);
function adjacent(direction: number): string {
  return addDays(date.value, direction * (view.value === "week" ? 7 : 1));
}
function canMove(direction: number): boolean {
  try {
    return supportedHistoryDate(adjacent(direction), view.value);
  } catch {
    return false;
  }
}
function move(direction: number): void {
  if (canMove(direction)) date.value = adjacent(direction);
}
function openDay(value: string): void {
  date.value = value;
  view.value = "day";
}
function today(): void {
  date.value = getCurrentDateInTimeZone();
}
async function load(): Promise<void> {
  const requestGeneration = ++generation;
  abort?.abort();
  abort = new AbortController();
  error.value = "";
  result.value = null;
  if (!supportedHistoryDate(date.value, view.value)) {
    error.value = "Bitte wähle ein gültiges Datum zwischen 1000 und 9999.";
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const response = await getHistory(
      date.value,
      view.value,
      filter.value,
      abort.signal,
    );
    if (generation === requestGeneration) result.value = response;
  } catch (cause) {
    if (generation === requestGeneration)
      error.value =
        cause instanceof Error
          ? cause.message
          : "Der Verlauf konnte nicht geladen werden.";
  } finally {
    if (generation === requestGeneration) loading.value = false;
  }
}
watch([date, view, filter], () => void load());
onMounted(() => void load());
onUnmounted(() => {
  generation += 1;
  abort?.abort();
});
</script>
<template>
  <main class="history-view">
    <header>
      <p class="eyebrow">Dein Rückblick</p>
      <h1>Verlauf</h1>
      <p class="intro">
        Erledigte Aufgaben und übersprungene Habit-Ausführungen. Tage gelten in
        Europe/Berlin.
      </p>
    </header>
    <div class="history-controls">
      <div class="mode" role="group" aria-label="Zeitraum">
        <button :aria-pressed="view === 'day'" @click="view = 'day'">
          Tag
        </button>
        <button :aria-pressed="view === 'week'" @click="view = 'week'">
          Woche
        </button>
      </div>
      <label
        >Datum<input
          v-model="date"
          name="historyDate"
          type="date"
          min="1000-01-01"
          max="9999-12-30"
      /></label>
      <label
        >Einträge<select v-model="filter" name="historyFilter">
          <option value="all">Alle</option>
          <option value="todos">Todos</option>
          <option value="habits">Habits</option>
        </select></label
      >
    </div>
    <div class="period-controls">
      <button
        :disabled="!canMove(-1)"
        aria-label="Vorheriger Zeitraum"
        @click="move(-1)"
      >
        ‹
      </button>
      <button @click="today">Heute</button>
      <button
        :disabled="!canMove(1)"
        aria-label="Nächster Zeitraum"
        @click="move(1)"
      >
        ›
      </button>
      <button class="refresh" @click="load">Aktualisieren</button>
    </div>
    <p v-if="loading" role="status">Verlauf wird geladen …</p>
    <div v-else-if="error" class="error" role="alert">
      <p>{{ error }}</p>
      <button @click="load">Erneut versuchen</button>
    </div>
    <template v-else-if="result">
      <h2 class="period-heading" tabindex="-1">{{ heading }}</h2>
      <p v-if="!hasItems" class="empty">
        Für diesen Zeitraum gibt es keine Einträge{{
          filter === "all" ? "" : " für diesen Filter"
        }}.
      </p>
      <template v-if="view === 'day'">
        <section
          v-for="group in groups"
          :key="group.status"
          class="history-group"
          :aria-label="group.label"
        >
          <h2>
            {{ group.label }}
            <span>{{
              result.days[0]!.items.filter(
                (item) => item.status === group.status,
              ).length
            }}</span>
          </h2>
          <ul>
            <HistoryItem
              v-for="item in result.days[0]!.items.filter(
                (item) => item.status === group.status,
              )"
              :key="`${item.type}-${item.id}`"
              :item="item"
            />
          </ul>
        </section>
      </template>
      <div v-else class="week-days">
        <details
          v-for="day in result.days"
          :key="day.date"
          class="week-day"
          :data-date="day.date"
        >
          <summary>
            <strong>{{ dayLabel(day.date) }}</strong>
            <span>{{ daySummary(day.items) }}</span>
          </summary>
          <div class="week-day__body">
            <button @click="openDay(day.date)">Tag öffnen</button>
            <p v-if="!day.items.length">Keine Einträge.</p>
            <section
              v-for="group in groups"
              :key="group.status"
              :aria-label="group.label"
            >
              <h3 v-if="day.items.some((item) => item.status === group.status)">
                {{ group.label }}
              </h3>
              <ul>
                <HistoryItem
                  v-for="item in day.items.filter(
                    (item) => item.status === group.status,
                  )"
                  :key="`${item.type}-${item.id}`"
                  :item="item"
                />
              </ul>
            </section>
          </div>
        </details>
      </div>
    </template>
  </main>
</template>
<style scoped>
.history-view {
  width: min(100% - 2rem, 46rem);
  margin: 0 auto;
  padding: 2rem 0 4rem;
  color: #273146;
}
.eyebrow {
  margin: 0 0 0.25rem;
  color: #68758b;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  font-size: clamp(2rem, 8vw, 3rem);
  color: #151c2c;
}
.intro {
  color: #61718c;
  line-height: 1.5;
}
.history-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem;
  margin: 1.75rem 0 1rem;
}
label {
  display: grid;
  gap: 0.4rem;
  font-size: 0.875rem;
}
button,
input,
select {
  min-height: 2.75rem;
  box-sizing: border-box;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: white;
  color: #2f3a4f;
  padding: 0.65rem 0.9rem;
  font: inherit;
}
button {
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
button:focus-visible,
input:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 3px solid #a9c3ff;
  outline-offset: 2px;
}
.mode {
  display: flex;
  gap: 0.5rem;
}
button[aria-pressed="true"] {
  background: #2457c5;
  border-color: #2457c5;
  color: white;
}
.period-controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.refresh {
  margin-left: auto;
}
.period-heading {
  font-size: 1.25rem;
  margin: 2rem 0 1.5rem;
}
.history-group {
  margin: 1.5rem 0;
}
.history-group h2 {
  display: flex;
  justify-content: space-between;
  font-size: 1rem;
}
.history-group h2 span {
  color: #65718a;
}
ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}
.empty {
  border: 1px dashed #c7ced9;
  border-radius: 1rem;
  padding: 2rem 1rem;
  text-align: center;
  color: #697386;
}
.error {
  margin-top: 1.5rem;
  padding: 1rem;
  border-radius: 0.75rem;
  background: #fff0f0;
  color: #9b1c1c;
}
.week-days {
  display: grid;
  gap: 0.75rem;
}
.week-day {
  border: 1px solid #d6dce7;
  border-radius: 1rem;
  background: white;
  overflow: hidden;
}
summary {
  padding: 1rem;
  cursor: pointer;
}
summary strong {
  margin-left: 0.35rem;
}
summary span {
  display: block;
  color: #61718c;
  font-size: 0.875rem;
  line-height: 1.6;
  margin-top: 0.5rem;
}
.week-day__body {
  padding: 0 1rem 1rem;
}
.week-day__body h3 {
  font-size: 0.875rem;
}
@media (max-width: 32rem) {
  .history-view {
    width: min(100% - 1rem, 46rem);
    padding-top: 1rem;
  }
  .history-controls label {
    flex: 1;
    min-width: 8rem;
  }
  input,
  select {
    width: 100%;
    min-width: 0;
  }
  .mode {
    width: 100%;
  }
}
</style>
