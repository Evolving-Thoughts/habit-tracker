<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  changeHabitSchedule,
  deleteHabit,
  deleteTodo,
  getHabit,
  getTodo,
  updateHabit,
  updateTodo,
} from "../api/day-planner.api";
import type { HabitScheduleType } from "../types/day-planner";
import type {
  MissedOccurrencePolicy,
  ChangeHabitScheduleInput,
  HabitResponse,
  HabitScheduleRule,
  ScheduleVersionResponse,
  UpdateHabitInput,
  Weekday,
} from "../types/habit";
import { formatHabitSchedule } from "../utils/habit";
import type { CreateTodoInput } from "../types/todo";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  isValidIsoDate,
} from "../utils/date";

const props = defineProps<{
  kind: "todo" | "habit";
  entityId: number;
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

const title = ref("");

// Todo-Felder
const scheduledAt = ref("");
const duration = ref<string | number>("");
const isFixed = ref(false);

const originalScheduledAt = ref<string | null>(null);
const originalLocalInput = ref("");

// Habit-Felder
const isActive = ref(true);
const loadedHabit = ref<HabitResponse | null>(null);
const changeSchedule = ref(false);
const effectiveFrom = ref(getCurrentDateInTimeZone());
const today = computed(() => getCurrentDateInTimeZone());
const missedPolicy = ref<MissedOccurrencePolicy>("carry_over");

const scheduleType = ref<HabitScheduleType>("interval");

const intervalDays = ref<string | number>(2);
const weeklyTarget = ref<string | number>(3);
const selectedWeekdays = ref<Weekday[]>([]);

const weekdayOptions: {
  value: Weekday;
  label: string;
}[] = [
  { value: "monday", label: "Montag" },
  { value: "tuesday", label: "Dienstag" },
  { value: "wednesday", label: "Mittwoch" },
  { value: "thursday", label: "Donnerstag" },
  { value: "friday", label: "Freitag" },
  { value: "saturday", label: "Samstag" },
  { value: "sunday", label: "Sonntag" },
];

const scheduleLabels: Record<HabitScheduleType, string> = {
  interval: "Intervall",
  fixed_weekdays: "Feste Wochentage",
  weekly_target: "Häufigkeit pro Woche",
};

const scheduleLabel = computed(() => {
  return scheduleLabels[scheduleType.value];
});

const isBusy = computed(() => {
  return isLoading.value || isSaving.value;
});

function toLocalInput(isoDateTime: string): string {
  const date = new Date(isoDateTime);

  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

async function loadEntity(): Promise<void> {
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      const todo = await getTodo(props.entityId);

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

      title.value = habit.title;
      isActive.value = habit.isActive;
      loadedHabit.value = habit;
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

function positiveInteger(
  value: string | number,
  message: string,
  maximum?: number,
): number {
  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    (maximum !== undefined && number > maximum)
  ) {
    throw new Error(message);
  }

  return number;
}

function buildTodoInput(): CreateTodoInput {
  let isoDate: string | null = null;

  if (scheduledAt.value === originalLocalInput.value) {
    isoDate = originalScheduledAt.value;
  } else if (scheduledAt.value) {
    const date = new Date(scheduledAt.value);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Ungültiger Zeitpunkt.");
    }

    isoDate = date.toISOString();
  }

  if (isFixed.value && isoDate === null) {
    throw new Error("Ein fester Termin benötigt einen Zeitpunkt.");
  }

  let minutes: number | null = null;

  const empty =
    typeof duration.value === "string" && duration.value.trim() === "";

  if (!empty) {
    minutes = positiveInteger(
      duration.value,
      "Die Dauer muss eine ganze Zahl ab 1 Minute sein.",
    );
  }

  return {
    title: validatedTitle(),
    scheduledAt: isoDate,
    plannedDurationMinutes: minutes,
    isFixed: isFixed.value,
  };
}

function fillSchedule(rule: HabitScheduleRule): void {
  scheduleType.value = rule.type;
  missedPolicy.value =
    rule.type === "weekly_target" ? "skip" : rule.missedOccurrencePolicy;
  intervalDays.value = rule.type === "interval" ? rule.intervalDays : 2;
  weeklyTarget.value = rule.type === "weekly_target" ? rule.weeklyTarget : 3;
  selectedWeekdays.value =
    rule.type === "fixed_weekdays" ? [...rule.weekdays] : [];
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
  const input: UpdateHabitInput = {};
  const value = validatedTitle();
  if (value !== loadedHabit.value?.title) input.title = value;
  if (isActive.value !== loadedHabit.value?.isActive)
    input.isActive = isActive.value;
  return input;
}

function buildScheduleChange(): ChangeHabitScheduleInput {
  if (
    !isValidIsoDate(effectiveFrom.value) ||
    effectiveFrom.value < getCurrentDateInTimeZone()
  ) {
    throw new Error("Bitte wähle heute oder ein zukünftiges gültiges Datum.");
  }
  let schedule: HabitScheduleRule;
  switch (scheduleType.value) {
    case "interval":
      schedule = {
        type: "interval",
        intervalDays: positiveInteger(
          intervalDays.value,
          "Das Intervall muss eine ganze Zahl ab 1 Tag sein.",
        ),
        missedOccurrencePolicy: missedPolicy.value,
      };
      break;
    case "fixed_weekdays":
      if (!selectedWeekdays.value.length)
        throw new Error("Bitte wähle mindestens einen Wochentag.");
      schedule = {
        type: "fixed_weekdays",
        weekdays: weekdayOptions
          .filter((option) => selectedWeekdays.value.includes(option.value))
          .map((option) => option.value),
        missedOccurrencePolicy: missedPolicy.value,
      };
      break;
    case "weekly_target":
      schedule = {
        type: "weekly_target",
        weeklyTarget: positiveInteger(
          weeklyTarget.value,
          "Das Wochenziel muss zwischen 1 und 7 liegen.",
          7,
        ),
      };
      break;
  }
  return { effectiveFrom: effectiveFrom.value, schedule };
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
      await updateTodo(props.entityId, buildTodoInput());
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
      await deleteTodo(props.entityId);
    } else {
      await deleteHabit(props.entityId);
    }

    emit("changed");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Löschen fehlgeschlagen.";
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

onMounted(loadEntity);
</script>

<template>
  <section class="item-editor" aria-labelledby="item-editor-heading">
    <h2 id="item-editor-heading">
      {{ kind === "todo" ? "Todo" : "Habit" }}
      bearbeiten
    </h2>

    <p v-if="isLoading">Eintrag wird geladen …</p>

    <p v-if="errorMessage" role="alert">
      {{ errorMessage }}
    </p>

    <form v-if="hasLoaded" novalidate @submit.prevent="save">
      <fieldset :disabled="isBusy">
        <label for="planner-edit-title">Titel</label>
        <input
          id="planner-edit-title"
          v-model="title"
          name="title"
          maxlength="200"
          required
        />

        <template v-if="kind === 'todo'">
          <label for="planner-edit-date"> Zeitpunkt · optional </label>
          <input
            id="planner-edit-date"
            v-model="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
          />

          <small>
            Lokale Zeitzone deines Geräts. Ohne Zeitpunkt landet das Todo im
            Dump.
          </small>

          <label for="planner-edit-duration">
            Dauer in Minuten · optional
          </label>
          <input
            id="planner-edit-duration"
            v-model="duration"
            name="duration"
            type="number"
            min="1"
            step="1"
          />

          <label class="item-editor__checkbox">
            <input v-model="isFixed" name="isFixed" type="checkbox" />
            Fester Termin
          </label>
        </template>

        <template v-else>
          <label class="item-editor__checkbox">
            <input v-model="isActive" name="isActive" type="checkbox" />
            Habit aktiv
          </label>

          <div class="item-editor__notice" data-test="schedule-summary">
            <p v-if="loadedHabit?.currentSchedule">
              Aktueller Zeitplan:
              <strong>{{
                describeSchedule(loadedHabit.currentSchedule)
              }}</strong>
              · seit
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
          <small
            >Nur Titel und Aktivität zu ändern lässt aktuelle und geplante
            Zeitpläne unverändert.</small
          >

          <fieldset v-if="changeSchedule" data-test="schedule-fields">
            <legend>Neuer Zeitplan</legend>
            <label for="planner-edit-effective-from">Gültig ab</label>
            <input
              id="planner-edit-effective-from"
              v-model="effectiveFrom"
              name="effectiveFrom"
              type="date"
              :min="today"
              required
            />
            <small
              >Standard: heute (Europe/Berlin). Heute wirkt die Änderung ab dem
              Speichern; ein zukünftiger Tag ab 00:00 Uhr.
              <template v-if="isValidIsoDate(effectiveFrom)"
                >Gewählt:
                {{ formatDateForGermanDisplay(effectiveFrom) }}.</template
              >
            </small>

            <p class="item-editor__schedule-label">
              Habit-Art: <strong>{{ scheduleLabel }}</strong>
            </p>

            <label for="planner-edit-schedule-type">
              Habit-Art auswählen
            </label>
            <select
              id="planner-edit-schedule-type"
              v-model="scheduleType"
              name="scheduleType"
            >
              <option value="interval">Intervall</option>
              <option value="fixed_weekdays">Feste Wochentage</option>
              <option value="weekly_target">Häufigkeit pro Woche</option>
            </select>

            <template v-if="scheduleType === 'interval'">
              <label for="planner-edit-interval"> Alle wie viele Tage? </label>
              <input
                id="planner-edit-interval"
                v-model="intervalDays"
                name="intervalDays"
                type="number"
                min="1"
                step="1"
              />

              <small> 1 = täglich, 2 = alle zwei Tage. </small>
            </template>

            <fieldset
              v-else-if="scheduleType === 'fixed_weekdays'"
              class="item-editor__weekdays"
            >
              <legend>Ausführungstage</legend>

              <label
                v-for="option in weekdayOptions"
                :key="option.value"
                class="item-editor__weekday"
              >
                <input
                  v-model="selectedWeekdays"
                  name="weekdays"
                  type="checkbox"
                  :value="option.value"
                />
                {{ option.label }}
              </label>
            </fieldset>

            <template v-else>
              <label for="planner-edit-weekly-target">
                Wie oft pro Woche?
              </label>
              <input
                id="planner-edit-weekly-target"
                v-model="weeklyTarget"
                name="weeklyTarget"
                type="number"
                min="1"
                max="7"
                step="1"
              />

              <small>
                Ohne festgelegte Wochentage. Die Woche beginnt am Montag.
              </small>
            </template>

            <template v-if="scheduleType !== 'weekly_target'">
              <label for="planner-edit-policy">
                Verhalten bei verpassten Terminen
              </label>
              <select
                id="planner-edit-policy"
                v-model="missedPolicy"
                name="missedPolicy"
              >
                <option value="carry_over">Übertragen</option>
                <option value="skip">Verfallen lassen</option>
              </select>
            </template>
            <small v-else
              >Wochenziele zählen Erledigungen von Montag bis Sonntag. Eine
              verpasste tägliche Chance wird nicht übertragen.</small
            >
            <p class="item-editor__notice">
              Die Änderung ersetzt einen eventuell bereits geplanten zukünftigen
              Zeitplan. Historische Erledigungen und übersprungene Ausführungen
              bleiben erhalten. Noch offene Ausführungen des abgelösten
              Zeitplans werden vom Backend abgeglichen.
            </p>
          </fieldset>
        </template>

        <div class="item-editor__actions">
          <button type="submit">
            {{ isSaving ? "Bitte warten …" : "Speichern" }}
          </button>

          <button type="button" @click="emit('close')">Abbrechen</button>
        </div>

        <div class="item-editor__delete">
          <button
            v-if="!confirmDeletion"
            type="button"
            data-test="request-delete"
            @click="confirmDeletion = true"
          >
            {{ kind === "todo" ? "Todo löschen" : "Gesamtes Habit löschen" }}
          </button>

          <template v-else>
            <p>„{{ title }}“ wirklich löschen?</p>

            <p v-if="kind === 'habit'">
              Das Habit verschwindet aus dem Tagesplan. Seine bisherigen
              Ausführungen bleiben für die Historie gespeichert.
            </p>

            <div class="item-editor__actions">
              <button type="button" data-test="confirm-delete" @click="remove">
                Ja, löschen
              </button>

              <button type="button" @click="confirmDeletion = false">
                Nicht löschen
              </button>
            </div>
          </template>
        </div>
      </fieldset>
    </form>

    <button
      v-if="!hasLoaded && !isLoading"
      type="button"
      @click="emit('close')"
    >
      Schließen
    </button>
  </section>
</template>

<style scoped>
.item-editor {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.875rem;
  background: #ffffff;
}

.item-editor h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}

.item-editor fieldset {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}

.item-editor input:not([type="checkbox"]),
.item-editor select {
  width: 100%;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid #bfc7d4;
  border-radius: 0.5rem;
  font: inherit;
}

.item-editor__checkbox,
.item-editor__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.item-editor button {
  padding: 0.65rem 0.9rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.5rem;
  background: #ffffff;
  cursor: pointer;
}

.item-editor button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.item-editor small {
  font-size: 0.875rem;
  color: #697386;
  line-height: 1.5;
}

.item-editor__schedule-label {
  margin: 0.5rem 0 0;
}

.item-editor .item-editor__weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.item-editor__weekdays legend {
  margin-bottom: 0.5rem;
}

.item-editor__weekday {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d9dde5;
  border-radius: 0.5rem;
}

.item-editor__notice {
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: #f2f4f8;
  color: #59657a;
  font-size: 0.875rem;
  line-height: 1.5;
}

.item-editor [role="alert"],
.item-editor__delete button {
  color: #b42318;
}

.item-editor__delete {
  margin-top: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
</style>
