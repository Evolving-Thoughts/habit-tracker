<script setup lang="ts">
import { computed, ref } from "vue";
import DayBestDay from "./DayBestDay.vue";
import DayReflection from "./DayReflection.vue";
import PlannerItem from "./PlannerItem.vue";
import QuickAddQuest from "./QuickAddQuest.vue";
import AppIcon from "./AppIcon.vue";
import CalendarEventRow from "./CalendarEventRow.vue";
import {
  getPlan,
  rescheduleOccurrence,
  rescheduleTodo,
  reorderDay,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { useLoader } from "../composables/useLoader";
import { DAY_DROP, useSortable } from "../composables/useSortable";
import { useEventTick } from "../composables/useEventTick";
import {
  eventStaysLine,
  forecastStaysLine,
  runWindowLine,
} from "../utils/day-drop";
import { useWrites } from "../composables/useWrites";
import { useEventDrop, useForecastDrop } from "../composables/useEventDrop";
import type { WeekPlanEntry, WeekPlanResponse } from "../types/week-plan";
import { dayRelation, tallyLine } from "../utils/day-tally";
import { dayLabel } from "../utils/history";
import { asPlannerItem, relationLabel, tallyOfEntries } from "../utils/other-day";
import { planRow, rowMenu, type MenuEntry } from "../utils/row-actions";
import {
  boardDrop,
  doneEntries,
  DRAGGABLE,
  dropOnDay,
  dropRunOnDay,
  entryKey,
  isEvent,
  isMovable,
  isMovableRun,
  isForecast,
  openEntries,
  runMayMoveTo,
  withEventDone,
} from "../utils/week-plan";

/**
 * Heute on another day, reached with ‹ › in its head. The day comes from
 * the Plan's read, so a past day lists what was done and skipped, with the
 * day's reflection and its best; a later day lists what is planned, takes
 * new quests, sorts by dragging and moves a quest with its menu. The focus
 * card and the stopwatch stay with today. See docs/day-order.md › Andere Tage.
 */
const props = defineProps<{
  date: string;
  today: string;
  /** A dialog of the view is open: nothing here starts meanwhile. */
  held: boolean;
}>();
const emit = defineEmits<{
  /** A short line for above the list: what a drop did or why it did not. */
  notice: [line: string];
  edit: [
    target: { kind: "todo" | "habit"; entityId: number; occurrenceId?: number },
  ];
}>();

const {
  data: plan,
  isLoading,
  errorMessage,
  reload,
} = useLoader<WeekPlanResponse | null>(
  (signal) => getPlan(props.date, 1, signal),
  {
    initial: null,
    fallbackError: "Der Tag konnte nicht geladen werden.",
    params: [() => props.date],
    resetOnLoad: true,
    refreshOnChange: () => !props.held && !writes.busy.value,
  },
);
const writes = useWrites(reload, errorMessage);

const day = computed(() =>
  plan.value?.days.find((entry) => entry.date === props.date) ?? null,
);
const open = computed(() => (day.value ? openEntries(day.value) : []));
const done = computed(() => (day.value ? doneEntries(day.value) : []));
const relation = computed(() => dayRelation(props.date, props.today));
const ahead = computed(() => relation.value === "future");
const tally = computed(() =>
  day.value
    ? tallyLine(tallyOfEntries(day.value.entries), relation.value)
    : null,
);
/* "morgen", "gestern"; a day further away by its date ("Donnerstag, 3. Dez."). */
const name = computed(() => {
  const relation = relationLabel(props.date, props.today);
  if (!relation) return "heute";
  return /^(in|vor) /.test(relation)
    ? dayLabel(props.date)
    : relation.toLowerCase();
});

const busy = computed(() => props.held || writes.busy.value);

const list = ref<HTMLElement | null>(null);
/* Status line for a move: read out, since the card itself moved. */
const status = ref("");
useSortable(list, {
  item: DRAGGABLE,
  accepts: () => !busy.value,
  onMove: (_from, _to, { item, list: target, index }) => {
    const drop = boardDrop(item, target, index);
    if (!drop || busy.value) return;
    if (drop.kind === "day") void applyDrop(drop.drop);
    else if (drop.kind === "run") void applyRunDrop(drop.drop);
    else if (drop.kind === "event") void applyEventDrop(drop.drop);
    else if (drop.kind === "forecast") void applyForecastDrop(drop.drop);
    else if (drop.kind === "refused") emit("notice", forecastStaysLine(drop.title));
  },
  // A card dropped on "Heute" in the head moves to today.
  dropTarget: {
    selector: DAY_DROP,
    accepts: (card, target) =>
      !busy.value && !!movedTo(card, target.dataset.date ?? ""),
    onDrop: async (card, target) => {
      const date = target.dataset.date ?? "";
      const entry = movedTo(card, date);
      if (!entry || busy.value) return;
      // A drop needs no question: an appointment moves with its time.
      const moved = isMovable(entry)
        ? await writes.write(() => rescheduleTodo(entry.todoId, date, true), {
            key: `todo-${entry.todoId}`,
            fallbackError: "Die Quest konnte nicht verschoben werden.",
          })
        : await writes.write(
            () => rescheduleOccurrence(entry.occurrenceId, date),
            {
              key: `run-${entry.occurrenceId}`,
              fallbackError: "Das Daily konnte nicht verschoben werden.",
            },
          );
      const where = relationLabel(date, props.today)?.toLowerCase() ?? "heute";
      if (moved) emit("notice", `„${entry.title}“ steht jetzt bei ${where}.`);
    },
    // What may not move says why instead of failing in silence.
    onRefuse: (card) => {
      const eventId = Number(card.dataset.eventId);
      const runId = Number(card.dataset.runId);
      const entry = open.value.find(
        (item) =>
          (isEvent(item) && item.eventId === eventId) ||
          (isMovableRun(item) && item.occurrenceId === runId),
      );
      const forecastId = Number(card.dataset.forecastId);
      if (forecastId) {
        emit("notice", forecastStaysLine(card.dataset.title ?? ""));
        return;
      }
      if (!entry) return;
      if (isEvent(entry)) emit("notice", eventStaysLine(entry.title));
      else if (isMovableRun(entry))
        emit("notice", runWindowLine(entry.title, entry.moveUntil, props.today));
    },
  },
});

/** The open quest or run on `card` when it may move to `date`. */
function movedTo(card: HTMLElement, date: string) {
  if (!date || date === props.date) return null;
  const todoId = Number(card.dataset.todoId);
  const runId = Number(card.dataset.runId);
  const entry = open.value.find(
    (item) =>
      (isMovable(item) && item.todoId === todoId) ||
      (isMovableRun(item) && item.occurrenceId === runId),
  );
  if (!entry) return null;
  if (isMovable(entry)) return entry;
  return isMovableRun(entry) && runMayMoveTo(entry, date, props.today)
    ? entry
    : null;
}

/* A Google event ticked off here: the rule Heute has. */
const tickEvent = useEventTick(
  plan,
  writes,
  withEventDone,
  (line) => (status.value = line),
);

async function applyDrop(drop: Parameters<typeof dropOnDay>[1]): Promise<void> {
  const before = plan.value;
  const result = before && dropOnDay(before, drop);
  if (!result) return;
  await writes.writeShown(
    () => {
      plan.value = result.plan;
      status.value = "Reihenfolge gespeichert.";
      return () => {
        plan.value = before;
        status.value = "";
      };
    },
    async () => {
      if (result.write.order) await reorderDay(result.write.order);
    },
    { key: "day", fallbackError: "Die Reihenfolge konnte nicht gespeichert werden." },
  );
}

async function applyRunDrop(
  drop: Parameters<typeof dropRunOnDay>[1],
): Promise<void> {
  const before = plan.value;
  const result = before && dropRunOnDay(before, drop);
  if (!result) return;
  await writes.writeShown(
    () => {
      plan.value = result.plan;
      status.value = "Reihenfolge gespeichert.";
      return () => {
        plan.value = before;
        status.value = "";
      };
    },
    async () => {
      if (result.write.order) await reorderDay(result.write.order);
    },
    { key: "day", fallbackError: "Die Reihenfolge konnte nicht gespeichert werden." },
  );
}

/* A Google event sorted within the day: the rule all day views share. */
const applyEventDrop = useEventDrop(plan, writes, {
  key: "day",
  said: (line) => (status.value = line),
});
/* A forecast run sorted within the day: its place waits for the day. */
const applyForecastDrop = useForecastDrop(plan, writes, {
  key: "day",
  said: (line) => (status.value = line),
});

function edit(entry: WeekPlanEntry): void {
  if (busy.value || isEvent(entry)) return;
  if (entry.type === "todo") emit("edit", { kind: "todo", entityId: entry.todoId });
  else
    emit("edit", {
      kind: "habit",
      entityId: entry.habitId,
      occurrenceId: entry.occurrenceId ?? undefined,
    });
}

function toggle(entry: WeekPlanEntry): void {
  if (entry.type !== "todo" || busy.value) return;
  const completed = entry.status !== "completed";
  void writes.write(() => updateTodoCompletion(entry.todoId, completed), {
    key: `todo-${entry.todoId}`,
    fallbackError: completed
      ? "Die Quest konnte nicht abgehakt werden."
      : "Die Quest konnte nicht wieder geöffnet werden.",
  });
}

/**
 * "Heute", "Morgen", "Nächste Woche": the quick moves Heute's cards have.
 * Only these: a tap on the card edits it; the rest of Heute's menu is not
 * offered on another day.
 */
function menu(entry: WeekPlanEntry): MenuEntry[] {
  return rowMenu({
    row: planRow(entry, props.date),
    today: props.today,
    busy: busy.value,
    move: (date) => {
      if (isMovable(entry))
        void writes.write(() => rescheduleTodo(entry.todoId, date, false), {
          key: `todo-${entry.todoId}`,
          fallbackError: "Die Quest konnte nicht verschoben werden.",
        });
      else if (isMovableRun(entry))
        void writes.write(() => rescheduleOccurrence(entry.occurrenceId, date), {
          key: `run-${entry.occurrenceId}`,
          fallbackError: "Das Daily konnte nicht verschoben werden.",
        });
    },
  });
}

</script>

<template>
  <div class="other-day" :data-date="date">
    <p v-if="tally" class="other-day__tally">{{ tally }}</p>

    <QuickAddQuest
      v-if="ahead"
      :date="date"
      :label="`Quest für ${name} hinzufügen`"
      @created="writes.applied()"
    />

    <div v-if="errorMessage" class="alert other-day__error">
      <p role="alert">{{ errorMessage }}</p>
      <button
        class="btn btn--ground"
        type="button"
        :disabled="isLoading"
        @click="reload()"
      >
        <AppIcon name="refresh" />Erneut versuchen
      </button>
    </div>

    <div
      v-if="isLoading"
      class="other-day__loading"
      role="status"
      aria-label="Tag wird geladen"
    >
      <span class="other-day__bone" />
      <span class="other-day__bone" />
    </div>

    <template v-else-if="day">
      <p v-if="!day.entries.length" class="other-day__empty">
        {{
          ahead
            ? `Für ${name} ist noch nichts geplant.`
            : "An diesem Tag ist nichts erledigt worden."
        }}
      </p>

      <!--
        The day's open entries in its order, its Google events among them at
        their places (the server's order). Quests, stored runs and, on a
        later day, the events drag, like Heute's; an event keeps its time.
        The cards' titles are h3: the list carries its h2 for screen readers.
      -->
      <h2 v-if="open.length" class="visually-hidden">
        {{ ahead ? "Geplant" : "Offen" }}
      </h2>
      <div
        v-if="open.length"
        ref="list"
        class="other-day__list"
        :data-date="date"
      >
        <template v-for="entry in open" :key="entryKey(entry, date)">
          <CalendarEventRow
            v-if="isEvent(entry)"
            :data-event-id="ahead ? entry.eventId : undefined"
            :draggable="ahead"
            checkable
            :time="entry.timeOfDay ?? ''"
            :title="entry.title"
            :past="!ahead"
            :busy="writes.isWriting(`event-${entry.eventId}`)"
            @toggle="tickEvent({ id: entry.eventId, title: entry.title }, true)"
          />
          <PlannerItem
            v-else
            :data-todo-id="isMovable(entry) ? entry.todoId : undefined"
            :data-run-id="isMovableRun(entry) ? entry.occurrenceId : undefined"
            :data-forecast-id="ahead && isForecast(entry) && entry.type === 'habit' ? entry.habitId : undefined"
            :data-forecast-date="ahead && isForecast(entry) ? date : undefined"
            :data-title="ahead && isForecast(entry) ? entry.title : undefined"
            :item="asPlannerItem(entry, date)"
            :is-updating="busy"
            :checkable="entry.type === 'todo'"
            :measurable="false"
            :menu="menu(entry)"
            :sortable="isMovable(entry) || isMovableRun(entry) || (ahead && isForecast(entry))"
            :forecast="isForecast(entry)"
            :time="entry.timeOfDay"
            @toggle="toggle(entry)"
            @edit="edit(entry)"
          />
        </template>
      </div>

      <section v-if="done.length" class="other-day__done" aria-label="Abgeschlossen">
        <h2 class="other-day__heading">Abgeschlossen</h2>
        <template v-for="entry in done" :key="entryKey(entry, date)">
          <CalendarEventRow
            v-if="isEvent(entry)"
            checkable
            done
            :time="entry.timeOfDay ?? ''"
            :title="entry.title"
            :busy="writes.isWriting(`event-${entry.eventId}`)"
            @toggle="tickEvent({ id: entry.eventId, title: entry.title }, false)"
          />
          <PlannerItem
            v-else
            :item="asPlannerItem(entry, date)"
            :is-updating="busy"
            :checkable="entry.type === 'todo'"
            :measurable="false"
            @toggle="toggle(entry)"
            @edit="edit(entry)"
          />
        </template>
      </section>
    </template>

    <!-- A day that is over: what it was, in words. -->
    <template v-if="!ahead">
      <DayReflection :key="`reflection-${date}`" :date="date" />
      <DayBestDay :key="`best-${date}`" :date="date" />
    </template>

    <p class="visually-hidden" role="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.other-day {
  display: grid;
  gap: var(--space-3);
}
.other-day__tally {
  margin: 0;
  color: var(--color-ink-muted);
  font-weight: 700;
}
.other-day__list,
.other-day__done {
  display: grid;
  gap: var(--space-2);
}
.other-day__heading {
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}
.other-day__empty {
  margin: 0;
  padding: var(--space-5) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink-muted);
  text-align: center;
}
.other-day__loading {
  display: grid;
  gap: var(--space-2);
}
.other-day__bone {
  height: 4rem;
  border-radius: var(--radius-card);
  background: var(--color-ground-deep);
}
</style>
