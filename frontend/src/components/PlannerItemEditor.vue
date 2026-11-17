<script setup lang="ts">
import { useTodoDeletion } from "../composables/useTodoDeletion";
import TodoDeletionSummary from "./TodoDeletionSummary.vue";
import TodoGoalFields from "./TodoGoalFields.vue";
import AppIcon from "./AppIcon.vue";

import {
  TIMER_DURATION_MESSAGE,
  TIMER_MAX_MINUTES,
} from "../utils/timer-duration";
import { computed, onMounted, ref } from "vue";
import { getCategories } from "../api/categories.api";
import type { CategoryResponse } from "../types/category";
import {
  changeHabitSchedule,
  deleteHabit,
  getHabit,
  getTodo,
  updateHabit,
  updateTodo,
} from "../api/day-planner.api";
import type {
  ChangeHabitScheduleInput,
  HabitResponse,
  HabitScheduleRule,
  ScheduleVersionResponse,
  UpdateHabitInput,
} from "../types/habit";
import { formatHabitSchedule, WEEKDAY_OPTIONS } from "../utils/habit";
import type {
  TodoGoalInput,
  TodoResponse,
  UpdateTodoInput,
} from "../types/todo";
import { buildTodoInput } from "../utils/todo-input";
import {
  emptyScheduleDraft,
  positiveInteger,
  scheduleDraftOf,
  scheduleRuleOf,
} from "../utils/habit-schedule";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  isValidIsoDate,
  toLocalInput,
} from "../utils/date";

const props = defineProps<{
  kind: "todo" | "habit";
  entityId: number;
  embedded?: boolean;
}>();

const emit = defineEmits<{
  changed: [];
  close: [];
  busy: [value: boolean];
}>();

const isLoading = ref(true);
const isSaving = ref(false);
const hasLoaded = ref(false);
const errorMessage = ref<string | null>(null);
const confirmDeletion = ref(false);
const {
  preview: deletionPreview,
  prepare: prepareDeletion,
  confirm: confirmPreviewedDeletion,
  cancel: cancelDeletion,
} = useTodoDeletion();
async function requestDeletion(): Promise<void> {
  if (isBusy.value) return;
  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);
  try {
    if (props.kind === "todo") await prepareDeletion(props.entityId);
    confirmDeletion.value = true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Löschvorschau konnte nicht geladen werden.";
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

const title = ref("");
const categories = ref<CategoryResponse[]>([]);
const categoryId = ref<number | null>(null);
const why = ref("");
const originalCategoryId = ref<number | null>(null);
const originalWhy = ref("");

// Todo-Felder
const periodStart = ref("");
const periodEnd = ref("");
const goalHabitId = ref<number | null>(null);
const goalTarget = ref<string | number>("");
const loadedTodo = ref<TodoResponse | null>(null);
const scheduledAt = ref("");
const duration = ref<string | number>("");
const timeOfDay = ref("");
const isFixed = ref(false);

const originalScheduledAt = ref<string | null>(null);
const originalLocalInput = ref("");

// Habit-Felder
const isActive = ref(true);
const loadedHabit = ref<HabitResponse | null>(null);
const changeSchedule = ref(false);
const effectiveFrom = ref(getCurrentDateInTimeZone());
const today = computed(() => getCurrentDateInTimeZone());
const schedule = ref(emptyScheduleDraft());

const isBusy = computed(() => {
  return isLoading.value || isSaving.value;
});

function fillAssignment(entity: {
  categoryId?: number | null;
  why?: string | null;
}): void {
  categoryId.value = originalCategoryId.value = entity.categoryId ?? null;
  why.value = originalWhy.value = entity.why ?? "";
}

/** Only what changed, so a plain edit never overwrites these fields. */
function assignmentChanges(): {
  categoryId?: number | null;
  why?: string | null;
} {
  const value = why.value.trim();
  return {
    ...(categoryId.value !== originalCategoryId.value
      ? { categoryId: categoryId.value }
      : {}),
    ...(value !== originalWhy.value ? { why: value || null } : {}),
  };
}

async function loadEntity(): Promise<void> {
  emit("busy", true);

  try {
    categories.value = await getCategories();

    if (props.kind === "todo") {
      const todo = await getTodo(props.entityId);

      fillAssignment(todo);
      loadedTodo.value = todo;
      periodStart.value = todo.periodStart ?? "";
      periodEnd.value = todo.periodEnd ?? "";
      goalHabitId.value = todo.goalHabitId ?? null;
      goalTarget.value = todo.goalTarget ?? "";
      title.value = todo.title;
      duration.value = todo.plannedDurationMinutes ?? "";
      isFixed.value = todo.isFixed;

      originalScheduledAt.value = todo.scheduledAt;

      scheduledAt.value = todo.scheduledAt
        ? toLocalInput(todo.scheduledAt)
        : "";

      originalLocalInput.value = scheduledAt.value;
    } else {
      const habit = await getHabit(props.entityId);

      fillAssignment(habit);
      title.value = habit.title;
      isActive.value = habit.isActive;
      loadedHabit.value = habit;
      duration.value = habit.plannedDurationMinutes ?? "";
      timeOfDay.value = habit.timeOfDay ?? "";
      const version = habit.currentSchedule ?? habit.upcomingSchedule;
      if (version) fillSchedule(version.schedule);
    }

    hasLoaded.value = true;
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Der Eintrag konnte nicht geladen werden.";
  } finally {
    isLoading.value = false;
    emit("busy", false);
  }
}

function validatedTitle(): string {
  const value = title.value.trim();

  if (!value || value.length > 200) {
    throw new Error("Der Titel muss 1 bis 200 Zeichen enthalten.");
  }

  return value;
}

/** Only what changed, so a plain edit leaves period and goal alone. */
function goalChanges(): TodoGoalInput {
  const todo = loadedTodo.value;
  const target =
    goalHabitId.value === null
      ? null
      : positiveInteger(
          goalTarget.value,
          "Die Sollmenge muss eine ganze Zahl ab 1 sein.",
        );
  const next: TodoGoalInput = {
    periodStart: periodStart.value || null,
    periodEnd: periodEnd.value || null,
    goalHabitId: goalHabitId.value,
    goalTarget: target,
  };
  const keys = Object.keys(next) as (keyof TodoGoalInput)[];
  return Object.fromEntries(
    keys
      .filter((key) => next[key] !== (todo?.[key] ?? null))
      .map((key) => [key, next[key]]),
  );
}

function todoInput(): UpdateTodoInput {
  return {
    ...buildTodoInput(
      {
        title: title.value,
        scheduledAt: scheduledAt.value,
        duration: duration.value,
        isFixed: isFixed.value,
      },
      { localInput: originalLocalInput.value, iso: originalScheduledAt.value },
    ),
    ...assignmentChanges(),
    ...goalChanges(),
  };
}

function fillSchedule(rule: HabitScheduleRule): void {
  schedule.value = scheduleDraftOf(rule);
}

function describeSchedule(version: ScheduleVersionResponse): string {
  return formatHabitSchedule(version.schedule);
}

function editUpcomingSchedule(): void {
  const version = loadedHabit.value?.upcomingSchedule;
  if (!version || isBusy.value) return;
  fillSchedule(version.schedule);
  effectiveFrom.value = version.effectiveFrom;
  changeSchedule.value = true;
}

function buildHabitInput(): UpdateHabitInput {
  const input: UpdateHabitInput = assignmentChanges();
  const value = validatedTitle();
  if (value !== loadedHabit.value?.title) input.title = value;
  if (isActive.value !== loadedHabit.value?.isActive)
    input.isActive = isActive.value;
  const minutes = String(duration.value).trim()
    ? positiveInteger(duration.value, TIMER_DURATION_MESSAGE, TIMER_MAX_MINUTES)
    : null;
  if (minutes !== (loadedHabit.value?.plannedDurationMinutes ?? null))
    input.plannedDurationMinutes = minutes;
  const time = timeOfDay.value || null;
  if (time !== (loadedHabit.value?.timeOfDay ?? null)) input.timeOfDay = time;
  return input;
}

function buildScheduleChange(): ChangeHabitScheduleInput {
  if (
    !isValidIsoDate(effectiveFrom.value) ||
    effectiveFrom.value < getCurrentDateInTimeZone()
  ) {
    throw new Error("Bitte wähle heute oder ein zukünftiges gültiges Datum.");
  }
  return {
    effectiveFrom: effectiveFrom.value,
    schedule: scheduleRuleOf(schedule.value),
  };
}

async function save(): Promise<void> {
  if (isBusy.value || !hasLoaded.value) {
    return;
  }

  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      await updateTodo(props.entityId, todoInput());
    } else {
      // Validate both requests before persisting either of them.
      const metadata = buildHabitInput();
      const scheduleInput = changeSchedule.value ? buildScheduleChange() : null;
      let metadataSaved = false;
      if (Object.keys(metadata).length > 0) {
        loadedHabit.value = await updateHabit(props.entityId, metadata);
        metadataSaved = true;
      }
      if (scheduleInput) {
        try {
          loadedHabit.value = await changeHabitSchedule(
            props.entityId,
            scheduleInput,
          );
        } catch (error: unknown) {
          const detail =
            error instanceof Error ? error.message : "Unbekannter Fehler";
          throw new Error(
            metadataSaved
              ? `Stammdaten gespeichert, Zeitplanänderung fehlgeschlagen: ${detail}. Du kannst die Zeitplanänderung erneut speichern.`
              : detail,
          );
        }
      }
    }

    emit("changed");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

async function remove(): Promise<void> {
  if (isBusy.value || !hasLoaded.value || !confirmDeletion.value) {
    return;
  }

  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      await confirmPreviewedDeletion();
    } else {
      await deleteHabit(props.entityId);
    }

    emit("changed");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Löschen fehlgeschlagen.";
    confirmDeletion.value = false;
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

function retryLoad(): void {
  errorMessage.value = null;
  isLoading.value = true;
  void loadEntity();
}

onMounted(loadEntity);
</script>

<template>
  <section
    class="item-editor"
    :class="{ card: !embedded }"
    :aria-labelledby="embedded ? undefined : 'item-editor-heading'"
  >
    <h2 v-if="!embedded" id="item-editor-heading">
      {{ kind === "todo" ? "Todo" : "Habit" }}
      bearbeiten
    </h2>

    <div
      v-if="isLoading"
      class="skeleton item-editor__skeleton"
      role="status"
      aria-label="Eintrag wird geladen"
    >
      <span />
      <span />
      <span />
    </div>

    <div v-if="!hasLoaded && !isLoading" class="alert">
      <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
      <div class="item-editor__actions">
        <button class="btn btn--ground" type="button" @click="retryLoad">
          Erneut versuchen
        </button>
        <button class="btn btn--ground" type="button" @click="emit('close')">
          Schließen
        </button>
      </div>
    </div>

    <form v-if="hasLoaded" novalidate @submit.prevent="save">
      <fieldset :disabled="isBusy">
        <label class="field">
          Titel
          <input v-model="title" name="title" maxlength="200" required />
        </label>

        <label class="field">
          Kategorie · optional
          <select v-model="categoryId" name="category">
            <option :value="null">Keine</option>
            <option
              v-for="category in categories"
              :key="category.id"
              :value="category.id"
            >
              {{ category.name }}
            </option>
          </select>
        </label>

        <label class="field">
          Warum · optional
          <textarea v-model="why" name="why" maxlength="1000" rows="2" />
        </label>

        <template v-if="kind === 'todo'">
          <div class="item-editor__row">
            <div class="field">
              <label for="planner-edit-date">Zeitpunkt · optional</label>
              <input
                id="planner-edit-date"
                v-model="scheduledAt"
                name="scheduledAt"
                type="datetime-local"
                aria-describedby="planner-edit-date-hint"
              />
              <small id="planner-edit-date-hint" class="item-editor__hint"
                >Ohne Zeitpunkt liegt es im Todo-Dump.</small
              >
            </div>

            <label class="field">
              Dauer in Minuten · optional
              <input
                v-model="duration"
                name="duration"
                type="number"
                min="1"
                step="1"
              />
            </label>
          </div>

          <label class="item-editor__checkbox">
            <input v-model="isFixed" name="isFixed" type="checkbox" />
            Fester Termin
          </label>

          <TodoGoalFields
            v-model:period-start="periodStart"
            v-model:period-end="periodEnd"
            v-model:habit-id="goalHabitId"
            v-model:target="goalTarget"
          />
        </template>

        <template v-else>
          <div class="item-editor__row">
            <label class="field">
              Uhrzeit · optional
              <input v-model="timeOfDay" name="timeOfDay" type="time" />
            </label>
            <div class="field">
              <label for="habit-edit-duration"
                >Dauer in Minuten · optional</label
              >
              <input
                id="habit-edit-duration"
                v-model="duration"
                name="duration"
                type="number"
                min="1"
                :max="TIMER_MAX_MINUTES"
                step="1"
                aria-describedby="habit-edit-duration-hint"
              />
              <small id="habit-edit-duration-hint" class="item-editor__hint"
                >Gilt für jeden Tag ohne eigene Dauer.</small
              >
            </div>
          </div>

          <label class="item-editor__checkbox">
            <input v-model="isActive" name="isActive" type="checkbox" />
            Aktiv: erscheint an fälligen Tagen in Heute
          </label>

          <div class="item-editor__notice" data-test="schedule-summary">
            <p v-if="loadedHabit?.currentSchedule">
              Jetzt:
              <strong>{{
                describeSchedule(loadedHabit.currentSchedule)
              }}</strong>, seit
              {{
                formatDateForGermanDisplay(
                  loadedHabit.currentSchedule.effectiveFrom,
                )
              }}
            </p>
            <p v-else>Das Habit hat noch keinen aktuell gültigen Zeitplan.</p>
            <template v-if="loadedHabit?.upcomingSchedule">
              <p>
                Geplant ab
                {{
                  formatDateForGermanDisplay(
                    loadedHabit.upcomingSchedule.effectiveFrom,
                  )
                }}:
                <strong>{{
                  describeSchedule(loadedHabit.upcomingSchedule)
                }}</strong>
              </p>
              <button
                class="btn btn--ground"
                type="button"
                data-test="edit-upcoming"
                @click="editUpcomingSchedule"
              >
                Geplanten Zeitplan bearbeiten
              </button>
            </template>
          </div>

          <label class="item-editor__checkbox">
            <input
              v-model="changeSchedule"
              name="changeSchedule"
              type="checkbox"
            />
            Zeitplan ändern
          </label>

          <fieldset
            v-if="changeSchedule"
            class="item-editor__schedule"
            data-test="schedule-fields"
          >
            <legend class="visually-hidden">Neuer Zeitplan</legend>
            <div class="field">
              <label for="planner-edit-effective-from">Gültig ab</label>
              <input
                id="planner-edit-effective-from"
                v-model="effectiveFrom"
                name="effectiveFrom"
                type="date"
                :min="today"
                required
                aria-describedby="planner-edit-effective-hint"
              />
              <small id="planner-edit-effective-hint" class="item-editor__hint"
                >Heute gilt es sofort, ein späterer Tag ab Mitternacht.</small
              >
            </div>

            <label class="field">
              Wie oft?
              <select v-model="schedule.type" name="scheduleType">
                <option value="interval">Alle paar Tage</option>
                <option value="fixed_weekdays">An festen Wochentagen</option>
                <option value="weekly_target">Ein paarmal pro Woche</option>
              </select>
            </label>

            <div v-if="schedule.type === 'interval'" class="field">
              <label for="planner-edit-interval">Alle wie viele Tage?</label>
              <input
                id="planner-edit-interval"
                v-model="schedule.intervalDays"
                name="intervalDays"
                type="number"
                min="1"
                step="1"
                aria-describedby="planner-edit-interval-hint"
              />
              <small id="planner-edit-interval-hint" class="item-editor__hint"
                >1 heißt täglich.</small
              >
            </div>

            <fieldset
              v-else-if="schedule.type === 'fixed_weekdays'"
              class="item-editor__weekdays"
            >
              <legend>An welchen Tagen?</legend>

              <label
                v-for="option in WEEKDAY_OPTIONS"
                :key="option.value"
                class="item-editor__weekday"
              >
                <input
                  v-model="schedule.weekdays"
                  name="weekdays"
                  type="checkbox"
                  :value="option.value"
                />
                {{ option.label }}
              </label>
            </fieldset>

            <div v-else class="field">
              <label for="planner-edit-weekly-target">Wie oft pro Woche?</label>
              <input
                id="planner-edit-weekly-target"
                v-model="schedule.weeklyTarget"
                name="weeklyTarget"
                type="number"
                min="1"
                max="7"
                step="1"
                aria-describedby="planner-edit-weekly-hint"
              />
              <small id="planner-edit-weekly-hint" class="item-editor__hint"
                >Die Woche läuft von Montag bis Sonntag.</small
              >
            </div>

            <label v-if="schedule.type !== 'weekly_target'" class="field">
              Wenn du einen Tag verpasst
              <select v-model="schedule.missedPolicy" name="missedPolicy">
                <option value="carry_over">Später nachholen</option>
                <option value="skip">Verfallen lassen</option>
              </select>
            </label>

            <p class="item-editor__notice">
              Ersetzt einen schon geplanten Zeitplan. Erledigtes bleibt
              erhalten.
            </p>
          </fieldset>
        </template>

        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="item-editor__actions">
          <button class="btn btn--primary" type="submit">
            {{ isSaving ? "Bitte warten …" : "Speichern" }}
          </button>

          <button class="btn" type="button" @click="emit('close')">
            Abbrechen
          </button>
        </div>

        <div class="item-editor__delete">
          <button
            v-if="!confirmDeletion"
            class="btn btn--quiet"
            type="button"
            data-test="request-delete"
            @click="requestDeletion"
          >
            <AppIcon name="trash" />
            {{ kind === "todo" ? "Todo löschen" : "Gesamtes Habit löschen" }}
          </button>

          <template v-else>
            <TodoDeletionSummary
              v-if="deletionPreview"
              :preview="deletionPreview"
            />
            <p>„{{ title }}“ wirklich löschen?</p>

            <p v-if="kind === 'habit'" class="item-editor__hint">
              Es verschwindet aus Heute. Der Verlauf bleibt erhalten.
            </p>

            <div class="item-editor__actions">
              <button
                class="btn btn--danger"
                type="button"
                data-test="confirm-delete"
                @click="remove"
              >
                Ja, löschen
              </button>

              <button
                class="btn"
                type="button"
                @click="
                  confirmDeletion = false;
                  cancelDeletion();
                "
              >
                Nicht löschen
              </button>
            </div>
          </template>
        </div>
      </fieldset>
    </form>
  </section>
</template>

<style scoped>
.item-editor h2 {
  margin: 0 0 var(--space-4);
  font-size: 1.125rem;
  font-weight: 800;
}

.item-editor fieldset {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.item-editor__skeleton > span {
  height: 3rem;
}

.item-editor__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.item-editor__checkbox {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  font-weight: 600;
}

.item-editor__checkbox input {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
}

.item-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.item-editor__hint {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}

/* Info: a calm panel in deep apricot with ink text. */
.item-editor__notice {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground-deep);
  color: var(--color-ink);
}

.item-editor__notice p {
  margin: 0;
}

.item-editor .item-editor__schedule {
  padding-left: var(--space-4);
  border-left: 2px solid var(--color-line);
}

.item-editor .item-editor__weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  border: 0;
}

.item-editor__weekdays legend {
  margin-bottom: var(--space-2);
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.item-editor__weekday {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-4) 0 var(--space-3);
  border: 1.5px solid var(--color-line);
  border-radius: var(--radius-pill);
  color: var(--color-ink-muted);
  font-weight: 700;
  cursor: pointer;
}

.item-editor__weekday:has(input:checked) {
  border-color: var(--color-ink);
  color: var(--color-ink);
}

.item-editor__weekday input {
  width: 1.125rem;
  height: 1.125rem;
}

.item-editor__delete {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.item-editor__delete p {
  margin: 0;
}

/* ModalDialog tints every button; destructive ones keep the danger tint. */
.item-editor button.btn--danger:not(:disabled) {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

/* On the deep panel and the alert, side actions sit on white. */
.item-editor button.btn--ground:not(:disabled) {
  background: var(--color-surface);
}

@media (max-width: 32rem) {
  .item-editor__row {
    grid-template-columns: 1fr;
  }
}
</style>
