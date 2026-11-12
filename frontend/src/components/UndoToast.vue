<script setup lang="ts">
/**
 * The ink pill that confirms a tick and offers to take it back. The live
 * region stays mounted, so screen readers hear each new message.
 */
defineProps<{ label: string | null }>();
const emit = defineEmits<{ undo: [] }>();
</script>

<template>
  <div class="undo-toast" role="status" aria-live="polite">
    <div v-if="label" class="undo-toast__body">
      <span>{{ label }}</span>
      <button type="button" @click="emit('undo')">Rückgängig</button>
    </div>
  </div>
</template>

<style scoped>
.undo-toast {
  position: fixed;
  right: 0;
  bottom: calc(
    var(--tab-bar-height) + 5.25rem + env(safe-area-inset-bottom, 0px)
  );
  left: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.undo-toast__body {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  max-width: min(100% - 2rem, 28rem);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--color-ink);
  color: var(--color-surface);
  font-weight: 600;
  box-shadow: 0 8px 24px rgb(43 29 22 / 30%);
  pointer-events: auto;
  animation: undo-toast-in 240ms var(--ease-out);
}

.undo-toast__body span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.undo-toast__body button {
  flex: none;
  min-height: var(--tap);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-action-strong);
  font-weight: 800;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.undo-toast__body button:active {
  transform: var(--press);
  transition-duration: 90ms;
}

@keyframes undo-toast-in {
  from {
    transform: translateY(0.75rem);
    opacity: 0;
  }
}

@media (min-width: 56rem) {
  .undo-toast {
    bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
