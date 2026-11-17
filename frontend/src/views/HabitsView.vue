<script setup lang="ts">
import { computed, ref } from "vue";
import { getHabits } from "../api/day-planner.api";
import { getCategories } from "../api/categories.api";
import { useListFocus } from "../composables/useListFocus";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import type { HabitResponse, HabitScheduleRule } from "../types/habit";
import { categoryMark } from "../utils/category-mark";
import { formatDateForGermanDisplay } from "../utils/date";
import { WEEKDAY_OPTIONS } from "../utils/habit";

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const successMessage = ref<string | null>(null);
const editingId = ref<number | null>(null);
const editorBusy = ref(false);
const creationOpen = ref(false);

/** Category names for the meta line; the list stays usable without them. */
const categoryNames = ref(new Map<number, string>());
async function loadCategoryNames(): Promise<void> {
  try {
    const categories = await getCategories();
    categoryNames.value = new Map(categories.map((c) => [c.id, c.name]));
  } catch {
    // Without names the cards simply show no category mark.
  }
}
async function loadAll(): Promise<HabitResponse[]> {
  const [habits] = await Promise.all([getHabits(), loadCategoryNames()]);
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
  fallbackError: "Die Habits konnten nicht geladen werden.",
  refreshOnChange: () => editingId.value === null && !creationOpen.value,
});
const { applied } = useWrites(loadHabits, errorMessage);

const isBusy = computed(() => isLoading.value || editorBusy.value);
const groups = computed(() => [
  {
    key: "active",
    title: "Aktiv",
    items: habits.value.filter((habit) => habit.isActive),
  },
  {
    key: "paused",
    title: "Pausiert",
    items: habits.value.filter((habit) => !habit.isActive),
  },
]);

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

function categoryOf(habit: HabitResponse): string | null {
  return habit.categoryId === null
    ? null
    : (categoryNames.value.get(habit.categoryId) ?? null);
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
  editingId.value = habit.id;
}
function closeEditing(): void {
  editingId.value = null;
  editorBusy.value = false;
}
async function onEditorChanged(): Promise<void> {
  successMessage.value = "Änderungen gespeichert.";
  await applied();
  closeEditing();
}
async function onCreated(): Promise<void> {
  successMessage.value = "Habit erstellt.";
  await applied();
  creationOpen.value = false;
}
</script>

<template>
  <main ref="page" class="page habits-view">
    <CreateButton
      label="Habit erstellen"
      :disabled="isBusy || editingId !== null"
      @click="openCreation"
    />
    <header class="page-header">
      <h1 class="page-title">Habits</h1>
      <p class="page-lead">Was du regelmäßig tun willst, und wie oft.</p>
    </header>

    <CreateItemDialog
      v-if="creationOpen"
      mode="habit"
      @close="creationOpen = false"
      @created="onCreated"
    />
    <EditItemDialog
      v-if="editingId !== null"
      :key="editingId"
      kind="habit"
      :entity-id="editingId"
      :return-focus="listFocus.returnFocus"
      @busy="editorBusy = $event"
      @changed="onEditorChanged"
      @close="closeEditing"
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
      aria-label="Habits werden geladen"
    >
      <span />
      <span />
      <span />
    </div>
    <div
      v-else-if="hasLoaded && habits.length === 0 && !errorMessage"
      class="empty-state"
    >
      <strong>Du hast noch keine Habits.</strong>
      <span>Tippe auf Plus, um deine erste Gewohnheit anzulegen.</span>
    </div>
    <template v-else-if="habits.length > 0">
      <template v-for="group in groups" :key="group.key">
        <section
          v-if="group.items.length"
          :data-group="group.key"
          class="habit-group"
          :aria-label="group.key === 'active' ? group.title : undefined"
        >
          <template v-if="group.key === 'paused'">
            <h2 class="section-title">
              {{ group.title }}
              <span class="count">{{ group.items.length }}</span>
            </h2>
            <p class="habit-group__hint">
              Pausierte Habits stehen nicht in Heute.
            </p>
          </template>
          <ul class="habit-group__items">
            <li
              v-for="habit in group.items"
              :key="habit.id"
              :data-habit-id="habit.id"
              :data-focus-key="`habit-${habit.id}`"
              class="habit-card"
              :class="{ 'habit-card--paused': !habit.isActive }"
            >
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
                <p v-if="habit.why" class="habit-card__why">{{ habit.why }}</p>
                <p class="habit-card__details">
                  <span v-if="categoryOf(habit)" class="habit-card__category">
                    <i
                      class="category-mark"
                      :style="{ background: categoryMark(categoryOf(habit)!) }"
                      aria-hidden="true"
                    />{{ categoryOf(habit) }}
                  </span>
                  <span v-for="part in detailsOf(habit)" :key="part">{{
                    part
                  }}</span>
                </p>
                <p v-if="nextScheduleOf(habit)" class="habit-card__next">
                  {{ nextScheduleOf(habit) }}
                </p>
              </div>
              <ItemPlayButton
                v-if="
                  habit.plannedDurationMinutes || habit.timerDurationMinutes
                "
                class="habit-card__play"
                kind="occurrence"
                :target-id="habit.timerOccurrenceId"
                :title="habit.title"
                :duration="
                  habit.timerDurationMinutes ?? habit.plannedDurationMinutes
                "
                :eligible="habit.isActive && habit.timerOccurrenceId !== null"
                :disabled="isBusy"
              />
            </li>
          </ul>
        </section>
      </template>
    </template>
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
