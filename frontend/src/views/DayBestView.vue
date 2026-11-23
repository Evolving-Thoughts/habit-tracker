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
  getDayBest,
  getDayBestMonths,
  getDayBests,
} from "../api/day-bests.api";
import AppIcon from "../components/AppIcon.vue";
import DayBestField from "../components/DayBestField.vue";
import { useLoader } from "../composables/useLoader";
import { DAY_QUERY, MONTH_QUERY } from "../routes";
import type { DayBest, DayBestMonths } from "../types/day-best";
import { getCurrentDateInTimeZone } from "../utils/date";
import {
  countLine,
  dayFromQuery,
  dayName,
  daysSoFar,
  monthFromQuery,
  monthGroups,
  monthOf,
  monthRange,
  nextMonths,
  shortWeekday,
  yearAgo,
  yearsOf,
} from "../utils/day-best";
import { monthLabel } from "../utils/history";

/**
 * "Das Beste": every day's line, newest first, in months with their count
 * ("12 von 30 Tagen"); days without a line are not listed. Older months
 * load while scrolling, a jump leads to any month with lines, and a tap on
 * a line changes it in place. The month or day shown lives in the address
 * (`?monat=`, `?tag=` from the search).
 */
const route = useRoute();
const router = useRouter();

const title = ref<HTMLElement | null>(null);
const message = ref("");

const {
  data: summary,
  isLoading: summaryLoading,
  errorMessage: summaryError,
  reload: reloadSummary,
} = useLoader<DayBestMonths | null>((signal) => getDayBestMonths(signal), {
  initial: null,
  fallbackError: "Das Beste konnte nicht geladen werden.",
});

const today = computed(
  () => summary.value?.today ?? getCurrentDateInTimeZone(),
);
const thisMonth = computed(() => monthOf(today.value));
const withEntries = computed(
  () => summary.value?.months.map((item) => item.month) ?? [],
);
const counts = computed(
  () => new Map(summary.value?.months.map((item) => [item.month, item.count])),
);

/** The day the search opened, if any; its month is where the list starts. */
const targetDay = computed(() => dayFromQuery(route.query[DAY_QUERY], today.value));
const anchor = computed(
  () =>
    monthFromQuery(route.query[MONTH_QUERY], today.value) ??
    (targetDay.value ? monthOf(targetDay.value) : thisMonth.value),
);
/** Away from now the way back shows (The Way-Back Rule). */
const anchored = computed(() => anchor.value !== thisMonth.value);

const entries = ref<DayBest[]>([]);
const loadedMonths = ref<string[]>([]);
/** The day whose line is open for a change. */
const editing = ref<string | null>(null);
const pageLoading = ref(false);
const pageError = ref("");
let generation = 0;

const groups = computed(() => monthGroups(entries.value));
const hasMore = computed(
  () =>
    nextMonths(withEntries.value, anchor.value, loadedMonths.value).length > 0,
);
const empty = computed(
  () => !!summary.value && summary.value.months.length === 0,
);
const loading = computed(
  () => summaryLoading.value || (pageLoading.value && !entries.value.length),
);

async function loadMore(): Promise<void> {
  if (pageLoading.value) return;
  const months = nextMonths(
    withEntries.value,
    anchor.value,
    loadedMonths.value,
  );
  if (!months.length) return;
  const current = generation;
  pageLoading.value = true;
  pageError.value = "";
  try {
    // One read per month: months with lines can lie years apart.
    const pages = await Promise.all(
      months.map((month) => {
        const { from, to } = monthRange(month);
        return getDayBests(from, to);
      }),
    );
    if (current !== generation) return;
    entries.value = [
      ...entries.value,
      ...pages.flatMap((page) => page.entries),
    ];
    loadedMonths.value = [...loadedMonths.value, ...months];
  } catch (cause) {
    if (current !== generation) return;
    pageError.value =
      cause instanceof Error
        ? cause.message
        : "Ältere Monate konnten nicht geladen werden.";
  } finally {
    if (current === generation) pageLoading.value = false;
  }
}

/** Starts the list over at the anchor month (and the day asked for). */
async function restart(): Promise<void> {
  generation += 1;
  entries.value = [];
  loadedMonths.value = [];
  pageLoading.value = false;
  editing.value = null;
  await loadMore();
  if (targetDay.value) await reveal(targetDay.value);
}
/*
 * Once the months are known, and whenever the address names another month.
 * A count kept in step after a write changes the summary, not its arrival,
 * so it never throws away what is shown.
 */
watch([() => !!summary.value, anchor], ([ready]) => {
  if (ready) void restart();
});

const found = ref<string | null>(null);
/** Scrolls to a day's line and gives it the focus. */
async function reveal(date: string): Promise<void> {
  await nextTick();
  const row = document.getElementById(`best-${date}`);
  if (!row) return;
  found.value = date;
  row.scrollIntoView?.({ block: "center" });
  row.querySelector<HTMLElement>("button")?.focus({ preventScroll: true });
}

/* Older months come into view: the next ones load. */
const sentinel = ref<HTMLElement | null>(null);
let observer: IntersectionObserver | null = null;
onMounted(() => {
  if (!("IntersectionObserver" in window)) return;
  observer = new IntersectionObserver(
    (items) => {
      if (
        items.some((item) => item.isIntersecting) &&
        hasMore.value &&
        !pageError.value
      )
        void loadMore();
    },
    { rootMargin: "400px 0px" },
  );
  watch(
    sentinel,
    (element, previous) => {
      if (previous) observer?.unobserve(previous);
      if (element) observer?.observe(element);
    },
    { immediate: true },
  );
});
onBeforeUnmount(() => observer?.disconnect());

/* Today has no line yet: the list starts with a field for it. */
const offersToday = computed(
  () =>
    !!summary.value &&
    !anchored.value &&
    !entries.value.some((entry) => entry.date === today.value),
);

/* "Heute vor einem Jahr", when that day has a line. */
const memory = ref<DayBest | null>(null);
watch(
  today,
  async (day) => {
    memory.value = null;
    const earlier = yearAgo(day);
    if (!earlier) return;
    try {
      const entry = await getDayBest(earlier);
      if (day === today.value && entry.text) memory.value = entry;
    } catch {
      // A memory is a gift, not a duty: without it the page is complete.
    }
  },
  { immediate: true },
);

/* Changing a line in place. */
function startEdit(date: string): void {
  editing.value = date;
  message.value = "";
}
async function focusRow(date: string | null): Promise<void> {
  await nextTick();
  const target = date
    ? document.querySelector<HTMLElement>(`#best-${date} button`)
    : title.value;
  target?.focus();
}
function cancelEdit(date: string): void {
  editing.value = null;
  void focusRow(date);
}

/** Keeps the month counts in step with a write, without a new read. */
function count(month: string, change: number): void {
  if (!summary.value) return;
  const months = summary.value.months
    .map((item) =>
      item.month === month ? { ...item, count: item.count + change } : item,
    )
    .filter((item) => item.count > 0);
  if (change > 0 && !months.some((item) => item.month === month))
    months.push({ month, count: change });
  months.sort((a, b) => b.month.localeCompare(a.month));
  summary.value = { ...summary.value, months };
}

function onSaved(saved: DayBest): void {
  const index = entries.value.findIndex((entry) => entry.date === saved.date);
  const month = monthOf(saved.date);
  editing.value = null;
  if (!saved.text) {
    if (index < 0) return;
    // The next line down takes the focus; without one, the title.
    const next =
      entries.value[index + 1]?.date ?? entries.value[index - 1]?.date ?? null;
    entries.value = entries.value.filter((_, at) => at !== index);
    count(month, -1);
    message.value = "Eintrag entfernt.";
    void focusRow(next);
    return;
  }
  if (index >= 0)
    entries.value = entries.value.map((entry, at) =>
      at === index ? saved : entry,
    );
  else {
    entries.value = [saved, ...entries.value];
    if (!loadedMonths.value.includes(month))
      loadedMonths.value = [month, ...loadedMonths.value];
    count(month, 1);
  }
  message.value = "Gespeichert.";
  void focusRow(saved.date);
}

/* The jump to a month. */
const jumpOpen = ref(false);
const years = computed(() => {
  const list = yearsOf(withEntries.value);
  const current = thisMonth.value.slice(0, 4);
  return list.includes(current) ? list : [current, ...list];
});
const MONTH_SHORT = [
  "Jan.",
  "Feb.",
  "März",
  "Apr.",
  "Mai",
  "Juni",
  "Juli",
  "Aug.",
  "Sept.",
  "Okt.",
  "Nov.",
  "Dez.",
];
function monthsOf(year: string) {
  return MONTH_SHORT.map((short, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    return {
      month,
      short,
      count: counts.value.get(month) ?? 0,
      future: month > thisMonth.value,
    };
  }).filter((item) => !item.future);
}
/** "November 2026, 12 Einträge", as a screen reader names a month. */
function jumpName(item: { month: string; count: number }): string {
  const entries =
    item.count === 0
      ? "kein Eintrag"
      : item.count === 1
        ? "1 Eintrag"
        : `${item.count} Einträge`;
  return `${monthLabel(`${item.month}-01`)}, ${entries}`;
}
function jumpQuery(month: string) {
  return month === thisMonth.value ? {} : { [MONTH_QUERY]: month };
}
async function jump(month: string): Promise<void> {
  jumpOpen.value = false;
  await router.push({ query: jumpQuery(month) });
  await nextTick();
  document.getElementById(`month-${month}`)?.focus();
}
async function showNewest(): Promise<void> {
  await router.push({ query: {} });
  await nextTick();
  title.value?.focus();
}
</script>

<template>
  <main class="page day-best-view">
    <header class="page-header">
      <h1 ref="title" class="page-title" tabindex="-1">Das Beste</h1>
      <!-- The way back first, so the jump keeps its place when it leaves. -->
      <div class="day-best-view__nav">
        <button v-if="anchored" type="button" class="btn" @click="showNewest">
          Heute
        </button>
        <button
          type="button"
          class="btn"
          :aria-expanded="jumpOpen"
          aria-controls="day-best-jump"
          :disabled="!summary"
          @click="jumpOpen = !jumpOpen"
        >
          <AppIcon name="calendar" />Monat wählen
        </button>
      </div>
      <p class="page-lead">
        Jeden Tag eine Zeile: das Schönste oder Eindrücklichste daran.
      </p>
    </header>

    <nav
      v-show="jumpOpen"
      id="day-best-jump"
      class="card day-best-jump"
      aria-label="Monat wählen"
    >
      <div v-for="year in years" :key="year" class="day-best-jump__year">
        <h2 class="card-title">{{ year }}</h2>
        <ul class="day-best-jump__months">
          <li v-for="item in monthsOf(year)" :key="item.month">
            <a
              v-if="item.count"
              class="day-best-jump__month"
              :href="router.resolve({ query: jumpQuery(item.month) }).href"
              :aria-current="item.month === anchor ? 'true' : undefined"
              @click.prevent="jump(item.month)"
            >
              <span aria-hidden="true">{{ item.short }}</span>
              <span class="day-best-jump__count" aria-hidden="true">{{
                item.count
              }}</span>
              <span class="visually-hidden">{{ jumpName(item) }}</span>
            </a>
            <span
              v-else
              class="day-best-jump__month day-best-jump__month--empty"
            >
              <span aria-hidden="true">{{ item.short }}</span>
              <span class="visually-hidden">{{ jumpName(item) }}</span>
            </span>
          </li>
        </ul>
      </div>
    </nav>

    <section
      v-if="memory && !anchored"
      class="card day-best-view__memory"
      aria-labelledby="day-best-memory-title"
    >
      <h2 id="day-best-memory-title" class="card-title">
        Heute vor einem Jahr
      </h2>
      <p class="day-best-view__memory-date">
        {{ dayName(memory.date) }} {{ memory.date.slice(0, 4) }}
      </p>
      <p class="day-best-view__memory-text">{{ memory.text }}</p>
    </section>

    <div v-if="summaryError" class="alert" role="alert">
      <p>{{ summaryError }}</p>
      <button type="button" class="btn btn--ground" @click="reloadSummary()">
        <AppIcon name="refresh" />Erneut versuchen
      </button>
    </div>

    <div
      v-if="loading"
      class="skeleton"
      role="status"
      aria-label="Das Beste wird geladen"
    >
      <span />
      <span />
      <span />
    </div>
    <template v-else>
      <div v-if="empty" class="empty-state day-best-view__empty">
        <strong>Noch keine Zeile.</strong>
        <span
          >Schreib jeden Abend auf, was das Beste am Tag war. Mit der Zeit
          entsteht ein Jahr, durch das du zurückblättern kannst.</span
        >
      </div>

      <div v-if="offersToday" class="card day-best-view__today">
        <DayBestField
          :date="today"
          text=""
          label="Das Beste von heute"
          placeholder="Was war heute das Beste?"
          @saved="onSaved"
        />
      </div>

      <section
        v-for="group in groups"
        :key="group.month"
        class="day-best-month"
        :aria-labelledby="`month-${group.month}`"
      >
        <h2 :id="`month-${group.month}`" class="day-best-month__head" tabindex="-1">
          <span>{{ group.label }}</span>{{ " " }}<span class="count">{{
            countLine(
              counts.get(group.month) ?? group.entries.length,
              daysSoFar(group.month, today),
            )
          }}</span>
        </h2>
        <ol class="day-best-month__list card">
          <li
            v-for="entry in group.entries"
            :id="`best-${entry.date}`"
            :key="entry.date"
            class="day-best-row"
            :class="{ 'day-best-row--found': found === entry.date }"
          >
            <span class="day-best-row__date" aria-hidden="true">
              <span class="day-best-row__day">{{
                Number(entry.date.slice(8, 10))
              }}</span>
              <span class="day-best-row__weekday">{{
                shortWeekday(entry.date)
              }}</span>
            </span>
            <DayBestField
              v-if="editing === entry.date"
              class="day-best-row__field"
              :date="entry.date"
              :text="entry.text"
              :label="`Das Beste vom ${dayName(entry.date)}`"
              hide-label
              autofocus
              @saved="onSaved"
              @cancel="cancelEdit(entry.date)"
            />
            <button
              v-else
              type="button"
              class="day-best-row__button"
              @click="startEdit(entry.date)"
            >
              <span class="visually-hidden">{{ dayName(entry.date) }}: </span>
              <span class="day-best-row__text">{{ entry.text }}</span>
              <span class="visually-hidden">. Bearbeiten</span>
              <AppIcon name="edit" class="day-best-row__pencil" />
            </button>
          </li>
        </ol>
      </section>

      <div v-if="pageError" class="alert" role="alert">
        <p>{{ pageError }}</p>
        <button type="button" class="btn btn--ground" @click="loadMore">
          <AppIcon name="refresh" />Erneut versuchen
        </button>
      </div>
      <div ref="sentinel" class="day-best-view__more">
        <button
          v-if="hasMore && !pageError"
          type="button"
          class="btn"
          :disabled="pageLoading"
          @click="loadMore"
        >
          {{ pageLoading ? "Lädt …" : "Ältere Monate laden" }}
        </button>
        <p v-else-if="groups.length && !pageError" class="day-best-view__end">
          Hier fängt es an.
        </p>
      </div>
    </template>
    <p class="visually-hidden" role="status">{{ message }}</p>
  </main>
</template>

<style scoped>
.day-best-view__nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.day-best-jump {
  display: grid;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.day-best-jump__months {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(4.5rem, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.day-best-jump__month {
  display: flex;
  gap: var(--space-1);
  align-items: center;
  justify-content: center;
  min-height: var(--tap);
  border-radius: var(--radius-pill);
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

a.day-best-jump__month {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
  text-decoration: none;
  transition: transform 420ms var(--spring);
}

a.day-best-jump__month:active {
  transform: var(--press);
}

/* The month shown: ink on white with an ink ring, as a chosen chip. */
a.day-best-jump__month[aria-current="true"] {
  background: var(--color-surface);
  box-shadow: inset 0 0 0 1.5px var(--color-ink);
  color: var(--color-ink);
}

.day-best-jump__count {
  color: inherit;
  font-size: 0.8125rem;
  opacity: 0.8;
}

.day-best-jump__month--empty {
  color: var(--color-ink-soft);
}

.day-best-view__memory {
  display: grid;
  gap: var(--space-1);
  margin-bottom: var(--space-5);
}

.day-best-view__memory .card-title {
  margin: 0;
}

.day-best-view__memory-date,
.day-best-view__memory-text {
  margin: 0;
}

.day-best-view__memory-date {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.day-best-view__memory-text {
  font-size: 1.0625rem;
  overflow-wrap: anywhere;
}

.day-best-view__empty {
  margin-bottom: var(--space-3);
}

.day-best-view__empty span {
  max-width: 42ch;
}

.day-best-view__today {
  margin-bottom: var(--space-2);
}

/* Month headings stay at the top while their days scroll beneath. */
.day-best-month__head {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  align-items: baseline;
  justify-content: space-between;
  margin: 0;
  padding: var(--space-5) 0 var(--space-2);
  background: var(--color-ground);
  font-size: 1.125rem;
  font-weight: 800;
}

.day-best-month__head:focus {
  outline: none;
}

.day-best-month__head .count {
  font-size: 0.875rem;
}

@media (min-width: 56rem), (hover: hover) and (pointer: fine) {
  .day-best-month__head {
    top: 3.5rem;
  }
}

.day-best-month__list {
  margin: 0;
  padding: var(--space-1) var(--space-4);
  list-style: none;
}

.day-best-row {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  padding: var(--space-2) 0;
  scroll-margin: 8rem 0;
}

.day-best-row + .day-best-row {
  border-top: 1px solid var(--color-line);
}

/* The day the search opened, marked by a line of ink beside it, not a colour. */
.day-best-row--found {
  margin-inline-start: calc(var(--space-4) * -1);
  padding-inline-start: var(--space-4);
  box-shadow: inset 3px 0 0 var(--color-ink);
}

.day-best-row__date {
  display: grid;
  flex: none;
  justify-items: center;
  width: 2.5rem;
  padding-top: var(--space-2);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

.day-best-row__day {
  font-size: 1.25rem;
  font-weight: 800;
}

.day-best-row__weekday {
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}

.day-best-row__field {
  flex: 1;
  min-width: 0;
}

.day-best-row__button {
  display: flex;
  flex: 1;
  gap: var(--space-2);
  align-items: flex-start;
  min-width: 0;
  min-height: var(--tap);
  padding: var(--space-2);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms var(--ease-out);
}

.day-best-row__button:hover {
  background: var(--color-action-tint);
}

.day-best-row__text {
  flex: 1;
  min-width: 0;
  font-size: 1.0625rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.day-best-row__pencil {
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
  margin-top: 0.2rem;
  color: var(--color-ink-soft);
  opacity: 0;
  transition: opacity 160ms var(--ease-out);
}

.day-best-row__button:hover .day-best-row__pencil,
.day-best-row__button:focus-visible .day-best-row__pencil {
  opacity: 1;
}

/* Without hover the pencil always says the line can be changed. */
@media (hover: none) {
  .day-best-row__pencil {
    opacity: 1;
  }
}

.day-best-view__more {
  display: grid;
  justify-items: center;
  margin-top: var(--space-5);
}

.day-best-view__end {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
