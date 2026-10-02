<script setup lang="ts">
import { ref } from "vue";
import TodayView from "./views/TodayView.vue";
import TodoDumpView from "./views/TodoDumpView.vue";

const activeView = ref<"today" | "todo-dump">("today");
</script>

<template>
  <nav class="app-navigation" aria-label="Ansichten">
    <button
      type="button"
      :aria-pressed="activeView === 'today'"
      @click="activeView = 'today'"
    >
      Heute
    </button>

    <button
      type="button"
      :aria-pressed="activeView === 'todo-dump'"
      @click="activeView = 'todo-dump'"
    >
      Todo-Dump
    </button>
  </nav>

  <TodayView v-if="activeView === 'today'" />
  <TodoDumpView v-else />
</template>

<style scoped>
.app-navigation {
  display: flex;
  gap: 0.5rem;
  width: min(100% - 2rem, 46rem);
  margin: 0 auto;
  padding-top: 1rem;
}

.app-navigation button {
  padding: 0.65rem 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #2f3a4f;
  font: inherit;
  cursor: pointer;
}

.app-navigation button[aria-pressed="true"] {
  border-color: #2457c5;
  background: #2457c5;
  color: #ffffff;
}

@media (max-width: 32rem) {
  .app-navigation {
    width: min(100% - 1rem, 46rem);
  }
}
</style>
