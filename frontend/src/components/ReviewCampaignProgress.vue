<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import { hrefOf } from "../routes";
import type { WeekReviewCampaign } from "../types/week-review";
import { campaignMark } from "../utils/category-mark";
import { questWord } from "../utils/todo-hierarchy";
import {
  dailyGoalText,
  progressChange,
  questCount,
  questsGained,
} from "../utils/week-review";

const props = defineProps<{ campaigns: WeekReviewCampaign[] }>();

const rows = computed(() =>
  props.campaigns.map((row) => {
    const { start, end } = row;
    const total = Math.max(1, end.totalCount);
    // What was done before the week, then what this week added on top.
    const before = Math.min(start.doneCount, end.doneCount);
    return {
      ...row,
      mark: campaignMark(row.campaign)!,
      change: progressChange(row),
      gained: questsGained(row),
      count: questCount(end.doneCount, end.totalCount),
      beforeWidth: (before / total) * 100,
      addedWidth: (Math.max(0, end.doneCount - before) / total) * 100,
    };
  }),
);
const readBack = computed(() =>
  props.campaigns.some(
    ({ start, end }) =>
      start.source === "reconstructed" || end.source === "reconstructed",
  ),
);
const href = (id: number): string =>
  `${hrefOf("campaigns")}?kampagne=${id}`;
</script>

<template>
  <section
    v-if="rows.length"
    class="campaign-progress card"
    aria-labelledby="review-progress-title"
  >
    <div class="card-head">
      <h2 id="review-progress-title" class="card-title">
        Fortschritt je Kampagne
      </h2>
      <p class="campaign-progress__legend">
        <span
          ><i class="campaign-progress__key" aria-hidden="true" />in dieser
          Woche</span
        >
        <span
          ><i
            class="campaign-progress__key campaign-progress__key--before"
            aria-hidden="true"
          />vorher</span
        >
      </p>
    </div>
    <ul class="campaign-progress__list">
      <li v-for="row in rows" :key="row.campaign.id">
        <a
          class="campaign-progress__row"
          :href="href(row.campaign.id)"
          :data-campaign-id="row.campaign.id"
          :style="{ '--row-mark': row.mark }"
        >
          <span class="campaign-progress__text">
            <span class="campaign-progress__top">
              <strong class="campaign-progress__title">{{
                row.campaign.title
              }}</strong>
              <span class="campaign-progress__count"
                >{{ row.count }} · {{ row.end.percentage }} %</span
              >
            </span>
            <span class="campaign-progress__change">{{ row.change }}</span>
            <span
              class="campaign-progress__track"
              role="img"
              :aria-label="`${row.end.percentage} % erledigt, davon ${Math.max(0, row.gained)} ${questWord(Math.max(0, row.gained))} in dieser Woche`"
            >
              <span
                class="campaign-progress__before"
                :style="{ width: `${row.beforeWidth}%` }"
              />
              <span
                class="campaign-progress__added"
                :style="{ width: `${row.addedWidth}%` }"
              />
            </span>
            <span
              v-for="goal in row.dailyGoals"
              :key="goal.todoId"
              class="campaign-progress__goal"
              >{{ dailyGoalText(goal) }}</span
            >
          </span>
          <AppIcon name="chevron" />
          <span class="visually-hidden">Kampagne öffnen</span>
        </a>
      </li>
    </ul>
    <p v-if="readBack" class="campaign-progress__note">
      Wo kein gespeicherter Stand vorliegt, ist er aus Anlage- und
      Erledigungsdatum der Quests zurückgerechnet.
    </p>
  </section>
</template>

<style scoped>
/* One row per campaign, two side by side where the card is wide enough. */
.campaign-progress__list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 26rem), 1fr));
  gap: var(--space-1) var(--space-4);
  margin: 0 calc(var(--space-2) * -1);
  padding: 0;
  list-style: none;
}

/* A link row: the campaign's stripe on the left, pressable like a card. */
.campaign-progress__row {
  position: relative;
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-height: var(--tap-large);
  padding: var(--space-2) var(--space-2) var(--space-2) var(--space-5);
  border-radius: var(--radius-control);
  color: var(--color-ink);
  text-decoration: none;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out);
}

/* Without a card of its own the stripe stands straight, as a rounded bar. */
.campaign-progress__row::before {
  position: absolute;
  top: var(--space-2);
  bottom: var(--space-2);
  left: var(--space-2);
  width: 5px;
  border-radius: var(--radius-pill);
  background: var(--row-mark);
  content: "";
}

.campaign-progress__row:hover {
  background: var(--color-ground);
}

.campaign-progress__row:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.campaign-progress__row > :deep(svg) {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-ink-muted);
}

.campaign-progress__text {
  display: grid;
  flex: 1 1 auto;
  gap: 0.125rem;
  min-width: 0;
}

.campaign-progress__top {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  align-items: baseline;
  justify-content: space-between;
}

.campaign-progress__title {
  font-weight: 800;
  overflow-wrap: anywhere;
}

.campaign-progress__count,
.campaign-progress__goal {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.campaign-progress__change {
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.campaign-progress__track {
  display: flex;
  height: 0.5rem;
  margin: var(--space-1) 0;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.campaign-progress__before,
.campaign-progress__added {
  display: block;
  height: 100%;
  transition: width 240ms var(--ease-out);
}

.campaign-progress__before {
  background: color-mix(in srgb, var(--row-mark) 40%, var(--color-surface));
}

.campaign-progress__added {
  background: var(--row-mark);
}

.campaign-progress__legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-4);
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
}

.campaign-progress__legend span {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
}

.campaign-progress__key {
  display: inline-block;
  width: 1rem;
  height: 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-ink-muted);
}

.campaign-progress__key--before {
  background: color-mix(in srgb, var(--color-ink-muted) 40%, var(--color-surface));
}

.campaign-progress__note {
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
}
</style>
