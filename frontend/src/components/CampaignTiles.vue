<script setup lang="ts">
import { computed, ref } from "vue";
import { campaignMark } from "../utils/category-mark";
import { formatDuration } from "../utils/today-agenda";
import { againstTargetParts, type CampaignTile } from "../utils/quest-hours";
import AppIcon from "./AppIcon.vue";
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
}>();
defineEmits<{
  open: [id: number];
  /** "Abschließen" or "Wieder öffnen" on a tile. */
  complete: [tile: CampaignTile];
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
        </div>
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

.campaign-tile:not(.campaign-tile--new):active:not(:has(.campaign-tile__complete:active)) {
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
  overflow-wrap: anywhere;
}

.campaign-tile__open {
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
