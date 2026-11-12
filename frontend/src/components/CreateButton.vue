<script setup lang="ts">
defineProps<{ label: string; disabled?: boolean }>();
const emit = defineEmits<{ click: [] }>();
</script>
<template>
  <button
    class="create-button"
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="emit('click')"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>
</template>
<style scoped>
.create-button {
  position: fixed;
  right: calc(1rem + env(safe-area-inset-right, 0px));
  bottom: calc(
    var(--tab-bar-height) + 1rem + env(safe-area-inset-bottom, 0px)
  );
  z-index: 20;
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 1.125rem;
  background: var(--color-action);
  color: var(--color-on-action);
  box-shadow: 0 4px 14px rgb(154 51 10 / 28%);
  cursor: pointer;
  transition: transform 420ms var(--spring);
}
.create-button svg {
  display: block;
  width: 1.5rem;
  height: 1.5rem;
}
.create-button:hover:not(:disabled) {
  background: var(--color-action-strong);
}
.create-button:active:not(:disabled) {
  transform: var(--press);
}
.create-button:disabled {
  background: var(--color-ink-soft);
  cursor: not-allowed;
}
.create-button:focus-visible {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 3px;
}
@media (min-width: 56rem) {
  /* Docked beside the page column instead of drifting to the window edge. */
  .create-button {
    right: max(1rem, calc(50vw - (var(--page-width) / 2) - 4.5rem));
    bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
