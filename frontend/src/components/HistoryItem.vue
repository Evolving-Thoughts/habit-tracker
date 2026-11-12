<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import type { HistoryItem } from "../types/history";
import { categoryMark } from "../utils/category-mark";
import { formatTimeForGermanDisplay } from "../utils/date";
import { shortDate } from "../utils/history";

const props = defineProps<{ item: HistoryItem }>();

const completed = computed(() => props.item.status === "completed");
const time = computed(() =>
  completed.value && props.item.resolvedAt
    ? formatTimeForGermanDisplay(props.item.resolvedAt)
    : "",
);
const details = computed(() => {
  const { item } = props;
  const parts: string[] = [];
  if (item.type === "todo" && !item.scheduledDate)
    parts.push("Aus dem Todo-Dump");
  if (time.value) parts.push(`Erledigt um ${time.value}`);
  if (!completed.value) parts.push("Übersprungen");
  if (item.plannedDurationMinutes !== null)
    parts.push(`${item.plannedDurationMinutes} Min. geplant`);
  // Only when it landed on another day than planned.
  if (item.scheduledDate && item.scheduledDate !== item.date)
    parts.push(`Geplant für ${shortDate(item.scheduledDate)}`);
  if (item.deleted) parts.push("Gelöscht");
  return parts;
});
</script>

<template>
  <li
    class="history-item"
    :class="{
      'history-item--skipped': !completed,
      'history-item--untimed': !time,
    }"
    :data-history-key="`${item.type}-${item.id}`"
    :data-status="item.status"
  >
    <span v-if="time" class="history-item__time">{{ time }}</span>
    <!-- Read-only state: history is a record, not something to tick. -->
    <span class="history-item__state" aria-hidden="true">
      <AppIcon v-if="completed" name="check" />
    </span>
    <div class="history-item__content">
      <h3>{{ item.title }}</h3>
      <p v-if="item.why" class="history-item__why">{{ item.why }}</p>
      <p
        v-if="item.categoryName || details.length"
        class="history-item__details"
      >
        <span v-if="item.categoryName" class="history-item__category">
          <i
            class="history-item__mark"
            :style="{ background: categoryMark(item.categoryName) }"
            aria-hidden="true"
          />{{ item.categoryName }}
        </span>
        <span v-for="part in details" :key="part">{{ part }}</span>
      </p>
    </div>
  </li>
</template>

<style scoped>
.history-item {
  display: grid;
  grid-template-columns: 2.75rem 1.25rem minmax(0, 1fr);
  gap: var(--space-3);
  align-items: start;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.history-item--untimed {
  grid-template-columns: 1.25rem minmax(0, 1fr);
}

.history-item__time {
  padding-top: 0.15rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* A small filled dot, not a ring: it reports a state, it is not a control. */
.history-item__state {
  display: grid;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.125rem;
  place-items: center;
  border-radius: 50%;
  background: var(--color-ink-muted);
  color: var(--color-surface);
}

.history-item__state :deep(svg) {
  width: 0.8125rem;
  height: 0.8125rem;
  stroke-width: 3.5;
}

.history-item--skipped .history-item__state {
  border: 1.5px dashed var(--color-ink-soft);
  background: transparent;
}

.history-item__content {
  min-width: 0;
}

.history-item h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.history-item--skipped h3 {
  color: var(--color-ink-muted);
}

.history-item__why {
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.history-item__details {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.history-item__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.history-item__mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}
</style>
