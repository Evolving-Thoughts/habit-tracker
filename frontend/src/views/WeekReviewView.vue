<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getQuestHours } from "../api/quest-hours.api";
import { getWeekReview } from "../api/week-review.api";
import AppIcon from "../components/AppIcon.vue";
import ReviewAnswers from "../components/ReviewAnswers.vue";
import ReviewCampaignHours from "../components/ReviewCampaignHours.vue";
import ReviewCampaignProgress from "../components/ReviewCampaignProgress.vue";
import ReviewDayBars from "../components/ReviewDayBars.vue";
import ReviewDayBests from "../components/ReviewDayBests.vue";
import ReviewDoneList from "../components/ReviewDoneList.vue";
import ReviewFigures from "../components/ReviewFigures.vue";
import ReviewQuestSplit from "../components/ReviewQuestSplit.vue";
import ReviewWeekTrend from "../components/ReviewWeekTrend.vue";
import { notifyDataChanged } from "../composables/data-sync";
import { useLoader } from "../composables/useLoader";
import type { QuestHoursResponse } from "../types/quest-hours";
import type {
  WeekReviewAnswers,
  WeekReviewResponse,
} from "../types/week-review";
import { getCurrentDateInTimeZone } from "../utils/date";
import { weekLabel } from "../utils/history";
import {
  isQuietWeek,
  neighbourWeek,
  offersWayBack,
  weekDistance,
  weekFromQuery,
} from "../utils/week-review";

const route = useRoute();
const router = useRouter();

/* The week lives in the address (#/rueckblick?woche=…), as in the Plan. */
const week = computed(() =>
  weekFromQuery(route.query.woche, getCurrentDateInTimeZone()),
);
/** Asked fresh each time: the app may stay open into the next week. */
const thisWeek = (): string =>
  weekFromQuery(null, getCurrentDateInTimeZone());
function showWeek(start: string): Promise<unknown> {
  return router.push({
    query: start === thisWeek() ? {} : { woche: start },
  });
}
/** "Diese Woche" only shows away from it, as "Heute" in the Kalender. */
const offersThisWeek = computed(() => offersWayBack(week.value, thisWeek()));
const range = ref<HTMLElement | null>(null);
async function showThisWeek(): Promise<void> {
  await showWeek(thisWeek());
  // The button leaves with the step; the range names where it went.
  await nextTick();
  range.value?.focus();
}

/* Two reads side by side: one failing keeps the other on the page. */
const {
  data: hours,
  isLoading: hoursLoading,
  errorMessage: hoursError,
  reload: reloadHours,
} = useLoader<QuestHoursResponse | null>(
  (signal) => getQuestHours(week.value, signal),
  {
    initial: null,
    fallbackError: "Die Kampagnen-Stunden konnten nicht geladen werden.",
    params: [week],
    resetOnLoad: true,
    refreshOnChange: () => true,
  },
);
const {
  data: review,
  isLoading: reviewLoading,
  errorMessage: reviewError,
  reload: reloadReview,
} = useLoader<WeekReviewResponse | null>(
  (signal) => getWeekReview(week.value, signal),
  {
    initial: null,
    fallbackError: "Der Wochenrückblick konnte nicht geladen werden.",
    params: [week],
    resetOnLoad: true,
    refreshOnChange: () => true,
  },
);

const loading = computed(() => hoursLoading.value || reviewLoading.value);
/** Only when both reads arrived: a failed one must not pass for an empty week. */
const quiet = computed(
  () => !!hours.value && !!review.value && isQuietWeek(hours.value, review.value),
);
const ahead = computed(() => week.value > thisWeek());
/* A week still ahead has nothing to compare or count yet. */
const hasTrend = computed(
  () =>
    !ahead.value &&
    !!hours.value?.weeks.some(
      (item) => item.questMinutes + item.otherMinutes > 0,
    ),
);
/* The fourth figure: the week's Dailies and the perfect week, from the review. */
const dailies = computed(() =>
  review.value && !ahead.value
    ? {
        quota: review.value.weekQuota,
        perfectWeek: review.value.perfectWeek,
      }
    : null,
);
const hasDailies = computed(
  () =>
    !!dailies.value &&
    ((dailies.value.quota?.total ?? 0) > 0 ||
      !!dailies.value.perfectWeek?.categories.length),
);
/*
 * An empty week keeps its figures only where earlier weeks or its Dailies
 * give them weight.
 */
const showFigures = computed(
  () => !!hours.value && (!quiet.value || hasTrend.value || hasDailies.value),
);
/* The goal is changed for the running week on; a past week shows its own. */
const goalEditable = computed(() => week.value === thisWeek());
/* The charts only for measured time, never a wall of empty ones. */
const measured = computed(
  () => !!hours.value && hours.value.questMinutes + hours.value.otherMinutes > 0,
);
const distance = computed(() => weekDistance(week.value, thisWeek()));

/* The new goal shows at once; Heute and the rest refresh in the background. */
function onTargetSaved(minutes: number | null): void {
  if (hours.value) hours.value = { ...hours.value, weeklyTargetMinutes: minutes };
  notifyDataChanged();
}

function onSaved(answers: WeekReviewAnswers): void {
  if (review.value) review.value = { ...review.value, answers };
}
</script>

<template>
  <main class="page week-review">
    <header class="page-header week-review__header">
      <div class="week-review__heading">
        <h1 class="page-title">Wochenrückblick</h1>
        <p class="page-lead">Wie weit die Woche deine Kampagnen gebracht hat.</p>
      </div>
      <!-- "Diese Woche" first, so the arrows keep their place when it leaves. -->
      <div class="week-review__nav">
        <button
          v-if="offersThisWeek"
          type="button"
          class="btn"
          @click="showThisWeek"
        >
          Diese Woche
        </button>
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Vorige Woche"
          @click="showWeek(neighbourWeek(week, -1))"
        >
          <AppIcon name="chevron-left" />
        </button>
        <p ref="range" class="week-review__range" tabindex="-1">
          <strong>{{ weekLabel(week) }}</strong> <span>{{ distance }}</span>
        </p>
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Nächste Woche"
          @click="showWeek(neighbourWeek(week, 1))"
        >
          <AppIcon name="chevron" />
        </button>
      </div>
    </header>

    <!-- Bones in the grid of what comes, so nothing jumps when it arrives. -->
    <div
      v-if="loading"
      class="week-review__body week-review__loading"
      role="status"
      aria-label="Wochenrückblick wird geladen"
    >
      <div class="week-review__figures-bones">
        <span class="week-review__bone week-review__bone--figure" />
        <span class="week-review__bone week-review__bone--figure" />
        <span class="week-review__bone week-review__bone--figure" />
        <span class="week-review__bone week-review__bone--figure" />
      </div>
      <div class="week-review__charts">
        <span class="week-review__bone week-review__bone--days" />
        <div class="week-review__side">
          <span class="week-review__bone week-review__bone--side" />
          <span class="week-review__bone week-review__bone--side" />
        </div>
      </div>
      <span class="week-review__bone week-review__bone--trend" />
    </div>
    <div v-else class="week-review__body">
      <div v-if="hoursError" class="alert" role="alert">
        <p>{{ hoursError }}</p>
        <button type="button" class="btn btn--ground" @click="reloadHours()">
          <AppIcon name="refresh" />Erneut versuchen
        </button>
      </div>
      <div v-if="reviewError" class="alert" role="alert">
        <p>{{ reviewError }}</p>
        <button type="button" class="btn btn--ground" @click="reloadReview()">
          <AppIcon name="refresh" />Erneut versuchen
        </button>
      </div>

      <!-- The dashboard: figures, the week's charts, the weeks before. -->
      <ReviewFigures
        v-if="hours && showFigures"
        :hours="hours"
        :editable="goalEditable"
        :dailies="dailies"
        @target-saved="onTargetSaved"
      />
      <div v-if="quiet" class="empty-state">
        <template v-if="ahead">
          <strong>Diese Woche liegt noch vor dir.</strong>
          <span
            >Sobald sie läuft, steht hier, was du in ihr misst und
            erledigst.</span
          >
        </template>
        <template v-else>
          <strong>In dieser Woche ist nichts gemessen und nichts erledigt.</strong>
          <span>Auch eine ruhige Woche darf einen Rückblick haben.</span>
        </template>
      </div>
      <!-- Measured time always has its split, so the side is never empty. -->
      <div v-if="hours && measured" class="week-review__charts">
        <ReviewDayBars :hours="hours" />
        <div class="week-review__side">
          <ReviewCampaignHours :hours="hours" />
          <ReviewQuestSplit :hours="hours" />
        </div>
      </div>
      <ReviewWeekTrend v-if="hours && hasTrend" :hours="hours" />

      <!-- What the week changed, its best days, and the questions. -->
      <ReviewCampaignProgress
        v-if="review && !quiet"
        :campaigns="review.campaigns"
      />
      <ReviewDoneList
        v-if="review && !quiet"
        :days="review.days"
        :today="review.today"
      />
      <!-- The week's lines of "Das Beste des Tages"; none, no card. -->
      <ReviewDayBests v-if="review" :week="review.startDate" :today="review.today" />
      <ReviewAnswers
        v-if="review"
        :week="review.startDate"
        :answers="review.answers"
        :ahead="ahead"
        @saved="onSaved"
      />
    </div>
  </main>
</template>

<style scoped>
/* The dashboard needs more room than a page column, like the Plan. */
@media (min-width: 56rem) {
  .week-review {
    width: min(100% - 2rem, 72rem);
  }
}

.week-review__heading {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}

.week-review__nav {
  display: flex;
  flex: 1 1 100%;
  gap: var(--space-1);
  align-items: center;
}

.week-review__range {
  display: grid;
  flex: 1 1 auto;
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.week-review__range strong {
  color: var(--color-ink);
  font-size: 0.9375rem;
  font-weight: 800;
}

/* From 40rem the switcher sits beside the title, as in the Plan. */
@media (min-width: 40rem) {
  .week-review__header {
    align-items: end;
  }

  .week-review__nav {
    flex: 0 0 auto;
  }

  .week-review__range {
    min-width: 7.5rem;
  }
}

/* One grid for every card, so the gaps are the same everywhere. */
.week-review__body {
  display: grid;
  gap: var(--space-3);
}

.week-review__charts,
.week-review__side {
  display: grid;
  gap: var(--space-3);
  align-content: start;
}

@media (min-width: 40rem) {
  .week-review__body,
  .week-review__charts,
  .week-review__side {
    gap: var(--space-4);
  }
}

/* Day bars about three fifths, the two side cards stacked beside them. */
@media (min-width: 56rem) {
  .week-review__charts {
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    align-items: stretch;
  }
}

.week-review__figures-bones {
  display: grid;
  gap: var(--space-4);
}

.week-review__bone {
  display: block;
  border-radius: var(--radius-card);
  background: var(--color-surface-flat);
  animation: week-review-breathe 1.6s var(--ease-out) infinite alternate;
}

/* On the phone the figures are one card: one bone of its size. */
.week-review__bone--figure {
  height: 18.5rem;
}

.week-review__bone--figure + .week-review__bone--figure {
  display: none;
}

.week-review__bone--days {
  height: 13rem;
}

.week-review__bone--side {
  height: 9rem;
}

.week-review__bone--trend {
  height: 13rem;
}

@media (min-width: 40rem) {
  .week-review__figures-bones {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .week-review__bone--figure {
    height: 8.5rem;
  }

  .week-review__bone--figure + .week-review__bone--figure {
    display: block;
  }
}

@media (min-width: 64rem) {
  .week-review__figures-bones {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 56rem) {
  .week-review__bone--days {
    height: auto;
    min-height: 17rem;
  }
}

@keyframes week-review-breathe {
  to {
    opacity: 0.5;
  }
}
</style>
