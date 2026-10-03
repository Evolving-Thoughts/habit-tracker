<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { getHabits } from "../api/day-planner.api";
import { useListFocus } from "../composables/useListFocus";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import { notifyTargetChange } from "../composables/useTimer";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import type { HabitResponse } from "../types/habit";
import { formatDateForGermanDisplay } from "../utils/date";
import { formatHabitSchedule } from "../utils/habit";

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const habits = ref<HabitResponse[]>([]);
const isLoading = ref(true);
const hasLoaded = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);
const editingId = ref<number | null>(null);
const editorBusy = ref(false);
const creationOpen = ref(false);
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
let loadGeneration = 0;
async function loadHabits(showPageLoading = true): Promise<void> {
  const generation = ++loadGeneration;
  if (showPageLoading) isLoading.value = true;
  errorMessage.value = null;
  try {
    const result = await getHabits();
    if (generation !== loadGeneration) return;
    habits.value = result;
    hasLoaded.value = true;
  } catch (error: unknown) {
    if (generation !== loadGeneration) return;
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Habits konnten nicht geladen werden.";
  } finally {
    if (generation === loadGeneration) isLoading.value = false;
  }
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
  successMessage.value = "Habit-Liste aktualisiert.";
  notifyTargetChange();
  await loadHabits(false);
  closeEditing();
}
async function onCreated(): Promise<void> {
  successMessage.value = "Habit erstellt.";
  await loadHabits(false);
  creationOpen.value = false;
}
function timerChanged(): void {
  if (editingId.value === null) void loadHabits(false);
}
onMounted(loadHabits);
onMounted(() => window.addEventListener("timer-data-changed", timerChanged));
onUnmounted(() =>
  window.removeEventListener("timer-data-changed", timerChanged),
);
</script>

<template>
  <main ref="page" class="habits-view">
    <CreateButton
      label="Habit erstellen"
      :disabled="isBusy || editingId !== null"
      @click="openCreation"
    />
    <header class="habits-view__header">
      <div>
        <p class="habits-view__eyebrow">Deine Gewohnheiten</p>
        <h1>Habits</h1>
        <p class="habits-view__intro">
          Alle Habits und ihre Zeitpläne – unabhängig davon, was heute fällig
          ist.
        </p>
      </div>
      <div class="habits-view__header-actions">
        <button
          class="habits-view__refresh"
          type="button"
          :disabled="isBusy || editingId !== null"
          @click="loadHabits()"
        >
          Aktualisieren
        </button>
      </div>
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

    <p v-if="errorMessage" class="habits-view__error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="successMessage" class="habits-view__success" role="status">
      {{ successMessage }}
    </p>
    <p v-if="isLoading" class="habits-view__state">Habits werden geladen …</p>
    <div
      v-else-if="hasLoaded && habits.length === 0 && !errorMessage"
      class="habits-view__empty"
    >
      <strong>Du hast noch keine Habits.</strong>
      <span>Lege mit „+“ deine erste Gewohnheit an.</span>
    </div>
    <div v-else-if="habits.length > 0" class="habits-view__groups">
      <template v-for="group in groups" :key="group.key">
        <section
          v-if="group.items.length"
          :data-group="group.key"
          class="habit-group"
        >
          <header class="habit-group__header">
            <h2>{{ group.title }}</h2>
            <span>{{ group.items.length }}</span>
          </header>
          <p v-if="group.key === 'paused'" class="habit-group__hint">
            Pausierte Habits erscheinen nicht in „Heute“. Du kannst sie
            jederzeit wieder aktivieren.
          </p>
          <ul class="habit-group__items">
            <li
              v-for="habit in group.items"
              :key="habit.id"
              :data-habit-id="habit.id"
              :data-focus-key="`habit-${habit.id}`"
              class="habit-card"
            >
              <div class="habit-card__heading">
                <h3>{{ habit.title }}</h3>
                <span
                  class="habit-card__status"
                  :class="{ 'habit-card__status--paused': !habit.isActive }"
                  >{{
                    !habit.isActive
                      ? "Pausiert"
                      : habit.currentSchedule
                        ? "Aktiv"
                        : habit.upcomingSchedule
                          ? "Geplant"
                          : "Ohne Zeitplan"
                  }}</span
                >
                <button
                  class="habit-card__edit"
                  data-edit-button
                  type="button"
                  :aria-label="`${habit.title} bearbeiten`"
                  title="Bearbeiten"
                  :disabled="isBusy || editingId !== null"
                  @click="openEditing(habit)"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
                    <path d="m14 5 5 5" />
                  </svg>
                </button>
              </div>
              <div
                v-if="
                  habit.plannedDurationMinutes || habit.timerDurationMinutes
                "
                class="habit-card__timer"
              >
                <ItemPlayButton
                  kind="occurrence"
                  :target-id="habit.timerOccurrenceId"
                  :title="habit.title"
                  :duration="
                    habit.timerDurationMinutes ?? habit.plannedDurationMinutes
                  "
                  :eligible="habit.isActive && habit.timerOccurrenceId !== null"
                  :disabled="isBusy"
                />
                <span
                  >{{
                    habit.timerDurationMinutes ?? habit.plannedDurationMinutes
                  }}
                  Min.<small v-if="habit.timerOccurrenceId === null"
                    >Keine offene fällige Ausführung</small
                  ></span
                >
              </div>
              <dl class="habit-card__schedules">
                <template v-if="habit.currentSchedule">
                  <dt>Aktueller Zeitplan</dt>
                  <dd>
                    <strong>{{
                      formatHabitSchedule(habit.currentSchedule.schedule)
                    }}</strong
                    ><small
                      >Gültig seit
                      {{
                        formatDateForGermanDisplay(
                          habit.currentSchedule.effectiveFrom,
                        )
                      }}</small
                    >
                  </dd>
                </template>
                <template v-if="habit.upcomingSchedule">
                  <dt>
                    Geplant ab
                    {{
                      formatDateForGermanDisplay(
                        habit.upcomingSchedule.effectiveFrom,
                      )
                    }}
                  </dt>
                  <dd class="habit-card__upcoming">
                    <strong>{{
                      formatHabitSchedule(habit.upcomingSchedule.schedule)
                    }}</strong>
                  </dd>
                </template>
              </dl>
              <p v-if="!habit.currentSchedule" class="habit-card__hint">
                {{
                  habit.upcomingSchedule
                    ? "Noch kein aktuell gültiger Zeitplan."
                    : "Noch kein Zeitplan hinterlegt."
                }}
              </p>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.habit-card__timer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.75rem;
  color: #59657a;
}
.habit-card__timer small {
  display: block;
  font-size: 0.875rem;
}
.habits-view {
  width: min(100% - 2rem, 46rem);
  margin: 0 auto;
  padding: 2rem 0 calc(6.5rem + env(safe-area-inset-bottom, 0px));
}
.habits-view__header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
}
.habits-view__header > div:first-child {
  min-width: 0;
}
.habits-view__eyebrow {
  margin: 0 0 0.25rem;
  color: #68758b;
  font-size: 0.875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.habits-view h1 {
  margin: 0;
  color: #151c2c;
  font-size: clamp(2rem, 8vw, 3rem);
  line-height: 1;
}
.habits-view__intro {
  margin: 0.75rem 0 0;
  color: #59657a;
  font-size: 0.875rem;
  line-height: 1.5;
}
.habits-view__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.habits-view__refresh {
  min-height: 2.75rem;
  padding: 0.65rem 0.9rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #fff;
  color: #2f3a4f;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}
.habits-view button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.habits-view__error {
  padding: 0.875rem 1rem;
  border: 1px solid #f2aaaa;
  border-radius: 0.75rem;
  background: #fff0f0;
  color: #9b1c1c;
  line-height: 1.5;
}
.habits-view__success {
  color: #146c43;
  line-height: 1.5;
}
.habits-view__state {
  color: #59657a;
}
.habits-view__empty {
  display: grid;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  border: 1px dashed #c7ced9;
  border-radius: 0.875rem;
  color: #59657a;
  text-align: center;
  line-height: 1.5;
}
.habits-view__groups {
  display: grid;
  gap: 2rem;
}
.habit-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}
.habit-group__header h2 {
  margin: 0;
  color: #273146;
  font-size: 1rem;
}
.habit-group__header > span {
  display: grid;
  min-width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 999px;
  background: #e8ebf0;
  color: #59657a;
  font-size: 0.875rem;
}
.habit-group__hint,
.habit-card__hint {
  color: #59657a;
  font-size: 0.875rem;
  line-height: 1.5;
}
.habit-group__hint {
  margin: 0 0 0.75rem;
}
.habit-group__items {
  display: grid;
  gap: 0.75rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.habit-card {
  padding: 1rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #fff;
}
.habit-card__heading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.habit-card h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: #182033;
  font-size: 1rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.habit-card__status {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  background: #eaf0fc;
  color: #2457c5;
  font-size: 0.875rem;
}
.habit-card__status--paused {
  background: #eef1f5;
  color: #59657a;
}
.habit-card__edit {
  display: grid;
  flex: 0 0 2.75rem;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  background: transparent;
  color: #59657a;
  cursor: pointer;
}
.habit-card__edit:hover:not(:disabled) {
  background: #eef1f5;
}
.habit-card__edit svg {
  width: 1.25rem;
  height: 1.25rem;
}
.habit-card__schedules {
  display: grid;
  gap: 0.375rem;
  margin: 0.75rem 0 0;
}
.habit-card__schedules:empty {
  display: none;
}
.habit-card dt {
  margin-top: 0.5rem;
  color: #59657a;
  font-size: 0.875rem;
}
.habit-card dt:first-child {
  margin-top: 0;
}
.habit-card dd {
  display: grid;
  gap: 0.25rem;
  margin: 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.habit-card dd strong {
  font-weight: 600;
}
.habit-card small {
  color: #59657a;
  font-size: 0.875rem;
}
.habit-card__upcoming {
  color: #2457c5;
}
.habit-card__hint {
  margin: 0.75rem 0 0;
}
@media (max-width: 32rem) {
  .habits-view {
    width: min(100% - 1rem, 46rem);
    padding-top: 1rem;
  }
  .habits-view__header {
    flex-wrap: wrap;
  }
}
</style>
