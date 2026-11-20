<script setup lang="ts">
import { computed } from "vue";
import ActionMenu from "./ActionMenu.vue";
import AppIcon from "./AppIcon.vue";
import CampaignChip from "./CampaignChip.vue";
import type { WeekPlanEntry } from "../types/week-plan";
import { onCardClick } from "../utils/card-click";
import { campaignMark as markOf } from "../utils/category-mark";
import { shortDate } from "../utils/history";
import type { MenuEntry } from "../utils/row-actions";
import { isMovable } from "../utils/week-plan";

/**
 * One card of the week plan, compact enough for seven columns. A quest
 * opens its editor from the title or a tap anywhere else on the card, drags
 * from anywhere onto its place or another day, and keeps every other step
 * in its menu "…" (the keyboard's way to move it). A daily is a fixed row
 * the plan only shows.
 */
const props = defineProps<{
  entry: WeekPlanEntry;
  /** A write is running: nothing starts until it is done. */
  busy: boolean;
  /** "Aktionen für …" of an open quest. */
  menu?: MenuEntry[];
}>();

const emit = defineEmits<{ edit: [] }>();

const movable = computed(() => isMovable(props.entry));
const editable = computed(() => props.entry.type === "todo");
function openFromCard(event: MouseEvent): void {
  if (editable.value && !props.busy) onCardClick(event, () => emit("edit"));
}
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

/** Every campaign has its own colour, as on Heute. */
const campaignMark = computed(() => markOf(props.entry.campaign));
/** A campaign's own quest wears its stripe but does not repeat its name. */
const campaign = computed(() => {
  const { entry } = props;
  return entry.type === "todo" && entry.campaign?.id === entry.todoId
    ? null
    : entry.campaign;
});
</script>

<template>
  <article
    class="plan-entry"
    :class="{
      'plan-entry--done': done,
      'plan-entry--daily': entry.type === 'habit',
      'plan-entry--campaign': campaignMark,
      'card-target': editable,
      'card-drag': movable,
    }"
    :style="campaignMark ? { '--campaign-mark': campaignMark } : undefined"
    @click="openFromCard"
  >
    <div class="plan-entry__body">
      <!-- The heading keeps the plain title; the button inside says "bearbeiten". -->
      <!-- Clamped to three lines; the tooltip and the names keep the full title. -->
      <h3
        class="plan-entry__title"
        :aria-label="entry.title"
        :title="entry.type === 'todo' ? undefined : entry.title"
      >
        <button
          v-if="entry.type === 'todo'"
          class="plan-entry__edit"
          data-edit-button
          type="button"
          :disabled="busy"
          :aria-label="`${entry.title} bearbeiten`"
          :title="entry.title"
          @click="emit('edit')"
        >
          {{ entry.title }}
        </button>
        <template v-else>{{ entry.title }}</template>
      </h3>
      <p
        v-if="entry.type === 'habit' || details.length"
        class="plan-entry__details"
      >
        <span v-if="entry.type === 'habit'" class="plan-entry__daily">
          <AppIcon name="dailies" />Daily
        </span>
        <span v-for="part in details" :key="part">{{ part }}</span>
      </p>
      <!-- Icon and name; a long name ends in an ellipsis, its tooltip names it. -->
      <p v-if="campaign" class="plan-entry__campaign">
        <CampaignChip :campaign="campaign" />
      </p>
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
 * Narrow columns give the title and the campaign the whole width and put
 * the menu below them, beside the details if there are any: a button beside
 * the title would leave a desktop column too little room for one German
 * word. A wide card (a phone's single day) keeps the menu on the right and
 * the campaign on the details' line.
 */
.plan-entry__body {
  display: grid;
  grid-template-areas:
    "title title"
    "campaign campaign"
    "details menu";
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  min-height: var(--tap);
  padding: var(--space-2) var(--space-1) var(--space-2) 0.625rem;
}

.plan-entry__body:has(.plan-entry__menu) {
  padding-bottom: 0;
}

@container (min-width: 15rem) {
  .plan-entry__body,
  .plan-entry__body:has(.plan-entry__menu) {
    grid-template-areas:
      "title title menu"
      "details campaign menu";
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-content: center;
    padding-block: var(--space-2);
    padding-left: var(--space-3);
  }

  .plan-entry__body:has(.plan-entry__menu) {
    padding-block: var(--space-1);
  }

  .plan-entry__details + .plan-entry__campaign {
    margin-left: var(--space-2);
  }
}

.plan-entry__menu {
  grid-area: menu;
}

/*
 * Titles wrap between words; only a word longer than the whole line breaks
 * inside. Hyphenation helps where the platform has a German dictionary
 * (Android, macOS); desktop Chromium on Windows has none, so the columns are
 * wide enough not to need it. Three lines at most, then an ellipsis.
 */
.plan-entry__title {
  display: -webkit-box;
  overflow: hidden;
  grid-area: title;
  margin: 0;
  padding-right: 0.125rem;
  color: var(--color-ink);
  font-size: 0.9375rem;
  font-weight: 700;
  line-height: 1.3;
  overflow-wrap: break-word;
  hyphens: auto;
  /* Only long compounds; a short word moves to the next line whole. */
  hyphenate-limit-chars: 10 4 4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

/* The narrowest desktop columns: a step smaller, so common words still fit. */
@container (max-width: 8.25rem) {
  .plan-entry__title {
    font-size: 0.875rem;
  }
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

/* "seit 16. Nov." stays one piece; the parts wrap as wholes. */
.plan-entry__details > span {
  white-space: nowrap;
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
  display: flex;
  grid-area: campaign;
  min-width: 0;
  margin: 0.25rem 0 0;
}
</style>
