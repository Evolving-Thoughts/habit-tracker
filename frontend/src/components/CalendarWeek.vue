<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";
import WeeklyTargets from "./WeeklyTargets.vue";
import type {
  Campaign,
  HistoryFilter,
  HistoryResponse,
  HistoryWorkShare,
} from "../types/history";
import { campaignMark, categoryMark } from "../utils/category-mark";
import { dayCounts, dayLabel, daySummary, hasEntries } from "../utils/history";
import { formatDuration } from "../utils/logbook";

type Day = HistoryResponse["days"][number];

const props = defineProps<{
  result: HistoryResponse;
  filter: HistoryFilter;
  filterLabel: string;
}>();
const emit = defineEmits<{ openDay: [date: string]; showAll: [] }>();

const weeklyTargets = computed(() => props.result.weeklyTargets ?? []);
const isEmpty = computed(
  () => !weeklyTargets.value.length && !props.result.days.some(hasEntries),
);
const quota = computed(() => {
  const value = props.result.weekQuota;
  return value && value.total > 0 ? value : null;
});
const perfectWeek = computed(() =>
  props.result.perfectWeek?.categories.length ? props.result.perfectWeek : null,
);

/* Logbuch: the bars share one scale, the longest day of the week. */
const longestDay = computed(() =>
  Math.max(0, ...props.result.days.map((day) => day.work.minutes)),
);
const weekMinutes = computed(() =>
  props.result.days.reduce((sum, day) => sum + day.work.minutes, 0),
);
/** The week's work by campaign, largest first and work without one last. */
const weekShares = computed<HistoryWorkShare[]>(() => {
  const shares = new Map<number | null, HistoryWorkShare>();
  for (const day of props.result.days)
    for (const { campaign, minutes } of day.work.campaigns ?? []) {
      const key = campaign?.id ?? null;
      const known = shares.get(key);
      if (known) known.minutes += minutes;
      else shares.set(key, { campaign, minutes });
    }
  return [...shares.values()].sort(
    (a, b) =>
      Number(a.campaign === null) - Number(b.campaign === null) ||
      b.minutes - a.minutes,
  );
});

const tone = (campaign: Campaign | null): string =>
  campaignMark(campaign) ?? "var(--color-mark-none)";
const campaignName = (campaign: Campaign | null): string =>
  campaign?.title ?? "Ohne Kampagne";
function workDescription(day: Day): string {
  const parts = (day.work.campaigns ?? []).map(
    ({ campaign, minutes }) =>
      `${campaignName(campaign)} ${formatDuration(minutes)}`,
  );
  return `${formatDuration(day.work.minutes)} im Logbuch: ${parts.join(", ")}`;
}
</script>

<template>
  <div v-if="isEmpty" class="empty-state">
    <strong>Für diesen Zeitraum gibt es nichts.</strong>
    <template v-if="filter !== 'all'">
      <span>Gezeigt werden nur {{ filterLabel }}.</span>
      <button type="button" class="btn" @click="emit('showAll')">
        Alle zeigen
      </button>
    </template>
  </div>
  <template v-else>
    <section v-if="quota" class="quota card" aria-labelledby="quota-label">
      <p class="quota__value">{{ quota.completed }} von {{ quota.total }}</p>
      <p id="quota-label" class="quota__label">Dailies diese Woche</p>
      <div
        class="quota__bar"
        role="progressbar"
        aria-labelledby="quota-label"
        :aria-valuenow="quota.completed"
        aria-valuemin="0"
        :aria-valuemax="quota.total"
      >
        <span
          :style="{
            width: `${Math.min(100, (quota.completed / quota.total) * 100)}%`,
          }"
        />
      </div>
    </section>

    <section
      v-if="perfectWeek"
      class="perfect-week"
      aria-labelledby="perfect-week-title"
    >
      <h2 id="perfect-week-title" class="section-title">
        {{ perfectWeek.perfect ? "Perfekte Woche!" : "Perfekte Woche" }}
      </h2>
      <ul class="rows card">
        <li
          v-for="category in perfectWeek.categories"
          :key="category.id"
          class="row"
        >
          <span class="row__name">
            <i
              class="swatch"
              :style="{ background: categoryMark(category.name) }"
              aria-hidden="true"
            />{{ category.name }}
          </span>
          <span class="count"
            >{{ category.completed }} von {{ category.target }}</span
          >
          <span class="row__check">
            <template v-if="category.reached">
              <AppIcon name="check" />
              <span class="visually-hidden">erreicht</span>
            </template>
          </span>
        </li>
      </ul>
    </section>

    <WeeklyTargets v-if="weeklyTargets.length" :targets="weeklyTargets" />

    <!-- The legend names every colour of the bars below in words. -->
    <section
      v-if="weekMinutes"
      class="week-logbook"
      aria-labelledby="week-logbook-title"
    >
      <h2 id="week-logbook-title" class="section-title">
        Logbuch <span class="count">{{ formatDuration(weekMinutes) }}</span>
      </h2>
      <ul class="rows card">
        <li
          v-for="share in weekShares"
          :key="share.campaign?.id ?? 'none'"
          class="row"
        >
          <span class="row__name">
            <i
              class="swatch"
              :style="{ background: tone(share.campaign) }"
              aria-hidden="true"
            />{{ campaignName(share.campaign) }}
          </span>
          <span class="count">{{ formatDuration(share.minutes) }}</span>
        </li>
      </ul>
    </section>

    <h2 class="section-title">Tage</h2>
    <ul class="week-days">
      <li v-for="day in result.days" :key="day.date">
        <button
          type="button"
          class="week-day"
          :class="{ 'week-day--today': day.date === result.today }"
          :data-date="day.date"
          :aria-label="`${dayLabel(day.date)} öffnen`"
          :aria-describedby="`week-day-${day.date}`"
          @click="emit('openDay', day.date)"
        >
          <span class="week-day__text">
            <strong>{{ dayLabel(day.date) }}</strong>
            <span :id="`week-day-${day.date}`" class="week-day__details">
              <span class="week-day__summary">{{
                daySummary(dayCounts(day))
              }}</span>
              <span v-if="day.work.minutes" class="week-day__work">
                <span class="work-track" aria-hidden="true">
                  <span
                    class="work-bar"
                    :style="{
                      width: `${(day.work.minutes / longestDay) * 100}%`,
                    }"
                  >
                    <i
                      v-for="share in day.work.campaigns"
                      :key="share.campaign?.id ?? 'none'"
                      :style="{
                        flexGrow: share.minutes,
                        background: tone(share.campaign),
                      }"
                    />
                  </span>
                </span>
                <span class="week-day__worked" aria-hidden="true">{{
                  formatDuration(day.work.minutes)
                }}</span>
                <span class="visually-hidden">{{ workDescription(day) }}</span>
              </span>
            </span>
          </span>
          <AppIcon name="chevron" />
        </button>
      </li>
    </ul>
  </template>
</template>

<style scoped>
.quota {
  display: grid;
  gap: var(--space-1);
  padding: var(--space-5);
  box-shadow: var(--shadow-card);
}

.quota p {
  margin: 0;
}

.quota__value {
  font-size: clamp(2.25rem, 10vw, 3rem);
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.quota__label {
  color: var(--color-ink-muted);
  font-weight: 700;
}

.quota__bar {
  height: 0.625rem;
  margin-top: var(--space-3);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.quota__bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
}

.rows {
  display: grid;
  margin: 0;
  padding: var(--space-1) var(--space-4);
  list-style: none;
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
  align-items: center;
  min-height: var(--tap);
  padding: var(--space-2) 0;
}

.row + .row {
  border-top: 1px solid var(--color-line);
}

.row__name {
  display: inline-flex;
  flex: 1 1 10rem;
  gap: 0.5rem;
  align-items: center;
  min-width: 0;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.row__check {
  display: inline-grid;
  width: 1.25rem;
  place-items: center;
  color: var(--color-ink);
}

.row__check :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
  stroke-width: 2.6;
}

.swatch {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

.week-days {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.week-day {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: var(--tap-large);
  padding: var(--space-3) var(--space-4);
  border: 0;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.week-day:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.week-day--today {
  box-shadow: inset 0 0 0 2px var(--color-ink);
}

.week-day__text {
  display: grid;
  flex: 1 1 auto;
  min-width: 0;
}

.week-day__details {
  display: grid;
  min-width: 0;
}

.week-day__summary {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.week-day__work {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-2);
}

/* Measured time in the campaigns' marks; a plain bar, not a target to fill. */
.work-track {
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
}

.work-bar {
  display: flex;
  gap: 2px;
  min-width: 0.5rem;
  height: 0.625rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
}

.work-bar i {
  flex-basis: 0;
  min-width: 2px;
}

.week-day__worked {
  flex: none;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.week-day > :deep(svg) {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-ink-muted);
}
</style>
