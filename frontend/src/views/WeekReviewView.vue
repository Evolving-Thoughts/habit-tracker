<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getQuestHours } from "../api/quest-hours.api";
import { getWeekReview } from "../api/week-review.api";
import AppIcon from "../components/AppIcon.vue";
import ReviewAnswers from "../components/ReviewAnswers.vue";
import ReviewCampaignHours from "../components/ReviewCampaignHours.vue";
import ReviewCampaignProgress from "../components/ReviewCampaignProgress.vue";
import ReviewDayBars from "../components/ReviewDayBars.vue";
import ReviewDoneList from "../components/ReviewDoneList.vue";
import ReviewFigures from "../components/ReviewFigures.vue";
import ReviewQuestSplit from "../components/ReviewQuestSplit.vue";
import ReviewWeekTrend from "../components/ReviewWeekTrend.vue";
import WeekQuota from "../components/WeekQuota.vue";
import { useLoader } from "../composables/useLoader";
import type { QuestHoursResponse } from "../types/quest-hours";
import type {
  WeekReviewAnswers,
  WeekReviewResponse,
} from "../types/week-review";
import { getCurrentDateInTimeZone } from "../utils/date";
import { weekLabel } from "../utils/history";
import { isQuietWeek, weekDistance } from "../utils/week-review";
import { neighbourWeek, weekFromQuery } from "../utils/week-plan";

const route = useRoute();
const router = useRouter();

/* The week lives in the address (#/rueckblick?woche=…), as in the Plan. */
const week = computed(() =>
  weekFromQuery(route.query.woche, getCurrentDateInTimeZone()),
);
/** Asked fresh each time: the app may stay open into the next week. */
const thisWeek = (): string =>
  weekFromQuery(null, getCurrentDateInTimeZone());
function showWeek(start: string): void {
  void router.push({
    query: start === thisWeek() ? {} : { woche: start },
  });
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
    fallbackError: "Die Quest-Stunden konnten nicht geladen werden.",
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
const hasTrend = computed(
  () => !!hours.value?.weeks.some((item) => item.questMinutes > 0),
);
const distance = computed(() => weekDistance(week.value, thisWeek()));

function onSaved(answers: WeekReviewAnswers): void {
  if (review.value) review.value = { ...review.value, answers };
}
</script>

<template>
  <main class="page week-review">
    <header class="page-header">
      <h1 class="page-title">Wochenrückblick</h1>
      <div class="week-review__nav">
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Vorige Woche"
          @click="showWeek(neighbourWeek(week, -1))"
        >
          <AppIcon name="chevron-left" />
        </button>
        <button type="button" class="btn" @click="showWeek(thisWeek())">
          Diese Woche
        </button>
        <button
          type="button"
          class="btn btn--icon"
          aria-label="Nächste Woche"
          @click="showWeek(neighbourWeek(week, 1))"
        >
          <AppIcon name="chevron" />
        </button>
      </div>
      <p class="page-lead week-review__range">
        <strong>{{ weekLabel(week) }}</strong> · {{ distance }}
      </p>
    </header>

    <div
      v-if="loading"
      class="week-review__loading"
      role="status"
      aria-label="Wochenrückblick wird geladen"
    >
      <span class="week-review__bone week-review__bone--figures" />
      <span class="week-review__bone week-review__bone--chart" />
      <span class="week-review__bone week-review__bone--chart" />
    </div>
    <template v-else>
      <div v-if="hoursError" class="alert week-review__alert" role="alert">
        <p>{{ hoursError }}</p>
        <button type="button" class="btn btn--ground" @click="reloadHours()">
          <AppIcon name="refresh" />Erneut versuchen
        </button>
      </div>
      <div v-if="reviewError" class="alert week-review__alert" role="alert">
        <p>{{ reviewError }}</p>
        <button type="button" class="btn btn--ground" @click="reloadReview()">
          <AppIcon name="refresh" />Erneut versuchen
        </button>
      </div>

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

      <template v-if="hours && !quiet">
        <ReviewFigures :hours="hours" />
        <ReviewDayBars :hours="hours" />
        <ReviewCampaignHours :hours="hours" />
      </template>
      <ReviewCampaignProgress
        v-if="review && !quiet"
        :campaigns="review.campaigns"
      />
      <ReviewQuestSplit v-if="hours && !quiet" :hours="hours" />
      <!-- A week still ahead has nothing to compare or count yet. -->
      <ReviewWeekTrend v-if="hours && hasTrend && !ahead" :hours="hours" />
      <WeekQuota
        v-if="review && !ahead"
        :quota="review.weekQuota"
        :perfect-week="review.perfectWeek"
        :lifted="false"
        titled
      />
      <ReviewDoneList v-if="review && !quiet" :days="review.days" />
      <ReviewAnswers
        v-if="review"
        :week="review.startDate"
        :answers="review.answers"
        :ahead="ahead"
        @saved="onSaved"
      />
    </template>
  </main>
</template>

<style scoped>
.week-review__nav {
  display: flex;
  gap: var(--space-1);
  align-items: center;
}

.week-review__range {
  font-variant-numeric: tabular-nums;
}

.week-review__range strong {
  color: var(--color-ink);
}

.week-review__alert {
  margin-bottom: var(--space-4);
}

/* Bones in the size of what comes, so nothing jumps when it arrives. */
.week-review__loading {
  display: grid;
  gap: var(--space-6);
}

.week-review__bone {
  display: block;
  border-radius: var(--radius-card);
  background: rgb(255 255 255 / 55%);
  animation: week-review-breathe 1.6s var(--ease-out) infinite alternate;
}

.week-review__bone--figures {
  height: 13rem;
}

.week-review__bone--chart {
  height: 11rem;
}

@keyframes week-review-breathe {
  to {
    opacity: 0.5;
  }
}
</style>
