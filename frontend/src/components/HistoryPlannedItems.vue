<script lang="ts">
import type { HistoryPlannedItem } from "../types/history";
import type { MenuEntry } from "../utils/row-actions";

/** What the calendar lets a planned row do; the view owns every write. */
export type PlannedActions = {
  /** Open quests and today's Daily runs get the ring, ticked like on Heute. */
  checkable: (item: HistoryPlannedItem) => boolean;
  complete: (item: HistoryPlannedItem) => void;
  /** The title opens the editor where the entry is stored. */
  editable: (item: HistoryPlannedItem) => boolean;
  edit: (item: HistoryPlannedItem) => void;
  /** "Aktionen für …": quick moves, "Anderer Tag …" and "Bearbeiten". */
  menu: (item: HistoryPlannedItem) => MenuEntry[];
  /** ▶ on an open quest and on a daily run that is due. */
  measure: (item: HistoryPlannedItem) => {
    kind: "todo" | "occurrence";
    targetId: number;
    eligible: boolean;
  } | null;
  busy: (item: HistoryPlannedItem) => boolean;
};
</script>

<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import CampaignChip from "./CampaignChip.vue";
import ItemRow from "./ItemRow.vue";
import { campaignMark, categoryMark } from "../utils/category-mark";
import { shortDate } from "../utils/history";

const props = defineProps<{
  items: HistoryPlannedItem[];
  /** Without it the list is read-only. */
  actions?: PlannedActions;
}>();

function details(item: HistoryPlannedItem): string[] {
  const parts: string[] = [];
  if (item.id === null) parts.push("voraussichtlich");
  if (item.isOverdue)
    parts.push(`noch offen seit ${shortDate(item.scheduledDate)}`);
  if (item.type === "todo" && item.timeOfDay)
    parts.push(`Termin um ${item.timeOfDay} Uhr`);
  if (item.plannedDurationMinutes !== null)
    parts.push(`${item.plannedDurationMinutes} Min. geplant`);
  return parts;
}

const can = <K extends "checkable" | "editable">(
  kind: K,
  item: HistoryPlannedItem,
) => props.actions?.[kind](item) ?? false;
/* Rows without a ring keep its place, so all titles of the list line up. */
const anyCheckable = computed(() =>
  props.items.some((item) => can("checkable", item)),
);
</script>

<template>
  <ul class="planned-items">
    <li
      v-for="item in items"
      :key="item.key"
      class="planned-item"
      :data-focus-key="item.key"
    >
      <ItemRow
        :title="item.title"
        :checkable="can('checkable', item)"
        :keep-ring-column="anyCheckable"
        :editable="can('editable', item)"
        :busy="actions?.busy(item) ?? false"
        :campaign-mark="campaignMark(item.campaign)"
        :measure="actions?.measure(item) ?? null"
        :menu="actions?.menu(item) ?? []"
        @toggle="actions?.complete(item)"
        @edit="actions?.edit(item)"
      >
        <template
          v-if="
            item.type === 'habit' ||
            item.categoryName ||
            details(item).length ||
            item.campaign
          "
          #meta
        >
          <!-- A Daily says so first, as on Heute and in the Plan. -->
          <span v-if="item.type === 'habit'" class="planned-item__daily">
            <AppIcon name="dailies" />Daily
          </span>
          <span v-if="item.categoryName" class="planned-item__category">
            <i
              class="planned-item__mark"
              :style="{
                background: categoryMark(item.categoryName, item.categoryColor),
              }"
              aria-hidden="true"
            />{{ item.categoryName }}
          </span>
          <span v-for="part in details(item)" :key="part">{{ part }}</span>
          <CampaignChip v-if="item.campaign" :campaign="item.campaign" />
        </template>
        <template v-if="item.why" #below>
          <p class="planned-item__why">{{ item.why }}</p>
        </template>
      </ItemRow>
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

.planned-item {
  min-width: 0;
}

.planned-item__why {
  margin: 0.1rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.planned-item__daily {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  font-weight: 700;
}

.planned-item__daily :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
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
</style>
