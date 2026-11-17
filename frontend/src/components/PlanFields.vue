<script setup lang="ts">
import { computed, watch } from "vue";
import { addDays, getCurrentDateInTimeZone } from "../utils/date";

/**
 * When a quest is planned: its day, and a time only if it is an appointment.
 * Everything else is worked through in the order of its day.
 */
const date = defineModel<string>("date", { required: true });
const time = defineModel<string>("time", { required: true });
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
// Without a day there is nothing an appointment could be on.
watch(date, (day) => {
  if (!day) time.value = "";
});
</script>

<template>
  <div class="plan-fields">
    <div class="field">
      <label :for="`${idPrefix}-date`">Tag · optional</label>
      <div class="plan-fields__day">
        <input
          :id="`${idPrefix}-date`"
          v-model="date"
          name="scheduledDate"
          type="date"
          :aria-describedby="`${idPrefix}-date-hint`"
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
      <small :id="`${idPrefix}-date-hint`" class="plan-fields__hint">
        Ohne Tag liegt die Quest im Questlog.
      </small>
    </div>
    <div class="field">
      <label :for="`${idPrefix}-time`">Feste Uhrzeit · optional</label>
      <input
        :id="`${idPrefix}-time`"
        v-model="time"
        name="timeOfDay"
        type="time"
        :disabled="!date"
        :aria-describedby="`${idPrefix}-time-hint`"
      />
      <small :id="`${idPrefix}-time-hint`" class="plan-fields__hint">
        Nur für Termine. Alles andere erledigst du in deiner Reihenfolge.
      </small>
    </div>
  </div>
</template>

<style scoped>
.plan-fields {
  display: grid;
  gap: var(--space-4);
}

.plan-fields__day {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}

.plan-fields__day input {
  flex: 1 1 10rem;
  width: auto;
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
