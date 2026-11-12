<script setup lang="ts">
defineProps<{
  icon: "play" | "pause" | "stop" | "edit" | "check";
  label: string;
  disabled?: boolean;
}>();
defineEmits<{ click: [] }>();
</script>
<template>
  <button
    class="timer-icon"
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        v-if="icon === 'play'"
        d="M8 5.5 19 12 8 18.5Z"
        fill="currentColor"
      />
      <path
        v-else-if="icon === 'pause'"
        d="M7 6h3v12H7zM14 6h3v12h-3z"
        fill="currentColor"
      />
      <rect
        v-else-if="icon === 'stop'"
        x="6"
        y="6"
        width="12"
        height="12"
        rx="1"
        fill="currentColor"
      />
      <path
        v-else-if="icon === 'check'"
        d="m5 12 4 4 10-10"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        v-else
        d="m16 3 5 5-12 12-6 1 1-6L16 3Z M14 5l5 5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>
<style scoped>
.timer-icon {
  display: grid;
  place-items: center;
  flex: 0 0 var(--tap);
  width: var(--tap);
  height: var(--tap);
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--color-action-tint);
  color: var(--color-action-strong);
  cursor: pointer;
  transition: transform 160ms var(--ease-out);
}
.timer-icon svg {
  width: 1.375rem;
  height: 1.375rem;
}
.timer-icon:hover:not(:disabled) {
  background: #ffe2cf;
}
.timer-icon:active:not(:disabled) {
  transform: scale(0.92);
}
.timer-icon:focus-visible {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 3px;
}
.timer-icon:disabled {
  background: transparent;
  color: var(--color-ink-soft);
  cursor: not-allowed;
}
</style>
