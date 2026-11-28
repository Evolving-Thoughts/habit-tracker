<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import DayCalendar from "./DayCalendar.vue";
import WeeklyTargets from "./WeeklyTargets.vue";
import { useDayClock } from "../composables/useDayClock";
import type {
  HistoryFilter,
  HistoryResponse,
  HistoryWorkLog,
} from "../types/history";
import {
  dayRelation,
  untimedLine,
  untimedOfHistoryDay,
} from "../utils/day-tally";
import {
  dayLabel,
  daySummary,
  hasEntries,
  shortDate,
  weekdayName,
} from "../utils/history";
import {
  HOUR_REM,
  axisHours,
  clockLabel,
  formatDuration,
  logBlocks,
  planBlocks,
} from "../utils/logbook";
import { todayScroll, weekOpenMinute } from "../utils/week-plan";

type Day = HistoryResponse["days"][number];

/**
 * The Kalender week as seven day columns on one hour axis (DESIGN.md ›
 * Kalender › Woche): above each column the day, its worked time and what it
 * holds without a time; a tap there opens the day. Logbuch blocks open and
 * drag in the columns exactly as in the day.
 */
const props = defineProps<{
  result: HistoryResponse;
  filter: HistoryFilter;
  filterLabel: string;
  reload: (showPageLoading?: boolean) => Promise<void>;
  hiddenLogs?: ReadonlySet<number>;
}>();
const emit = defineEmits<{
  openDay: [date: string];
  showAll: [];
  removeLog: [log: HistoryWorkLog];
}>();

const weeklyTargets = computed(() => props.result.weeklyTargets ?? []);
const isEmpty = computed(
  () => !weeklyTargets.value.length && !props.result.days.some(hasEntries),
);
const today = computed(() => props.result.today);

/** Everything on the axis of a day; only what has begun has a Logbuch. */
const blocksOf = (day: Day) => [
  ...planBlocks(day),
  ...(day.date <= today.value ? logBlocks(day.work, day.date) : []),
];
/** One axis for all seven days: early morning, or the earliest entry. */
const hours = computed(() => axisHours(props.result.days.flatMap(blocksOf)));
const hourMarks = computed(() =>
  Array.from(
    { length: hours.value.to - hours.value.from + 1 },
    (_, index) => hours.value.from + index,
  ),
);
const hasToday = computed(() =>
  props.result.days.some((day) => day.date === today.value),
);
const now = useDayClock((minutes) =>
  hasToday.value && minutes < 1439 ? minutes + 1 : null,
);

const weekday = (date: string) => weekdayName(date).slice(0, 2);
const untimed = (day: Day) => untimedLine(untimedOfHistoryDay(day));
/**
 * The day in a sentence for screen readers, counted like every view; a day
 * with nothing planned already names its measured time.
 */
function description(day: Day): string {
  const summary = daySummary(day, dayRelation(day.date, today.value));
  return day.work.minutes && !summary.startsWith("Nichts geplant")
    ? `${summary}, ${formatDuration(day.work.minutes)} im Logbuch`
    : summary;
}

/*
 * Opens on now in the current week, else on the first entry or the morning.
 * Sideways, where the seven columns do not fit (a phone), the current week
 * starts with today right beside the hours, any other week with Monday.
 */
const board = ref<HTMLElement | null>(null);
async function scrollToStart(): Promise<void> {
  await nextTick();
  const element = board.value;
  if (!element) return;
  const first = Math.min(
    ...props.result.days.flatMap(blocksOf).map((block) => block.start),
  );
  const target = weekOpenMinute(
    hasToday.value ? now.value : null,
    Number.isFinite(first) ? first : null,
  );
  const rem =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  element.scrollTop = Math.max(
    0,
    ((target - hours.value.from * 60) / 60) * HOUR_REM * rem,
  );
  element.scrollLeft = sidewaysStart(element);
}

function sidewaysStart(element: HTMLElement): number {
  const head = hasToday.value
    ? element.querySelector<HTMLElement>(`.week-head[data-date="${today.value}"]`)
    : null;
  const hoursColumn = element.querySelector<HTMLElement>(".calendar-week__corner");
  if (!head || !hoursColumn) return 0;
  const box = element.getBoundingClientRect();
  const column = head.getBoundingClientRect();
  const start = column.left - box.left + element.scrollLeft;
  // Only when at least a whole column is hidden; a few pixels short keeps Monday.
  const lead = element.scrollWidth - element.clientWidth >= column.width;
  return todayScroll(
    { start, end: start + column.width },
    {
      width: element.clientWidth,
      sticky: hoursColumn.getBoundingClientRect().width,
      lead,
    },
  );
}
onMounted(scrollToStart);
watch(() => props.result.startDate, scrollToStart);
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
    <div
      ref="board"
      class="calendar-week"
      :style="{
        '--hour': `${HOUR_REM}rem`,
        '--hours': hours.to - hours.from,
      }"
    >
      <span class="calendar-week__corner" aria-hidden="true" />
      <button
        v-for="day in result.days"
        :key="`head-${day.date}`"
        type="button"
        class="week-head"
        :class="{ 'week-head--today': day.date === today }"
        :data-date="day.date"
        :aria-current="day.date === today ? 'date' : undefined"
        :aria-label="`${dayLabel(day.date)} öffnen`"
        :aria-describedby="`week-head-${day.date}`"
        @click="emit('openDay', day.date)"
      >
        <!-- Today says so in words, not only by its line: on a phone it is
             the first column in view while the title names the whole week. -->
        <span v-if="day.date === today" class="week-head__today">Heute</span>
        <span class="week-head__day">
          <strong>{{ weekday(day.date) }}</strong>
          {{ shortDate(day.date) }}
        </span>
        <span class="week-head__details" aria-hidden="true">
          <span v-if="day.work.minutes" class="week-head__worked">{{
            formatDuration(day.work.minutes)
          }}</span>
          <span v-if="untimed(day)" class="week-head__summary">{{
            untimed(day)
          }}</span>
        </span>
        <span :id="`week-head-${day.date}`" class="visually-hidden">{{
          description(day)
        }}</span>
      </button>
      <div class="calendar-week__hours" aria-hidden="true">
        <div class="calendar-week__axis">
          <span
            v-for="hour in hourMarks"
            :key="hour"
            :style="{ '--at': hour - hours.from }"
            >{{ String(hour).padStart(2, "0") }}:00</span
          >
          <span
            v-if="hasToday && now >= hours.from * 60"
            class="calendar-week__now"
            :style="{ '--minute-at': now - hours.from * 60 }"
            >{{ clockLabel(now) }}</span
          >
        </div>
      </div>
      <div
        v-for="day in result.days"
        :key="day.date"
        class="week-column"
        :class="{ 'week-column--today': day.date === today }"
        :data-date="day.date"
      >
        <DayCalendar
          compact
          :day="day"
          :today="today"
          :hours="hours"
          :hidden-logs="hiddenLogs"
          @remove-log="emit('removeLog', $event)"
        />
      </div>
    </div>

    <WeeklyTargets v-if="weeklyTargets.length" :targets="weeklyTargets" />
  </template>
</template>

<style scoped>
/*
 * One board scrolls both ways: down through the hours, sideways where seven
 * columns do not fit. The heads stay on top, the hours on the left. Paint
 * containment makes it the box of everything positioned inside: the hidden
 * status lines of the far columns once widened the page to 789px at 375.
 */
.calendar-week {
  display: grid;
  grid-template-columns: 3rem repeat(7, minmax(7.5rem, 1fr));
  grid-template-rows: auto auto;
  height: max(24rem, calc(100dvh - var(--tab-bar-height) - var(--timer-bar-height, 0px) - 14rem));
  overflow: auto;
  contain: paint;
  overscroll-behavior: contain;
}

.calendar-week__corner,
.week-head {
  position: sticky;
  z-index: 3;
  top: 0;
  background: var(--color-ground);
}

.calendar-week__corner {
  left: 0;
  z-index: 4;
  border-bottom: 1px solid var(--color-line);
}

.week-head {
  display: grid;
  gap: 0.125rem;
  align-content: start;
  min-width: 0;
  padding: var(--space-2) var(--space-2) var(--space-3);
  border: 0;
  border-bottom: 1px solid var(--color-line);
  color: var(--color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms var(--ease-out);
}

.week-head:hover {
  background: var(--color-ground-deep);
}

/* Today: a line of ink under its head, as in the review's day chart. */
.week-head--today {
  box-shadow: inset 0 -2px 0 var(--color-ink);
}

.week-head__today {
  font-size: 0.8125rem;
  font-weight: 800;
  line-height: 1.2;
}

.week-head__day {
  font-size: 0.9375rem;
  font-variant-numeric: tabular-nums;
}

.week-head__day strong {
  font-weight: 800;
}

.week-head__details {
  display: grid;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}

.week-head__worked {
  color: var(--color-ink);
}

.calendar-week__hours {
  position: sticky;
  z-index: 2;
  left: 0;
  background: var(--color-ground);
}

.calendar-week__axis {
  position: relative;
  height: calc(var(--hours) * var(--hour));
  margin: var(--space-3) var(--space-2) var(--space-3) 0;
}

.calendar-week__axis > span {
  position: absolute;
  top: calc(var(--at) * var(--hour));
  right: 0;
  color: var(--color-ink-soft);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transform: translateY(-50%);
}

.calendar-week__axis > .calendar-week__now {
  top: calc(var(--minute-at) * var(--hour) / 60);
  padding: 0.125rem 0;
  background: var(--color-ground);
  color: var(--color-ink);
  font-weight: 800;
}

/* Each day a quiet lane; today's tinted. */
.week-column {
  min-width: 0;
  padding: var(--space-3) 0.125rem;
  border-left: 1px solid var(--color-line);
}

.week-column--today {
  background: var(--color-surface-faint);
}

@media (min-width: 56rem) {
  .calendar-week {
    height: max(28rem, calc(100dvh - 3.5rem - 13rem));
  }
}
</style>
