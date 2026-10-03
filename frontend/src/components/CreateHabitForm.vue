<script setup lang="ts">
import { ref } from "vue";
import { createHabit } from "../api/day-planner.api";
import type {
  CreateHabitInput,
  HabitScheduleRule,
  MissedOccurrencePolicy,
  Weekday,
} from "../types/habit";
import type { HabitScheduleType } from "../types/day-planner";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  isValidIsoDate,
} from "../utils/date";

defineProps<{ embedded?: boolean }>();
const emit = defineEmits<{ created: []; busy: [value: boolean] }>();
const title = ref("");
const startDate = ref("");
const scheduleType = ref<HabitScheduleType>("interval");
const intervalDays = ref<string | number>(1);
const weeklyTarget = ref<string | number>(3);
const weekdays = ref<Weekday[]>([]);
const missedPolicy = ref<MissedOccurrencePolicy>("carry_over");
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const today = getCurrentDateInTimeZone();
const weekdayOptions: { value: Weekday; label: string }[] = [
  { value: "monday", label: "Montag" },
  { value: "tuesday", label: "Dienstag" },
  { value: "wednesday", label: "Mittwoch" },
  { value: "thursday", label: "Donnerstag" },
  { value: "friday", label: "Freitag" },
  { value: "saturday", label: "Samstag" },
  { value: "sunday", label: "Sonntag" },
];
function integer(
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
function buildInput(): CreateHabitInput {
  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) throw new Error("Bitte gib einen Titel ein.");
  if (trimmedTitle.length > 200)
    throw new Error("Der Titel darf höchstens 200 Zeichen enthalten.");
  if (startDate.value && !isValidIsoDate(startDate.value))
    throw new Error("Bitte gib ein gültiges Startdatum ein.");
  let schedule: HabitScheduleRule;
  switch (scheduleType.value) {
    case "interval":
      schedule = {
        type: "interval",
        intervalDays: integer(
          intervalDays.value,
          "Das Intervall muss eine ganze Zahl ab 1 Tag sein.",
        ),
        missedOccurrencePolicy: missedPolicy.value,
      };
      break;
    case "fixed_weekdays":
      if (!weekdays.value.length)
        throw new Error("Bitte wähle mindestens einen Wochentag.");
      schedule = {
        type: "fixed_weekdays",
        weekdays: weekdayOptions
          .filter((option) => weekdays.value.includes(option.value))
          .map((option) => option.value),
        missedOccurrencePolicy: missedPolicy.value,
      };
      break;
    case "weekly_target":
      schedule = {
        type: "weekly_target",
        weeklyTarget: integer(
          weeklyTarget.value,
          "Das Wochenziel muss zwischen 1 und 7 liegen.",
          7,
        ),
      };
      break;
  }
  return {
    title: trimmedTitle,
    ...(startDate.value ? { startDate: startDate.value } : {}),
    schedule,
  };
}
async function submit(): Promise<void> {
  if (isSubmitting.value) return;
  errorMessage.value = null;
  try {
    const input = buildInput();
    isSubmitting.value = true;
    emit("busy", true);
    await createHabit(input);
    title.value = "";
    startDate.value = "";
    emit("created");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Das Habit konnte nicht erstellt werden.";
  } finally {
    isSubmitting.value = false;
    emit("busy", false);
  }
}
</script>

<template>
  <section
    class="create-habit"
    :class="{ 'create-habit--embedded': embedded }"
    :aria-labelledby="embedded ? undefined : 'create-habit-heading'"
  >
    <h2 v-if="!embedded" id="create-habit-heading">Neues Habit</h2>
    <form novalidate @submit.prevent="submit">
      <fieldset :disabled="isSubmitting">
        <div class="create-habit__field">
          <label for="habit-title">Titel</label>
          <input
            id="habit-title"
            v-model="title"
            name="title"
            type="text"
            maxlength="200"
            required
            placeholder="Welche Gewohnheit möchtest du aufbauen?"
          />
        </div>
        <div class="create-habit__field">
          <label for="habit-start-date">Startdatum · optional</label>
          <input
            id="habit-start-date"
            v-model="startDate"
            name="startDate"
            type="date"
          />
          <small
            >Ohne Datum: heute in Europe/Berlin ({{
              formatDateForGermanDisplay(today)
            }}).
            <template v-if="isValidIsoDate(startDate)"
              >Gewählt: {{ formatDateForGermanDisplay(startDate) }}.</template
            >
          </small>
        </div>
        <div class="create-habit__field">
          <label for="habit-schedule-type">Habit-Art</label>
          <select
            id="habit-schedule-type"
            v-model="scheduleType"
            name="scheduleType"
          >
            <option value="interval">Intervall</option>
            <option value="fixed_weekdays">Feste Wochentage</option>
            <option value="weekly_target">Häufigkeit pro Woche</option>
          </select>
        </div>
        <div v-if="scheduleType === 'interval'" class="create-habit__field">
          <label for="habit-interval-days">Alle wie viele Tage?</label>
          <input
            id="habit-interval-days"
            v-model="intervalDays"
            name="intervalDays"
            type="number"
            min="1"
            step="1"
          />
          <small>1 = täglich, 2 = alle zwei Tage.</small>
        </div>
        <fieldset
          v-else-if="scheduleType === 'fixed_weekdays'"
          class="create-habit__weekdays"
        >
          <legend>Ausführungstage</legend>
          <label v-for="option in weekdayOptions" :key="option.value">
            <input
              v-model="weekdays"
              type="checkbox"
              name="weekdays"
              :value="option.value"
            />
            {{ option.label }}
          </label>
        </fieldset>
        <div v-else class="create-habit__field">
          <label for="habit-weekly-target">Wie oft pro Woche?</label>
          <input
            id="habit-weekly-target"
            v-model="weeklyTarget"
            name="weeklyTarget"
            type="number"
            min="1"
            max="7"
            step="1"
          />
          <small>Ohne feste Wochentage. Die Woche beginnt am Montag.</small>
        </div>
        <div
          v-if="scheduleType !== 'weekly_target'"
          class="create-habit__field"
        >
          <label for="habit-missed-policy"
            >Verhalten bei verpassten Terminen</label
          >
          <select
            id="habit-missed-policy"
            v-model="missedPolicy"
            name="missedPolicy"
          >
            <option value="carry_over">Übertragen</option>
            <option value="skip">Verfallen lassen</option>
          </select>
        </div>
        <p class="create-habit__hint">
          Das Habit erscheint ab seinem Startdatum an fälligen Tagen in „Heute“.
          Seinen Zeitplan kannst du später bearbeiten.
        </p>
        <button type="submit">
          {{ isSubmitting ? "Wird erstellt …" : "Habit erstellen" }}
        </button>
      </fieldset>
    </form>
    <p v-if="errorMessage" class="create-habit__error" role="alert">
      {{ errorMessage }}
    </p>
  </section>
</template>

<style scoped>
.create-habit {
  padding: 1rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #fff;
}
.create-habit.create-habit--embedded {
  padding: 0;
  border: 0;
}
.create-habit h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}
.create-habit fieldset {
  display: grid;
  gap: 1rem;
  margin: 0;
  padding: 0;
  min-width: 0;
  border: 0;
}
.create-habit__field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
}
.create-habit__field > label {
  color: #39445a;
  font-size: 0.875rem;
  font-weight: 600;
}
.create-habit input:not([type="checkbox"]),
.create-habit select {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
  padding: 0.7rem;
  border: 1px solid #bfc7d4;
  border-radius: 0.5rem;
  background: #fff;
  color: #182033;
  font: inherit;
}
.create-habit small,
.create-habit__hint {
  color: #59657a;
  font-size: 0.875rem;
  line-height: 1.5;
}
.create-habit__hint {
  margin: 0;
}
.create-habit .create-habit__weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.create-habit__weekdays legend {
  margin-bottom: 0.5rem;
}
.create-habit__weekdays label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.75rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid #d9dde5;
  border-radius: 0.5rem;
}
.create-habit button {
  min-height: 2.75rem;
  justify-self: start;
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 0.5rem;
  background: #2457c5;
  color: #fff;
  font: inherit;
  cursor: pointer;
}
.create-habit fieldset:disabled {
  opacity: 0.65;
}
.create-habit fieldset:disabled button {
  cursor: wait;
}
.create-habit__error {
  margin: 1rem 0 0;
  color: #b42318;
  font-size: 0.875rem;
  line-height: 1.5;
}
.create-habit select:focus-visible {
  outline: 3px solid rgb(53 103 220 / 30%);
  outline-offset: 2px;
}
</style>
