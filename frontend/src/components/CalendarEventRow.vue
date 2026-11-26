<script setup lang="ts">
import CheckRing from "./CheckRing.vue";

/**
 * A Google event in a list of the day, in the flat white of appointments
 * elsewhere. Its time and title stay as Google has them; in Heute and on its
 * other days it can be ticked off (`checkable`), which only the app keeps,
 * and it drags like a card (`draggable`) among the cards without a time.
 * It lines up with the cards: time, ring, text.
 */
const props = defineProps<{
  time: string;
  title: string;
  /** Over: quieter, like an appointment that has ended. */
  past?: boolean;
  /** In an order that sorts by dragging: the whole row lifts. */
  draggable?: boolean;
  /** Shows the ring that ticks it off (and opens it again). */
  checkable?: boolean;
  /** Ticked off: crossed through under "abgeschlossen". */
  done?: boolean;
  /** Its tick is being written. */
  busy?: boolean;
}>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <div
    class="calendar-event-row"
    :class="{
      'calendar-event-row--past': past && !done,
      'calendar-event-row--done': done,
      'card-drag': draggable,
    }"
    data-event
  >
    <span class="calendar-event-row__time">{{ time }}</span>
    <CheckRing
      v-if="checkable"
      :checked="!!done"
      :label="done ? `${props.title} wieder öffnen` : `${props.title} abhaken`"
      :disabled="busy"
      :busy="busy"
      :aria-pressed="!!done"
      @toggle="emit('toggle')"
    />
    <span v-else class="calendar-event-row__ring-space" aria-hidden="true" />
    <span class="calendar-event-row__text">
      <span class="calendar-event-row__title">{{ title }}</span>
      <span class="calendar-event-row__source">Google Kalender</span>
    </span>
  </div>
</template>

<style scoped>
/* The cards' columns: time, ring, text (ItemRow, PlannerItem). */
.calendar-event-row {
  display: flex;
  align-items: flex-start;
  padding: var(--space-1);
  border-radius: var(--radius-card);
  background: var(--color-surface-flat);
}

.calendar-event-row--past {
  opacity: 0.8;
}

.calendar-event-row__time {
  flex: none;
  width: 2.75rem;
  padding-top: 0.7rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

.calendar-event-row__ring-space {
  flex: none;
  width: var(--tap);
}

.calendar-event-row__text {
  display: grid;
  flex: 1;
  min-width: 0;
  /* The first line sits on the ring's middle, as on the cards. */
  padding: 0.55rem var(--space-3) 0.45rem var(--space-1);
}

.calendar-event-row__title {
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.calendar-event-row--done .calendar-event-row__title {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.calendar-event-row__source {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
</style>
