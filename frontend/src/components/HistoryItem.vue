<script setup lang="ts">
import type { HistoryItem } from "../types/history";
import {
  formatDateForGermanDisplay,
  formatTimeForGermanDisplay,
} from "../utils/date";
defineProps<{ item: HistoryItem }>();
</script>
<template>
  <li
    class="history-item"
    :data-history-key="`${item.type}-${item.id}`"
    :data-status="item.status"
  >
    <span class="history-item__icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path v-if="item.status === 'completed'" d="m5 12 4 4 10-10" />
        <template v-else>
          <path d="M9 10H4V5" />
          <path d="M4 10a8 8 0 1 1 2 8" />
        </template>
      </svg>
    </span>
    <div class="history-item__content">
      <div class="history-item__heading">
        <h3>{{ item.title }}</h3>
        <span v-if="item.deleted" class="history-item__deleted">Gelöscht</span>
      </div>
      <p>
        {{ item.type === "todo" ? "Todo" : "Habit" }}
        <template v-if="item.type === 'todo' && !item.scheduledDate">
          · Aus dem Todo-Dump</template
        >
        <template v-if="item.status === 'completed' && item.resolvedAt">
          · Erledigt um
          {{ formatTimeForGermanDisplay(item.resolvedAt) }}</template
        >
        <template v-if="item.plannedDurationMinutes !== null">
          · Geplant: {{ item.plannedDurationMinutes }} Min.</template
        >
      </p>
      <p
        v-if="
          item.scheduledDate &&
          (item.status === 'skipped' || item.scheduledDate !== item.date)
        "
      >
        Geplant für {{ formatDateForGermanDisplay(item.scheduledDate) }}
      </p>
    </div>
  </li>
</template>
<style scoped>
.history-item {
  display: flex;
  align-items: flex-start;
  gap: 0.875rem;
  padding: 1rem;
  border: 1px solid #d6dce7;
  border-radius: 1rem;
  background: white;
}
.history-item__icon {
  display: grid;
  place-items: center;
  flex: 0 0 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: #e5f5ed;
  color: #146c43;
}
.history-item[data-status="skipped"] .history-item__icon {
  background: #eff1f5;
  color: #647086;
}
.history-item__content {
  min-width: 0;
  flex: 1;
}
.history-item__heading {
  display: flex;
  gap: 0.75rem;
  justify-content: space-between;
  align-items: flex-start;
}
h3 {
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
  color: #202b40;
}
p {
  margin: 0.5rem 0 0;
  color: #61718c;
  font-size: 0.875rem;
  line-height: 1.5;
}
.history-item__deleted {
  font-size: 0.75rem;
  background: #eff1f5;
  color: #5d677c;
  border-radius: 0.4rem;
  padding: 0.2rem 0.4rem;
}
</style>
