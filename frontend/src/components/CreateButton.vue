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
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
  z-index: 20;
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0.875rem;
  background: #2457c5;
  color: #fff;
  box-shadow: 0 2px 8px rgb(15 23 42 / 18%);
  cursor: pointer;
}
.create-button svg {
  display: block;
  width: 1.5rem;
  height: 1.5rem;
}
.create-button:hover:not(:disabled) {
  background: #1c46a1;
}
.create-button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.create-button:focus-visible {
  outline: 3px solid rgb(53 103 220 / 40%);
  outline-offset: 3px;
}
</style>
