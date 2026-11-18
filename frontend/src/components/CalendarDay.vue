<script setup lang="ts">
import { computed, ref, watch } from "vue";
import DayReflection from "./DayReflection.vue";
import DayTimeline from "./DayTimeline.vue";
import DayWorkLogs from "./DayWorkLogs.vue";
import HistoryItem from "./HistoryItem.vue";
import HistoryPlannedItems, {
  type PlannedActions,
} from "./HistoryPlannedItems.vue";
import WeeklyTargets from "./WeeklyTargets.vue";
import type { WorkTarget } from "../api/work-logs.api";
import type {
  HistoryFilter,
  HistoryResponse,
  HistoryWeeklyTarget,
  HistoryWorkLog,
} from "../types/history";
import { hasEntries } from "../utils/history";
import { formatDuration, logBlocks, planBlocks } from "../utils/logbook";

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
const isEmpty = computed(
  () => !props.weeklyTargets.length && !hasEntries(props.day),
);
/** Only what has begun can have been worked on. */
const isPastOrToday = computed(() => props.day.date <= props.today);

const plan = computed(() => planBlocks(props.day));
const logs = computed(() =>
  (props.day.work.logs ?? []).filter((log) => !props.hiddenLogs?.has(log.id)),
);
/*
 * The day's total comes from the server, which still counts a stretch whose
 * delete is held back. Until the delete went through, the head shows no
 * figure rather than one that is about to be wrong.
 */
const holdsBack = computed(() =>
  (props.day.work.logs ?? []).some((log) => props.hiddenLogs?.has(log.id)),
);
const blocks = computed(() =>
  isPastOrToday.value
    ? logBlocks({ ...props.day.work, logs: logs.value }, props.day.date)
    : null,
);
const hasAxis = computed(() => plan.value.length > 0 || logs.value.length > 0);
const hasAside = computed(() => isPastOrToday.value || plan.value.length > 0);

/** Entries of the day that can take a manual work log. */
const workTargets = computed<WorkTarget[]>(() => {
  const seen = new Set<string>();
  return [...props.day.items, ...plannedItems.value].flatMap((entry) => {
    if (entry.id === null) return [];
    const kind =
      entry.type === "todo" ? ("todo" as const) : ("occurrence" as const);
    const key = `${kind}-${entry.id}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ kind, targetId: entry.id, title: entry.title }];
  });
});

const editing = ref<number | null>(null);
watch(
  () => props.day.date,
  () => {
    editing.value = null;
  },
);
</script>

<template>
  <div class="calendar-day" :class="{ 'calendar-day--split': hasAside }">
    <div class="calendar-day__list">
      <DayReflection v-if="isPastOrToday" :date="day.date" />

      <div v-if="isEmpty" class="empty-state calendar-day__empty">
        <strong>Für diesen Zeitraum gibt es nichts.</strong>
        <template v-if="filter !== 'all'">
          <span>Gezeigt werden nur {{ filterLabel }}.</span>
          <button type="button" class="btn" @click="emit('showAll')">
            Alle zeigen
          </button>
        </template>
      </div>

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
      <section v-if="plannedItems.length" aria-label="Offen / geplant">
        <h2 class="section-title">
          Offen / geplant <span class="count">{{ plannedItems.length }}</span>
        </h2>
        <HistoryPlannedItems :items="plannedItems" :actions="actions" />
      </section>

      <WeeklyTargets v-if="weeklyTargets.length" :targets="weeklyTargets" />
    </div>

    <!-- The plan and the Logbuch on one time axis, with the list to correct it. -->
    <section
      v-if="hasAside"
      class="calendar-day__axis"
      aria-labelledby="day-axis-title"
    >
      <h2 id="day-axis-title" class="section-title" tabindex="-1">
        <template v-if="isPastOrToday">
          Logbuch
          <span v-if="day.work.minutes && !holdsBack" class="count">{{
            formatDuration(day.work.minutes)
          }}</span>
        </template>
        <template v-else>Termine</template>
      </h2>
      <DayTimeline
        v-if="hasAxis"
        :plan="plan"
        :logs="blocks"
        @edit="editing = $event"
      />
      <template v-if="isPastOrToday">
        <p v-if="!logs.length" class="calendar-day__quiet">
          {{
            day.date === today
              ? "Heute wurde noch keine Zeit gemessen."
              : "An diesem Tag wurde keine Zeit gemessen."
          }}
        </p>
        <div v-if="logs.length || workTargets.length" class="card">
          <DayWorkLogs
            v-model:editing="editing"
            :date="day.date"
            :logs="logs"
            :targets="workTargets"
            :reload="reload"
            @remove="emit('removeLog', $event)"
          />
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.calendar-day__empty {
  margin-top: var(--space-5);
}

.entries {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.calendar-day__axis {
  display: grid;
  gap: var(--space-3);
  align-content: start;
}

.calendar-day__axis > .section-title {
  margin-bottom: 0;
}

.calendar-day__quiet {
  margin: 0;
  color: var(--color-ink-muted);
}

/* Wide screens: the list of the day beside its time axis. */
@media (min-width: 56rem) {
  .calendar-day--split {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(19rem, 24rem);
    gap: var(--space-6);
    align-items: start;
  }

  .calendar-day--split .calendar-day__axis > .section-title {
    margin-top: 0;
  }
}
</style>
