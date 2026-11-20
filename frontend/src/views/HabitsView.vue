<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getHabits, updateOccurrenceStatus } from "../api/day-planner.api";
import { useCategoryLabels } from "../composables/useCategoryLabels";
import { useListFocus } from "../composables/useListFocus";
import ActionMenu from "../components/ActionMenu.vue";
import CampaignChip from "../components/CampaignChip.vue";
import DeleteItemDialog, {
  type DeleteTarget,
} from "../components/DeleteItemDialog.vue";
import CheckRing from "../components/CheckRing.vue";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import UndoToast from "../components/UndoToast.vue";
import { useLoader } from "../composables/useLoader";
import { useUndo } from "../composables/useUndo";
import { useWrites } from "../composables/useWrites";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import { getHistory } from "../api/history.api";
import type { HabitResponse, HabitScheduleRule } from "../types/habit";
import type { HistoryResponse } from "../types/history";
import { shownWhy } from "../utils/why";
import { onCardClick } from "../utils/card-click";
import { rowMenu, type MenuEntry } from "../utils/row-actions";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
} from "../utils/date";
import { WEEKDAY_OPTIONS, dailyWeekStatus } from "../utils/habit";
import { streakSummary } from "../utils/streak";
import {
  WITHOUT,
  dailyCampaigns,
  dailyFilterFromQuery,
  dailyFilterQuery,
  dailyGroups,
  passesFilter,
  type DailyFilter,
} from "../utils/daily-groups";

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const successMessage = ref<string | null>(null);
const editingId = ref<number | null>(null);
/** Today's run of the daily being edited, for its notes. */
const editingRun = ref<number | null>(null);
const deleting = ref<DeleteTarget | null>(null);
const editorBusy = ref(false);
const creationOpen = ref(false);

/** Category names and marks for the meta line. */
const {
  load: loadCategories,
  labelOf,
  list: categories,
} = useCategoryLabels();
/*
 * The week as the calendar reads it, for each Daily's status this week; the
 * list stays usable without it. Read once with the list, so both agree.
 */
const week = ref<HistoryResponse | null>(null);
const today = ref(getCurrentDateInTimeZone());
async function loadWeek(): Promise<void> {
  today.value = getCurrentDateInTimeZone();
  try {
    week.value = await getHistory(today.value, "week", "habits");
  } catch {
    week.value = null;
  }
}
async function loadAll(): Promise<HabitResponse[]> {
  const [habits] = await Promise.all([
    getHabits(),
    loadCategories(),
    loadWeek(),
  ]);
  return habits;
}

const {
  data: habits,
  isLoading,
  hasLoaded,
  errorMessage,
  reload: loadHabits,
} = useLoader(loadAll, {
  initial: [] as HabitResponse[],
  fallbackError: "Die Dailies konnten nicht geladen werden.",
  refreshOnChange: () =>
    editingId.value === null &&
    !deleting.value &&
    !creationOpen.value &&
    !writes.busy.value,
});
const writes = useWrites(loadHabits, errorMessage);
const { applied } = writes;

/**
 * Today's run of a Daily, where one is due or was done today: the open run
 * the stopwatch would measure, or the completed one the week lists. The
 * ring ticks it through the same occurrence path as Heute.
 */
function runToday(habit: HabitResponse): { id: number; done: boolean } | null {
  const day = week.value?.days.find((entry) => entry.date === today.value);
  const done = day?.items.find(
    (item) =>
      item.type === "habit" &&
      item.habitId === habit.id &&
      item.status === "completed",
  );
  if (done) return { id: done.id, done: true };
  if (habit.isActive && habit.timerOccurrenceId !== null)
    return { id: habit.timerOccurrenceId, done: false };
  return null;
}
/* Rings line up: a card without a run today keeps the ring's place. */
const anyRun = computed(() =>
  habits.value.some((habit) => runToday(habit) !== null),
);
const { undo, offer: offerUndo, take: takeUndo } = useUndo<number>();
const runKey = (habit: HabitResponse) => `run-${habit.id}`;
async function toggleRun(habit: HabitResponse): Promise<void> {
  const run = runToday(habit);
  if (!run) return;
  const done = await writes.write(
    () => updateOccurrenceStatus(run.id, run.done ? "pending" : "completed"),
    {
      key: runKey(habit),
      fallbackError: "Das Daily konnte nicht aktualisiert werden.",
    },
  );
  if (done && !run.done) offerUndo(run.id, `„${habit.title}“ erledigt`);
}
async function undoLast(): Promise<void> {
  const id = takeUndo();
  if (id === null) return;
  await writes.write(() => updateOccurrenceStatus(id, "pending"), {
    key: `undo-${id}`,
    fallbackError: "Das Rückgängigmachen hat nicht geklappt.",
  });
}

const isBusy = computed(() => isLoading.value || editorBusy.value);

/* The filter lives in the address (#/dailies?kategorie=…&kampagne=…). */
const route = useRoute();
const router = useRouter();
const filter = computed(() => dailyFilterFromQuery(route.query));
function setFilter(change: Partial<DailyFilter>): void {
  void router.replace({
    query: dailyFilterQuery({ ...filter.value, ...change }),
  });
}
/** A select's value as a filter value: "" is all. */
function chosen(event: Event): number | typeof WITHOUT | null {
  const value = (event.target as HTMLSelectElement).value;
  if (value === WITHOUT) return WITHOUT;
  return value ? Number(value) : null;
}
const campaignOptions = computed(() => dailyCampaigns(habits.value));
/* Grouped by category; the paused ones last. */
const groups = computed(() =>
  dailyGroups(
    habits.value.filter((habit) => passesFilter(habit, filter.value)),
    categories.value,
  ),
);

/** The schedule as a person would say it: "Mo, Mi, Fr", "3× pro Woche". */
function scheduleInWords(rule: HabitScheduleRule): string {
  switch (rule.type) {
    case "interval":
      return rule.intervalDays === 1
        ? "Täglich"
        : `Alle ${rule.intervalDays} Tage`;
    case "weekly_target":
      return `${rule.weeklyTarget}× pro Woche`;
    case "fixed_weekdays":
      return WEEKDAY_OPTIONS.filter((day) => rule.weekdays.includes(day.value))
        .map((day) => day.label.slice(0, 2))
        .join(", ");
  }
}

function shortDate(date: string): string {
  return formatDateForGermanDisplay(date).slice(0, 6);
}

function scheduleOf(habit: HabitResponse): string {
  if (habit.currentSchedule)
    return scheduleInWords(habit.currentSchedule.schedule);
  if (habit.upcomingSchedule)
    return `Ab ${shortDate(habit.upcomingSchedule.effectiveFrom)}: ${scheduleInWords(habit.upcomingSchedule.schedule)}`;
  return "Noch kein Zeitplan";
}

/** A change already planned on top of the current schedule. */
function nextScheduleOf(habit: HabitResponse): string | null {
  if (!habit.currentSchedule || !habit.upcomingSchedule) return null;
  return `Ab ${shortDate(habit.upcomingSchedule.effectiveFrom)}: ${scheduleInWords(habit.upcomingSchedule.schedule)}`;
}

const categoryOf = (habit: HabitResponse) => labelOf(habit.categoryId);

/* The card contract: a tap on the card opens the editor, as its title does. */
const canEdit = () =>
  !isBusy.value && editingId.value === null && !deleting.value;
function openFromCard(event: MouseEvent, habit: HabitResponse): void {
  if (canEdit()) onCardClick(event, () => openEditing(habit));
}
const cardMenu = (habit: HabitResponse): MenuEntry[] =>
  rowMenu(
    habit.title,
    {
      edit: () => openEditing(habit),
      remove: { run: () => openDeleting(habit) },
    },
    !canEdit(),
  );
function openDeleting(habit: HabitResponse): void {
  if (!canEdit()) return;
  successMessage.value = null;
  listFocus.remember(`habit-${habit.id}`);
  deleting.value = { kind: "habit", id: habit.id, title: habit.title };
}
async function onDeleted(): Promise<void> {
  successMessage.value = "Daily gelöscht. Das Logbuch bleibt erhalten.";
  await applied();
  deleting.value = null;
  editorBusy.value = false;
}

function statusOf(habit: HabitResponse): string | null {
  return dailyWeekStatus(habit, week.value, today.value);
}

function detailsOf(habit: HabitResponse): string[] {
  const parts = [scheduleOf(habit)];
  if (habit.timeOfDay) parts.push(`${habit.timeOfDay.slice(0, 5)} Uhr`);
  if (habit.plannedDurationMinutes)
    parts.push(`${habit.plannedDurationMinutes} Min.`);
  return parts;
}

function openCreation(): void {
  if (isBusy.value || editingId.value !== null) return;
  successMessage.value = null;
  creationOpen.value = true;
}
function openEditing(habit: HabitResponse): void {
  if (isBusy.value || editingId.value !== null) return;
  successMessage.value = null;
  listFocus.remember(`habit-${habit.id}`);
  editingRun.value = runToday(habit)?.id ?? null;
  editingId.value = habit.id;
}
function closeEditing(): void {
  editingId.value = null;
  editingRun.value = null;
  editorBusy.value = false;
}
async function onEditorChanged(): Promise<void> {
  successMessage.value = "Änderungen gespeichert.";
  await applied();
  closeEditing();
}
async function onCreated(): Promise<void> {
  successMessage.value = "Daily erstellt.";
  await applied();
  creationOpen.value = false;
}
</script>

<template>
  <main ref="page" class="page habits-view">
    <header class="page-header">
      <h1 class="page-title">Dailies</h1>
      <p class="page-lead">Was du regelmäßig tun willst, und wie oft.</p>
    </header>

    <CreateItemDialog
      v-if="creationOpen"
      kind="habit"
      @close="creationOpen = false"
      @created="onCreated"
    />
    <EditItemDialog
      v-if="editingId !== null"
      :key="editingId"
      kind="habit"
      :entity-id="editingId"
      :occurrence-id="editingRun"
      :return-focus="listFocus.returnFocus"
      @busy="editorBusy = $event"
      @changed="onEditorChanged"
      @close="closeEditing"
    />

    <DeleteItemDialog
      v-if="deleting"
      :target="deleting"
      :return-focus="listFocus.returnFocus"
      @busy="editorBusy = $event"
      @deleted="onDeleted"
      @close="
        deleting = null;
        editorBusy = false;
      "
    />

    <div v-if="errorMessage" class="alert habits-view__alert">
      <p role="alert">{{ errorMessage }}</p>
      <button
        class="btn btn--ground"
        type="button"
        :disabled="isLoading || editingId !== null"
        @click="loadHabits()"
      >
        Erneut versuchen
      </button>
    </div>
    <p v-if="successMessage" class="habits-view__status" role="status">
      {{ successMessage }}
    </p>
    <div
      v-if="isLoading"
      class="skeleton"
      role="status"
      aria-label="Dailies werden geladen"
    >
      <span />
      <span />
      <span />
    </div>
    <div
      v-else-if="hasLoaded && habits.length === 0 && !errorMessage"
      class="empty-state"
    >
      <strong>Du hast noch keine Dailies.</strong>
      <span>Tippe auf Plus, um dein erstes Daily anzulegen.</span>
    </div>
    <template v-else-if="habits.length > 0">
      <!-- Narrows the list; the choice stays in the address. -->
      <div class="habit-filter" role="group" aria-label="Dailies filtern">
        <label class="habit-filter__field">
          <span>Kategorie</span>
          <select
            class="input habit-filter__select"
            name="filterCategory"
            :value="filter.category ?? ''"
            @change="setFilter({ category: chosen($event) })"
          >
            <option value="">Alle</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
            <option :value="WITHOUT">Ohne Kategorie</option>
          </select>
        </label>
        <label class="habit-filter__field">
          <span>Kampagne</span>
          <select
            class="input habit-filter__select"
            name="filterCampaign"
            :value="filter.campaign ?? ''"
            @change="setFilter({ campaign: chosen($event) })"
          >
            <option value="">Alle</option>
            <option
              v-for="campaign in campaignOptions"
              :key="campaign.id"
              :value="campaign.id"
            >
              {{ campaign.title }}
            </option>
            <option :value="WITHOUT">Ohne Kampagne</option>
          </select>
        </label>
      </div>
      <div v-if="!groups.length" class="empty-state">
        <strong>Keine Dailies für diesen Filter.</strong>
        <button
          type="button"
          class="btn"
          @click="setFilter({ category: null, campaign: null })"
        >
          Alle zeigen
        </button>
      </div>
      <template v-for="group in groups" :key="group.key">
        <section
          :data-group="group.key"
          class="habit-group"
          :aria-labelledby="`habit-group-${group.key}`"
        >
          <h2 :id="`habit-group-${group.key}`" class="section-title">
            <i
              v-if="group.mark"
              class="category-mark habit-group__mark"
              :style="{ background: group.mark }"
              aria-hidden="true"
            />{{ group.title }}
            <span class="count">{{ group.habits.length }}</span>
          </h2>
          <p v-if="group.key === 'paused'" class="habit-group__hint">
            Pausierte Dailies stehen nicht in Heute.
          </p>
          <ul class="habit-group__items">
            <li
              v-for="habit in group.habits"
              :key="habit.id"
              :data-habit-id="habit.id"
              :data-focus-key="`habit-${habit.id}`"
              class="habit-card card-target"
              :class="{
                'habit-card--paused': !habit.isActive,
                'habit-card--ring': anyRun && habit.isActive,
              }"
              @click="openFromCard($event, habit)"
            >
              <template v-if="anyRun && habit.isActive">
                <CheckRing
                  v-if="runToday(habit)"
                  class="habit-card__ring"
                  :checked="runToday(habit)!.done"
                  :label="
                    runToday(habit)!.done
                      ? `${habit.title} heute wieder öffnen`
                      : `${habit.title} heute erledigen`
                  "
                  :disabled="isBusy || writes.isWriting(runKey(habit))"
                  :busy="writes.isWriting(runKey(habit))"
                  @toggle="toggleRun(habit)"
                />
                <span v-else class="habit-card__ring" aria-hidden="true" />
              </template>
              <div class="habit-card__content">
                <!-- The heading keeps the plain title; the button says "bearbeiten". -->
                <h3 :aria-label="habit.title">
                  <button
                    class="habit-card__title"
                    data-edit-button
                    type="button"
                    :aria-label="`${habit.title} bearbeiten`"
                    :disabled="isBusy || editingId !== null"
                    @click="openEditing(habit)"
                  >
                    {{ habit.title }}
                  </button>
                </h3>
                <p v-if="shownWhy(habit)" class="habit-card__why">
                  {{ shownWhy(habit) }}
                </p>
                <p class="habit-card__details">
                  <span v-if="statusOf(habit)" class="habit-card__status">{{
                    statusOf(habit)
                  }}</span>
                  <span
                    v-if="streakSummary(habit.streak)"
                    class="habit-card__streak"
                    >{{ streakSummary(habit.streak) }}</span
                  >
                  <span v-if="categoryOf(habit)" class="habit-card__category">
                    <i
                      class="category-mark"
                      :style="{ background: categoryOf(habit)!.mark }"
                      aria-hidden="true"
                    />{{ categoryOf(habit)!.name }}
                  </span>
                  <span v-for="part in detailsOf(habit)" :key="part">{{
                    part
                  }}</span>
                  <CampaignChip
                    v-if="habit.campaign"
                    :campaign="habit.campaign"
                  />
                </p>
                <p v-if="nextScheduleOf(habit)" class="habit-card__next">
                  {{ nextScheduleOf(habit) }}
                </p>
              </div>
              <div class="habit-card__end">
                <ItemPlayButton
                  kind="occurrence"
                  :target-id="habit.timerOccurrenceId"
                  :title="habit.title"
                  :eligible="habit.isActive && habit.timerOccurrenceId !== null"
                  :disabled="isBusy"
                />
                <ActionMenu
                  :title="habit.title"
                  :entries="cardMenu(habit)"
                  :disabled="isBusy"
                />
              </div>
            </li>
          </ul>
        </section>
      </template>
    </template>
    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
    <!-- After the content in reading order; fixed in place, it looks the same. -->
    <CreateButton
      label="Daily erstellen"
      :disabled="isBusy || editingId !== null"
      @click="openCreation"
    />
  </main>
</template>

<style scoped>
.habits-view__alert,
.habits-view__status {
  margin: 0 0 var(--space-4);
}

.habits-view__status {
  color: var(--color-ink-muted);
  font-weight: 600;
}

/* Two compact selects on one line; under each other only when too narrow. */
.habit-filter {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  margin: 0 0 var(--space-4);
}

.habit-filter__field {
  display: flex;
  flex: 1 1 12rem;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.habit-filter__select {
  flex: 1 1 auto;
  min-width: 0;
}

.habit-group + .habit-group {
  margin-top: var(--space-5);
}

.habit-group .section-title {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.habit-group__hint {
  margin: calc(var(--space-2) * -1) 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
}

.habit-group__items {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.habit-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

/* The ring column sits before the title, as in every other row. */
.habit-card--ring {
  grid-template-columns: var(--tap) minmax(0, 1fr) auto;
  gap: var(--space-2);
  padding-left: var(--space-2);
}

.habit-card__ring {
  width: var(--tap);
  height: var(--tap);
}

.habit-card__end {
  display: flex;
  align-items: center;
}

.habit-card__content {
  min-width: 0;
  padding: 0.35rem 0 0.15rem;
}

.habit-card h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.habit-card--paused h3 {
  color: var(--color-ink-muted);
}

.habit-card__title {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 0.2em;
  cursor: pointer;
  transition: text-decoration-color 160ms var(--ease-out);
}

.habit-card__title:hover:not(:disabled) {
  text-decoration-color: var(--color-line);
}

.habit-card__title:disabled {
  cursor: progress;
}

.habit-card__why {
  max-width: 60ch;
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
}

.habit-card__details,
.habit-card__next {
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.habit-card__details {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
}

.habit-card__next {
  font-weight: 600;
}

/* Where the week stands, first and in ink; a number, never a warning colour. */
.habit-card__status {
  color: var(--color-ink);
}

/* The series is a number too, even when it broke. */
.habit-card__streak {
  white-space: nowrap;
}

.habit-card__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}
</style>
