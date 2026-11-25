<script setup lang="ts">
import { computed } from "vue";
import { useMediaQuery } from "../composables/useMediaQuery";
import DayBestDay from "./DayBestDay.vue";
import DayCalendar from "./DayCalendar.vue";
import DayReflection from "./DayReflection.vue";
import HistoryItem from "./HistoryItem.vue";
import HistoryPlannedItems, {
  type PlannedActions,
} from "./HistoryPlannedItems.vue";
import WeeklyTargets from "./WeeklyTargets.vue";
import type {
  HistoryFilter,
  HistoryResponse,
  HistoryWeeklyTarget,
  HistoryWorkLog,
} from "../types/history";
import { dayRelation, tallyLine, tallyOfHistoryDay } from "../utils/day-tally";
import { hasEntries } from "../utils/history";

type Day = HistoryResponse["days"][number];

const props = defineProps<{
  day: Day;
  today: string;
  weeklyTargets: HistoryWeeklyTarget[];
  filter: HistoryFilter;
  filterLabel: string;
  actions: PlannedActions;
  reload: (showPageLoading?: boolean) => Promise<void>;
  /** Stretches whose delete waits behind the undo toast: already out of view. */
  hiddenLogs?: ReadonlySet<number>;
}>();
const emit = defineEmits<{ showAll: []; removeLog: [log: HistoryWorkLog] }>();

const completedItems = computed(() =>
  props.day.items.filter((item) => item.status === "completed"),
);
const skippedItems = computed(() =>
  props.day.items.filter((item) => item.status === "skipped"),
);
const plannedItems = computed(() => props.day.planned ?? []);
/*
 * The server sorts open entries like Heute: appointments by time, the rest
 * in the day's order. What waits from an earlier day has its own group, as
 * Heute's Nachholen, so the day's own count stays the day's own.
 */
const ownItems = computed(() =>
  plannedItems.value.filter((item) => !item.isOverdue),
);
const carriedItems = computed(() =>
  plannedItems.value.filter((item) => item.isOverdue),
);
/** The day counted by the rule every view shares. */
const tally = computed(() =>
  tallyLine(
    tallyOfHistoryDay(props.day),
    dayRelation(props.day.date, props.today),
  ),
);
const isEmpty = computed(
  () => !props.weeklyTargets.length && !hasEntries(props.day),
);
/** Only what has begun can be reflected on, or have had its best. */
const isPastOrToday = computed(() => props.day.date <= props.today);
/**
 * Beside its calendar (from 56rem) the day opens with its reflection; on a
 * phone its plan comes first, then the reflection and the day's best.
 */
const wide = useMediaQuery("(min-width: 56rem)");
</script>

<template>
  <div class="calendar-day">
    <div class="calendar-day__list">
      <template v-if="wide && isPastOrToday">
        <DayReflection :date="day.date" />
        <DayBestDay :date="day.date" />
      </template>

      <div v-if="isEmpty" class="empty-state calendar-day__empty">
        <strong>Für diesen Zeitraum gibt es nichts.</strong>
        <template v-if="filter !== 'all'">
          <span>Gezeigt werden nur {{ filterLabel }}.</span>
          <button type="button" class="btn" @click="emit('showAll')">
            Alle zeigen
          </button>
        </template>
      </div>

      <p v-if="tally" class="calendar-day__tally">{{ tally }}</p>
      <section v-if="ownItems.length" aria-label="Offen / geplant">
        <h2 class="section-title">
          Offen / geplant <span class="count">{{ ownItems.length }}</span>
        </h2>
        <HistoryPlannedItems :items="ownItems" :actions="actions" />
      </section>
      <section v-if="carriedItems.length" aria-label="Von früher">
        <h2 class="section-title">
          Von früher <span class="count">{{ carriedItems.length }}</span>
        </h2>
        <HistoryPlannedItems :items="carriedItems" :actions="actions" />
      </section>
      <!-- Past days keep what happened in the order it happened. -->
      <section v-if="completedItems.length" aria-label="Erledigt">
        <h2 class="section-title">
          Erledigt <span class="count">{{ completedItems.length }}</span>
        </h2>
        <ul class="entries">
          <HistoryItem
            v-for="item in completedItems"
            :key="`${item.type}-${item.id}`"
            :item="item"
          />
        </ul>
      </section>
      <section v-if="skippedItems.length" aria-label="Übersprungen">
        <h2 class="section-title">
          Übersprungen <span class="count">{{ skippedItems.length }}</span>
        </h2>
        <ul class="entries">
          <HistoryItem
            v-for="item in skippedItems"
            :key="`${item.type}-${item.id}`"
            :item="item"
          />
        </ul>
      </section>

      <div
        v-if="!wide && isPastOrToday"
        class="calendar-day__reflection"
      >
        <DayReflection :date="day.date" />
        <DayBestDay :date="day.date" />
      </div>

      <WeeklyTargets v-if="weeklyTargets.length" :targets="weeklyTargets" />
    </div>

    <!-- The plan and the Logbuch on one hour axis; a block opens to correct it. -->
    <DayCalendar
      class="calendar-day__calendar"
      :day="day"
      :today="today"
      :reload="reload"
      :hidden-logs="hiddenLogs"
      @remove-log="emit('removeLog', $event)"
    />
  </div>
</template>

<style scoped>
.calendar-day {
  display: grid;
  gap: var(--space-6);
}

.calendar-day__empty {
  margin-top: var(--space-5);
}

/* The day's best right below the reflection, as its companion. */
.calendar-day__list > .day-best-day,
.calendar-day__reflection > .day-best-day {
  margin-top: var(--space-2);
}

/* After the day's plan on a phone, set apart like a section. */
.calendar-day__reflection {
  margin-top: var(--space-6);
}

.calendar-day__tally {
  margin: var(--space-4) 0 0;
  color: var(--color-ink-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.entries {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * Below the list on a phone the day's calendar takes its natural height and
 * scrolls with the page: no scroll area inside the scrolling page.
 */
.calendar-day__calendar {
  height: auto;
}

.calendar-day__calendar :deep(.day-calendar__scroller) {
  overflow: clip;
}

/*
 * Wide screens: the list of the day beside its calendar, which stays in
 * view at the full height of the window while the list scrolls.
 */
@media (min-width: 56rem) {
  .calendar-day {
    grid-template-columns: minmax(0, 1fr) clamp(22rem, 38%, 30rem);
    align-items: start;
  }

  .calendar-day__calendar {
    position: sticky;
    top: calc(3.5rem + var(--space-4));
    height: calc(100dvh - 3.5rem - var(--space-6));
  }

  .calendar-day__calendar :deep(.day-calendar__scroller) {
    overflow-y: auto;
  }
}
</style>
