<script setup lang="ts">
import type { HistoryPlannedItem } from "../types/history";
import { formatDateForGermanDisplay } from "../utils/date";
defineProps<{ items: HistoryPlannedItem[] }>();
</script>
<template>
  <ul>
    <li v-for="item in items" :key="item.key" class="planned-item">
      <span class="planned-kind">{{
        item.type === "todo" ? "Todo" : "Habit"
      }}</span>
      <strong>{{ item.title }}</strong>
      <span v-if="item.isOverdue" class="overdue"
        >überfällig seit
        {{ formatDateForGermanDisplay(item.scheduledDate) }}</span
      >
      <span v-else
        >Geplant für {{ formatDateForGermanDisplay(item.scheduledDate) }}</span
      >
      <span v-if="item.plannedDurationMinutes !== null"
        >Geplant: {{ item.plannedDurationMinutes }} Min.</span
      >
    </li>
  </ul>
</template>
<style scoped>
ul {
  padding: 0;
  list-style: none;
}
.planned-item {
  display: grid;
  gap: 0.35rem;
  padding: 0.75rem 0;
  overflow-wrap: anywhere;
}
.planned-item + .planned-item {
  border-top: 1px solid #e4e8ef;
}
.planned-item span {
  font-size: 0.8125rem;
  color: #61718c;
}
.planned-item .planned-kind {
  font-weight: 700;
}
.planned-item .overdue {
  color: #973e17;
}
</style>
