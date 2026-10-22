<script setup lang="ts">
import type { DeletionPreview } from "../types/todo-hierarchy";
defineProps<{ preview: DeletionPreview }>();
const stateLabel = {
  running: "läuft",
  paused: "pausiert",
  finished: "beendet",
  stopped: "gestoppt",
};
</script>
<template>
  <section class="deletion-summary" aria-label="Betroffene Todos und Timer">
    <p>
      <strong>{{ preview.todos.length }} Todo(s) werden gelöscht.</strong>
      Vorhandene Verlaufseinträge bleiben erhalten.
    </p>
    <ul>
      <li v-for="todo in preview.todos" :key="todo.id">
        {{ todo.title }} · {{ todo.completed ? "erledigt" : "offen" }}
      </li>
    </ul>
    <p>
      <strong
        >{{ preview.timers.length }} Timer werden ebenfalls gelöscht.</strong
      >
    </p>
    <ul v-if="preview.timers.length">
      <li v-for="timer in preview.timers" :key="timer.id">
        {{ timer.title }} · {{ stateLabel[timer.state] }}
      </li>
    </ul>
  </section>
</template>
<style scoped>
.deletion-summary {
  overflow-wrap: anywhere;
}
.deletion-summary ul {
  max-height: 14rem;
  overflow: auto;
  padding-left: 1.5rem;
}
.deletion-summary p {
  line-height: 1.5;
}
</style>
