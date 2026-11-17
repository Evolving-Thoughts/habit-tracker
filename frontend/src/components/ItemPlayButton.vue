<script setup lang="ts">
import { computed } from "vue";
import { useTimer } from "../composables/useTimer";
import TimerIconButton from "./TimerIconButton.vue";
const props = defineProps<{
  kind: "todo" | "occurrence";
  targetId: number | null;
  title: string;
  eligible: boolean;
  disabled?: boolean;
}>();
const controller = useTimer();
const ownActive = computed(() => {
  const timer = controller?.timer.value;
  return timer?.kind === props.kind && timer.targetId === props.targetId;
});
const label = computed(() =>
  ownActive.value
    ? `Timer für ${props.title} ist bereits aktiv`
    : !props.eligible
      ? `Timer für ${props.title}: keine offene fällige Ausführung`
      : `Timer für ${props.title} starten`,
);
function start(): void {
  if (controller && props.targetId !== null)
    void controller.start({
      kind: props.kind,
      targetId: props.targetId,
      title: props.title,
    });
}
</script>
<template>
  <TimerIconButton
    icon="play"
    :label="label"
    :disabled="disabled || !eligible || ownActive || controller?.busy.value"
    @click="start"
  />
</template>
