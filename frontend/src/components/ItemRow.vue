<script setup lang="ts">
import { computed } from "vue";
import ActionMenu from "./ActionMenu.vue";
import CheckRing from "./CheckRing.vue";
import ItemPlayButton from "./ItemPlayButton.vue";
import { timerStateOf, useTimer } from "../composables/useTimer";
import { onCardClick } from "../utils/card-click";
import type { MenuEntry } from "../utils/row-actions";

/**
 * The one row for quests and dailies (DESIGN.md › Karten): an optional
 * leading column (time or date), the ring where the item can be done, the
 * title that opens the editor with its meta line, ▶ where measuring makes
 * sense, and every other action in one menu "Aktionen für …". A tap
 * anywhere else on the card opens the editor too; where the list sorts,
 * the whole card drags.
 */
const props = withDefaults(
  defineProps<{
    title: string;
    headingLevel?: 2 | 3 | 4;
    state?: "open" | "completed" | "skipped";
    /** Shows the ring; read-only rows leave it out. */
    checkable?: boolean;
    /** Without a ring, keeps its column, so titles line up in a mixed list. */
    keepRingColumn?: boolean;
    /**
     * A daily's run the schedule only forecasts on a later day: planned,
     * not there yet. A dashed edge without fill, like a place held open.
     */
    forecast?: boolean;
    /** The ring's spoken name; "<title> erledigen" or "… wieder öffnen" by default. */
    checkLabel?: string;
    /** Passed to the ring as aria-pressed, where a list reads it so. */
    ringPressed?: boolean;
    /** The title, and a tap anywhere else on the card, open the editor. */
    editable?: boolean;
    /** The list drags the whole card (`useSortable`). */
    draggable?: boolean;
    /** A write runs for this row: its controls wait. */
    busy?: boolean;
    /** The campaign's mark: a stripe on the left. */
    campaignMark?: string | null;
    /** Where measuring makes sense: what the ▶ starts. */
    measure?: {
      kind: "todo" | "occurrence";
      targetId: number | null;
      eligible: boolean;
    } | null;
    menu?: MenuEntry[];
    menuKey?: string | number;
    /**
     * The meta line wraps on a phone too, instead of ending in one line:
     * for lists where every part counts (Heute, the Kalender's day lists).
     */
    wrapMeta?: boolean;
  }>(),
  {
    headingLevel: 3,
    state: "open",
    checkable: true,
    keepRingColumn: false,
    forecast: false,
    checkLabel: undefined,
    ringPressed: undefined,
    editable: true,
    draggable: false,
    busy: false,
    campaignMark: null,
    measure: null,
    menu: () => [],
    menuKey: undefined,
    wrapMeta: false,
  },
);

const emit = defineEmits<{ toggle: []; edit: [] }>();

const resolved = computed(() => props.state !== "open");
const ringLabel = computed(
  () =>
    props.checkLabel ??
    (resolved.value
      ? `${props.title} wieder öffnen`
      : `${props.title} erledigen`),
);

function openFromCard(event: MouseEvent): void {
  if (props.editable && !props.busy) onCardClick(event, () => emit("edit"));
}

/* The row whose stopwatch runs says so in words, not only by its button. */
const controller = useTimer();
const timerState = computed(() => timerStateOf(controller, props.measure));
</script>

<template>
  <article
    class="item-row"
    :class="{
      'item-row--completed': state === 'completed',
      'item-row--skipped': state === 'skipped',
      'item-row--campaign': campaignMark,
      'item-row--leading': $slots.leading,
      'item-row--wrap-meta': wrapMeta,
      'item-row--forecast': forecast,
      'card-target': editable,
      'card-drag': draggable,
    }"
    :style="campaignMark ? { '--campaign-mark': campaignMark } : undefined"
    @click="openFromCard"
  >
    <div class="item-row__main">
      <div v-if="$slots.leading" class="item-row__leading">
        <slot name="leading" />
      </div>
      <CheckRing
        v-if="checkable"
        :checked="state === 'completed'"
        :skipped="state === 'skipped'"
        :label="ringLabel"
        :disabled="busy"
        :busy="busy"
        :aria-pressed="ringPressed"
        @toggle="emit('toggle')"
      />
      <span
        v-else-if="keepRingColumn"
        class="item-row__ring-space"
        aria-hidden="true"
      />
      <div class="item-row__content">
        <!-- The heading keeps the plain title; the button inside says "bearbeiten". -->
        <component
          :is="`h${headingLevel}`"
          class="item-row__heading"
          :aria-label="title"
        >
          <button
            v-if="editable"
            class="item-row__title"
            data-edit-button
            type="button"
            :disabled="busy"
            :aria-label="`${title} bearbeiten`"
            @click="emit('edit')"
          >
            {{ title }}
          </button>
          <template v-else>{{ title }}</template>
        </component>
        <p v-if="forecast" class="visually-hidden">
          Eingeplant; der Lauf entsteht an seinem Tag.
        </p>
        <p v-if="$slots.meta || timerState" class="item-row__meta">
          <span v-if="timerState" class="item-row__running">
            <i aria-hidden="true" />{{
              timerState === "running" ? "läuft" : "pausiert"
            }}
          </span>
          <slot name="meta" />
        </p>
        <slot name="below" />
      </div>
      <div v-if="measure || menu.length" class="item-row__end">
        <ItemPlayButton
          v-if="measure && !resolved"
          :kind="measure.kind"
          :target-id="measure.targetId"
          :title="title"
          :eligible="measure.eligible"
          :disabled="busy"
        />
        <ActionMenu
          v-if="menu.length"
          :title="title"
          :entries="menu"
          :disabled="busy"
          :trigger-key="menuKey"
        />
      </div>
    </div>
    <div v-if="$slots.default" class="item-row__extra">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.item-row {
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-1);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

/*
 * Planned, not there yet: no fill, a dashed edge in strong line ink (inside
 * the card, so nothing shifts). Shape says it, not a colour.
 */
.item-row--forecast {
  background: transparent;
  outline: 1.5px dashed var(--color-line-strong);
  outline-offset: -1.5px;
}

/* The stripe names the campaign the item works towards. */
.item-row--campaign {
  box-shadow: inset 0.3125rem 0 0 var(--campaign-mark);
}

/* Room for the stripe on every row, so rings line up with and without one. */
.item-row:not(.item-row--leading) {
  padding-left: calc(var(--space-1) + 0.3125rem);
}

/* Holds the ring's place where the neighbours have one. */
.item-row__ring-space {
  flex: none;
  width: var(--tap);
}

.item-row__main {
  display: flex;
  align-items: flex-start;
}

.item-row__leading {
  display: grid;
  flex: none;
  width: 2.75rem;
  min-height: var(--tap);
  place-items: center;
}

.item-row__content {
  flex: 1;
  min-width: 0;
  /* The first line sits on the ring's middle. */
  padding: 0.55rem var(--space-1) 0.45rem var(--space-1);
}

/* A row without ring and leading column keeps its text off the card's edge. */
.item-row__content:first-child {
  padding-left: var(--space-3);
}

.item-row__heading {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.item-row--completed .item-row__heading,
.item-row--skipped .item-row__heading {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.item-row__title {
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

.item-row__title:hover:not(:disabled) {
  text-decoration-color: var(--color-line);
}

.item-row__title:disabled {
  cursor: progress;
}

/*
 * A finger's target: the title button reaches a tap high around its line,
 * invisibly (the whole card opens the editor too; this is the button's own).
 */
@media (pointer: coarse) {
  .item-row__title {
    position: relative;
  }

  .item-row__title::after {
    position: absolute;
    inset: calc((var(--tap) - 1lh) / -2) 0;
    content: "";
  }
}

.item-row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: 0.1rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  /*
   * Its parts must not widen the list it sits in: a long campaign name
   * ends in an ellipsis within the row (the chip never breaks its name).
   */
  contain: inline-size;
}

/*
 * A phone keeps the meta line to one line, so a row stays short; the last
 * part (usually the campaign, also named by the stripe) ends in an ellipsis.
 * Lists where every part counts opt out with `wrapMeta`.
 */
@media (max-width: 39.99rem) {
  .item-row:not(.item-row--wrap-meta) .item-row__meta {
    flex-wrap: nowrap;
    overflow: hidden;
    white-space: nowrap;
  }

  .item-row:not(.item-row--wrap-meta) .item-row__meta > *,
  .item-row:not(.item-row--wrap-meta) .item-row__meta :slotted(*) {
    flex: none;
  }

  .item-row:not(.item-row--wrap-meta) .item-row__meta :slotted(:last-child) {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

/* "läuft" is a state, so it speaks in ink, never in orange. */
.item-row__running {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  color: var(--color-ink);
  font-weight: 800;
}

.item-row__running i {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-ink);
  animation: item-row-pulse 1.6s var(--ease-out) infinite alternate;
}

@keyframes item-row-pulse {
  to {
    opacity: 0.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .item-row__running i {
    animation: none;
  }
}

.item-row__end {
  display: flex;
  flex: none;
  align-items: center;
}

/* Extra choices (the catch-up chips) start at the left edge, so all fit. */
.item-row__extra {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0 var(--space-2) var(--space-2);
}
</style>
