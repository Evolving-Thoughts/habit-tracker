<script setup lang="ts">
import DayCalendar from "./DayCalendar.vue";
import { getHistory } from "../api/history.api";
import { useParentSession } from "../composables/useViewSession";
import type { HistoryResponse, HistoryWorkLog } from "../types/history";

/**
 * Heute's day calendar: today as the Kalender reads it (`GET /history`,
 * day), so appointments, Google events, completions and the Logbuch stand
 * on one hour axis, beside the list on wide screens and as the "Logbuch"
 * pane below. The day is a resource of Heute's session: it reloads after
 * Heute's writes and the calendar's own, and after a change elsewhere once
 * no dialog holds the view.
 */
const props = defineProps<{
  date: string;
  /** Stretches whose delete waits behind Heute's undo toast. */
  hiddenLogs?: ReadonlySet<number>;
  /** In the page's flow at its natural height (the pane on a phone). */
  flow?: boolean;
}>();
const emit = defineEmits<{ removeLog: [log: HistoryWorkLog] }>();

const { data, errorMessage, reload } = useParentSession().resource<HistoryResponse | null>(
  (signal) => getHistory(props.date, "day", "all", signal),
  {
    initial: null,
    fallbackError: "Der Kalender des Tages konnte nicht geladen werden.",
    params: [() => props.date],
  },
);
</script>

<template>
  <div class="today-calendar" :class="{ 'today-calendar--flow': flow }">
    <DayCalendar
      v-if="data?.days[0]"
      class="today-calendar__day"
      :day="data.days[0]"
      :today="data.today"
      :hidden-logs="hiddenLogs"
      :flow="flow"
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

/* Without a height to fill, the placeholder holds a screen's worth. */
.today-calendar--flow .today-calendar__loading {
  min-height: 24rem;
}
</style>
