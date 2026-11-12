<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import ItemPlayButton from "./ItemPlayButton.vue";
import { categoryMark } from "../utils/category-mark";
import { formatDateForGermanDisplay } from "../utils/date";
import type { DayPlannerHabitItem, DayPlannerItem } from "../types/day-planner";

const props = defineProps<{
  item: DayPlannerItem;
  isUpdating: boolean;
  /** Clock time shown in the leading column; null keeps the column empty. */
  time?: string | null;
  /** Shows the original day instead of a time, for items carried over. */
  showDate?: boolean;
  /** Replaces the item's own actions with the ones in the slot. */
  compact?: boolean;
}>();

const emit = defineEmits<{
  toggle: [item: DayPlannerItem];
  skip: [item: DayPlannerHabitItem];
  edit: [item: DayPlannerItem];
  move: [item: DayPlannerItem];
}>();

const isCompleted = computed(() => props.item.status === "completed");
const isSkipped = computed(() => props.item.status === "skipped");
const isResolved = computed(() => isCompleted.value || isSkipped.value);
const isPending = computed(() => props.item.status === "pending");

const canMove = computed(() => {
  if (!isPending.value) return false;
  if (props.item.type === "todo") return props.item.scheduledAt !== null;
  return (props.item.moveUntil ?? "") > props.item.scheduledDate;
});

const details = computed(() => {
  const parts: string[] = [];
  if (isSkipped.value) parts.push("Übersprungen");
  if (props.item.plannedDurationMinutes != null) {
    parts.push(
      props.item.workedMinutes > 0
        ? `${props.item.workedMinutes}/${props.item.plannedDurationMinutes} Min.`
        : `${props.item.plannedDurationMinutes} Min.`,
    );
  } else if (props.item.workedMinutes > 0) {
    parts.push(`${props.item.workedMinutes} Min. gearbeitet`);
  }
  if (props.item.type === "todo" && props.item.isFixed)
    parts.push("Fester Termin");
  if (props.item.goal) parts.push(`Ziel: ${props.item.goal.title}`);
  return parts;
});

const leading = computed(() =>
  props.showDate
    ? formatDateForGermanDisplay(props.item.scheduledDate).slice(0, 6)
    : (props.time ?? ""),
);

function skip(): void {
  if (props.item.type === "habit") emit("skip", props.item);
}
</script>

<template>
  <article
    class="planner-item"
    :class="{
      'planner-item--completed': isCompleted,
      'planner-item--skipped': isSkipped,
      'planner-item--overdue': item.isOverdue,
    }"
  >
    <span class="planner-item__time">{{ leading }}</span>

    <button
      class="planner-item__check"
      type="button"
      :disabled="isUpdating"
      :aria-busy="isUpdating || undefined"
      :aria-label="
        isResolved ? `${item.title} wieder öffnen` : `${item.title} erledigen`
      "
      @click="emit('toggle', item)"
    >
      <span class="planner-item__ring">
        <AppIcon v-if="isCompleted" name="check" />
      </span>
    </button>

    <div class="planner-item__content">
      <h3>
        <button
          class="planner-item__title"
          data-edit-button
          type="button"
          :disabled="isUpdating"
          :aria-label="`${item.title} bearbeiten`"
          @click="emit('edit', item)"
        >
          {{ item.title }}
        </button>
      </h3>
      <p
        v-if="item.categoryName || details.length"
        class="planner-item__details"
      >
        <span v-if="item.categoryName" class="planner-item__category">
          <i
            class="category-mark"
            :style="{ background: categoryMark(item.categoryName) }"
            aria-hidden="true"
          />{{ item.categoryName }}
        </span>
        <span v-for="part in details" :key="part">{{ part }}</span>
      </p>

      <div v-if="isPending && !compact" class="planner-item__actions">
        <ItemPlayButton
          :kind="item.type === 'todo' ? 'todo' : 'occurrence'"
          :target-id="item.type === 'todo' ? item.todoId : item.occurrenceId"
          :title="item.title"
          :duration="item.plannedDurationMinutes"
          :eligible="item.timerEligible"
          :disabled="isUpdating"
        />
        <button
          v-if="item.type === 'habit'"
          class="planner-item__action planner-item__skip-button"
          type="button"
          :disabled="isUpdating"
          :aria-label="`${item.title} überspringen`"
          @click="skip"
        >
          Überspringen
        </button>
        <button
          v-if="canMove"
          class="planner-item__action planner-item__move-button"
          data-move-button
          type="button"
          :disabled="isUpdating"
          :aria-label="`${item.title} verschieben`"
          @click="emit('move', item)"
        >
          Verschieben
        </button>
      </div>
    </div>
    <div v-if="compact && $slots.default" class="planner-item__quick">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.planner-item {
  display: grid;
  grid-template-columns: 2.75rem var(--tap) minmax(0, 1fr);
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-2) var(--space-4) var(--space-3) var(--space-3);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.planner-item__time {
  padding-top: 0.7rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.planner-item__check {
  display: grid;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-on-action);
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.planner-item__check:active:not(:disabled) {
  transform: scale(0.86);
  transition-duration: 90ms;
}

.planner-item__ring {
  display: grid;
  width: 1.875rem;
  height: 1.875rem;
  place-items: center;
  border: 2.5px solid var(--color-action);
  border-radius: 50%;
  transition:
    background-color 240ms var(--ease-out),
    border-color 240ms var(--ease-out);
}

.planner-item__ring :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 3;
  animation: check-pop 420ms var(--spring);
}

@keyframes check-pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}

.planner-item--completed .planner-item__ring {
  background: var(--color-action);
}

.planner-item--skipped .planner-item__ring {
  border-color: var(--color-ink-soft);
  border-style: dashed;
}

.planner-item__check:disabled {
  cursor: progress;
}

.planner-item__check:disabled .planner-item__ring {
  border-color: var(--color-ink-soft);
}

.planner-item__content {
  min-width: 0;
  padding-top: 0.55rem;
}

.planner-item__content h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.planner-item--completed h3,
.planner-item--skipped h3 {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.planner-item__details {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.planner-item__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

.planner-item__title {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 0.2em;
  cursor: pointer;
  transition: text-decoration-color 160ms var(--ease-out);
}

.planner-item__title:hover:not(:disabled) {
  text-decoration-color: var(--color-line);
}

.planner-item__title:disabled {
  cursor: progress;
}

.planner-item__actions:empty {
  display: none;
}

/* Carried-over rows: quick choices start at the time column, so all fit. */
.planner-item__quick {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1 / -1;
  gap: var(--space-2);
}

.planner-item__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-2);
}

.planner-item__action {
  min-height: var(--tap);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-action-tint);
  color: var(--color-action-strong);
  font-size: 0.9375rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.planner-item__action:active:not(:disabled) {
  transform: var(--press);
  transition-duration: 90ms;
}

.planner-item__action:disabled {
  color: var(--color-ink-soft);
  background: transparent;
  cursor: progress;
}
</style>
