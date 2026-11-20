<script setup lang="ts">
import { WEEKDAY_OPTIONS } from "../utils/habit";
import {
  TIMER_DURATION_MESSAGE,
  TIMER_MAX_MINUTES,
} from "../utils/timer-duration";
import { ref } from "vue";
import { createHabit } from "../api/day-planner.api";
import { useTodoDeletion } from "../composables/useTodoDeletion";
import CategoryPicker from "./CategoryPicker.vue";
import ParentPicker from "./ParentPicker.vue";
import type { CreateHabitInput } from "../types/habit";
import type { InheritedWhy } from "../types/todo";
import WhyField from "./WhyField.vue";
import { categoryOfChoice, type ParentChoice } from "../utils/parent-choice";
import { whyBelow } from "../utils/why";
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

/** What a daily made from a quest starts with. */
export type HabitDraft = {
  title: string;
  why: string;
  categoryId: number | null;
  campaignId: number | null;
};

/**
 * "Neues Daily": Titel, then the rhythm with its details right below,
 * Kategorie and Kampagne, Warum, and the optional start, time and duration.
 * Given `replaces`, the daily takes the place of that quest: once it is
 * created, the quest is deleted (with its subtree preview, like any delete).
 */
const props = defineProps<{
  embedded?: boolean;
  initial?: HabitDraft;
  replaces?: { id: number; title: string };
}>();
const emit = defineEmits<{
  created: [];
  busy: [value: boolean];
  cancel: [];
}>();
const title = ref(props.initial?.title ?? "");
const startDate = ref("");
const duration = ref<string | number>("");
const timeOfDay = ref("");
const categoryId = ref<number | null>(props.initial?.categoryId ?? null);
const campaignId = ref<number | null>(props.initial?.campaignId ?? null);
/** What the daily inherits from its campaign while it has no own reason. */
const campaignWhy = ref<InheritedWhy | null>(null);
const why = ref(props.initial?.why ?? "");
const schedule = ref(emptyScheduleDraft());
const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
/** The daily exists; only the quest it replaces still has to go. */
const habitCreated = ref(false);
const today = getCurrentDateInTimeZone();
const { preview, prepare, confirm, cancel } = useTodoDeletion();

function readCampaign(choice: ParentChoice | null): void {
  campaignWhy.value = choice ? whyBelow(choice.todo) : null;
}
function chooseCampaign(choice: ParentChoice | null): void {
  readCampaign(choice);
  // The campaign's category, unless one is chosen already.
  if (choice && categoryId.value === null)
    categoryId.value = categoryOfChoice(choice);
}
function presetCampaign(choices: ParentChoice[]): void {
  readCampaign(
    choices.find((choice) => choice.todo.id === campaignId.value) ?? null,
  );
}

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
    ...(categoryId.value !== null ? { categoryId: categoryId.value } : {}),
    ...(campaignId.value !== null ? { campaignId: campaignId.value } : {}),
    ...(why.value.trim() ? { why: why.value.trim() } : {}),
    schedule: scheduleRuleOf(schedule.value),
  };
}
function reset(): void {
  title.value = "";
  startDate.value = "";
  duration.value = "";
  timeOfDay.value = "";
  categoryId.value = null;
  campaignId.value = null;
  campaignWhy.value = null;
  why.value = "";
}
async function removeReplaced(): Promise<void> {
  if (!props.replaces) return;
  try {
    await prepare(props.replaces.id);
    // Only the quest itself: one that got quests below meanwhile stays.
    if (preview.value?.todos.length !== 1) {
      cancel();
      throw new Error("Die Quest hat inzwischen Unter-Quests");
    }
    await confirm();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unbekannter Fehler";
    throw new Error(
      `Das Daily ist angelegt, die Quest „${props.replaces.title}“ aber noch nicht gelöscht: ${detail}. Speichere erneut, um sie zu löschen.`,
    );
  }
}
async function submit(): Promise<void> {
  if (isSubmitting.value) return;
  errorMessage.value = null;
  try {
    const input = habitCreated.value ? null : buildInput();
    isSubmitting.value = true;
    emit("busy", true);
    if (input) {
      await createHabit(input);
      habitCreated.value = true;
    }
    await removeReplaced();
    if (!props.replaces) {
      reset();
      habitCreated.value = false;
    }
    emit("created");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Das Daily konnte nicht erstellt werden.";
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
    <h2 v-if="!embedded" id="create-habit-heading">Neues Daily</h2>
    <form novalidate @submit.prevent="submit">
      <fieldset :disabled="isSubmitting || habitCreated">
        <p v-if="replaces" class="create-habit__notice">
          Beim Speichern entsteht dieses Daily, und die Quest „{{
            replaces.title
          }}“ wird gelöscht. Was schon im Logbuch steht, bleibt erhalten.
        </p>
        <label class="field">
          Titel
          <input
            v-model="title"
            name="title"
            type="text"
            maxlength="200"
            required
            placeholder="Welches Daily möchtest du aufbauen?"
          />
        </label>

        <!-- The rhythm first, its details right below it. -->
        <label class="field">
          Rhythmus
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

        <div class="create-habit__row">
          <div class="field">
            <label for="habit-category">Kategorie · optional</label>
            <CategoryPicker id="habit-category" v-model="categoryId" />
          </div>
          <div class="field">
            <label for="habit-campaign">Kampagne · optional</label>
            <ParentPicker
              id="habit-campaign"
              v-model="campaignId"
              campaigns-only
              @chosen="chooseCampaign"
              @ready="presetCampaign"
            />
          </div>
        </div>

        <WhyField id="habit-why" v-model="why" :inherited="campaignWhy" />

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
            >Die Dauer ist das Soll der Stoppuhr; sie läuft darüber
            hinaus.</small
          >
        </div>
      </fieldset>

      <!-- In a dialog it sticks to the bottom edge, like the editor's actions. -->
      <div
        class="create-habit__footer"
        :class="{ 'sticky-actions': embedded }"
        data-test="editor-actions"
      >
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>
        <div class="create-habit__actions">
          <button
            class="btn btn--primary"
            type="submit"
            :disabled="isSubmitting"
          >
            {{
              isSubmitting
                ? "Wird erstellt …"
                : replaces
                  ? "Als Daily speichern"
                  : "Daily erstellen"
            }}
          </button>
          <button
            v-if="embedded"
            class="btn"
            type="button"
            :disabled="isSubmitting"
            @click="emit('cancel')"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </form>
  </section>
</template>

<style scoped>
.create-habit h2 {
  margin: 0 0 var(--space-4);
  font-size: 1.125rem;
  font-weight: 800;
}
.create-habit form,
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
/* Info: a calm panel in deep apricot with ink text. */
.create-habit__notice {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground-deep);
  color: var(--color-ink);
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
.create-habit__footer {
  display: grid;
  gap: var(--space-3);
}
.create-habit__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
@media (max-width: 32rem) {
  .create-habit__row {
    grid-template-columns: 1fr;
  }
}
</style>
