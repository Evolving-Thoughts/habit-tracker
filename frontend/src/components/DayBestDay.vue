<script setup lang="ts">
import { getDayBest } from "../api/day-bests.api";
import { useLoader } from "../composables/useLoader";
import type { DayBest } from "../types/day-best";
import DayBestField from "./DayBestField.vue";

/**
 * The day's best in the Kalender's day view, beside the reflection: the
 * same field as in Heute, for today and any day before it.
 */
const props = defineProps<{ date: string }>();

const {
  data: entry,
  isLoading,
  errorMessage,
} = useLoader<DayBest | null>((signal) => getDayBest(props.date, signal), {
  initial: null,
  fallbackError: "Das Beste des Tages konnte nicht geladen werden.",
  params: [() => props.date],
  resetOnLoad: true,
});
</script>

<template>
  <section class="day-best-day card" aria-labelledby="day-best-day-title">
    <h2 id="day-best-day-title" class="day-best-day__title">
      Das Beste des Tages
    </h2>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <DayBestField
      v-else
      :key="date"
      :date="date"
      :text="entry?.text ?? ''"
      label="Das Beste des Tages"
      hide-label
      :disabled="isLoading"
      @saved="entry = $event"
    />
  </section>
</template>

<style scoped>
.day-best-day {
  display: grid;
  gap: var(--space-2);
}

.day-best-day__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 800;
}
</style>
