<script setup lang="ts">
import { computed } from "vue";
import type { DeletionPreview } from "../types/todo-hierarchy";
const props = defineProps<{
  preview: DeletionPreview;
  /** The quest that goes is a campaign: the count names it apart. */
  campaign?: boolean;
}>();
/** "3 Quests werden gelöscht." or "Die Kampagne und 2 Quests werden gelöscht." */
const countLine = computed(() => {
  const count = props.preview.todos.length - Number(!!props.campaign);
  const quests = count === 1 ? "1 Quest" : `${count} Quests`;
  if (!props.campaign)
    return `${quests} ${count === 1 ? "wird" : "werden"} gelöscht.`;
  return count > 0
    ? `Die Kampagne und ${quests} werden gelöscht.`
    : "Die Kampagne wird gelöscht.";
});
const stateLabel = {
  running: "läuft",
  paused: "pausiert",
  finished: "beendet",
  stopped: "gestoppt",
};
</script>
<template>
  <section
    class="deletion-summary"
    aria-label="Betroffene Quests und Stoppuhren"
  >
    <p>
      <strong>{{ countLine }}</strong>
      Was schon im Logbuch steht, bleibt erhalten.
    </p>
    <ul>
      <li v-for="todo in preview.todos" :key="todo.id">
        <span>{{ todo.title }}</span>
        <span class="deletion-summary__state">{{
          todo.completed ? "erledigt" : "offen"
        }}</span>
      </li>
    </ul>
    <template v-if="preview.timers.length">
      <p>
        <strong>{{
          preview.timers.length === 1
            ? "1 Stoppuhr wird ebenfalls gelöscht."
            : `${preview.timers.length} Stoppuhren werden ebenfalls gelöscht.`
        }}</strong>
      </p>
      <ul>
        <li v-for="timer in preview.timers" :key="timer.id">
          <span>{{ timer.title }}</span>
          <span class="deletion-summary__state">{{
            stateLabel[timer.state]
          }}</span>
        </li>
      </ul>
    </template>
  </section>
</template>
<style scoped>
.deletion-summary {
  display: grid;
  gap: var(--space-3);
  overflow-wrap: anywhere;
}

.deletion-summary p {
  margin: 0;
  line-height: 1.5;
}

.deletion-summary ul {
  max-height: 14rem;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
}

.deletion-summary li {
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
  padding: var(--space-2) 0;
  border-bottom: 1px solid var(--color-line);
}

.deletion-summary li:last-child {
  border-bottom: 0;
}

.deletion-summary__state {
  flex: none;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
