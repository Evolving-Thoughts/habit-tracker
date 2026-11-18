<script setup lang="ts">
import { computed } from "vue";
import ActionMenu from "./ActionMenu.vue";
import AppIcon from "./AppIcon.vue";
import type { WeekPlanEntry } from "../types/week-plan";
import { campaignMark as markOf } from "../utils/category-mark";
import { shortDate } from "../utils/history";
import type { MenuEntry } from "../utils/row-actions";
import { isMovable } from "../utils/week-plan";

/**
 * One row of the week plan, compact enough for seven columns. A quest opens
 * its editor from the title; its grip is the one move control: drag it, step
 * it with the arrow keys, or tap it to pick another day. A daily is a fixed
 * row the plan only shows. In the Questlog column the grip only drags; the
 * keyboard plans through the row's menu instead.
 */
const props = defineProps<{
  entry: WeekPlanEntry;
  /** A write is running: nothing starts until it is done. */
  busy: boolean;
  /** "Aktionen für …" beside the grip, as in the Questlog column. */
  menu?: MenuEntry[];
  /** The grip is only a drag handle; the menu is the way for keys and taps. */
  dragOnly?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  move: [];
  /** The grip's arrow keys: up and down in the day, left and right a day. */
  arrow: [key: "up" | "down" | "left" | "right"];
}>();

const movable = computed(() => isMovable(props.entry));
const done = computed(() => props.entry.status !== "pending");

const details = computed(() => {
  const parts: string[] = [];
  const { entry } = props;
  if (entry.timeOfDay) parts.push(entry.timeOfDay.slice(0, 5));
  if (entry.plannedDurationMinutes != null)
    parts.push(`${entry.plannedDurationMinutes} Min.`);
  if (entry.type === "habit" && entry.status === "skipped")
    parts.push("Übersprungen");
  if (entry.type === "todo" && entry.isOverdue)
    parts.push(`seit ${shortDate(entry.scheduledDate)}`);
  return parts;
});

/** Every campaign has its own quiet colour, as on Heute. */
const campaignMark = computed(() => markOf(props.entry.campaign));
/** A campaign's own quest wears its stripe but does not repeat its name. */
const campaignName = computed(() => {
  const { entry } = props;
  if (!entry.campaign) return null;
  return entry.type === "todo" && entry.campaign.id === entry.todoId
    ? null
    : entry.campaign.title;
});
</script>

<template>
  <article
    class="plan-entry"
    :class="{
      'plan-entry--done': done,
      'plan-entry--daily': entry.type === 'habit',
      'plan-entry--campaign': campaignMark,
    }"
    :style="campaignMark ? { '--campaign-mark': campaignMark } : undefined"
  >
    <div class="plan-entry__body">
      <!-- The heading keeps the plain title; the button inside says "bearbeiten". -->
      <h3 class="plan-entry__title" :aria-label="entry.title">
        <button
          v-if="entry.type === 'todo'"
          class="plan-entry__edit"
          data-edit-button
          type="button"
          :disabled="busy"
          :aria-label="`${entry.title} bearbeiten`"
          @click="emit('edit')"
        >
          {{ entry.title }}
        </button>
        <template v-else>{{ entry.title }}</template>
      </h3>
      <p
        v-if="entry.type === 'habit' || details.length || campaignName"
        class="plan-entry__details"
      >
        <span v-if="entry.type === 'habit'" class="plan-entry__daily">
          <AppIcon name="dailies" />Daily
        </span>
        <span v-for="part in details" :key="part">{{ part }}</span>
        <span v-if="campaignName" class="plan-entry__campaign">
          {{ campaignName }}
        </span>
      </p>
      <span
        v-if="movable && dragOnly"
        class="plan-entry__grip plan-entry__grip--drag sort-handle"
        aria-hidden="true"
        title="Auf einen Tag ziehen"
      >
        <AppIcon name="grip" />
      </span>
      <button
        v-else-if="movable"
        class="plan-entry__grip sort-handle"
        type="button"
        :disabled="busy"
        :aria-label="`${entry.title} verschieben`"
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
        title="Ziehen, antippen oder mit den Pfeiltasten verschieben"
        @click="emit('move')"
        @keydown.up.prevent="emit('arrow', 'up')"
        @keydown.down.prevent="emit('arrow', 'down')"
        @keydown.left.prevent="emit('arrow', 'left')"
        @keydown.right.prevent="emit('arrow', 'right')"
      >
        <AppIcon name="grip" />
      </button>
      <div v-if="menu?.length" class="plan-entry__menu">
        <ActionMenu :title="entry.title" :entries="menu" :disabled="busy" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.plan-entry {
  container-type: inline-size;
  border-radius: var(--radius-control);
  background: var(--color-surface);
}

/* The stripe names the campaign the entry works towards. */
.plan-entry--campaign {
  box-shadow: inset 0.3125rem 0 0 var(--campaign-mark);
}

/* A daily is planned by its schedule: it lies flatter than a quest. */
.plan-entry--daily {
  background: var(--color-surface-flat);
}

/*
 * Narrow columns give the title the whole width and put the grip beside the
 * details; a wide row (a phone's single day) keeps the grip on the right.
 */
.plan-entry__body {
  display: grid;
  grid-template-areas:
    "title title"
    "details grip";
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: var(--tap);
  padding: var(--space-2) var(--space-1) var(--space-2) var(--space-3);
}

.plan-entry__body:has(.plan-entry__grip) {
  padding-bottom: 0;
}

@container (min-width: 15rem) {
  .plan-entry__body,
  .plan-entry__body:has(.plan-entry__grip) {
    grid-template-areas:
      "title grip"
      "details grip";
    align-content: center;
    padding-block: var(--space-2);
  }

  .plan-entry__body:has(.plan-entry__grip) {
    padding-block: var(--space-1);
  }
}

/* Without details the grip sits beside the title at any width. */
.plan-entry__body:not(:has(.plan-entry__details)) {
  grid-template-areas: "title grip";
  padding-block: var(--space-1);
}

/* With a menu (the Questlog column) the menu follows the grip. */
.plan-entry__body:has(.plan-entry__menu) {
  grid-template-areas:
    "title title title"
    "details grip menu";
  grid-template-columns: minmax(0, 1fr) auto auto;
  padding-bottom: 0;
}

.plan-entry__body:has(.plan-entry__menu):not(:has(.plan-entry__details)) {
  grid-template-areas:
    "title title title"
    ". grip menu";
  padding-bottom: 0;
}

.plan-entry__menu {
  grid-area: menu;
}

.plan-entry__title {
  grid-area: title;
  margin: 0;
  padding-right: var(--space-2);
  color: var(--color-ink);
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: anywhere;
  /* Long German words break at a syllable in the narrow columns. */
  hyphens: auto;
}

.plan-entry--done .plan-entry__title {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.plan-entry__edit {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: inherit;
  cursor: pointer;
}

.plan-entry__edit:hover:not(:disabled) {
  text-decoration: underline;
  text-decoration-color: var(--color-line);
  text-underline-offset: 0.2em;
}

.plan-entry--done .plan-entry__edit:hover:not(:disabled) {
  text-decoration: line-through;
}

.plan-entry__edit:disabled {
  cursor: progress;
}

.plan-entry__details {
  display: flex;
  flex-wrap: wrap;
  grid-area: details;
  gap: 0 var(--space-2);
  min-width: 0;
  margin: 0.125rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.plan-entry__daily {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  font-weight: 700;
}

.plan-entry__daily :deep(svg) {
  width: 0.875rem;
  height: 0.875rem;
}

.plan-entry__campaign {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.plan-entry__grip {
  display: grid;
  grid-area: grip;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink-soft);
  cursor: grab;
  /* A finger on the grip moves the quest; it must not scroll the board. */
  touch-action: none;
  transition: transform 420ms var(--spring);
}

.plan-entry__grip:hover:not(:disabled) {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.plan-entry__grip:active:not(:disabled) {
  cursor: grabbing;
  transform: var(--press);
  transition-duration: 90ms;
}

.plan-entry__grip:disabled {
  cursor: progress;
}

.plan-entry__grip--drag:hover {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.plan-entry__grip :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}
</style>
