<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

/**
 * The tick ring of every row (DESIGN.md › Eintrag mit Haken-Ring): an orange
 * ring in a round tap target that fills when done; dashed for skipped. Role
 * and pressed state come from the row through the attributes.
 */
defineProps<{
  checked: boolean;
  skipped?: boolean;
  label: string;
  disabled?: boolean;
  busy?: boolean;
}>();
const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    class="check-ring"
    :class="{
      'check-ring--checked': checked,
      'check-ring--skipped': skipped,
    }"
    type="button"
    :disabled="disabled"
    :aria-busy="busy || undefined"
    :aria-label="label"
    @click="emit('toggle')"
  >
    <span class="check-ring__ring">
      <AppIcon v-if="checked" name="check" />
    </span>
  </button>
</template>

<style scoped>
.check-ring {
  display: grid;
  flex: none;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-on-action);
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.check-ring:active:not(:disabled) {
  transform: scale(0.86);
  transition-duration: 90ms;
}

.check-ring__ring {
  display: grid;
  width: 1.875rem;
  height: 1.875rem;
  place-items: center;
  border: 2.5px solid var(--color-action);
  border-radius: 50%;
  transition:
    background-color 240ms var(--ease-out),
    border-color 240ms var(--ease-out);
}

.check-ring__ring :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 3;
  animation: check-pop 420ms var(--spring);
}

@keyframes check-pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}

.check-ring--checked .check-ring__ring {
  background: var(--color-action);
}

.check-ring--skipped .check-ring__ring {
  border-color: var(--color-ink-soft);
  border-style: dashed;
}

.check-ring:disabled {
  cursor: progress;
}

.check-ring:disabled .check-ring__ring {
  border-color: var(--color-ink-soft);
}

.check-ring--checked:disabled .check-ring__ring {
  background: var(--color-ink-soft);
}
</style>
