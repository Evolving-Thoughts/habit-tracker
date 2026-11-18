<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import {
  getToday,
  reorderDay,
  rescheduleOccurrence,
  rescheduleTodo,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { useListFocus } from "../composables/useListFocus";
import { useSortable } from "../composables/useSortable";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import { useUndo } from "../composables/useUndo";
import { useCampaignCompletion } from "../composables/useCampaignCompletion";
import { timerStateOf, toggleTimer, useTimer } from "../composables/useTimer";
import {
  focusWhenReady,
  useShortcutHandlers,
} from "../composables/useShortcuts";
import ActionMenu from "../components/ActionMenu.vue";
import AppIcon from "../components/AppIcon.vue";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import PlannerItem from "../components/PlannerItem.vue";
import QuickAddQuest from "../components/QuickAddQuest.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import MoveItemDialog from "../components/MoveItemDialog.vue";
import ModalDialog from "../components/ModalDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import CampaignCompletionDialog from "../components/CampaignCompletionDialog.vue";
import type {
  DayPlannerHabitItem,
  DayPlannerItem,
  DayPlannerResponse,
} from "../types/day-planner";
import { addDays, formatDateForGermanDisplay, weekStart } from "../utils/date";
import { dayLabel, fullStop } from "../utils/history";
import {
  arrangeToday,
  formatDayHeading,
  formatWindow,
  itemKey,
  moved,
  nextChangeAt,
  withQueueOrder,
} from "../utils/today-agenda";
import { tallyLine } from "../utils/day-tally";
import { useDayClock } from "../composables/useDayClock";
import { categoryMark } from "../utils/category-mark";
import { workLine } from "../utils/quest-hours";
import { hrefOf } from "../routes";
import {
  quickMoveEntries,
  quickMoves,
  type MenuEntry,
} from "../utils/row-actions";

type EditingTarget = {
  kind: "todo" | "habit";
  entityId: number;
};

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const editingTarget = ref<EditingTarget | null>(null);
const editorBusy = ref(false);
const movingItem = ref<DayPlannerItem | null>(null);
const postponeOpen = ref(false);
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
  fallbackError: "Heute konnte nicht geladen werden.",
  refreshOnChange: () =>
    !editorBusy.value &&
    !editingTarget.value &&
    !movingItem.value &&
    !postponeOpen.value &&
    !creationOpen.value &&
    !campaignCompletion.question.value &&
    !writes.busy.value,
});
const writes = useWrites(loadToday, errorMessage);

/*
 * The clock moves the focus and the "now" line along through the day: it
 * wakes when an appointment starts or ends, so its turn on the focus card
 * begins and ends on time while the page stays open.
 */
const now = useDayClock((minutes) =>
  planner.value ? nextChangeAt(planner.value, minutes) : null,
);

const agenda = computed(() =>
  planner.value ? arrangeToday(planner.value, now.value) : null,
);
const heading = computed(() =>
  planner.value ? formatDayHeading(planner.value.date) : "Heute",
);
/* Counted like every view counts a day: "1 von 7 erledigt · 1 von früher". */
const progress = computed(() =>
  agenda.value ? tallyLine(agenda.value.tally, "today") : null,
);
const progressParts = computed(() => progress.value?.split(" · ") ?? []);
/* Worked time and quest hours in one line that says how they relate. */
const timeLine = computed(() =>
  planner.value
    ? workLine(planner.value.workedMinutes, planner.value.questHours)
    : null,
);
const timeParts = computed(() => timeLine.value?.split(" · ") ?? []);
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
/* An appointment on the focus card names its time range above everything else. */
const focusSlot = computed(() =>
  agenda.value?.focusWindow ? formatWindow(agenda.value.focusWindow) : null,
);
/** With nothing left in the order: when the next appointment comes. */
const nextAppointment = computed(() => {
  const day = agenda.value;
  const entry = day?.timeline[day.nowIndex];
  if (!entry) return null;
  return `${entry.time} ${entry.kind === "item" ? entry.item.title : entry.event.title}`;
});
const openAppointments = computed(() =>
  (agenda.value?.timeline ?? []).some(
    (entry) => entry.kind === "item" && entry.item.status === "pending",
  ),
);
const focusMeta = computed(() => {
  const focus = agenda.value?.focus;
  if (!focus) return [];
  const parts: string[] = [];
  if (focus.plannedDurationMinutes != null)
    parts.push(
      focus.workedMinutes > 0
        ? `${focus.workedMinutes}/${focus.plannedDurationMinutes} Min.`
        : `${focus.plannedDurationMinutes} Min.`,
    );
  if (focus.type === "todo" && focus.timeOfDay) parts.push("Termin");
  return parts;
});

const { undo, offer: offerUndo, take: takeUndo } = useUndo<DayPlannerItem>();
const campaignCompletion = useCampaignCompletion();

const getItemKey = itemKey;

function isUpdating(item: DayPlannerItem): boolean {
  return editorBusy.value || writes.isWriting(getItemKey(item));
}

async function toggleItem(item: DayPlannerItem): Promise<void> {
  if (isUpdating(item)) {
    return;
  }

  const completing = item.status === "pending";
  // A campaign planned for today with open quests asks first.
  const open =
    completing && item.type === "todo" && item.campaign?.id === item.todoId
      ? await campaignCompletion.openQuestsBelow(item.todoId)
      : 0;
  if (!(await campaignCompletion.confirm(item.title, open))) return;
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
  if (done && completing)
    offerUndo(
      item,
      open > 0 ? `„${item.title}“ abgeschlossen` : `„${item.title}“ erledigt`,
    );
}

async function undoLast(): Promise<void> {
  const item = takeUndo();
  if (!item) return;
  await writes.write(
    () =>
      item.type === "todo"
        ? updateTodoCompletion(item.todoId, false)
        : updateOccurrenceStatus(item.occurrenceId, "pending"),
    {
      key: getItemKey(item),
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
      fallbackError: "Das Daily konnte nicht übersprungen werden.",
    },
  );
}

/** Movable to `date` without a dialog; appointments and habit limits ask. */
function quickMovable(item: DayPlannerItem, date: string): boolean {
  if (item.type === "todo") return item.timeOfDay === null;
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

/* The order of the day: the focus card is its head, the rows follow. */
const order = ref<HTMLElement | null>(null);
const orderMessage = ref("");
/** The focus heads the queue unless an appointment is running right now. */
const focusInQueue = computed(
  () => !!agenda.value?.focus && agenda.value.focus === agenda.value.queue[0],
);
const rows = computed(
  () =>
    agenda.value?.queue.filter((item) => item !== agenda.value?.focus) ?? [],
);

/** How the server names an item of the order. */
function orderRef(item: DayPlannerItem): {
  type: "todo" | "habit";
  id: number;
} {
  return item.type === "todo"
    ? { type: "todo", id: item.todoId }
    : { type: "habit", id: item.occurrenceId };
}
const orderRefs = computed(() => (agenda.value?.queue ?? []).map(orderRef));

async function moveInOrder(from: number, to: number): Promise<void> {
  const current = planner.value;
  if (!current || !agenda.value || writes.isWriting("order")) return;
  const queue = moved(agenda.value.queue, from, to);
  const item = queue[to];
  if (!item || queue[from] === item) return;
  // Shown at once; the reload after the write confirms it or takes it back.
  planner.value = withQueueOrder(current, queue);
  orderMessage.value = `„${item.title}“ steht jetzt an Stelle ${to + 1} von ${queue.length}.`;
  await writes.write(() => reorderDay(queue.map(orderRef)), {
    key: "order",
    fallbackError: "Die Reihenfolge konnte nicht gespeichert werden.",
  });
}

/** The grip's arrow keys move an item one place and keep the grip focused. */
async function shiftInOrder(
  item: DayPlannerItem,
  direction: -1 | 1,
): Promise<void> {
  const from = agenda.value?.queue.indexOf(item) ?? -1;
  if (from === -1) return;
  listFocus.remember(getItemKey(item));
  await moveInOrder(from, from + direction);
  await nextTick();
  page.value
    ?.querySelector<HTMLElement>(
      `[data-focus-key="${getItemKey(item)}"] .sort-handle`,
    )
    ?.focus();
}

useSortable(order, {
  item: "[data-sort-key]",
  handle: ".sort-handle",
  onMove: (from, to) => void moveInOrder(from, to),
});

/* What is still open today can go to tomorrow in one step. */
const postponable = computed(() =>
  (agenda.value?.queue ?? []).filter((item) =>
    quickMovable(item, tomorrow.value),
  ),
);
async function postponeAll(): Promise<void> {
  const items = postponable.value;
  postponeOpen.value = false;
  for (const item of items) {
    if (!(await moveTo(item, tomorrow.value))) return;
  }
  creationMessage.value =
    items.length === 1
      ? "1 Eintrag steht jetzt bei morgen."
      : `${items.length} Einträge stehen jetzt bei morgen.`;
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
      ? "Quest erstellt. Ohne Tag findest du sie im Questlog."
      : "Daily erstellt. Es erscheint ab seinem Startdatum an fälligen Tagen.";
  await writes.applied();
  creationOpen.value = false;
}

/*
 * Keyboard shortcuts on a row run what its buttons run. Done rows and items
 * whose buttons would not offer the step ignore the key; an appointment opens
 * "Verschieben", where its move is confirmed.
 */
const timer = useTimer();
function pendingItem(key: string | null): DayPlannerItem | null {
  const item = planner.value?.items.find((entry) => getItemKey(entry) === key);
  return item && item.status === "pending" && !isUpdating(item) ? item : null;
}
function whereLabel(date: string): string {
  if (date === planner.value?.date) return "bei heute";
  if (date === tomorrow.value) return "bei morgen";
  return `am ${dayLabel(date)}`;
}
function moveByKey(key: string | null, date: string): boolean {
  const item = pendingItem(key);
  if (!item || !date || item.scheduledDate === date) return false;
  if (item.type === "todo" && item.timeOfDay !== null) {
    openMoving(item);
    return true;
  }
  if (!quickMovable(item, date)) return false;
  void listFocus.around(getItemKey(item), async () => {
    if (await moveTo(item, date))
      orderMessage.value = fullStop(
        `„${item.title}“ steht jetzt ${whereLabel(date)}`,
      );
  });
  return true;
}
/*
 * "Aktionen für …" of a row and of the focus card. The quick moves run the
 * same step as T, D and W; "Verschieben" opens the dialog the row had.
 */
function canMoveByDialog(item: DayPlannerItem): boolean {
  if (item.status !== "pending") return false;
  if (item.type === "todo") return true;
  return (item.moveUntil ?? "") > item.scheduledDate;
}
function rowMenu(item: DayPlannerItem): MenuEntry[] {
  const today = planner.value?.date;
  if (!today || item.status !== "pending") return [];
  const busy = isUpdating(item);
  const entries: MenuEntry[] = [];
  if (item.type === "habit")
    entries.push({
      id: "skip",
      label: "Überspringen",
      icon: "skip",
      ariaLabel: `${item.title} überspringen`,
      disabled: busy,
      run: () => void skipHabit(item),
    });
  const moves = quickMoves(today, {
    date: item.scheduledDate,
    timeOfDay: item.type === "todo" ? item.timeOfDay : null,
    moveUntil: item.type === "habit" ? item.moveUntil : undefined,
  });
  entries.push(
    ...quickMoveEntries(
      item.title,
      moves,
      (move) => void moveByKey(getItemKey(item), move.date),
      { disabled: busy },
    ),
  );
  if (canMoveByDialog(item))
    entries.push({
      id: "move",
      label:
        item.type === "todo" && item.timeOfDay
          ? "Termin verschieben …"
          : "Anderer Tag …",
      icon: "move",
      ariaLabel: `${item.title} verschieben`,
      disabled: busy,
      run: () => openMoving(item),
    });
  return entries;
}
/** The focus card says in words when its stopwatch runs. */
const focusTimer = computed(() => {
  const focus = agenda.value?.focus;
  if (!focus) return null;
  return timerStateOf(
    timer,
    focus.type === "todo" ? "todo" : "occurrence",
    focus.type === "todo" ? focus.todoId : focus.occurrenceId,
  );
});

useShortcutHandlers(
  {
    "quest.new": () => {
      void focusWhenReady(() =>
        page.value?.querySelector<HTMLElement>('input[name="quickTitle"]'),
      );
    },
    "row.timer": ({ key }) => {
      const item = pendingItem(key);
      if (!item) return false;
      return toggleTimer(
        timer,
        item.type === "todo"
          ? { kind: "todo", targetId: item.todoId, title: item.title }
          : {
              kind: "occurrence",
              targetId: item.occurrenceId,
              title: item.title,
            },
        item.timerEligible,
      );
    },
    "row.done": ({ key }) => {
      const item = pendingItem(key);
      if (!item) return false;
      void listFocus.around(getItemKey(item), () => toggleItem(item));
    },
    "row.today": ({ key }) => moveByKey(key, planner.value?.date ?? ""),
    "row.tomorrow": ({ key }) => moveByKey(key, tomorrow.value),
    "row.nextWeek": ({ key }) =>
      moveByKey(
        key,
        planner.value ? addDays(weekStart(planner.value.date), 7) : "",
      ),
  },
  {
    // The same offer as the "Auf morgen" button in the head of the view.
    commands: () =>
      postponable.value.length && !writes.busy.value && !editorBusy.value
        ? [
            {
              id: "today.postpone",
              label: "Offenes auf morgen verschieben",
              group: "Aktionen",
              keywords: ["Auf morgen"],
              run: () => (postponeOpen.value = true),
            },
          ]
        : [],
  },
);
</script>

<template>
  <main ref="page" class="today-view">
    <header class="today-view__header">
      <div class="today-view__title">
        <h1>{{ heading }}</h1>
        <!-- Breaks only between its parts: "1 von 7 erledigt" · "1 von früher". -->
        <p v-if="progress" class="today-view__progress">
          <template v-for="(part, index) in progressParts" :key="part"
            >{{ index ? " " : ""
            }}<span class="today-view__progress-part">{{
              index < progressParts.length - 1 ? `${part} ·` : part
            }}</span></template
          >
        </p>
        <p v-if="timeLine" class="today-view__time">
          <!-- From 40rem each part breaks as a whole, no figure torn apart. -->
          <template v-for="(part, index) in timeParts" :key="part"
            >{{ index ? " " : ""
            }}<span class="today-view__time-part">{{
              index < timeParts.length - 1 ? `${part} ·` : part
            }}</span></template
          >
        </p>
      </div>
      <button
        v-if="postponable.length"
        class="today-view__postpone"
        type="button"
        :disabled="isLoading || editorBusy || writes.busy.value"
        @click="postponeOpen = true"
      >
        <AppIcon name="tomorrow" />
        <span>Auf morgen</span>
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

    <ModalDialog
      v-if="postponeOpen"
      title="Offenes auf morgen verschieben"
      focus-selector="[data-postpone-confirm]"
      :return-focus="() => null"
      @close="postponeOpen = false"
    >
      <p class="postpone__lead">
        {{
          postponable.length === 1
            ? "1 offener Eintrag wandert auf morgen und reiht sich dort hinten ein."
            : `${postponable.length} offene Einträge wandern auf morgen und reihen sich dort hinten ein.`
        }}
        Termine mit Uhrzeit bleiben, wo sie sind.
      </p>
      <div class="postpone__actions">
        <button
          class="btn btn--primary"
          type="button"
          data-postpone-confirm
          data-primary
          @click="postponeAll"
        >
          Auf morgen verschieben
        </button>
        <button class="btn" type="button" @click="postponeOpen = false">
          Abbrechen
        </button>
      </div>
    </ModalDialog>

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

    <div v-if="errorMessage" class="alert today-view__error">
      <p role="alert">{{ errorMessage }}</p>
      <button
        class="btn btn--ground"
        type="button"
        :disabled="isLoading || writes.busy.value"
        @click="loadToday()"
      >
        <AppIcon name="refresh" />Erneut versuchen
      </button>
    </div>

    <QuickAddQuest
      v-if="planner"
      :date="planner.date"
      :order="orderRefs"
      @created="writes.applied()"
    />

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
      <p>Genieße den freien Raum oder schreib oben auf, was heute ansteht.</p>
    </section>

    <template v-else-if="agenda && hasItems">
      <div ref="order" class="order">
        <section
          v-if="agenda.focus"
          class="focus"
          :data-focus-key="getItemKey(agenda.focus)"
          :data-sort-key="focusInQueue ? getItemKey(agenda.focus) : undefined"
          aria-labelledby="focus-title"
        >
          <div class="focus__head">
            <!-- The heading keeps the plain title; the button inside says "bearbeiten". -->
            <h2
              id="focus-title"
              class="focus__title"
              :aria-label="agenda.focus.title"
            >
              <button
                class="focus__title-button"
                data-edit-button
                type="button"
                :disabled="isUpdating(agenda.focus)"
                :aria-label="`${agenda.focus.title} bearbeiten`"
                @click="openEditing(agenda.focus)"
              >
                {{ agenda.focus.title }}
              </button>
            </h2>
            <!-- Top right, where the plus button never covers it. -->
            <button
              v-if="focusInQueue && rows.length"
              class="focus__grip sort-handle"
              type="button"
              :disabled="isUpdating(agenda.focus)"
              :aria-label="`${agenda.focus.title} in der Reihenfolge verschieben`"
              title="Ziehen oder mit den Pfeiltasten verschieben"
              @keydown.down.prevent="shiftInOrder(agenda.focus, 1)"
            >
              <AppIcon name="grip" />
            </button>
          </div>
          <p v-if="focusSlot" class="focus__slot">
            <AppIcon name="calendar" />
            <span>{{ focusSlot }}</span>
          </p>
          <p v-if="agenda.focus.why" class="focus__why">
            {{ agenda.focus.why }}
          </p>
          <p
            v-if="
              focusMeta.length ||
              focusGoal ||
              focusTimer ||
              agenda.focus.type === 'habit'
            "
            class="focus__meta"
          >
            <span v-if="focusTimer" class="focus__running">
              <i aria-hidden="true" />{{
                focusTimer === "running" ? "läuft" : "pausiert"
              }}
            </span>
            <span v-if="agenda.focus.type === 'habit'" class="focus__daily">
              <AppIcon name="dailies" />Daily
            </span>
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
              :eligible="agenda.focus.timerEligible"
              :disabled="isUpdating(agenda.focus)"
            />
            <!-- The Fokus-Modus has no Später or Überspringen for an appointment. -->
            <a
              v-if="!focusSlot"
              class="focus__mode"
              :href="hrefOf('focus')"
              aria-label="Fokus-Modus"
              title="Fokus-Modus"
            >
              <AppIcon name="focus" />
            </a>
            <ActionMenu
              v-if="rowMenu(agenda.focus).length"
              :title="agenda.focus.title"
              :entries="rowMenu(agenda.focus)"
              :disabled="isUpdating(agenda.focus)"
            />
          </div>
        </section>
        <!-- Appointments wait on the axis; they never stand in for the order. -->
        <section v-else-if="openAppointments" class="today-view__empty">
          <h2>In der Reihenfolge ist nichts mehr offen.</h2>
          <p>
            {{
              nextAppointment
                ? `Nächster Termin: ${nextAppointment}.`
                : "Was noch offen ist, steht bei den Terminen."
            }}
          </p>
        </section>
        <section v-else-if="!agenda.carriedOver.length" class="today-view__empty">
          <h2>Alles für heute erledigt.</h2>
          <p>Der Rest des Tages gehört dir.</p>
        </section>

        <!-- On a phone only the next two rows carry their Warum, so the day stays short. -->
        <PlannerItem
          v-for="(item, index) in rows"
          :key="getItemKey(item)"
          :data-focus-key="getItemKey(item)"
          :data-sort-key="getItemKey(item)"
          :item="item"
          :is-updating="isUpdating(item)"
          :menu="rowMenu(item)"
          :why-wide-only="index >= 2"
          sortable
          @toggle="toggleItem"
          @edit="openEditing"
          @shift="shiftInOrder"
        />
      </div>

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
            why-wide-only
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
                item.type === 'todo' || !!item.moveUntil
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
          Termine
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
                :menu="rowMenu(entry.item)"
                why-wide-only
                @toggle="toggleItem"
                @edit="openEditing"
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
            @edit="openEditing"
          />
        </div>
      </section>
    </template>

    <!-- Stays mounted, so a move that empties the day is still announced. -->
    <p class="visually-hidden" role="status">{{ orderMessage }}</p>
    <!-- After the content in reading order; fixed in place, it looks the same. -->
    <CreateButton
      label="Eintrag erstellen"
      :disabled="
        isLoading || editorBusy || writes.busy.value || editingTarget !== null
      "
      @click="openCreation"
    />
    <CampaignCompletionDialog
      v-if="campaignCompletion.question.value"
      :title="campaignCompletion.question.value.title"
      :open="campaignCompletion.question.value.open"
      @confirm="campaignCompletion.reply(true)"
      @cancel="campaignCompletion.reply(false)"
    />
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
  /* Below the last row, room for the plus button: its actions stay reachable. */
  padding: var(--space-5) 0 var(--fab-clearance);
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

.today-view__progress {
  margin: var(--space-1) 0 0;
  color: var(--color-ink-muted);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.today-view__progress-part {
  display: inline-block;
}

.today-view__time {
  margin: var(--space-1) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

@media (min-width: 40rem) {
  .today-view__time-part {
    display: inline-block;
  }
}

.today-view__postpone {
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

.today-view__postpone :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

.today-view__postpone:active:not(:disabled) {
  transform: var(--press);
}

.today-view__postpone:disabled {
  color: var(--color-ink-soft);
  cursor: progress;
}

.today-view__notice,
.today-view__error {
  margin: 0 0 var(--space-4);
}

.today-view__notice {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-surface);
}

/* Focus: the one large card on the page. */
.focus {
  padding: var(--space-5) var(--space-5) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface-raised);
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

.focus__head {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}

.focus__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: clamp(1.5rem, 6vw, 1.875rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.015em;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

/* The title opens the editor, like a row's title. */
.focus__title-button {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  letter-spacing: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 0.15em;
  cursor: pointer;
  transition: text-decoration-color 160ms var(--ease-out);
}

.focus__title-button:hover:not(:disabled) {
  text-decoration-color: var(--color-line);
}

.focus__title-button:disabled {
  cursor: progress;
}

/* "läuft" is a state: ink, never orange. */
.focus__running {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  color: var(--color-ink);
  font-weight: 800;
}

.focus__running i {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--color-ink);
  animation: today-pulse 1.6s var(--ease-out) infinite alternate;
}

@media (prefers-reduced-motion: reduce) {
  .focus__running i {
    animation: none;
  }
}

.focus__why {
  max-width: 60ch;
  margin: var(--space-2) 0 0;
  font-size: 1.0625rem;
}

/* An appointment's turn: its time range, in ink and large enough to read at a glance. */
.focus__slot {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin: var(--space-2) 0 0;
  color: var(--color-ink);
  font-size: 1.125rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.focus__slot :deep(svg) {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  color: var(--color-ink-muted);
}

.focus__daily {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
}

.focus__daily :deep(svg) {
  width: 1rem;
  height: 1rem;
}

/* One line on a phone: Erledigt takes the room, the round buttons follow. */
.focus__actions {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-4);
}

.focus__done {
  display: inline-flex;
  flex: 1 1 auto;
  min-width: 0;
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

/* Wide screens keep Erledigt a button, not a bar across the card. */
@media (min-width: 40rem) {
  .focus__done {
    flex: 0 1 18rem;
  }
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

/* The Fokus-Modus is a round icon button beside the stopwatch; its name is the tooltip. */
.focus__mode {
  display: grid;
  flex: none;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  border-radius: 50%;
  background: var(--color-action-tint);
  color: var(--color-action-strong);
  transition: transform 420ms var(--spring);
}

.focus__mode:hover {
  background: var(--color-action-tint-hover);
}

.focus__mode:active {
  transform: scale(0.92);
}

.focus__mode :deep(svg) {
  width: 1.375rem;
  height: 1.375rem;
}

/* The focus card and the rows after it are one sortable order. */
.order {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}

.order > .focus {
  margin-bottom: var(--space-1);
}

.focus__grip {
  display: grid;
  flex: none;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink-soft);
  cursor: grab;
  touch-action: none;
}

.focus__grip :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

/* What is being dragged, and the gap it leaves behind. */
.order :deep(.sortable-ghost) {
  opacity: 0.35;
}

.order :deep(.sortable-fallback) {
  box-shadow: var(--shadow-card);
  cursor: grabbing;
}

.postpone__lead {
  margin: 0 0 var(--space-4);
  color: var(--color-ink-muted);
}

.postpone__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/* Carried over from earlier days: a panel in deep apricot, not a warning. */
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
  background: var(--color-surface-flat);
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
  background: var(--color-surface-flat);
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
