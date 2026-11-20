<script setup lang="ts">
import DayCalendar from "./DayCalendar.vue";
import { getHistory } from "../api/history.api";
import { useLoader } from "../composables/useLoader";
import type { HistoryResponse, HistoryWorkLog } from "../types/history";

/**
 * Heute's day calendar on wide screens: today as the Kalender reads it
 * (`GET /history`, day), so appointments, Google events, completions and the
 * Logbuch stand on one hour axis beside the list. It loads again whenever
 * data changes elsewhere, like every view.
 */
const props = defineProps<{
  date: string;
  /** Stretches whose delete waits behind Heute's undo toast. */
  hiddenLogs?: ReadonlySet<number>;
}>();
const emit = defineEmits<{ removeLog: [log: HistoryWorkLog] }>();

const { data, errorMessage, reload } = useLoader<HistoryResponse | null>(
  (signal) => getHistory(props.date, "day", "all", signal),
  {
    initial: null,
    fallbackError: "Der Kalender des Tages konnte nicht geladen werden.",
    params: [() => props.date],
    refreshOnChange: () => true,
  },
);
</script>

<template>
  <div class="today-calendar">
    <DayCalendar
      v-if="data?.days[0]"
      class="today-calendar__day"
      :day="data.days[0]"
      :today="data.today"
      :reload="reload"
      :hidden-logs="hiddenLogs"
      @remove-log="emit('removeLog', $event)"
    />
    <div v-else-if="errorMessage" class="alert">
      <p role="alert">{{ errorMessage }}</p>
      <button type="button" class="btn btn--ground" @click="reload()">
        Erneut versuchen
      </button>
    </div>
    <div
      v-else
      class="today-calendar__loading"
      role="status"
      aria-label="Kalender des Tages wird geladen"
    />
  </div>
</template>

<style scoped>
.today-calendar {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.today-calendar__day {
  flex: 1 1 auto;
}

.today-calendar__loading {
  flex: 1 1 auto;
  border-radius: var(--radius-card);
  background: var(--color-surface-flat);
}
</style>
