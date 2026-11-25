<script setup lang="ts">
import type { HistoryWeeklyTarget } from "../types/history";

defineProps<{ targets: HistoryWeeklyTarget[] }>();
</script>

<template>
  <section class="weekly-targets" aria-label="Wochenziele">
    <h2 class="section-title">Wochenziele</h2>
    <ul class="rows card">
      <li v-for="target in targets" :key="target.key" class="row">
        <strong class="row__name">{{ target.title }}</strong>
        <!-- Done first, as everywhere: "2 von 4 erledigt · noch 2". -->
        <span class="count"
          >{{ target.completed }} von {{ target.target }} erledigt<template
            v-if="target.remaining > 0"
          >
            · noch {{ target.remaining }}</template
          ></span
        >
      </li>
    </ul>
  </section>
</template>

<style scoped>
.rows {
  display: grid;
  margin: 0;
  padding: var(--space-1) var(--space-4);
  list-style: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  align-items: center;
  min-height: var(--tap);
  padding: var(--space-2) 0;
}

.row + .row {
  border-top: 1px solid var(--color-line);
}

.row__name {
  flex: 1 1 10rem;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
