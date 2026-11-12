<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import {
  getToday,
  rescheduleOccurrence,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { useListFocus } from "../composables/useListFocus";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import AppIcon from "../components/AppIcon.vue";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import PlannerItem from "../components/PlannerItem.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import MoveItemDialog from "../components/MoveItemDialog.vue";
import ReplanDialog from "../components/ReplanDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import type {
  DayPlannerHabitItem,
  DayPlannerItem,
  DayPlannerResponse,
} from "../types/day-planner";
import { addDays, formatDateForGermanDisplay } from "../utils/date";
import {
  arrangeToday,
  formatDayHeading,
  formatDuration,
  nowInBerlin,
  plannedClock,
} from "../utils/today-agenda";
import { categoryMark } from "../utils/category-mark";

type EditingTarget = {
  kind: "todo" | "habit";
  entityId: number;
};

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const editingTarget = ref<EditingTarget | null>(null);
const editorBusy = ref(false);
const movingItem = ref<DayPlannerItem | null>(null);
const replanOpen = ref(false);
const creationOpen = ref(false);
const creationMessage = ref<string | null>(null);
const catchUpOpen = ref(false);
const resolvedOpen = ref(false);

const {
  data: planner,
  isLoading,
  errorMessage,
  reload: loadToday,
} = useLoader<DayPlannerResponse | null>(getToday, {
  initial: null,
  fallbackError: "Ein unbekannter Fehler ist aufgetreten.",
  refreshOnChange: () =>
    !editorBusy.value &&
    !editingTarget.value &&
    !movingItem.value &&
    !replanOpen.value &&
    !creationOpen.value &&
    !writes.busy.value,
});
const writes = useWrites(loadToday, errorMessage);

/* The clock moves the focus and the "now" line along through the day. */
const now = ref(nowInBerlin());
let clock: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  clock = setInterval(() => (now.value = nowInBerlin()), 60_000);
});
onUnmounted(() => {
  clearInterval(clock);
  clearTimeout(undoTimer);
});

const agenda = computed(() =>
  planner.value ? arrangeToday(planner.value, now.value) : null,
);
const heading = computed(() =>
  planner.value ? formatDayHeading(planner.value.date) : "Heute",
);
const progress = computed(() => {
  if (!agenda.value || !planner.value || !agenda.value.total) return [];
  const parts = [`${agenda.value.done} von ${agenda.value.total} erledigt`];
  if (planner.value.workedMinutes > 0)
    parts.push(`${formatDuration(planner.value.workedMinutes)} gearbeitet`);
  return parts;
});
const hasItems = computed(
  () =>
    (planner.value?.items.length ?? 0) > 0 ||
    (planner.value?.externalEvents.length ?? 0) > 0,
);
const focusGoal = computed(() => {
  const goal = agenda.value?.focus?.goal;
  if (!goal) return null;
  if (goal.target === null) return `Teil von: ${goal.title}`;
  const until = goal.periodEnd
    ? ` bis ${formatDateForGermanDisplay(goal.periodEnd)}`
    : "";
  return `${goal.title}: ${goal.completed} von ${goal.target}${until}`;
});
const focusMeta = computed(() => {
  const focus = agenda.value?.focus;
  if (!focus) return [];
  const parts: string[] = [];
  const planned = plannedClock(focus);
  if (planned) parts.push(planned.time);
  if (focus.plannedDurationMinutes != null)
    parts.push(
      focus.workedMinutes > 0
        ? `${focus.workedMinutes}/${focus.plannedDurationMinutes} Min.`
        : `${focus.plannedDurationMinutes} Min.`,
    );
  if (focus.type === "todo" && focus.isFixed) parts.push("Fester Termin");
  return parts;
});

type Undo = { item: DayPlannerItem; label: string };
const undo = ref<Undo | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | undefined;
function offerUndo(item: DayPlannerItem, label: string): void {
  clearTimeout(undoTimer);
  undo.value = { item, label };
  undoTimer = setTimeout(() => (undo.value = null), 5000);
}

function getItemKey(item: DayPlannerItem): string {
  return item.type === "todo"
    ? `todo-${item.todoId}`
    : `habit-${item.occurrenceId}`;
}

function isUpdating(item: DayPlannerItem): boolean {
  return editorBusy.value || writes.isWriting(getItemKey(item));
}

async function toggleItem(item: DayPlannerItem): Promise<void> {
  if (isUpdating(item)) {
    return;
  }

  const completing = item.status === "pending";
  const done = await writes.write(
    () =>
      item.type === "todo"
        ? updateTodoCompletion(item.todoId, item.status !== "completed")
        : updateOccurrenceStatus(
            item.occurrenceId,
            item.status === "pending" ? "completed" : "pending",
          ),
    {
      key: getItemKey(item),
      fallbackError: "Der Eintrag konnte nicht aktualisiert werden.",
    },
  );
  if (done && completing) offerUndo(item, `„${item.title}“ erledigt`);
}

async function undoLast(): Promise<void> {
  const last = undo.value;
  if (!last) return;
  clearTimeout(undoTimer);
  undo.value = null;
  await writes.write(
    () =>
      last.item.type === "todo"
        ? updateTodoCompletion(last.item.todoId, false)
        : updateOccurrenceStatus(last.item.occurrenceId, "pending"),
    {
      key: getItemKey(last.item),
      fallbackError: "Das Rückgängigmachen hat nicht geklappt.",
    },
  );
}

async function skipHabit(item: DayPlannerHabitItem): Promise<void> {
  if (isUpdating(item)) {
    return;
  }

  await writes.write(
    () => updateOccurrenceStatus(item.occurrenceId, "skipped"),
    {
      key: getItemKey(item),
      fallbackError: "Das Habit konnte nicht übersprungen werden.",
    },
  );
}

/** Movable to `date` without a dialog; fixed todos and habit limits ask. */
function quickMovable(item: DayPlannerItem, date: string): boolean {
  if (item.type === "todo") return item.scheduledAt !== null && !item.isFixed;
  return item.moveUntil !== null && date <= item.moveUntil;
}

function moveTo(item: DayPlannerItem, date: string): Promise<boolean> {
  return writes.write(
    () =>
      item.type === "todo"
        ? rescheduleTodo(item.todoId, date, false)
        : rescheduleOccurrence(item.occurrenceId, date),
    {
      key: getItemKey(item),
      fallbackError: "Der Eintrag konnte nicht verschoben werden.",
    },
  );
}

const quickToday = computed(() => {
  const today = planner.value?.date;
  if (!today || !agenda.value) return [];
  return agenda.value.carriedOver.filter((item) => quickMovable(item, today));
});
const tomorrow = computed(() =>
  planner.value ? addDays(planner.value.date, 1) : "",
);

async function catchUpAll(): Promise<void> {
  const today = planner.value?.date;
  if (!today) return;
  for (const item of quickToday.value) {
    if (!(await moveTo(item, today))) return;
  }
}

function openEditing(item: DayPlannerItem): void {
  if (editorBusy.value || writes.busy.value) {
    return;
  }

  listFocus.remember(getItemKey(item));
  editingTarget.value =
    item.type === "todo"
      ? {
          kind: "todo",
          entityId: item.todoId,
        }
      : {
          kind: "habit",
          entityId: item.habitId,
        };
}

function closeEditing(): void {
  editingTarget.value = null;
  editorBusy.value = false;
}

async function onEditorChanged(): Promise<void> {
  await writes.applied();
  closeEditing();
}

function openMoving(item: DayPlannerItem): void {
  if (editorBusy.value || writes.busy.value) {
    return;
  }

  listFocus.remember(getItemKey(item));
  movingItem.value = item;
}

function closeMoving(): void {
  movingItem.value = null;
  editorBusy.value = false;
}

async function onMoved(): Promise<void> {
  await writes.applied();
  closeMoving();
}

function closeReplan(): void {
  replanOpen.value = false;
  editorBusy.value = false;
}

async function onReplanned(): Promise<void> {
  await writes.applied();
  closeReplan();
}

function openCreation(): void {
  if (
    isLoading.value ||
    editorBusy.value ||
    writes.busy.value ||
    editingTarget.value
  )
    return;
  creationMessage.value = null;
  creationOpen.value = true;
}
async function onCreated(kind: "todo" | "habit"): Promise<void> {
  creationMessage.value =
    kind === "todo"
      ? "Todo erstellt. Ohne Zeitpunkt findest du es im Todo-Dump."
      : "Habit erstellt. Es erscheint ab seinem Startdatum an fälligen Tagen.";
  await writes.applied();
  creationOpen.value = false;
}
</script>

<template>
  <main ref="page" class="today-view">
    <CreateButton
      label="Eintrag erstellen"
      :disabled="
        isLoading || editorBusy || writes.busy.value || editingTarget !== null
      "
      @click="openCreation"
    />
    <header class="today-view__header">
      <div class="today-view__title">
        <h1>{{ heading }}</h1>
        <p v-if="progress.length" class="today-view__progress">
          <span v-for="part in progress" :key="part">{{ part }}</span>
        </p>
      </div>
      <button
        class="today-view__replan"
        type="button"
        :disabled="isLoading || editorBusy"
        @click="replanOpen = true"
      >
        <AppIcon name="replan" />
        <span>Neu planen</span>
      </button>
    </header>

    <CreateItemDialog
      v-if="creationOpen"
      mode="choose"
      @close="creationOpen = false"
      @created="onCreated"
    />
    <p v-if="creationMessage" class="today-view__notice" role="status">
      {{ creationMessage }}
    </p>

    <EditItemDialog
      v-if="editingTarget"
      :key="`${editingTarget.kind}-${editingTarget.entityId}`"
      :kind="editingTarget.kind"
      :entity-id="editingTarget.entityId"
      :return-focus="listFocus.returnFocus"
      @busy="editorBusy = $event"
      @changed="onEditorChanged"
      @close="closeEditing"
    />

    <ReplanDialog
      v-if="replanOpen"
      :return-focus="() => null"
      :carried-over="agenda?.carriedOver.length ?? 0"
      @busy="editorBusy = $event"
      @applied="onReplanned"
      @close="closeReplan"
    />

    <MoveItemDialog
      v-if="movingItem && planner"
      :item="movingItem"
      :today="planner.date"
      :offer-today="movingItem.isOverdue"
      :return-focus="listFocus.returnFocus"
      @busy="editorBusy = $event"
      @moved="onMoved"
      @close="closeMoving"
    />

    <p v-if="errorMessage" class="today-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <div
      v-if="isLoading"
      class="today-view__loading"
      role="status"
      aria-label="Tagesplan wird geladen"
    >
      <span class="today-view__bone today-view__bone--focus" />
      <span class="today-view__bone" />
      <span class="today-view__bone" />
    </div>

    <section v-else-if="!hasItems && !errorMessage" class="today-view__empty">
      <h2>Für heute ist nichts geplant.</h2>
      <p>Genieße den freien Raum oder plane über das Plus einen Eintrag.</p>
    </section>

    <template v-else-if="agenda && hasItems">
      <section
        v-if="agenda.focus"
        class="focus"
        :data-focus-key="getItemKey(agenda.focus)"
        aria-labelledby="focus-title"
      >
        <h2 id="focus-title" class="focus__title">{{ agenda.focus.title }}</h2>
        <p v-if="agenda.focus.why" class="focus__why">
          {{ agenda.focus.why }}
        </p>
        <p v-if="focusMeta.length || focusGoal" class="focus__meta">
          <span v-if="agenda.focus.categoryName" class="focus__category">
            <i
              class="category-mark"
              :style="{ background: categoryMark(agenda.focus.categoryName) }"
              aria-hidden="true"
            />{{ agenda.focus.categoryName }}
          </span>
          <span v-for="part in focusMeta" :key="part">{{ part }}</span>
          <span v-if="focusGoal">{{ focusGoal }}</span>
        </p>
        <div class="focus__actions">
          <button
            class="focus__done"
            type="button"
            :disabled="isUpdating(agenda.focus)"
            :aria-label="`${agenda.focus.title} erledigen`"
            @click="toggleItem(agenda.focus)"
          >
            <AppIcon name="check" />
            <span>Erledigt</span>
          </button>
          <ItemPlayButton
            :kind="agenda.focus.type === 'todo' ? 'todo' : 'occurrence'"
            :target-id="
              agenda.focus.type === 'todo'
                ? agenda.focus.todoId
                : agenda.focus.occurrenceId
            "
            :title="agenda.focus.title"
            :duration="agenda.focus.plannedDurationMinutes"
            :eligible="agenda.focus.timerEligible"
            :disabled="isUpdating(agenda.focus)"
          />
          <button
            v-if="agenda.focus.type === 'habit'"
            class="focus__more focus__more--tinted"
            type="button"
            :disabled="isUpdating(agenda.focus)"
            :aria-label="`${agenda.focus.title} überspringen`"
            @click="skipHabit(agenda.focus)"
          >
            Überspringen
          </button>
          <button
            class="focus__more focus__more--tinted"
            data-edit-button
            type="button"
            :disabled="isUpdating(agenda.focus)"
            :aria-label="`${agenda.focus.title} bearbeiten`"
            @click="openEditing(agenda.focus)"
          >
            Bearbeiten
          </button>
        </div>
      </section>
      <section v-else-if="!agenda.carriedOver.length" class="today-view__empty">
        <h2>Alles für heute erledigt.</h2>
        <p>Der Rest des Tages gehört dir.</p>
      </section>

      <p v-if="agenda.focus && agenda.next" class="today-view__next">
        <span>Danach</span>
        {{ agenda.next.time }}
        {{
          agenda.next.kind === "item"
            ? agenda.next.item.title
            : agenda.next.event.title
        }}
      </p>

      <section
        v-if="agenda.carriedOver.length"
        class="catch-up"
        aria-label="Einträge von früher"
      >
        <button
          class="catch-up__toggle"
          type="button"
          :aria-expanded="catchUpOpen"
          aria-controls="catch-up-list"
          @click="catchUpOpen = !catchUpOpen"
        >
          <span>
            {{
              agenda.carriedOver.length === 1
                ? "1 Eintrag von früher"
                : `${agenda.carriedOver.length} Einträge von früher`
            }}
          </span>
          <span class="catch-up__hint">Nachholen</span>
          <AppIcon name="chevron" />
        </button>
        <div v-if="catchUpOpen" id="catch-up-list" class="catch-up__body">
          <button
            v-if="quickToday.length > 1"
            class="catch-up__all"
            type="button"
            :disabled="writes.busy.value"
            @click="catchUpAll"
          >
            Alle {{ quickToday.length }} heute einplanen
          </button>
          <PlannerItem
            v-for="item in agenda.carriedOver"
            :key="getItemKey(item)"
            class="catch-up__row"
            :data-focus-key="getItemKey(item)"
            :item="item"
            :is-updating="isUpdating(item)"
            show-date
            compact
            @toggle="toggleItem"
            @edit="openEditing"
          >
            <button
              v-if="planner && quickMovable(item, planner.date)"
              class="catch-up__chip"
              type="button"
              :disabled="isUpdating(item)"
              :aria-label="`${item.title} heute einplanen`"
              @click="moveTo(item, planner.date)"
            >
              Heute
            </button>
            <button
              v-if="quickMovable(item, tomorrow)"
              class="catch-up__chip"
              type="button"
              :disabled="isUpdating(item)"
              :aria-label="`${item.title} auf morgen`"
              @click="moveTo(item, tomorrow)"
            >
              Morgen
            </button>
            <button
              v-if="
                item.type === 'todo'
                  ? item.scheduledAt !== null
                  : !!item.moveUntil
              "
              class="catch-up__chip"
              type="button"
              data-move-button
              :disabled="isUpdating(item)"
              :aria-label="`${item.title} auf einen anderen Tag`"
              @click="openMoving(item)"
            >
              Anderer Tag
            </button>
            <button
              v-if="item.type === 'habit'"
              class="catch-up__chip"
              type="button"
              :disabled="isUpdating(item)"
              :aria-label="`${item.title} überspringen`"
              @click="skipHabit(item)"
            >
              Überspringen
            </button>
          </PlannerItem>
        </div>
      </section>

      <section
        v-if="agenda.timeline.length"
        class="timeline"
        aria-labelledby="timeline-title"
      >
        <h2 id="timeline-title" class="today-view__section-title">
          Tagesablauf
        </h2>
        <ol class="timeline__list">
          <template
            v-for="(entry, index) in agenda.timeline"
            :key="
              entry.kind === 'item'
                ? getItemKey(entry.item)
                : `event-${entry.event.id}`
            "
          >
            <li v-if="index === agenda.nowIndex" class="timeline__now">
              Jetzt
            </li>
            <li :class="{ 'timeline__entry--past': index < agenda.nowIndex }">
              <PlannerItem
                v-if="entry.kind === 'item'"
                :data-focus-key="getItemKey(entry.item)"
                :item="entry.item"
                :time="entry.time"
                :is-updating="isUpdating(entry.item)"
                @toggle="toggleItem"
                @skip="skipHabit"
                @edit="openEditing"
                @move="openMoving"
              />
              <div v-else class="timeline__event">
                <span class="timeline__time">{{ entry.time }}</span>
                <span class="timeline__event-title">
                  {{ entry.event.title }}
                </span>
                <span class="timeline__source">Google Kalender</span>
              </div>
            </li>
          </template>
          <li
            v-if="agenda.nowIndex === agenda.timeline.length"
            class="timeline__now"
          >
            Jetzt
          </li>
        </ol>
      </section>

      <section
        v-if="agenda.anytime.length"
        class="timeline"
        aria-labelledby="anytime-title"
      >
        <h2 id="anytime-title" class="today-view__section-title">
          Irgendwann heute
        </h2>
        <div class="timeline__list">
          <PlannerItem
            v-for="item in agenda.anytime"
            :key="getItemKey(item)"
            :data-focus-key="getItemKey(item)"
            :item="item"
            :is-updating="isUpdating(item)"
            @toggle="toggleItem"
            @skip="skipHabit"
            @edit="openEditing"
            @move="openMoving"
          />
        </div>
      </section>

      <section v-if="agenda.resolved.length" class="resolved">
        <button
          class="resolved__toggle"
          type="button"
          :aria-expanded="resolvedOpen"
          aria-controls="resolved-list"
          @click="resolvedOpen = !resolvedOpen"
        >
          {{ agenda.resolved.length }} abgeschlossen
          <AppIcon name="chevron" />
        </button>
        <div v-if="resolvedOpen" id="resolved-list" class="timeline__list">
          <PlannerItem
            v-for="item in agenda.resolved"
            :key="getItemKey(item)"
            :data-focus-key="getItemKey(item)"
            :item="item"
            :is-updating="isUpdating(item)"
            @toggle="toggleItem"
            @skip="skipHabit"
            @edit="openEditing"
            @move="openMoving"
          />
        </div>
      </section>
    </template>

    <UndoToast
      class="today-view__toast"
      :label="undo?.label ?? null"
      @undo="undoLast"
    />
  </main>
</template>

<style scoped>
.today-view {
  width: min(100% - 2rem, var(--page-width));
  margin: 0 auto;
  padding: var(--space-5) 0 6rem;
}

.today-view__header {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}

.today-view__title h1 {
  margin: 0;
  font-size: clamp(1.75rem, 7vw, 2.25rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.02em;
  text-wrap: balance;
}

.today-view__progress span {
  white-space: nowrap;
}

.today-view__progress {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: var(--space-1) 0 0;
  color: var(--color-ink-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.today-view__replan {
  display: inline-flex;
  flex: none;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-4) 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-action-strong);
  font-weight: 700;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.today-view__replan :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

.today-view__replan:active:not(:disabled) {
  transform: var(--press);
}

.today-view__replan:disabled {
  color: var(--color-ink-soft);
  cursor: progress;
}

.today-view__notice,
.today-view__error {
  margin: 0 0 var(--space-4);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}

.today-view__error {
  background: var(--color-danger-tint);
  color: var(--color-danger);
  font-weight: 600;
}

/* Focus: the one large card on the page. */
.focus {
  padding: var(--space-5) var(--space-5) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}

.focus__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

.focus__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.focus__title {
  margin: 0;
  font-size: clamp(1.5rem, 6vw, 1.875rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.focus__why {
  max-width: 60ch;
  margin: var(--space-2) 0 0;
  font-size: 1.0625rem;
}

.focus__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-4);
}

.focus__done {
  display: inline-flex;
  flex: 1 1 10rem;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  min-height: 3.25rem;
  padding: 0 var(--space-5);
  border: 0;
  border-radius: var(--radius-control);
  background: var(--color-action);
  color: var(--color-on-action);
  font-size: 1.0625rem;
  font-weight: 800;
  cursor: pointer;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out);
}

.focus__done :deep(svg) {
  stroke-width: 2.6;
}

.focus__done:hover:not(:disabled) {
  background: var(--color-action-strong);
}

.focus__done:active:not(:disabled) {
  transform: var(--press);
  transition-duration: 90ms;
}

.focus__done:disabled {
  background: var(--color-ink-soft);
  cursor: progress;
}

.focus__more {
  min-height: 3.25rem;
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink-muted);
  font-weight: 700;
  cursor: pointer;
}

.focus__more:hover:not(:disabled) {
  background: var(--color-action-tint);
}

.focus__more--tinted {
  border-radius: var(--radius-pill);
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.today-view__next {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-2);
  margin: var(--space-3) var(--space-5) 0;
  color: var(--color-ink-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.today-view__next span {
  color: var(--color-ink);
  font-weight: 800;
}

/* Catching up: an offer, never an alarm. */
.catch-up {
  margin-top: var(--space-5);
  border-radius: var(--radius-card);
  background: var(--color-ground-deep);
}

.catch-up__toggle {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  width: 100%;
  min-height: var(--tap-large);
  padding: var(--space-2) var(--space-4) var(--space-2) var(--space-5);
  border: 0;
  border-radius: var(--radius-card);
  background: transparent;
  color: var(--color-ink);
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}

.catch-up__hint {
  margin-left: auto;
  color: var(--color-action-strong);
}

.catch-up__toggle :deep(svg),
.resolved__toggle :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 200ms var(--ease-out);
}

.catch-up__toggle[aria-expanded="true"] :deep(svg),
.resolved__toggle[aria-expanded="true"] :deep(svg) {
  transform: rotate(90deg);
}

.catch-up__body {
  display: grid;
  padding: 0 var(--space-1) var(--space-2);
}

.catch-up__all {
  justify-self: start;
  min-height: var(--tap);
  margin: 0 0 var(--space-2) var(--space-4);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-action);
  color: var(--color-on-action);
  font-weight: 800;
  cursor: pointer;
}

.catch-up__all:disabled {
  background: var(--color-ink-soft);
  cursor: progress;
}

/* Carried-over items lie flat on the panel, divided by hairlines. */
.catch-up__body :deep(.catch-up__row) {
  border-radius: 0;
  background: transparent;
}

.catch-up__body :deep(.catch-up__row + .catch-up__row) {
  border-top: 1px solid var(--color-line);
}

.catch-up__chip {
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-action-strong);
  font-weight: 700;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.catch-up__chip:active:not(:disabled) {
  transform: var(--press);
  transition-duration: 90ms;
}

.catch-up__chip:disabled {
  color: var(--color-ink-soft);
  cursor: progress;
}

/* The day's time axis. */
.timeline,
.resolved {
  margin-top: var(--space-6);
}

.today-view__section-title {
  margin: 0 0 var(--space-3) var(--space-3);
  font-size: 1.125rem;
  font-weight: 800;
}

.timeline__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.timeline__entry--past {
  opacity: 0.8;
}

.timeline__now {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: var(--space-1) 0 var(--space-1) var(--space-3);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
}

.timeline__now::after {
  flex: 1;
  height: 2px;
  border-radius: 2px;
  background: var(--color-ink);
  content: "";
}

.timeline__event {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: 0 calc(var(--tap) + var(--space-4));
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
  border-radius: var(--radius-card);
  background: rgb(255 255 255 / 55%);
}

.timeline__time {
  padding-top: 0.1rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.timeline__event-title {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.timeline__source {
  grid-column: 2;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.resolved__toggle {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  margin-bottom: var(--space-2);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-ink-muted);
  font-weight: 700;
  cursor: pointer;
}

.today-view__empty {
  padding: var(--space-6) var(--space-5);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  text-align: center;
}

.today-view__empty h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
}

.today-view__empty p {
  margin: var(--space-2) 0 0;
  color: var(--color-ink-muted);
}

.today-view__loading {
  display: grid;
  gap: var(--space-2);
}

.today-view__bone {
  height: 4.5rem;
  border-radius: var(--radius-card);
  background: rgb(255 255 255 / 55%);
  animation: today-pulse 1.4s ease-in-out infinite alternate;
}

.today-view__bone--focus {
  height: 13rem;
}

@keyframes today-pulse {
  to {
    opacity: 0.5;
  }
}

@media (min-width: 56rem) {
  .today-view {
    padding-top: var(--space-6);
  }
}

@media (max-width: 32rem) {
  .today-view {
    padding-top: var(--space-4);
  }

  .focus {
    padding: var(--space-4);
  }
}
</style>
