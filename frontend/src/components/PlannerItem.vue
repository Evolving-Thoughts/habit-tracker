<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import ItemRow from "./ItemRow.vue";
import { campaignMark as markOf, categoryMark } from "../utils/category-mark";
import { formatDateForGermanDisplay } from "../utils/date";
import type { MenuEntry } from "../utils/row-actions";
import type { DayPlannerItem } from "../types/day-planner";

/**
 * A row of Heute on the shared row (ItemRow): ring, title with its meta
 * line, ▶ and the menu the view builds. Carried-over rows are compact and
 * show the view's chips instead of ▶ and the menu.
 */
const props = defineProps<{
  item: DayPlannerItem;
  isUpdating: boolean;
  /** Clock time shown in the leading column; null keeps the column empty. */
  time?: string | null;
  /** Shows the original day instead of a time, for items carried over. */
  showDate?: boolean;
  /** Replaces ▶ and the menu with the choices in the slot. */
  compact?: boolean;
  /** Shows a grip in the leading column: drag it, or use the arrow keys. */
  sortable?: boolean;
  /** "Aktionen für …": everything beyond ring, title and ▶. */
  menu?: MenuEntry[];
}>();

const emit = defineEmits<{
  toggle: [item: DayPlannerItem];
  edit: [item: DayPlannerItem];
  /** The grip's arrow keys: one place up (-1) or down (1). */
  shift: [item: DayPlannerItem, direction: -1 | 1];
}>();

const state = computed(() =>
  props.item.status === "completed"
    ? "completed"
    : props.item.status === "skipped"
      ? "skipped"
      : "open",
);

const details = computed(() => {
  const parts: string[] = [];
  if (state.value === "skipped") parts.push("Übersprungen");
  if (props.item.plannedDurationMinutes != null) {
    parts.push(
      props.item.workedMinutes > 0
        ? `${props.item.workedMinutes}/${props.item.plannedDurationMinutes} Min.`
        : `${props.item.plannedDurationMinutes} Min.`,
    );
  } else if (props.item.workedMinutes > 0) {
    parts.push(`${props.item.workedMinutes} Min. gearbeitet`);
  }
  if (props.item.type === "todo" && props.item.timeOfDay)
    parts.push("Termin");
  return parts;
});

/** Every campaign has its own quiet colour, like categories do. */
const campaignMark = computed(() => markOf(props.item.campaign));

const leading = computed(() =>
  props.showDate
    ? formatDateForGermanDisplay(props.item.scheduledDate).slice(0, 6)
    : (props.time ?? ""),
);

const measure = computed(() =>
  props.compact
    ? null
    : {
        kind:
          props.item.type === "todo"
            ? ("todo" as const)
            : ("occurrence" as const),
        targetId:
          props.item.type === "todo"
            ? props.item.todoId
            : props.item.occurrenceId,
        eligible: props.item.timerEligible,
      },
);
</script>

<template>
  <ItemRow
    class="planner-item"
    :class="{ 'planner-item--overdue': item.isOverdue }"
    :title="item.title"
    :state="state"
    :busy="isUpdating"
    :campaign-mark="campaignMark"
    :measure="measure"
    :menu="compact || state !== 'open' ? [] : (menu ?? [])"
    @toggle="emit('toggle', item)"
    @edit="emit('edit', item)"
  >
    <template v-if="sortable || leading" #leading>
      <button
        v-if="sortable"
        class="planner-item__grip sort-handle"
        type="button"
        :disabled="isUpdating"
        :aria-label="`${item.title} in der Reihenfolge verschieben`"
        title="Ziehen oder mit den Pfeiltasten verschieben"
        @keydown.up.prevent="emit('shift', item, -1)"
        @keydown.down.prevent="emit('shift', item, 1)"
      >
        <AppIcon name="grip" />
      </button>
      <span v-else class="planner-item__time">{{ leading }}</span>
    </template>
    <template v-if="item.categoryName || details.length || item.campaign" #meta>
      <span v-if="item.categoryName" class="planner-item__category">
        <i
          class="category-mark"
          :style="{ background: categoryMark(item.categoryName) }"
          aria-hidden="true"
        />{{ item.categoryName }}
      </span>
      <span v-for="part in details" :key="part">{{ part }}</span>
      <span v-if="item.campaign" class="planner-item__campaign">
        {{ item.campaign.title }}
      </span>
    </template>
    <template v-if="compact && $slots.default" #default>
      <slot />
    </template>
  </ItemRow>
</template>

<style scoped>
.planner-item__campaign {
  font-weight: 700;
}

.planner-item__grip {
  display: grid;
  width: 2.75rem;
  height: var(--tap);
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink-soft);
  cursor: grab;
  /* A finger on the grip sorts; it must not scroll the page instead. */
  touch-action: none;
}

.planner-item__grip:active {
  cursor: grabbing;
}

.planner-item__grip :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

.planner-item__time {
  align-self: start;
  padding-top: 0.7rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
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
</style>
