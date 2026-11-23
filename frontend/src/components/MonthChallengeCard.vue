<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import CheckRing from "./CheckRing.vue";
import ItemPlayButton from "./ItemPlayButton.vue";
import type { DayPlannerHabitItem } from "../types/day-planner";
import type { MonthChallenge } from "../types/month-challenge";
import {
  barShare,
  barText,
  CHALLENGE_HREF,
  progressLine,
} from "../utils/month-challenge";

/**
 * The running Monats-Challenge at the top of Heute: a flat, calm card with
 * the Daily's title, where the month stands and a thin bar in ink. While
 * today's run is open (or was done today) its ring and ▶ are the run's own,
 * the same steps as its row below. Never a warning, whatever the numbers.
 */
const props = defineProps<{
  challenge: MonthChallenge;
  /** Today's run of the Daily in Heute's list, open or done today. */
  run: DayPlannerHabitItem | null;
  busy: boolean;
}>();
const emit = defineEmits<{ toggle: [item: DayPlannerHabitItem] }>();

const done = computed(() => props.run?.status === "completed");
const line = computed(() => progressLine(props.challenge));
</script>

<template>
  <section
    class="challenge-card"
    :class="{ 'challenge-card--ring': run }"
    aria-labelledby="challenge-card-title"
  >
    <CheckRing
      v-if="run"
      class="challenge-card__ring"
      :checked="done"
      :label="
        done
          ? `${challenge.title} heute wieder öffnen`
          : `${challenge.title} heute erledigen`
      "
      :disabled="busy"
      :busy="busy"
      @toggle="emit('toggle', run)"
    />
    <div class="challenge-card__body">
      <p class="challenge-card__kicker">
        <AppIcon name="challenge" />
        <span>Monats-Challenge</span>
      </p>
      <h2 id="challenge-card-title" class="challenge-card__title">
        {{ challenge.title }}
      </h2>
      <p v-if="line" class="challenge-card__progress">{{ line }}</p>
      <span
        class="challenge-card__bar"
        role="progressbar"
        :aria-label="`Monats-Challenge ${challenge.title}`"
        :aria-valuenow="challenge.done"
        aria-valuemin="0"
        :aria-valuemax="challenge.total"
        :aria-valuetext="barText(challenge)"
      >
        <span :style="{ width: `${barShare(challenge)}%` }" />
      </span>
    </div>
    <div class="challenge-card__end">
      <ItemPlayButton
        v-if="run && !done"
        kind="occurrence"
        :target-id="run.occurrenceId"
        :title="run.title"
        :eligible="run.timerEligible"
        :disabled="busy"
      />
      <a class="challenge-card__link" :href="CHALLENGE_HREF">Challenges</a>
    </div>
  </section>
</template>

<style scoped>
/* Flat white like every row: the focus card stays the one lifted card. */
.challenge-card {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  margin: 0 0 var(--space-3);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.challenge-card--ring {
  grid-template-columns: var(--tap) minmax(0, 1fr) auto;
  padding-left: var(--space-2);
}

.challenge-card__body {
  display: grid;
  gap: 0.125rem;
  min-width: 0;
}

.challenge-card p {
  margin: 0;
}

.challenge-card__kicker {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}

.challenge-card__kicker :deep(svg) {
  width: 1rem;
  height: 1rem;
}

.challenge-card__title {
  margin: 0;
  overflow: hidden;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 800;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.challenge-card__progress {
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

/* The same thin bar in ink as the week's quest hours: a share, not a verdict. */
.challenge-card__bar {
  display: block;
  width: min(100%, 16rem);
  height: 0.375rem;
  margin-top: var(--space-1);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.challenge-card__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
  transition: width 240ms var(--ease-out);
}

.challenge-card__end {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.challenge-card__link {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-2);
  color: var(--color-action-strong);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--color-line);
  text-underline-offset: 0.2em;
}
</style>
