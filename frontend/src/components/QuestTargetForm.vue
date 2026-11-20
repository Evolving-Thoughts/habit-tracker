<script setup lang="ts">
import { nextTick, ref, useId, watch } from "vue";
import { setQuestTarget } from "../api/quest-hours.api";
import { goalFields, goalMinutes, MAX_TARGET_HOURS } from "../utils/quest-hours";

/*
 * The overall weekly goal in hours and minutes, saved for the running week
 * and the weeks after it. Shared by Einstellungen and the weekly review.
 */
const props = withDefaults(
  defineProps<{
    /** The stored goal the fields start from; null without one. */
    minutes: number | null;
    disabled?: boolean;
    /** Offers "Abbrechen", for the review's inline editor. */
    cancellable?: boolean;
    /** Puts the focus in the hours field when it appears. */
    autofocus?: boolean;
  }>(),
  { disabled: false, cancellable: false, autofocus: false },
);
const emit = defineEmits<{
  saved: [minutes: number | null];
  cancel: [];
}>();

const id = useId();
const fields = ref(goalFields(props.minutes));
const busy = ref(false);
const error = ref("");
const hoursInput = ref<HTMLInputElement | null>(null);

watch(
  () => props.minutes,
  (minutes) => {
    fields.value = goalFields(minutes);
  },
);

if (props.autofocus) void nextTick(() => hoursInput.value?.focus());

async function save(): Promise<void> {
  if (busy.value || props.disabled) return;
  error.value = "";
  let minutes: number | null;
  try {
    minutes = goalMinutes(fields.value);
  } catch (reason) {
    error.value = (reason as Error).message;
    return;
  }
  busy.value = true;
  try {
    const { weeklyTargetMinutes } = await setQuestTarget(minutes);
    fields.value = goalFields(weeklyTargetMinutes);
    emit("saved", weeklyTargetMinutes);
  } catch (reason) {
    error.value =
      reason instanceof Error ? reason.message : "Das hat nicht geklappt.";
  } finally {
    busy.value = false;
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (props.cancellable && event.key === "Escape") {
    event.stopPropagation();
    emit("cancel");
  }
}
</script>

<template>
  <form
    class="goal-form"
    novalidate
    @submit.prevent="save"
    @keydown="onKeydown"
  >
    <fieldset class="goal-form__fields" :aria-describedby="`${id}-hint`">
      <legend class="goal-form__legend">Wochenziel · optional</legend>
      <div class="field goal-form__field">
        <label :for="`${id}-hours`">Stunden</label>
        <input
          :id="`${id}-hours`"
          ref="hoursInput"
          v-model="fields.hours"
          name="weeklyQuestTargetHours"
          type="number"
          inputmode="numeric"
          min="0"
          :max="MAX_TARGET_HOURS"
          step="1"
          :disabled="disabled"
        />
      </div>
      <div class="field goal-form__field">
        <label :for="`${id}-minutes`">Minuten</label>
        <input
          :id="`${id}-minutes`"
          v-model="fields.minutes"
          name="weeklyQuestTargetMinutes"
          type="number"
          inputmode="numeric"
          min="0"
          max="59"
          step="5"
          :disabled="disabled"
        />
      </div>
    </fieldset>
    <small :id="`${id}-hint`" class="goal-form__hint"
      >Gilt ab dieser Woche; vergangene Wochen behalten ihr Ziel. Beides leer
      heißt: kein Ziel.</small
    >
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div class="goal-form__actions">
      <button class="btn" type="submit" :disabled="busy || disabled">
        Speichern
      </button>
      <button
        v-if="cancellable"
        class="btn btn--quiet"
        type="button"
        @click="emit('cancel')"
      >
        Abbrechen
      </button>
      <slot name="status" />
    </div>
  </form>
</template>

<style scoped>
.goal-form {
  display: grid;
  gap: var(--space-2);
}

.goal-form p {
  margin: 0;
}

.goal-form__fields {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.goal-form__legend {
  width: 100%;
  margin-bottom: var(--space-1);
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.goal-form__field {
  flex: 1 1 5rem;
  max-width: 8rem;
}

.goal-form__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.goal-form__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
}
</style>
