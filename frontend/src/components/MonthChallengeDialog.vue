<script setup lang="ts">
import { computed, ref, useId } from "vue";
import { createMonthChallenge } from "../api/month-challenges.api";
import CreateHabitForm from "./CreateHabitForm.vue";
import ModalDialog from "./ModalDialog.vue";
import type { HabitResponse } from "../types/habit";
import { shortDate } from "../utils/history";
import {
  daysLeftInMonth,
  monthKeyOf,
  monthName,
} from "../utils/month-challenge";

/**
 * "Monats-Challenge starten": the month (this one, or the next to prepare
 * it), the daily reminder (19:00 unless changed) and the Daily, an existing
 * one or a new one from the same form as "Neues Daily". Nothing is saved
 * before the last button; a new Daily is created first, then the challenge
 * starts on it.
 */
const props = defineProps<{
  /** The active Dailies to choose from. */
  habits: HabitResponse[];
  /** The months still free, "YYYY-MM", the current one first. */
  months: string[];
  initialMonth: string;
  today: string;
  returnFocus: () => HTMLElement | null;
}>();
const emit = defineEmits<{ close: []; created: [title: string] }>();

const id = useId();
const month = ref(props.initialMonth);
/** A Daily created here whose challenge did not start: it stays choosable. */
const created = ref<HabitResponse[]>([]);
const choices = computed(() => [...props.habits, ...created.value]);
const mode = ref<"existing" | "new">(choices.value.length ? "existing" : "new");
const habitId = ref<number | null>(choices.value[0]?.id ?? null);
const reminderOn = ref(true);
const reminderTime = ref("19:00");
const busy = ref(false);
const formBusy = ref(false);
const errorMessage = ref<string | null>(null);
/** The Daily the form just created, until its challenge has started. */
let fresh: HabitResponse | null = null;

/* Started in the running month, only the days from today count. */
const startNote = computed(() => {
  if (month.value !== monthKeyOf(props.today))
    return `Gezählt wird der ganze ${monthName(month.value)}.`;
  const left = daysLeftInMonth(props.today);
  return `Gezählt wird ab heute, ${shortDate(props.today)}: ${left === 1 ? "1 Tag" : `${left} Tage`}.`;
});

function reminder(): string | null {
  return reminderOn.value ? reminderTime.value : null;
}

async function start(habit: { id: number; title: string }): Promise<void> {
  if (reminderOn.value && !/^\d{2}:\d{2}$/.test(reminderTime.value))
    throw new Error("Bitte gib eine Uhrzeit für die Erinnerung ein.");
  await createMonthChallenge({
    habitId: habit.id,
    month: month.value,
    reminderTime: reminder(),
  });
  emit("created", habit.title);
}

async function submitExisting(): Promise<void> {
  if (busy.value) return;
  const habit = choices.value.find((item) => item.id === habitId.value);
  if (!habit) {
    errorMessage.value = "Bitte wähle ein Daily.";
    return;
  }
  busy.value = true;
  errorMessage.value = null;
  try {
    await start(habit);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Monats-Challenge konnte nicht starten.";
  } finally {
    busy.value = false;
  }
}

function keep(habit: HabitResponse): void {
  fresh = habit;
}

/** The form created the Daily; now its challenge starts. */
async function startOnNew(): Promise<void> {
  const habit = fresh;
  fresh = null;
  if (!habit) return;
  busy.value = true;
  errorMessage.value = null;
  try {
    await start(habit);
  } catch (error) {
    // The Daily is there: offer it to try again without a second one.
    created.value = [...created.value, habit];
    habitId.value = habit.id;
    mode.value = "existing";
    const detail = error instanceof Error ? error.message : "";
    errorMessage.value = `Das Daily „${habit.title}“ ist angelegt, die Challenge aber noch nicht gestartet. ${detail}`.trim();
  } finally {
    busy.value = false;
  }
}

function close(): void {
  if (!busy.value && !formBusy.value) emit("close");
}
</script>

<template>
  <ModalDialog
    title="Monats-Challenge starten"
    :busy="busy || formBusy"
    :return-focus="returnFocus"
    focus-selector="[name='challengeHabit'], input[name='title']"
    @close="close"
  >
    <div class="challenge-dialog">
      <p class="challenge-dialog__lead">
        Ein Daily, einen Monat lang in seinem eigenen Rhythmus. Geschafft ist
        sie, wenn jeder fällige Lauf erledigt ist; Überspringen zählt als
        verpasst.
      </p>

      <fieldset class="challenge-dialog__group" :disabled="busy || formBusy">
        <legend>Monat</legend>
        <div class="segmented" role="radiogroup" aria-label="Monat">
          <label v-for="key in months" :key="key">
            <input
              v-model="month"
              type="radio"
              :name="`${id}-month`"
              :value="key"
              data-test="challenge-month"
            />
            {{ monthName(key) }}
          </label>
        </div>
        <p class="challenge-dialog__hint">{{ startNote }}</p>
      </fieldset>

      <fieldset class="challenge-dialog__group" :disabled="busy || formBusy">
        <legend>Erinnerung</legend>
        <div class="challenge-dialog__reminder">
          <span :id="`${id}-reminder`" class="challenge-dialog__label">
            Täglich erinnern
          </span>
          <button
            class="switch"
            type="button"
            role="switch"
            :aria-labelledby="`${id}-reminder`"
            :aria-describedby="`${id}-reminder-hint`"
            :aria-checked="reminderOn"
            @click="reminderOn = !reminderOn"
          >
            <span class="switch__track" aria-hidden="true">
              <span class="switch__thumb" />
            </span>
          </button>
        </div>
        <label v-if="reminderOn" class="field challenge-dialog__time">
          Um
          <input
            v-model="reminderTime"
            type="time"
            name="challengeReminder"
            step="60"
            required
          />
        </label>
        <p :id="`${id}-reminder-hint`" class="challenge-dialog__hint">
          Nur wenn der Lauf des Tages dann noch offen ist, höchstens einmal am
          Tag, auf Geräten mit Benachrichtigungen.
        </p>
      </fieldset>

      <fieldset class="challenge-dialog__group" :disabled="busy || formBusy">
        <legend>Daily</legend>
        <div class="segmented" role="radiogroup" aria-label="Daily">
          <label v-if="choices.length">
            <input
              v-model="mode"
              type="radio"
              :name="`${id}-mode`"
              value="existing"
            />
            Vorhandenes Daily
          </label>
          <label>
            <input v-model="mode" type="radio" :name="`${id}-mode`" value="new" />
            Neues Daily
          </label>
        </div>
      </fieldset>

      <form
        v-if="mode === 'existing'"
        class="challenge-dialog__form"
        novalidate
        @submit.prevent="submitExisting"
      >
        <label class="field">
          Welches Daily?
          <select v-model="habitId" name="challengeHabit" :disabled="busy">
            <option v-for="habit in choices" :key="habit.id" :value="habit.id">
              {{ habit.title }}
            </option>
          </select>
        </label>
        <div class="challenge-dialog__footer sticky-actions">
          <p v-if="errorMessage" class="form-error" role="alert">
            {{ errorMessage }}
          </p>
          <div class="challenge-dialog__actions">
            <button
              class="btn btn--primary"
              type="submit"
              :disabled="busy"
              :aria-busy="busy || undefined"
            >
              {{ busy ? "Startet …" : "Challenge starten" }}
            </button>
            <button class="btn" type="button" :disabled="busy" @click="close">
              Abbrechen
            </button>
          </div>
        </div>
      </form>
      <template v-else>
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>
        <CreateHabitForm
          submit-label="Daily anlegen und Challenge starten"
          @habit="keep"
          @busy="formBusy = $event"
          @created="startOnNew"
          @cancel="close"
        />
      </template>
    </div>
  </ModalDialog>
</template>

<style scoped>
.challenge-dialog {
  display: grid;
  gap: var(--space-4);
}

.challenge-dialog p {
  margin: 0;
}

.challenge-dialog__lead,
.challenge-dialog__hint {
  max-width: 60ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.challenge-dialog__hint {
  font-size: 0.875rem;
}

.challenge-dialog__group {
  display: grid;
  gap: var(--space-2);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.challenge-dialog__group > legend {
  margin-bottom: var(--space-2);
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.challenge-dialog__group > .segmented {
  justify-self: start;
  flex-wrap: wrap;
}

.challenge-dialog__reminder {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
}

.challenge-dialog__label {
  font-weight: 700;
}

.challenge-dialog__time {
  justify-self: start;
}

.challenge-dialog__time input {
  width: auto;
  min-width: 8rem;
  font-variant-numeric: tabular-nums;
}

.challenge-dialog__form {
  display: grid;
  gap: var(--space-4);
}

.challenge-dialog__footer {
  display: grid;
  gap: var(--space-3);
}

.challenge-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}
</style>
