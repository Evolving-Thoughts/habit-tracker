<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { getToday, reorderDay } from "../api/day-planner.api";
import { useListFocus } from "../composables/useListFocus";
import { useSortable } from "../composables/useSortable";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import { useTicks, type TickTarget } from "../composables/useTicks";
import { useLogRemoval } from "../composables/useLogRemoval";
import { useMediaQuery } from "../composables/useMediaQuery";
import { timerStateOf, toggleTimer, useTimer } from "../composables/useTimer";
import {
  focusWhenReady,
  useShortcutHandlers,
} from "../composables/useShortcuts";
import ActionMenu from "../components/ActionMenu.vue";
import AppIcon from "../components/AppIcon.vue";
import CampaignChip from "../components/CampaignChip.vue";
import ChallengeMark from "../components/ChallengeMark.vue";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import DayBestCard from "../components/DayBestCard.vue";
import MonthChallengeCard from "../components/MonthChallengeCard.vue";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import PlannerItem from "../components/PlannerItem.vue";
import QuickAddQuest from "../components/QuickAddQuest.vue";
import TodayCalendar from "../components/TodayCalendar.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import MoveItemDialog from "../components/MoveItemDialog.vue";
import CampaignMoveDialog from "../components/CampaignMoveDialog.vue";
import DeleteItemDialog, {
  type DeleteTarget,
} from "../components/DeleteItemDialog.vue";
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
  formatDuration,
  formatWindow,
  itemKey,
  nextChangeAt,
} from "../utils/today-agenda";
import {
  dropInDay,
  orderRef,
  sortableRows,
  stepInDay,
} from "../utils/today-order";
import { tallyLine } from "../utils/day-tally";
import { useDayClock } from "../composables/useDayClock";
import { categoryMark } from "../utils/category-mark";
import { workLine } from "../utils/quest-hours";
import { streakLine } from "../utils/streak";
import { useRouter } from "vue-router";
import { hrefOf } from "../routes";
import { onCardClick } from "../utils/card-click";
import {
  quickMoveEntries,
  quickMoves,
  rowMenu as cardMenu,
  type MenuEntry,
} from "../utils/row-actions";

type EditingTarget = {
  kind: "todo" | "habit";
  entityId: number;
  /** The run a daily was opened from, for its notes. */
  occurrenceId?: number;
};

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const editingTarget = ref<EditingTarget | null>(null);
const editorBusy = ref(false);
const movingItem = ref<DayPlannerItem | null>(null);
/** "In Kampagne verschieben …" and "Löschen" from a card's menu. */
const campaignMoving = ref<{ todoId: number; title: string } | null>(null);
const deleting = ref<DeleteTarget | null>(null);
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
    !campaignMoving.value &&
    !deleting.value &&
    !postponeOpen.value &&
    !creationOpen.value &&
    !ticks.campaignQuestion.value &&
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
/* A figure keeps its unit: "4 Std. 20 Min." never breaks inside. */
const NO_BREAK_SPACE = String.fromCharCode(160);
const timeParts = computed(
  () =>
    timeLine.value
      ?.split(" · ")
      .map((part) =>
        part.replace(/(\d) (Std\.|Min\.)/g, `$1${NO_BREAK_SPACE}$2`),
      ) ?? [],
);
/** The week's campaign hours against the goal, as a slim bar; none without one. */
const weekGoal = computed(() => {
  const hours = planner.value?.questHours;
  if (!hours || hours.weeklyTargetMinutes === null) return null;
  return {
    minutes: hours.weekMinutes,
    target: hours.weeklyTargetMinutes,
    filled: Math.min(
      100,
      Math.round((hours.weekMinutes / hours.weeklyTargetMinutes) * 100),
    ),
  };
});
/* Wide screens: the day calendar stands beside the list. */
const wide = useMediaQuery("(min-width: 64rem)");
const hasItems = computed(
  () =>
    (planner.value?.items.length ?? 0) > 0 ||
    (planner.value?.externalEvents.length ?? 0) > 0,
);
/* A daily's goal and its count; which campaign it serves, the chip says. */
const focusGoal = computed(() => {
  const goal = agenda.value?.focus?.goal;
  if (!goal || goal.target === null) return null;
  const until = goal.periodEnd
    ? ` bis ${formatDateForGermanDisplay(goal.periodEnd)}`
    : "";
  return `${goal.title}: ${goal.completed} von ${goal.target}${until}`;
});
/* Which campaign the focus serves; a campaign's own quest needs no chip. */
const focusCampaign = computed(() => {
  const focus = agenda.value?.focus;
  if (!focus?.campaign) return null;
  return focus.type === "todo" && focus.campaign.id === focus.todoId
    ? null
    : focus.campaign;
});
/* An appointment on the focus card names its time range above everything else. */
const focusSlot = computed(() =>
  agenda.value?.focusWindow ? formatWindow(agenda.value.focusWindow) : null,
);
/** With nothing left in the order: when the next appointment comes. */
const nextAppointment = computed(() => {
  const day = agenda.value;
  const entry = day?.nextAppointment;
  if (!entry) return null;
  return `${entry.time} ${entry.kind === "item" ? entry.item.title : entry.event.title}`;
});
const openAppointments = computed(() =>
  (agenda.value?.appointments ?? []).some(
    (entry) => entry.kind === "item" && entry.item.status === "pending",
  ),
);
const focusMeta = computed(() => {
  const focus = agenda.value?.focus;
  if (!focus) return [];
  const parts: string[] = [];
  const series = focus.type === "habit" ? streakLine(focus.streak) : null;
  if (series) parts.push(series);
  if (focus.plannedDurationMinutes != null)
    parts.push(
      focus.workedMinutes > 0
        ? `${focus.workedMinutes}/${focus.plannedDurationMinutes} Min.`
        : `${focus.plannedDurationMinutes} Min.`,
    );
  if (focus.type === "todo" && focus.timeOfDay) parts.push("Termin");
  return parts;
});

/*
 * Ticks, skips and quick moves go through `useTicks`; its toast also holds
 * back a Logbuch delete (`useLogRemoval`).
 */
const ticks = useTicks(writes.write, {
  onOtherUndo: (held) => restoreLog(held.id),
});
const { undo, undoLast, flushUndo } = ticks;
/* Closing or reloading the page sends a held delete on its way. */
onMounted(() => window.addEventListener("pagehide", flushUndo));
onBeforeUnmount(() => window.removeEventListener("pagehide", flushUndo));
const { hiddenLogs, removeLog, restoreLog } = useLogRemoval(
  ticks.offerUndo,
  writes.write,
);

const getItemKey = itemKey;

function isUpdating(item: DayPlannerItem): boolean {
  return editorBusy.value || writes.isWriting(getItemKey(item));
}

function tickTarget(item: DayPlannerItem): TickTarget {
  return item.type === "todo"
    ? { kind: "todo", id: item.todoId, title: item.title }
    : { kind: "occurrence", id: item.occurrenceId, title: item.title };
}

async function toggleItem(item: DayPlannerItem): Promise<void> {
  if (isUpdating(item)) {
    return;
  }
  const options = {
    key: getItemKey(item),
    fallbackError: "Der Eintrag konnte nicht aktualisiert werden.",
  };
  if (item.status !== "pending") {
    await ticks.reopen(tickTarget(item), options);
    return;
  }
  // A campaign planned for today with open quests asks first.
  const campaign =
    item.type === "todo" && item.campaign?.id === item.todoId
      ? ("lookup" as const)
      : undefined;
  await ticks.complete(tickTarget(item), { ...options, campaign });
}

/**
 * Today's run of the running Monats-Challenge in the day's list: the open
 * one, or the one done today. Its card ticks it like the row does.
 */
const challengeRun = computed<DayPlannerHabitItem | null>(() => {
  const challenge = planner.value?.monthChallenge;
  if (!challenge || challenge.todayRun === "none") return null;
  return (
    planner.value!.items.find(
      (item): item is DayPlannerHabitItem =>
        item.type === "habit" &&
        item.habitId === challenge.habitId &&
        (challenge.todayRun === "open"
          ? item.occurrenceId === challenge.todayOccurrenceId
          : item.status === "completed"),
    ) ?? null
  );
});

async function skipHabit(item: DayPlannerHabitItem): Promise<void> {
  if (isUpdating(item)) {
    return;
  }
  await ticks.skip(tickTarget(item), getItemKey(item));
}

/** Movable to `date` without a dialog; appointments and habit limits ask. */
function quickMovable(item: DayPlannerItem, date: string): boolean {
  if (item.type === "todo") return item.timeOfDay === null;
  return item.moveUntil !== null && date <= item.moveUntil;
}

function moveTo(item: DayPlannerItem, date: string): Promise<boolean> {
  return ticks.move(tickTarget(item), date, {
    key: getItemKey(item),
    fallbackError: "Der Eintrag konnte nicht verschoben werden.",
  });
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
          occurrenceId: item.occurrenceId,
        };
}

function openMenuDialog(item: DayPlannerItem, kind: "move" | "delete"): void {
  if (editorBusy.value || writes.busy.value) return;
  listFocus.remember(getItemKey(item));
  if (kind === "move" && item.type === "todo")
    campaignMoving.value = { todoId: item.todoId, title: item.title };
  else if (kind === "delete")
    deleting.value =
      item.type === "todo"
        ? { kind: "todo", id: item.todoId, title: item.title }
        : { kind: "habit", id: item.habitId, title: item.title };
}
function closeMenuDialog(): void {
  campaignMoving.value = null;
  deleting.value = null;
  editorBusy.value = false;
}
async function onMenuDialogDone(): Promise<void> {
  await writes.applied();
  closeMenuDialog();
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
const sortables = computed(() =>
  agenda.value ? sortableRows(agenda.value) : [],
);
const orderRefs = computed(() => (agenda.value?.sequence ?? []).map(orderRef));

async function moveInOrder(from: number, to: number): Promise<void> {
  if (!planner.value || !agenda.value || writes.isWriting("order")) return;
  const move = dropInDay(planner.value, agenda.value, from, to);
  if (!move) return;
  // Shown at once; a failure takes it back to the stored order.
  const before = planner.value;
  await writes.writeShown(
    () => {
      planner.value = move.planner;
      orderMessage.value = move.message;
      return () => {
        planner.value = before;
        orderMessage.value = "";
      };
    },
    () => reorderDay(move.order),
    {
      key: "order",
      fallbackError: "Die Reihenfolge konnte nicht gespeichert werden.",
      reloadOnFailure: false,
    },
  );
}

/** Where one step up or down lands; calendar events are stepped over. */
function stepFrom(item: DayPlannerItem, direction: -1 | 1): number | null {
  return agenda.value ? stepInDay(agenda.value, item, direction) : null;
}

/**
 * "Nach oben" and "Nach unten" in the menu: the keyboard's way to sort.
 * An appointment counts as one step. The focus stays on the moved card's
 * menu button.
 */
async function shiftInOrder(
  item: DayPlannerItem,
  direction: -1 | 1,
): Promise<void> {
  const to = stepFrom(item, direction);
  if (to === null) return;
  await moveInOrder(sortables.value.indexOf(item), to);
  await nextTick();
  page.value
    ?.querySelector<HTMLElement>(
      `[data-focus-key="${getItemKey(item)}"] [aria-haspopup="menu"]`,
    )
    ?.focus();
}

/* The whole card drags: the focus card and every row of the order. */
useSortable(order, {
  item: "[data-sort-key]",
  anchor: "[data-sort-anchor]",
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
const router = useRouter();
function rowMenu(item: DayPlannerItem): MenuEntry[] {
  const today = planner.value?.date;
  if (!today || item.status !== "pending") return [];
  const busy = isUpdating(item);
  const moves = quickMoves(today, {
    date: item.scheduledDate,
    timeOfDay: item.type === "todo" ? item.timeOfDay : null,
    moveUntil: item.type === "habit" ? item.moveUntil : undefined,
  });
  const isFocus = item === agenda.value?.focus;
  return cardMenu(
    item.title,
    {
      quickMoves: quickMoveEntries(
        item.title,
        moves,
        (move) => void moveByKey(getItemKey(item), move.date),
        { disabled: busy },
      ),
      otherDay: canMoveByDialog(item)
        ? {
            run: () => openMoving(item),
            appointment: item.type === "todo" && !!item.timeOfDay,
          }
        : undefined,
      skip: item.type === "habit" ? () => void skipHabit(item) : undefined,
      edit: () => openEditing(item),
      // The Fokus-Modus has no Später or Überspringen for an appointment.
      focusMode:
        isFocus && !focusSlot.value
          ? () => void router.push({ name: "focus" })
          : undefined,
      reparent:
        item.type === "todo"
          ? () => openMenuDialog(item, "move")
          : undefined,
      up:
        stepFrom(item, -1) !== null
          ? () => void shiftInOrder(item, -1)
          : undefined,
      down:
        stepFrom(item, 1) !== null
          ? () => void shiftInOrder(item, 1)
          : undefined,
      remove: {
        run: () => openMenuDialog(item, "delete"),
        ariaLabel:
          item.type === "habit"
            ? `Daily ${item.title} ganz löschen`
            : undefined,
      },
    },
    busy,
  );
}
/** A tap anywhere on the focus card but its controls opens the editor. */
function openFocusFromCard(event: MouseEvent, item: DayPlannerItem): void {
  if (!isUpdating(item)) onCardClick(event, () => openEditing(item));
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
  <main ref="page" class="today-view" :class="{ 'today-view--split': wide }">
    <div class="today-view__list">
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
          <!-- The week against its goal at a glance; behind is a number, not a warning. -->
          <span
            v-if="weekGoal"
            class="today-view__week-bar"
            role="progressbar"
            aria-label="Kampagnen-Stunden diese Woche gegen das Wochenziel"
            :aria-valuenow="weekGoal.minutes"
            aria-valuemin="0"
            :aria-valuemax="weekGoal.target"
            :aria-valuetext="`${formatDuration(weekGoal.minutes)} von ${formatDuration(weekGoal.target)}`"
          >
            <span :style="{ width: `${weekGoal.filled}%` }" />
          </span>
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
        :occurrence-id="editingTarget.occurrenceId"
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

      <CampaignMoveDialog
        v-if="campaignMoving"
        :todo-id="campaignMoving.todoId"
        :title="campaignMoving.title"
        :return-focus="listFocus.returnFocus"
        @busy="editorBusy = $event"
        @moved="onMenuDialogDone"
        @close="closeMenuDialog"
      />
      <DeleteItemDialog
        v-if="deleting"
        :target="deleting"
        :return-focus="listFocus.returnFocus"
        @busy="editorBusy = $event"
        @deleted="onMenuDialogDone"
        @close="closeMenuDialog"
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

      <!-- The month's challenge, calm and above the focus card. -->
      <MonthChallengeCard
        v-if="planner?.monthChallenge && !isLoading"
        :challenge="planner.monthChallenge"
        :run="challengeRun"
        :busy="challengeRun ? isUpdating(challengeRun) : editorBusy"
        @toggle="toggleItem"
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
            class="focus card-target card-drag"
            :data-focus-key="getItemKey(agenda.focus)"
            :data-sort-key="getItemKey(agenda.focus)"
            aria-labelledby="focus-title"
            @click="openFocusFromCard($event, agenda.focus)"
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
                agenda.focus.type === 'habit' ||
                focusCampaign
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
              <ChallengeMark
                v-if="agenda.focus.type === 'habit' && agenda.focus.monthChallenge"
              />
              <span v-if="agenda.focus.categoryName" class="focus__category">
                <i
                  class="category-mark"
                  :style="{
                    background: categoryMark(
                      agenda.focus.categoryName,
                      agenda.focus.categoryColor,
                    ),
                  }"
                  aria-hidden="true"
                />{{ agenda.focus.categoryName }}
              </span>
              <span v-for="part in focusMeta" :key="part">{{ part }}</span>
              <span v-if="focusGoal">{{ focusGoal }}</span>
              <CampaignChip v-if="focusCampaign" :campaign="focusCampaign" />
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
          <!-- Nothing is up: only appointments are left, none running, and the day was never sorted. They wait in the list below. -->
          <section v-else-if="openAppointments" class="today-view__empty">
            <h2>In der Reihenfolge ist nichts mehr offen.</h2>
            <p>
              {{
                nextAppointment
                  ? `Nächster Termin: ${nextAppointment}.`
                  : "Was noch offen ist, steht unten bei seiner Uhrzeit."
              }}
            </p>
          </section>
          <section v-else-if="!agenda.carriedOver.length" class="today-view__empty">
            <h2>Alles für heute erledigt.</h2>
            <p>Der Rest des Tages gehört dir.</p>
          </section>

          <!--
            The rest of the day in one order. Appointments stand in it with
            their time and drag like any other card; one that is over but
            still open asks quietly. Google events are read-only anchors: a
            card can be dropped next to them, but they never lift. On wide
            screens they stand in the day calendar instead. On a phone only the next two rows carry
            their Warum, so the day stays short.
          -->
          <template
            v-for="(entry, index) in agenda.list"
            :key="
              entry.kind === 'event'
                ? `event-${entry.event.id}`
                : getItemKey(entry.item)
            "
          >
            <PlannerItem
              v-if="entry.kind === 'item'"
              class="today-view__appointment"
              :class="{ 'today-view__appointment--past': entry.past }"
              :data-focus-key="getItemKey(entry.item)"
              :data-sort-key="getItemKey(entry.item)"
              sortable
              :item="entry.item"
              :time="entry.time"
              :is-updating="isUpdating(entry.item)"
              :menu="rowMenu(entry.item)"
              :past="entry.past"
              :movable="canMoveByDialog(entry.item)"
              why-wide-only
              @toggle="toggleItem"
              @edit="openEditing"
              @move="openMoving"
            />
            <div
              v-else-if="entry.kind === 'event'"
              class="today-view__event"
              :class="{ 'today-view__event--past': entry.past }"
              :data-sort-key="`event-${entry.event.id}`"
              data-sort-anchor
            >
              <span class="today-view__event-time">{{ entry.time }}</span>
              <span class="today-view__event-title">{{ entry.event.title }}</span>
              <span class="today-view__event-source">Google Kalender</span>
            </div>
            <PlannerItem
              v-else
              :data-focus-key="getItemKey(entry.item)"
              :data-sort-key="getItemKey(entry.item)"
              :item="entry.item"
              :is-updating="isUpdating(entry.item)"
              :menu="rowMenu(entry.item)"
              :why-wide-only="index >= 2"
              sortable
              @toggle="toggleItem"
              @edit="openEditing"
            />
          </template>
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
          <div v-if="resolvedOpen" id="resolved-list" class="resolved__list">
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

      <!-- In the evening, at the end of the day's list: the day's best. -->
      <DayBestCard v-if="planner && !isLoading" :date="planner.date" />
    </div>

    <!-- Wide screens: today on one hour axis beside the list, in view while it scrolls. -->
    <TodayCalendar
      v-if="wide && planner"
      class="today-view__calendar"
      :date="planner.date"
      :hidden-logs="hiddenLogs"
      @remove-log="removeLog"
    />

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
      v-if="ticks.campaignQuestion.value"
      :title="ticks.campaignQuestion.value.title"
      :open="ticks.campaignQuestion.value.open"
      @confirm="ticks.answerCampaign(true)"
      @cancel="ticks.answerCampaign(false)"
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

/* The flat ink bar of every progress: track in deep apricot, never coloured. */
.today-view__week-bar {
  display: block;
  width: min(100%, 16rem);
  height: 0.375rem;
  margin-top: var(--space-2);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.today-view__week-bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
  transition: width 240ms var(--ease-out);
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

.resolved {
  margin-top: var(--space-6);
}

.resolved__list {
  display: grid;
  gap: var(--space-2);
}

/* An appointment that is over and still open: a little quieter, never a warning. */
.today-view__appointment--past {
  opacity: 0.8;
}

/* A Google event: read-only, in the flat white of appointments elsewhere. */
.today-view__event {
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  gap: 0 calc(var(--tap) + var(--space-4));
  padding: var(--space-3) var(--space-4) var(--space-3) var(--space-3);
  border-radius: var(--radius-card);
  background: var(--color-surface-flat);
}

.today-view__event--past {
  opacity: 0.8;
}

.today-view__event-time {
  padding-top: 0.1rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.today-view__event-title {
  font-weight: 700;
  overflow-wrap: anywhere;
}

.today-view__event-source {
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

/*
 * Wide screens use the whole window: the list takes what the day calendar
 * leaves, and the calendar stays in view at the height of the window.
 */
@media (min-width: 64rem) {
  .today-view--split {
    --calendar-width: clamp(22rem, 30vw, 32rem);

    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--calendar-width);
    gap: var(--space-6);
    align-items: start;
    width: calc(100% - 2 * var(--space-6));
  }

  .today-view__calendar {
    position: sticky;
    top: calc(3.5rem + var(--space-4));
    height: calc(100dvh - 3.5rem - var(--space-6));
  }

  /* The plus button stays beside the list, clear of the calendar. */
  .today-view--split .create-button {
    right: calc(var(--calendar-width) + var(--space-6) * 2 + var(--space-4));
  }

  /* Google events stand in the calendar; the list keeps the own entries. */
  .today-view--split .today-view__event {
    display: none;
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
