<script setup lang="ts">
import type { HistoryPlannedItem } from "../types/history";
import { categoryMark } from "../utils/category-mark";
import { shortDate } from "../utils/history";

const props = defineProps<{
  items: HistoryPlannedItem[];
  /** Which entries may be moved; without it the list is read-only. */
  canMove?: (item: HistoryPlannedItem) => boolean;
}>();
const emit = defineEmits<{ move: [item: HistoryPlannedItem] }>();

function details(item: HistoryPlannedItem): string[] {
  const parts: string[] = [];
  if (item.id === null) parts.push("voraussichtlich");
  if (item.isOverdue)
    parts.push(`noch offen seit ${shortDate(item.scheduledDate)}`);
  if (item.isFixed) parts.push("Fester Termin");
  if (item.plannedDurationMinutes !== null)
    parts.push(`${item.plannedDurationMinutes} Min. geplant`);
  return parts;
}

const movable = (item: HistoryPlannedItem) => props.canMove?.(item) ?? false;
</script>

<template>
  <ul class="planned-items">
    <li v-for="item in items" :key="item.key" class="planned-item">
      <h3>{{ item.title }}</h3>
      <p v-if="item.why" class="planned-item__why">{{ item.why }}</p>
      <p
        v-if="item.categoryName || details(item).length"
        class="planned-item__details"
      >
        <span v-if="item.categoryName" class="planned-item__category">
          <i
            class="planned-item__mark"
            :style="{ background: categoryMark(item.categoryName) }"
            aria-hidden="true"
          />{{ item.categoryName }}
        </span>
        <span v-for="part in details(item)" :key="part">{{ part }}</span>
      </p>
      <button
        v-if="movable(item)"
        type="button"
        class="btn planned-item__move"
        :aria-label="`${item.title} verschieben`"
        @click="emit('move', item)"
      >
        Verschieben
      </button>
    </li>
  </ul>
</template>

<style scoped>
.planned-items {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Upcoming entries have no time and no state yet: just the text. */
.planned-item {
  min-width: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.planned-item h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.planned-item__why {
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.planned-item__details {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.planned-item__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.planned-item__mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

.planned-item__move {
  margin-top: var(--space-2);
}
</style>
