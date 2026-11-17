<script setup lang="ts">
import { WEEKDAY_OPTIONS } from "../utils/habit";
import {
  TIMER_DURATION_MESSAGE,
  TIMER_MAX_MINUTES,
} from "../utils/timer-duration";
import { ref } from "vue";
import { createHabit } from "../api/day-planner.api";
import CategorySelect, { type CategoryChoice } from "./CategorySelect.vue";
import type { CreateHabitInput } from "../types/habit";
import {
  emptyScheduleDraft,
  positiveInteger,
  scheduleRuleOf,
} from "../utils/habit-schedule";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  isValidIsoDate,
} from "../utils/date";

defineProps<{ embedded?: boolean }>();
const emit = defineEmits<{ created: []; busy: [value: boolean] }>();
const title = ref("");
const startDate = ref("");
const duration = ref<string | number>("");
const timeOfDay = ref("");
const category = ref<CategoryChoice>("default");
const why = ref("");
const schedule = ref(emptyScheduleDraft());
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const today = getCurrentDateInTimeZone();
function buildInput(): CreateHabitInput {
  const trimmedTitle = title.value.trim();
  if (!trimmedTitle) throw new Error("Bitte gib einen Titel ein.");
  if (trimmedTitle.length > 200)
    throw new Error("Der Titel darf höchstens 200 Zeichen enthalten.");
  if (startDate.value && !isValidIsoDate(startDate.value))
    throw new Error("Bitte gib ein gültiges Startdatum ein.");
  return {
    title: trimmedTitle,
    ...(String(duration.value).trim()
      ? {
          plannedDurationMinutes: positiveInteger(
            duration.value,
            TIMER_DURATION_MESSAGE,
            TIMER_MAX_MINUTES,
          ),
        }
      : {}),
    ...(timeOfDay.value ? { timeOfDay: timeOfDay.value } : {}),
    ...(startDate.value ? { startDate: startDate.value } : {}),
    ...(category.value !== "default" ? { categoryId: category.value } : {}),
    ...(why.value.trim() ? { why: why.value.trim() } : {}),
    schedule: scheduleRuleOf(schedule.value),
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
    duration.value = "";
    timeOfDay.value = "";
    category.value = "default";
    why.value = "";
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
    :class="{ card: !embedded }"
    :aria-labelledby="embedded ? undefined : 'create-habit-heading'"
  >
    <h2 v-if="!embedded" id="create-habit-heading">Neues Habit</h2>
    <form novalidate @submit.prevent="submit">
      <fieldset :disabled="isSubmitting">
        <label class="field">
          Titel
          <input
            v-model="title"
            name="title"
            type="text"
            maxlength="200"
            required
            placeholder="Welche Gewohnheit möchtest du aufbauen?"
          />
        </label>
        <label class="field">
          Kategorie · optional
          <CategorySelect id="habit-category" v-model="category" />
        </label>
        <label class="field">
          Warum · optional
          <textarea v-model="why" name="why" maxlength="1000" rows="2" />
        </label>
        <div class="create-habit__row">
          <div class="field">
            <label for="habit-start-date">Startdatum · optional</label>
            <input
              id="habit-start-date"
              v-model="startDate"
              name="startDate"
              type="date"
              aria-describedby="habit-start-hint"
            />
            <small id="habit-start-hint" class="create-habit__hint"
              >Ohne Datum ab heute,
              {{ formatDateForGermanDisplay(today) }}.</small
            >
          </div>
          <label class="field">
            Uhrzeit · optional
            <input v-model="timeOfDay" name="timeOfDay" type="time" />
          </label>
        </div>
        <div class="field">
          <label for="habit-duration">Dauer in Minuten · optional</label>
          <input
            id="habit-duration"
            v-model="duration"
            name="duration"
            type="number"
            min="1"
            :max="TIMER_MAX_MINUTES"
            step="1"
            aria-describedby="habit-duration-hint"
          />
          <small id="habit-duration-hint" class="create-habit__hint"
            >Mit einer Dauer kannst du den Timer starten.</small
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
          <label for="habit-interval-days">Alle wie viele Tage?</label>
          <input
            id="habit-interval-days"
            v-model="schedule.intervalDays"
            name="intervalDays"
            type="number"
            min="1"
            step="1"
            aria-describedby="habit-interval-hint"
          />
          <small id="habit-interval-hint" class="create-habit__hint"
            >1 heißt täglich.</small
          >
        </div>
        <fieldset
          v-else-if="schedule.type === 'fixed_weekdays'"
          class="create-habit__weekdays"
        >
          <legend>An welchen Tagen?</legend>
          <label
            v-for="option in WEEKDAY_OPTIONS"
            :key="option.value"
            class="create-habit__weekday"
          >
            <input
              v-model="schedule.weekdays"
              type="checkbox"
              name="weekdays"
              :value="option.value"
            />
            {{ option.label }}
          </label>
        </fieldset>
        <div v-else class="field">
          <label for="habit-weekly-target">Wie oft pro Woche?</label>
          <input
            id="habit-weekly-target"
            v-model="schedule.weeklyTarget"
            name="weeklyTarget"
            type="number"
            min="1"
            max="7"
            step="1"
            aria-describedby="habit-weekly-hint"
          />
          <small id="habit-weekly-hint" class="create-habit__hint"
            >Die Woche beginnt am Montag.</small
          >
        </div>
        <label v-if="schedule.type !== 'weekly_target'" class="field">
          Wenn du einen Tag verpasst
          <select v-model="schedule.missedPolicy" name="missedPolicy">
            <option value="carry_over">Später nachholen</option>
            <option value="skip">Verfallen lassen</option>
          </select>
        </label>
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>
        <button class="btn btn--primary create-habit__submit" type="submit">
          {{ isSubmitting ? "Wird erstellt …" : "Habit erstellen" }}
        </button>
      </fieldset>
    </form>
  </section>
</template>

<style scoped>
.create-habit h2 {
  margin: 0 0 var(--space-4);
  font-size: 1.125rem;
  font-weight: 800;
}
.create-habit fieldset {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.create-habit__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}
.create-habit__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}
.create-habit .create-habit__weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.create-habit__weekdays legend {
  margin-bottom: var(--space-2);
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
.create-habit__weekday {
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
.create-habit__weekday:has(input:checked) {
  border-color: var(--color-ink);
  color: var(--color-ink);
}
.create-habit__weekday input {
  width: 1.125rem;
  height: 1.125rem;
}
.create-habit__submit {
  justify-self: start;
}
@media (max-width: 32rem) {
  .create-habit__row {
    grid-template-columns: 1fr;
  }
}
</style>
