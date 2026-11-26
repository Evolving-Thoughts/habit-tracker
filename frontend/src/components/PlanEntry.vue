<script setup lang="ts">
import { computed } from "vue";
import ActionMenu from "./ActionMenu.vue";
import AppIcon from "./AppIcon.vue";
import CampaignChip from "./CampaignChip.vue";
import ChallengeMark from "./ChallengeMark.vue";
import type { WeekPlanEntry } from "../types/week-plan";
import { onCardClick } from "../utils/card-click";
import { campaignMark as markOf } from "../utils/category-mark";
import { shortDate } from "../utils/history";
import type { MenuEntry } from "../utils/row-actions";
import { streakLine } from "../utils/streak";
import { isForecast, isMovable, isMovableRun } from "../utils/week-plan";

/**
 * One card of the Plan, compact enough for its narrowest columns. A quest
 * or a daily's run opens its editor from the title or a tap anywhere else
 * on the card, drags from anywhere onto its place or another day (a run
 * only once it is stored, and only within its window), and keeps every
 * other step in its menu "…". With the focus on the card (its title), the
 * arrow keys move it: up and down in the day, left and right a day
 * (`arrows`).
 */
const props = defineProps<{
  entry: WeekPlanEntry;
  /** A write is running: nothing starts until it is done. */
  busy: boolean;
  /** "Aktionen für …" of an open entry. */
  menu?: MenuEntry[];
  /** The focused card moves with the arrow keys (an entry on a day). */
  arrows?: boolean;
}>();

const emit = defineEmits<{
  edit: [];
  /** An arrow key on the focused card: up and down in the day, left and right a day. */
  arrow: [key: "up" | "down" | "left" | "right"];
}>();
function onArrow(event: KeyboardEvent, key: "up" | "down" | "left" | "right") {
  if (!props.arrows || props.busy) return;
  event.preventDefault();
  emit("arrow", key);
}

/** A Google event: read-only, it drags within its day but opens no editor. */
const event = computed(() => props.entry.type === "event");
const movable = computed(
  () => isMovable(props.entry) || isMovableRun(props.entry) || event.value,
);
function openFromCard(click: MouseEvent): void {
  if (!props.busy && !event.value) onCardClick(click, () => emit("edit"));
}
const done = computed(() => props.entry.status !== "pending");
/** A run the schedule only forecasts: planned, not there yet. */
const forecast = computed(() => isForecast(props.entry));

const details = computed(() => {
  const parts: string[] = [];
  const { entry } = props;
  if (entry.type === "habit") {
    const series = streakLine(entry.streak);
    if (series) parts.push(series);
  }
  if (entry.timeOfDay) parts.push(entry.timeOfDay.slice(0, 5));
  if (entry.plannedDurationMinutes != null)
    parts.push(`${entry.plannedDurationMinutes} Min.`);
  if (entry.type === "habit" && entry.status === "skipped")
    parts.push("Übersprungen");
  if (entry.type === "todo" && entry.isOverdue)
    parts.push(`seit ${shortDate(entry.scheduledDate)}`);
  if (entry.type === "event") parts.push("Google Kalender");
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
      'plan-entry--campaign': campaignMark,
      'plan-entry--event': event,
      'plan-entry--forecast': forecast,
      'card-target': true,
      'card-drag': movable,
    }"
    :style="campaignMark ? { '--campaign-mark': campaignMark } : undefined"
    @click="openFromCard"
  >
    <div class="plan-entry__body">
      <!-- The heading keeps the plain title; the button inside says "bearbeiten". -->
      <!-- Clamped to three lines; the tooltip and the names keep the full title. -->
      <h3 class="plan-entry__title" :aria-label="entry.title">
        <span v-if="event" class="plan-entry__event" :title="entry.title">{{
          entry.title
        }}</span>
        <button
          v-else
          class="plan-entry__edit"
          data-edit-button
          type="button"
          :disabled="busy"
          :aria-label="`${entry.title} bearbeiten`"
          :aria-keyshortcuts="
            arrows ? 'ArrowUp ArrowDown ArrowLeft ArrowRight' : undefined
          "
          :title="entry.title"
          @click="emit('edit')"
          @keydown.up="onArrow($event, 'up')"
          @keydown.down="onArrow($event, 'down')"
          @keydown.left="onArrow($event, 'left')"
          @keydown.right="onArrow($event, 'right')"
        >
          {{ entry.title }}
        </button>
      </h3>
      <p v-if="forecast" class="visually-hidden">
        Eingeplant; der Lauf entsteht an seinem Tag.
      </p>
      <p
        v-if="entry.type === 'habit' || details.length"
        class="plan-entry__details"
      >
        <span v-if="entry.type === 'habit'" class="plan-entry__daily">
          <AppIcon name="dailies" />Daily
        </span>
        <ChallengeMark
          v-if="entry.type === 'habit' && entry.monthChallenge"
        />
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

/* Planned, not there yet: no fill, a dashed edge inside the card. */
.plan-entry--forecast {
  background: transparent;
  outline: 1.5px dashed var(--color-line-strong);
  outline-offset: -1.5px;
}

/* A Google event: the flat white of appointments elsewhere, never a button. */
.plan-entry--event {
  background: var(--color-surface-flat);
}

/* The stripe names the campaign the entry works towards. */
.plan-entry--campaign {
  box-shadow: inset 0.3125rem 0 0 var(--campaign-mark);
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
