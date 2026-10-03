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
  flex: 0 0 2.75rem;
  width: 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 1px solid #cad6f5;
  border-radius: 50%;
  background: #eaf0ff;
  color: #2457c5;
  cursor: pointer;
}
.timer-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}
.timer-icon:hover:not(:disabled) {
  background: #dbe6ff;
}
.timer-icon:focus-visible {
  outline: 3px solid #2457c5;
  outline-offset: 3px;
}
.timer-icon:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
