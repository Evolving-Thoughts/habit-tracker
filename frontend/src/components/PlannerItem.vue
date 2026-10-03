<script setup lang="ts">
import { computed } from "vue";
import {
  formatDateForGermanDisplay,
  formatTimeForGermanDisplay,
} from "../utils/date";
import type { DayPlannerHabitItem, DayPlannerItem } from "../types/day-planner";

const props = defineProps<{
  item: DayPlannerItem;
  isUpdating: boolean;
}>();

const emit = defineEmits<{
  toggle: [item: DayPlannerItem];
  skip: [item: DayPlannerHabitItem];
  edit: [item: DayPlannerItem];
}>();

const isCompleted = computed(() => {
  return props.item.status === "completed";
});

const isSkipped = computed(() => {
  return props.item.status === "skipped";
});

const statusLabel = computed(() => {
  if (isCompleted.value) {
    return "Erledigt";
  }

  if (isSkipped.value) {
    return "Übersprungen";
  }

  if (props.item.isOverdue) {
    return "Überfällig";
  }

  return "Offen";
});

const typeLabel = computed(() => {
  return props.item.type === "todo" ? "Todo" : "Habit";
});

function toggle(): void {
  emit("toggle", props.item);
}

function skip(): void {
  if (props.item.type !== "habit") {
    return;
  }

  emit("skip", props.item);
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
    <button
      class="planner-item__check"
      type="button"
      :disabled="isUpdating"
      :aria-label="
        isCompleted || isSkipped
          ? `${item.title} wieder öffnen`
          : `${item.title} erledigen`
      "
      @click="toggle"
    >
      <span v-if="isUpdating">…</span>
      <span v-else-if="isCompleted">✓</span>
      <span v-else-if="isSkipped">↩</span>
      <span v-else />
    </button>

    <div class="planner-item__content">
      <div class="planner-item__heading">
        <h3>{{ item.title }}</h3>

        <span
          class="planner-item__status"
          :class="{
            'planner-item__status--overdue': item.isOverdue,
            'planner-item__status--completed': isCompleted,
            'planner-item__status--skipped': isSkipped,
          }"
        >
          {{ statusLabel }}
        </span>
      </div>

      <div class="planner-item__metadata">
        <span>{{ typeLabel }}</span>

        <span>
          {{ formatDateForGermanDisplay(item.scheduledDate) }}
        </span>

        <span v-if="item.type === 'todo'">
          {{ formatTimeForGermanDisplay(item.scheduledAt) }}
        </span>

        <span
          v-if="item.type === 'todo' && item.plannedDurationMinutes !== null"
        >
          {{ item.plannedDurationMinutes }} Min.
        </span>

        <span v-if="item.type === 'todo' && item.isFixed"> Fester Termin </span>
      </div>

      <div
        v-if="item.type === 'habit' && item.status === 'pending'"
        class="planner-item__actions"
      >
        <button
          class="planner-item__skip-button"
          type="button"
          :disabled="isUpdating"
          @click="skip"
        >
          Überspringen
        </button>
      </div>
    </div>

    <button
      class="planner-item__edit"
      data-edit-button
      type="button"
      :disabled="isUpdating"
      :aria-label="`${item.title} bearbeiten`"
      title="Bearbeiten"
      @click="emit('edit', item)"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
        <path d="m14 5 5 5" />
      </svg>
    </button>
  </article>
</template>

<style scoped>
.planner-item {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  padding: 1rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #ffffff;
  box-shadow: 0 0.125rem 0.5rem rgb(15 23 42 / 6%);
  transition:
    border-color 150ms ease,
    opacity 150ms ease;
}

.planner-item--overdue {
  border-color: #f0a3a3;
}

.planner-item--completed,
.planner-item--skipped {
  opacity: 0.68;
}

.planner-item__check {
  display: grid;
  flex: 0 0 1.75rem;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  padding: 0;
  border: 2px solid #748096;
  border-radius: 50%;
  background: transparent;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
}

.planner-item--completed .planner-item__check {
  border-color: #198754;
  background: #198754;
}

.planner-item--skipped .planner-item__check {
  border-color: #7a8496;
  background: #7a8496;
}

.planner-item__check:disabled,
.planner-item__skip-button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.planner-item__content {
  min-width: 0;
  flex: 1;
}

.planner-item__heading {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  justify-content: space-between;
}

.planner-item__heading h3 {
  margin: 0;
  color: #182033;
  font-size: 1rem;
  line-height: 1.4;
}

.planner-item--completed h3,
.planner-item--skipped h3 {
  text-decoration: line-through;
}

.planner-item__status {
  flex-shrink: 0;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: #eef1f5;
  color: #536079;
  font-size: 0.75rem;
  font-weight: 600;
}

.planner-item__status--overdue {
  background: #ffe8e8;
  color: #b42318;
}

.planner-item__status--completed {
  background: #def7e7;
  color: #146c43;
}

.planner-item__status--skipped {
  background: #eceef2;
  color: #626b7a;
}

.planner-item__metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.75rem;
  margin-top: 0.5rem;
  color: #697386;
  font-size: 0.8125rem;
}

.planner-item__metadata span + span::before {
  margin-right: 0.75rem;
  color: #bcc2cc;
  content: "•";
}

.planner-item__actions {
  margin-top: 0.75rem;
}

.planner-item__skip-button {
  padding: 0;
  border: 0;
  background: transparent;
  color: #59657a;
  font: inherit;
  font-size: 0.8125rem;
  text-decoration: underline;
  cursor: pointer;
}

.planner-item__edit {
  display: grid;
  flex: 0 0 2.75rem;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0.625rem;
  background: transparent;
  color: #697386;
  cursor: pointer;
}

.planner-item__edit:hover:not(:disabled) {
  background: #eef1f5;
}

.planner-item__edit:disabled {
  opacity: 0.5;
  cursor: wait;
}

.planner-item__edit svg {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
