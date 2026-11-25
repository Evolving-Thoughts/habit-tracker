<script setup lang="ts">
/**
 * A Google event in a list of the day: read-only, in the flat white of
 * appointments elsewhere. It holds its place in the order (a card dropped
 * next to it stays there) but never lifts itself.
 */
defineProps<{
  time: string;
  title: string;
  /** Over: quieter, like an appointment that has ended. */
  past?: boolean;
}>();
</script>

<template>
  <div
    class="calendar-event-row"
    :class="{ 'calendar-event-row--past': past }"
    data-event
  >
    <span class="calendar-event-row__time">{{ time }}</span>
    <span class="calendar-event-row__title">{{ title }}</span>
    <span class="calendar-event-row__source">Google Kalender</span>
  </div>
</template>

<style scoped>
.calendar-event-row {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: 0 calc(var(--tap) + var(--space-4));
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
  border-radius: var(--radius-card);
  background: var(--color-surface-flat);
}

.calendar-event-row--past {
  opacity: 0.8;
}

.calendar-event-row__time {
  padding-top: 0.1rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.calendar-event-row__title {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.calendar-event-row__source {
  grid-column: 2;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
</style>
