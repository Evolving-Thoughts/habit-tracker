<script setup lang="ts">
import { computed } from "vue";
import { timerStateOf, toggleTimer, useTimer } from "../composables/useTimer";
import TimerIconButton from "./TimerIconButton.vue";

/**
 * ▶ of a row. While the row's own stopwatch runs it turns into pause (and
 * into resume while paused), the same step as Space and the timer bar.
 */
const props = defineProps<{
  kind: "todo" | "occurrence";
  targetId: number | null;
  title: string;
  eligible: boolean;
  disabled?: boolean;
}>();
const controller = useTimer();
const own = computed(() =>
  timerStateOf(controller, props.kind, props.targetId),
);
const label = computed(() =>
  own.value === "running"
    ? `Stoppuhr für ${props.title} läuft, pausieren`
    : own.value === "paused"
      ? `Stoppuhr für ${props.title} fortsetzen`
      : !props.eligible
        ? `Timer für ${props.title}: keine offene fällige Ausführung`
        : `Timer für ${props.title} starten`,
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
  <TimerIconButton
    :icon="own === 'running' ? 'pause' : 'play'"
    :label="label"
    :active="own !== null"
    :disabled="
      disabled ||
      (!own && !eligible) ||
      targetId === null ||
      controller?.busy.value
    "
    @click="press"
  />
</template>
