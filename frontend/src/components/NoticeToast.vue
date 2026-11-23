<script setup lang="ts">
/**
 * An ink pill that tells something happened by itself, like a Soll reached,
 * on every view. It sits one place above the undo toast, so both can show
 * at once. The live region stays mounted, so screen readers hear each new
 * message.
 */
defineProps<{ message: string | null }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <div class="notice-toast" role="status" aria-live="polite">
    <div v-if="message" class="notice-toast__body">
      <span>{{ message }}</span>
      <button type="button" @click="emit('close')">OK</button>
    </div>
  </div>
</template>

<style scoped>
.notice-toast {
  position: fixed;
  right: 0;
  bottom: calc(
    var(--tab-bar-height) + 9.25rem + env(safe-area-inset-bottom, 0px)
  );
  left: 0;
  z-index: 40;
  display: flex;
  justify-content: center;
  pointer-events: none;
}

.notice-toast__body {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  max-width: min(100% - 2rem, 28rem);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--color-ink);
  color: var(--color-surface);
  font-weight: 600;
  box-shadow: var(--shadow-toast);
  pointer-events: auto;
  animation: notice-toast-in 240ms var(--ease-out);
}

.notice-toast__body span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.notice-toast__body button {
  flex: none;
  min-width: var(--tap);
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

.notice-toast__body button:active {
  transform: var(--press);
  transition-duration: 90ms;
}

@keyframes notice-toast-in {
  from {
    transform: translateY(0.75rem);
    opacity: 0;
  }
}

@media (min-width: 56rem), (hover: hover) and (pointer: fine) {
  .notice-toast {
    bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
