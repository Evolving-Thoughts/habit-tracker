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
    <span aria-hidden="true">+</span>
  </button>
</template>
<style scoped>
.create-button {
  display: grid;
  flex: 0 0 2.75rem;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0.625rem;
  background: #2457c5;
  color: #fff;
  font: inherit;
  font-size: 1.75rem;
  line-height: 1;
  cursor: pointer;
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
