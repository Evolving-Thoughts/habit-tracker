<script setup lang="ts">
import { computed, ref } from "vue";
import { campaignMark } from "../utils/category-mark";
import { formatDuration } from "../utils/today-agenda";
import { againstTargetParts, type CampaignTile } from "../utils/quest-hours";
import {
  goalWords,
  questDay,
  readyToComplete,
  runningGoal,
} from "../utils/campaign-next";
import { getCurrentDateInTimeZone } from "../utils/date";
import { questWord } from "../utils/todo-hierarchy";
import type { MenuEntry } from "../utils/row-actions";
import ActionMenu from "./ActionMenu.vue";
import AppIcon from "./AppIcon.vue";
import ItemPlayButton from "./ItemPlayButton.vue";
import QuestTrend from "./QuestTrend.vue";

const props = defineProps<{
  tiles: CampaignTile[];
  /** The Monday of each trend week, oldest first. */
  starts: string[];
  /** False while the quest hours are not loaded: no numbers then. */
  counted: boolean;
  /** A write is running: the buttons wait. */
  busy?: boolean;
  /** Done as shown, while a tap on "Abschließen" is still being saved. */
  completed?: (tile: CampaignTile) => boolean;
  /** Today's date, for "heute" and "morgen" beside the next quest. */
  today?: string;
}>();
const emit = defineEmits<{
  open: [id: number];
  /** "Abschließen" or "Wieder öffnen" on a tile or in its "…". */
  complete: [tile: CampaignTile];
  /** "Bearbeiten" in a tile's "…". */
  edit: [tile: CampaignTile];
  /** The dashed tile after the active ones. */
  create: [];
}>();

const tab = ref<"active" | "done">("active");
const done = (tile: CampaignTile): boolean =>
  props.completed?.(tile) ?? tile.todo.completed;
const shown = computed(() =>
  props.tiles.filter((tile) => tile.todo.completed === (tab.value === "done")),
);
const markOf = (tile: CampaignTile): string =>
  campaignMark({ title: tile.todo.title, color: tile.color })!;
const share = (tile: CampaignTile): number =>
  Math.min(100, (tile.minutes / tile.weeklyTargetMinutes!) * 100);

/* Fortschritt is the server's, as on the campaign's page: the quests below it. */
const hasQuests = (tile: CampaignTile): boolean =>
  tile.todo.progress.todoCount > 0;
const allDone = (tile: CampaignTile): boolean =>
  hasQuests(tile) &&
  tile.todo.progress.doneCount === tile.todo.progress.todoCount;
const questShare = (tile: CampaignTile): number =>
  (tile.todo.progress.doneCount / tile.todo.progress.todoCount) * 100;
const questCount = (tile: CampaignTile): string =>
  `${tile.todo.progress.doneCount} von ${tile.todo.progress.todoCount} ${questWord(tile.todo.progress.todoCount)}`;
const todayDate = (): string => props.today ?? getCurrentDateInTimeZone();
const dayOf = (tile: CampaignTile): string | null =>
  questDay(tile.next?.scheduledDate ?? null, todayDate());
/** A daily goal of the campaign that still runs counts as open. */
const goalOf = (tile: CampaignTile) => runningGoal(tile.todo, todayDate());
/** "Abschließen" stands on the tile once nothing is open; else in its "…". */
const completeOnTile = (tile: CampaignTile): boolean =>
  done(tile) || readyToComplete(tile.todo, todayDate());
function menu(tile: CampaignTile): MenuEntry[] {
  const entries: MenuEntry[] = [
    {
      id: "edit",
      label: "Bearbeiten",
      icon: "edit",
      ariaLabel: `Kampagne ${tile.todo.title} bearbeiten`,
      disabled: props.busy,
      run: () => emit("edit", tile),
    },
  ];
  if (!completeOnTile(tile))
    entries.push({
      id: "complete",
      label: "Kampagne abschließen",
      icon: "check",
      ariaLabel: `${tile.todo.title} abschließen`,
      disabled: props.busy,
      run: () => emit("complete", tile),
    });
  return entries;
}
</script>

<template>
  <section class="campaign-tiles" aria-labelledby="campaign-tiles-title">
    <div class="campaign-tiles__head">
      <h2 id="campaign-tiles-title" class="visually-hidden">
        Kampagnen im Überblick
      </h2>
      <div class="segmented" role="group" aria-label="Kampagnen zeigen">
        <button
          type="button"
          :aria-pressed="tab === 'active'"
          @click="tab = 'active'"
        >
          Aktiv
        </button>
        <button
          type="button"
          :aria-pressed="tab === 'done'"
          @click="tab = 'done'"
        >
          Abgeschlossen
        </button>
      </div>
    </div>
    <p v-if="!shown.length" class="campaign-tiles__empty">
      {{
        tab === "active"
          ? "Keine aktive Kampagne. Quests ohne Kampagne stehen im Questlog."
          : "Noch keine Kampagne abgeschlossen."
      }}
    </p>
    <ul v-if="shown.length || tab === 'active'" class="campaign-tiles__list">
      <li
        v-for="tile in shown"
        :key="tile.todo.id"
        class="campaign-tile"
        :style="{ '--mark': markOf(tile) }"
        :data-campaign-tile="tile.todo.id"
      >
        <div class="campaign-tile__head">
          <span class="campaign-tile__badge" aria-hidden="true">
            <AppIcon :name="tile.icon ?? 'campaigns'" />
          </span>
          <h3 class="campaign-tile__title">
            <button
              type="button"
              class="campaign-tile__open"
              @click="$emit('open', tile.todo.id)"
            >
              {{ tile.todo.title }}
            </button>
          </h3>
          <!-- A wrapper carries the class: the menu has two roots (button, teleport). -->
          <span v-if="!done(tile)" class="campaign-tile__menu">
            <ActionMenu
              :title="tile.todo.title"
              :entries="menu(tile)"
              :disabled="busy"
              :trigger-key="tile.todo.id"
            />
          </span>
        </div>
        <!-- How far it is: the quests below it, never the campaign itself. -->
        <template v-if="hasQuests(tile)">
          <p class="campaign-tile__progress">
            <strong class="campaign-tile__figure">{{ questCount(tile) }}</strong
            >{{ " " }}erledigt
          </p>
          <span class="campaign-tile__bar" aria-hidden="true">
            <span :style="{ width: `${questShare(tile)}%` }" />
          </span>
        </template>
        <div v-if="tile.next && !done(tile)" class="campaign-tile__next">
          <ItemPlayButton
            class="campaign-tile__play"
            kind="todo"
            :target-id="tile.next.id"
            :title="tile.next.title"
            :eligible="tile.next.timerEligible"
            :disabled="busy"
          />
          <p class="campaign-tile__next-text">
            Als Nächstes:
            <strong>{{ tile.next.title }}</strong
            ><span v-if="dayOf(tile)" class="campaign-tile__figure"
              >&nbsp;· {{ dayOf(tile) }}</span
            >
          </p>
        </div>
        <!-- Every quest done, but its daily goal still runs: that is open. -->
        <p
          v-else-if="goalOf(tile) && !done(tile)"
          class="campaign-tile__next-text"
        >
          Noch offen: <strong>{{ goalWords(goalOf(tile)!) }}</strong>
        </p>
        <p v-else-if="allDone(tile) && !done(tile)" class="campaign-tile__next-text">
          Alle Quests erledigt.
        </p>
        <template v-if="counted">
          <!-- Wraps between the figures, never inside one ("diese / Woche"). -->
          <p class="campaign-tile__week">
            <strong
              ><template
                v-for="(part, index) in againstTargetParts(
                  tile.minutes,
                  tile.weeklyTargetMinutes,
                )"
                :key="index"
                >{{ index ? " " : "" }}<span class="campaign-tile__figure">{{
                  part
                }}</span></template
              ></strong
            >{{ " " }}<span class="campaign-tile__figure">diese Woche</span>
          </p>
          <span
            v-if="tile.weeklyTargetMinutes !== null"
            class="campaign-tile__bar"
            aria-hidden="true"
          >
            <span :style="{ width: `${share(tile)}%` }" />
          </span>
          <!-- A short label names the line; its full text is the svg's name. -->
          <div class="campaign-tile__trend">
            <p class="campaign-tile__trend-label" aria-hidden="true">
              {{ tile.weeks.length }} Wochen
            </p>
            <QuestTrend
              :weeks="tile.weeks"
              :starts="starts"
              :mark="markOf(tile)"
            />
          </div>
          <p class="campaign-tile__total">
            Insgesamt {{ formatDuration(tile.totalMinutes) }}
          </p>
        </template>
        <button
          v-if="completeOnTile(tile)"
          type="button"
          class="btn campaign-tile__complete"
          :disabled="busy"
          :aria-label="
            done(tile)
              ? `${tile.todo.title} wieder öffnen`
              : `${tile.todo.title} abschließen`
          "
          @click="$emit('complete', tile)"
        >
          <AppIcon name="check" />{{
            done(tile) ? "Wieder öffnen" : "Abschließen"
          }}
        </button>
      </li>
      <!-- Not there yet: dashed, like everything that is still to come. -->
      <li v-if="tab === 'active'" class="campaign-tile campaign-tile--new">
        <button
          type="button"
          class="campaign-tile__create"
          :disabled="busy"
          @click="$emit('create')"
        >
          <AppIcon name="plus" />Neue Kampagne
        </button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.campaign-tiles {
  display: grid;
  gap: var(--space-3);
}

.campaign-tiles__empty {
  margin: 0;
  color: var(--color-ink-muted);
}

.campaign-tiles__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 14rem), 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* A white card with the campaign's stripe; the title button opens it. */
.campaign-tile {
  position: relative;
  display: grid;
  gap: var(--space-2);
  align-content: start;
  min-width: 0;
  padding: var(--space-3) var(--space-4) var(--space-3)
    calc(var(--space-4) + 0.3125rem);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: inset 0.3125rem 0 0 var(--mark);
  transition: transform 420ms var(--spring);
}

.campaign-tile:not(.campaign-tile--new):active:not(:has(.campaign-tile__complete:active, .campaign-tile__play:active, .campaign-tile__menu :active)) {
  transform: var(--press);
  transition-duration: 90ms;
}

.campaign-tile:has(.campaign-tile__open:focus-visible) {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 2px;
}

.campaign-tile p {
  margin: 0;
}

.campaign-tile__head {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
}

.campaign-tile__title {
  flex: 1 1 auto;
}

/* Above the title button's cover, so it is its own target. */
.campaign-tile__menu,
.campaign-tile__play {
  position: relative;
  z-index: 1;
  flex: none;
}

.campaign-tile__menu {
  margin-right: calc(var(--space-2) * -1);
}

.campaign-tile__progress {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  text-wrap: pretty;
  font-variant-numeric: tabular-nums;
}

.campaign-tile__progress strong {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
}

/* The next quest with its ▶: one step from the overview to the work. */
.campaign-tile__next {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-width: 0;
  margin-left: calc(var(--space-2) * -1);
}

.campaign-tile__next-text {
  min-width: 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  line-height: 1.35;
  overflow-wrap: break-word;
  hyphens: manual;
  /* No single word ("27.11.") alone on the last line. */
  text-wrap: pretty;
}

.campaign-tile__next-text strong {
  color: var(--color-ink);
  font-weight: 700;
}

.campaign-tile__badge {
  display: grid;
  flex: none;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  border-radius: 50%;
  background: var(--mark);
  color: var(--color-on-action);
}

.campaign-tile__title {
  min-width: 0;
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1.3;
  /* Whole-Word: breaks between words, never mid-word on its own. */
  overflow-wrap: break-word;
  hyphens: manual;
}

.campaign-tile__open {
  max-width: 100%;
  min-height: var(--tap);
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}

/* The whole card is the target; the button keeps the name and the focus. */
.campaign-tile__open::after {
  position: absolute;
  inset: 0;
  border-radius: var(--radius-card);
  content: "";
}

.campaign-tile__open:focus-visible {
  outline: none;
}

.campaign-tile__week {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.campaign-tile__week strong {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
}

.campaign-tile__figure {
  white-space: nowrap;
}

.campaign-tile__bar {
  display: block;
  height: 0.375rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.campaign-tile__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
  transition: width 240ms var(--ease-out);
}

.campaign-tile__trend {
  display: grid;
  gap: 0.125rem;
}

.campaign-tile__trend-label {
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}

/* Above the title button's cover, so it is its own target. */
.campaign-tile__complete {
  position: relative;
  z-index: 1;
  justify-self: start;
  margin-top: var(--space-1);
}

/* The dashed tile: a campaign that is not there yet. */
.campaign-tile--new {
  padding: 0;
  background: none;
  box-shadow: none;
}

.campaign-tile__create {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 7rem;
  padding: var(--space-4);
  border: 1.5px dashed var(--color-line-strong);
  border-radius: var(--radius-card);
  background: none;
  color: var(--color-action-strong);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition:
    background-color 160ms var(--ease-out),
    transform 420ms var(--spring);
}

.campaign-tile__create:hover:not(:disabled) {
  background: var(--color-action-tint);
}

.campaign-tile__create:active:not(:disabled) {
  transform: var(--press);
  transition-duration: 90ms;
}

.campaign-tile__create:focus-visible {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 2px;
}

.campaign-tile__create:disabled {
  color: var(--color-ink-soft);
  cursor: progress;
}

.campaign-tile__create :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
}

.campaign-tile__total {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
