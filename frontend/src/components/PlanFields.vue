<script setup lang="ts">
import { computed } from "vue";
import { addDays, getCurrentDateInTimeZone } from "../utils/date";

/**
 * The day a quest is planned for. Everything on a day is worked through in
 * its order; only an appointment gets a time (`AppointmentFields`). Only
 * while no day is set does a hint say where the quest then lives.
 */
const date = defineModel<string>("date", { required: true });
defineProps<{ idPrefix: string }>();

const today = getCurrentDateInTimeZone();
const days = computed(() => [
  { label: "Heute", value: today },
  { label: "Morgen", value: addDays(today, 1) },
]);
/** A second tap on the chosen day takes it back. */
function pick(day: string): void {
  date.value = date.value === day ? "" : day;
}
</script>

<template>
  <div class="field">
    <label :for="`${idPrefix}-date`">Tag · optional</label>
    <div class="plan-fields__day">
      <input
        :id="`${idPrefix}-date`"
        v-model="date"
        name="scheduledDate"
        type="date"
        :aria-describedby="date ? undefined : `${idPrefix}-date-hint`"
      />
      <button
        v-for="day in days"
        :key="day.value"
        type="button"
        class="chip"
        :aria-pressed="date === day.value"
        @click="pick(day.value)"
      >
        {{ day.label }}
      </button>
    </div>
    <small
      v-if="!date"
      :id="`${idPrefix}-date-hint`"
      class="plan-fields__hint"
    >
      Ohne Tag liegt die Quest im Questlog.
    </small>
  </div>
</template>

<style scoped>
.plan-fields__day {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

/* Narrow enough that the date and both chips share one line at 375px. */
.plan-fields__day input {
  flex: 1 1 9rem;
  width: auto;
  min-width: 0;
}

.plan-fields__day .chip {
  padding: 0 var(--space-3);
}

/* Dialogs tint every button; the chosen day still has to stand out. */
.plan-fields__day .chip[aria-pressed="true"] {
  border-color: var(--color-ink);
  background: var(--color-surface);
  /* The ring is drawn inside, because dialogs take the border away. */
  box-shadow: inset 0 0 0 1.5px var(--color-ink);
  color: var(--color-ink);
}

.plan-fields__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}
</style>
