<script setup lang="ts">
import { computed } from "vue";
import { timerStateOf, toggleTimer, useTimer } from "../composables/useTimer";
import AppIcon from "./AppIcon.vue";
import TimerIconButton from "./TimerIconButton.vue";

/**
 * ▶ of a row. While the row's own stopwatch runs it turns into pause (and
 * into resume while paused), the same step as Space and the timer bar.
 * `labelled` makes it the large primary button of the focus card, with the
 * next step as a word beside the icon ("Starten", "Pausieren", "Fortsetzen").
 */
const props = defineProps<{
  kind: "todo" | "occurrence";
  targetId: number | null;
  title: string;
  eligible: boolean;
  disabled?: boolean;
  labelled?: boolean;
}>();
const controller = useTimer();
const own = computed(() => timerStateOf(controller, props));
const label = computed(() =>
  own.value === "running"
    ? `Stoppuhr für ${props.title} läuft, pausieren`
    : own.value === "paused"
      ? `Stoppuhr für ${props.title} fortsetzen`
      : !props.eligible
        ? `Stoppuhr für ${props.title}: keine offene fällige Ausführung`
        : `Stoppuhr für ${props.title} starten`,
);
/** The visible word of the labelled button: what a tap does next. */
const word = computed(() =>
  own.value === "running"
    ? "Pausieren"
    : own.value === "paused"
      ? "Fortsetzen"
      : "Starten",
);
const unavailable = computed(
  () =>
    !!props.disabled ||
    (!own.value && !props.eligible) ||
    props.targetId === null ||
    !!controller?.busy.value,
);
function press(): void {
  if (props.targetId === null) return;
  toggleTimer(
    controller,
    { kind: props.kind, targetId: props.targetId, title: props.title },
    props.eligible,
  );
}
</script>
<template>
  <button
    v-if="labelled"
    class="item-play"
    type="button"
    :aria-label="label"
    :disabled="unavailable"
    @click="press"
  >
    <AppIcon :name="own === 'running' ? 'pause' : 'play'" />
    <span>{{ word }}</span>
  </button>
  <TimerIconButton
    v-else
    :icon="own === 'running' ? 'pause' : 'play'"
    :label="label"
    :active="own !== null"
    :disabled="unavailable"
    @click="press"
  />
</template>

<style scoped>
/* The focus card's primary button: orange, the control corner, 3.25rem high. */
.item-play {
  display: inline-flex;
  min-width: 0;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  min-height: 3.25rem;
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--radius-control);
  background: var(--color-action);
  color: var(--color-on-action);
  font: inherit;
  font-size: 1.0625rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out);
}

.item-play :deep(svg) {
  flex: none;
  width: 1.375rem;
  height: 1.375rem;
}

.item-play:hover:not(:disabled) {
  background: var(--color-action-strong);
}

.item-play:active:not(:disabled) {
  transform: var(--press);
  transition-duration: 90ms;
}

.item-play:focus-visible {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 2px;
}

/* Not available yet: calm, an apricot tint with soft ink. */
.item-play:disabled {
  background: var(--color-action-tint);
  color: var(--color-ink-soft);
  cursor: not-allowed;
}
</style>
