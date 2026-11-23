<script setup lang="ts">
import { useTodoDeletion } from "../composables/useTodoDeletion";
import TodoDeletionSummary from "./TodoDeletionSummary.vue";
import PlanFields from "./PlanFields.vue";
import AppointmentFields from "./AppointmentFields.vue";
import QuestNotes from "./QuestNotes.vue";
import WhyField from "./WhyField.vue";
import TodoGoalFields from "./TodoGoalFields.vue";
import CampaignFields from "./CampaignFields.vue";
import CategoryPicker from "./CategoryPicker.vue";
import CreateHabitForm, { type HabitDraft } from "./CreateHabitForm.vue";
import FormDisclosure from "./FormDisclosure.vue";
import FocusBlockOverride from "./FocusBlockOverride.vue";
import type { FocusBlockOverride as FocusBlockChoice } from "../types/focus-block";
import { OVERRIDE_LABELS } from "../utils/focus-block";
import KindSwitch from "./KindSwitch.vue";
import ParentPicker from "./ParentPicker.vue";
import AppIcon from "./AppIcon.vue";

import { TIMER_MAX_MINUTES } from "../utils/timer-duration";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { CategoryResponse } from "../types/category";
import {
  changeHabitSchedule,
  deleteHabit,
  getHabit,
  getTodo,
  updateHabit,
  updateTodo,
} from "../api/day-planner.api";
import type {
  ChangeHabitScheduleInput,
  HabitResponse,
  HabitScheduleRule,
  ScheduleVersionResponse,
} from "../types/habit";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import { formatHabitSchedule, WEEKDAY_OPTIONS } from "../utils/habit";
import type { InheritedWhy, TodoResponse } from "../types/todo";
import {
  habitChanges,
  todoChanges,
  type HabitFields,
  type TodoFields,
} from "../utils/editor-changes";
import type { CampaignColor, CampaignIcon } from "../types/campaign";
import {
  campaignChoices,
  isCampaignColor,
  isCampaignIcon,
} from "../utils/campaign-style";
import { minutesToHours } from "../utils/quest-hours";
import { categoryOfChoice, type ParentChoice } from "../utils/parent-choice";
import { whyBelow } from "../utils/why";
import {
  emptyScheduleDraft,
  scheduleDraftOf,
  scheduleRuleOf,
} from "../utils/habit-schedule";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  isValidIsoDate,
} from "../utils/date";

const props = defineProps<{
  kind: "todo" | "habit";
  entityId: number;
  embedded?: boolean;
  /** The run a daily was opened from: its notes are shown and saved here. */
  occurrenceId?: number | null;
}>();

const emit = defineEmits<{
  changed: [];
  close: [];
  busy: [value: boolean];
  /** A quest's editor switched to "Daily" (or back). */
  mode: [kind: "todo" | "habit"];
}>();

const isLoading = ref(true);
const isSaving = ref(false);
const hasLoaded = ref(false);
const errorMessage = ref<string | null>(null);
const confirmDeletion = ref(false);
const keepButton = ref<HTMLButtonElement | null>(null);
const {
  preview: deletionPreview,
  prepare: prepareDeletion,
  confirm: confirmPreviewedDeletion,
  cancel: cancelDeletion,
} = useTodoDeletion();
async function requestDeletion(): Promise<void> {
  if (isBusy.value) return;
  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);
  try {
    if (props.kind === "todo") await prepareDeletion(props.entityId);
    confirmDeletion.value = true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Löschvorschau konnte nicht geladen werden.";
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
  if (confirmDeletion.value) {
    // The question stands right above the actions; the safe answer has the focus.
    await nextTick();
    keepButton.value?.scrollIntoView?.({ block: "nearest" });
    keepButton.value?.focus();
  }
}
function keep(): void {
  confirmDeletion.value = false;
  cancelDeletion();
}

const title = ref("");
const categories = ref<CategoryResponse[]>([]);
const categoryId = ref<number | null>(null);
const why = ref("");
const inheritedWhy = ref<InheritedWhy | null>(null);
/** What the server said is inherited, before another place was chosen. */
const loadedInheritedWhy = ref<InheritedWhy | null>(null);

// Todo-Felder
const periodStart = ref("");
const periodEnd = ref("");
const goalHabitId = ref<number | null>(null);
const goalTarget = ref<string | number>("");
const loadedTodo = ref<TodoResponse | null>(null);
const todoDate = ref("");
const todoTime = ref("");
const duration = ref<string | number>("");
const timeOfDay = ref("");
/** Fokus-Sperre: Standard, Immer or Nie; quests and dailies alike. */
const focusBlockChoice = ref<FocusBlockChoice>("default");
const focusBlockSummary = computed(() =>
  focusBlockChoice.value === "default"
    ? ""
    : OVERRIDE_LABELS[focusBlockChoice.value],
);
/** "Gehört zu": the quest it sits below; null at the top. */
const parentId = ref<number | null>(null);
/** The places "Gehört zu" offers, once loaded. */
const parentChoicesLoaded = ref<ParentChoice[]>([]);
/** Known once "Gehört zu" has read the tree; until then no switch to Daily. */
const hasChildren = ref<boolean | null>(null);
// Only a quest without parent is a campaign and offers these.
const campaignColor = ref<CampaignColor | null>(null);
const campaignIcon = ref<CampaignIcon | null>(null);
const weeklyTarget = ref<string | number>("");
/**
 * A campaign as it was opened (a top-level quest with quests below or a
 * colour, icon or goal): its form leaves out what a campaign is not planned
 * by, unless a value is already set there.
 */
const isCampaign = computed(
  () =>
    !!loadedTodo.value &&
    loadedTodo.value.campaign?.id === loadedTodo.value.id,
);
/** At the top now (as chosen): colour, icon and goal are on offer. */
const isTopLevel = computed(() => parentId.value === null);
const showPlan = computed(
  () => !isCampaign.value || !!loadedTodo.value?.scheduledDate,
);
const showDuration = computed(
  () => !isCampaign.value || loadedTodo.value?.plannedDurationMinutes != null,
);
const showAppointment = computed(
  () => !isCampaign.value || !!loadedTodo.value?.timeOfDay,
);
const showGoal = computed(
  () =>
    !isCampaign.value ||
    loadedTodo.value?.goalHabitId != null ||
    !!loadedTodo.value?.periodStart ||
    !!loadedTodo.value?.periodEnd,
);
const campaignSummary = computed(() =>
  campaignChoices(campaignColor.value, campaignIcon.value, weeklyTarget.value),
);
const categoryName = computed(
  () =>
    categories.value.find((category) => category.id === categoryId.value)
      ?.name ?? "",
);

/*
 * Quest or Daily: an open quest with nothing below it can become a daily.
 * The daily takes over title, reason, category and campaign; once it is
 * saved, the quest is deleted (see CreateHabitForm). Nothing changes before.
 */
const form = ref<"todo" | "habit">("todo");
watch(form, (value) => emit("mode", value));
const canBecomeDaily = computed(
  () =>
    props.kind === "todo" &&
    !!loadedTodo.value &&
    !loadedTodo.value.completed &&
    !isCampaign.value &&
    hasChildren.value === false,
);
/** The campaign the chosen place belongs to. */
const chosenCampaignId = computed(() => {
  if (parentId.value === null) return null;
  const choice = parentChoicesLoaded.value.find(
    (entry) => entry.todo.id === parentId.value,
  );
  if (choice) return choice.campaign.id;
  const campaign = loadedTodo.value?.campaign;
  return campaign && campaign.id !== loadedTodo.value?.id ? campaign.id : null;
});
const habitDraft = computed<HabitDraft>(() => ({
  title: title.value.trim(),
  why: why.value.trim(),
  categoryId: categoryId.value,
  campaignId: chosenCampaignId.value,
}));

// Habit-Felder
const isActive = ref(true);
const loadedHabit = ref<HabitResponse | null>(null);
const campaignId = ref<number | null>(null);
const changeSchedule = ref(false);
const effectiveFrom = ref(getCurrentDateInTimeZone());
const today = computed(() => getCurrentDateInTimeZone());
const schedule = ref(emptyScheduleDraft());

const isBusy = computed(() => {
  return isLoading.value || isSaving.value;
});

function fillAssignment(entity: {
  categoryId?: number | null;
  why?: string | null;
  inheritedWhy?: InheritedWhy | null;
}): void {
  categoryId.value = entity.categoryId ?? null;
  why.value = entity.why ?? "";
  inheritedWhy.value = loadedInheritedWhy.value = entity.inheritedWhy ?? null;
}

/** The category a new place brings, unless the entry has one already. */
function takeCategory(choice: ParentChoice | null): void {
  if (choice && categoryId.value === null)
    categoryId.value = categoryOfChoice(choice);
}

/** "Gehört zu" changed: the reason now comes from there, live as ever. */
function chooseParent(choice: ParentChoice | null): void {
  inheritedWhy.value =
    parentId.value === loadedTodo.value?.parentId
      ? loadedInheritedWhy.value
      : choice
        ? whyBelow(choice.todo)
        : null;
  takeCategory(choice);
}
function readParents(choices: ParentChoice[], todos: HierarchyTodo[]): void {
  parentChoicesLoaded.value = choices;
  hasChildren.value = todos.some((todo) => todo.parentId === props.entityId);
}

/**
 * A daily's campaign changed: its reason comes from there; without one in
 * the campaign, the goal counting the daily (the server's answer) still
 * applies when the daily named no campaign before.
 */
function chooseCampaign(choice: ParentChoice | null): void {
  const originalCampaignId = loadedHabit.value?.campaignId ?? null;
  const fallback =
    originalCampaignId === null ? loadedInheritedWhy.value : null;
  inheritedWhy.value =
    campaignId.value === originalCampaignId
      ? loadedInheritedWhy.value
      : ((choice ? whyBelow(choice.todo) : null) ?? fallback);
  takeCategory(choice);
}

/*
 * Loading is not reported as busy: "busy" keeps a dialog open while a write
 * is under way, and nothing can be lost by closing an editor that is still
 * loading. (Reporting it swallowed an early Escape.)
 */
async function loadEntity(): Promise<void> {
  try {
    if (props.kind === "todo") {
      const todo = await getTodo(props.entityId);

      fillAssignment(todo);
      loadedTodo.value = todo;
      parentId.value = todo.parentId;
      periodStart.value = todo.periodStart ?? "";
      periodEnd.value = todo.periodEnd ?? "";
      goalHabitId.value = todo.goalHabitId ?? null;
      goalTarget.value = todo.goalTarget ?? "";
      title.value = todo.title;
      duration.value = todo.plannedDurationMinutes ?? "";
      focusBlockChoice.value = todo.focusBlock ?? "default";
      todoDate.value = todo.scheduledDate ?? "";
      todoTime.value = todo.timeOfDay ?? "";
      campaignColor.value = isCampaignColor(todo.color) ? todo.color : null;
      campaignIcon.value = isCampaignIcon(todo.icon) ? todo.icon : null;
      weeklyTarget.value = minutesToHours(todo.weeklyTargetMinutes);
    } else {
      const habit = await getHabit(props.entityId);

      fillAssignment(habit);
      title.value = habit.title;
      isActive.value = habit.isActive;
      loadedHabit.value = habit;
      campaignId.value = habit.campaignId ?? null;
      duration.value = habit.plannedDurationMinutes ?? "";
      timeOfDay.value = habit.timeOfDay ?? "";
      focusBlockChoice.value = habit.focusBlock ?? "default";
      const version = habit.currentSchedule ?? habit.upcomingSchedule;
      if (version) fillSchedule(version.schedule);
    }

    hasLoaded.value = true;
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Der Eintrag konnte nicht geladen werden.";
  } finally {
    isLoading.value = false;
  }
}

/** The form as it stands, for `todoChanges`. */
function todoFields(): TodoFields {
  return {
    title: title.value,
    date: todoDate.value,
    time: todoTime.value,
    duration: duration.value,
    parentId: parentId.value,
    categoryId: categoryId.value,
    why: why.value,
    periodStart: periodStart.value,
    periodEnd: periodEnd.value,
    goalHabitId: goalHabitId.value,
    goalTarget: goalTarget.value,
    weeklyTarget: weeklyTarget.value,
    color: campaignColor.value,
    icon: campaignIcon.value,
    focusBlock: focusBlockChoice.value,
  };
}

/** The form as it stands, for `habitChanges`. */
function habitFields(): HabitFields {
  return {
    title: title.value,
    isActive: isActive.value,
    campaignId: campaignId.value,
    duration: duration.value,
    timeOfDay: timeOfDay.value,
    categoryId: categoryId.value,
    why: why.value,
    focusBlock: focusBlockChoice.value,
  };
}

function fillSchedule(rule: HabitScheduleRule): void {
  schedule.value = scheduleDraftOf(rule);
}

function describeSchedule(version: ScheduleVersionResponse): string {
  return formatHabitSchedule(version.schedule);
}

function editUpcomingSchedule(): void {
  const version = loadedHabit.value?.upcomingSchedule;
  if (!version || isBusy.value) return;
  fillSchedule(version.schedule);
  effectiveFrom.value = version.effectiveFrom;
  changeSchedule.value = true;
}

function buildScheduleChange(): ChangeHabitScheduleInput {
  if (
    !isValidIsoDate(effectiveFrom.value) ||
    effectiveFrom.value < getCurrentDateInTimeZone()
  ) {
    throw new Error("Bitte wähle heute oder ein zukünftiges gültiges Datum.");
  }
  return {
    effectiveFrom: effectiveFrom.value,
    schedule: scheduleRuleOf(schedule.value),
  };
}

async function save(): Promise<void> {
  if (isBusy.value || !hasLoaded.value) {
    return;
  }

  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      await updateTodo(
        props.entityId,
        todoChanges(todoFields(), loadedTodo.value!),
      );
    } else {
      // Validate both requests before persisting either of them.
      const metadata = habitChanges(habitFields(), loadedHabit.value!);
      const scheduleInput = changeSchedule.value ? buildScheduleChange() : null;
      let metadataSaved = false;
      if (Object.keys(metadata).length > 0) {
        loadedHabit.value = await updateHabit(props.entityId, metadata);
        metadataSaved = true;
      }
      if (scheduleInput) {
        try {
          loadedHabit.value = await changeHabitSchedule(
            props.entityId,
            scheduleInput,
          );
        } catch (error: unknown) {
          const detail =
            error instanceof Error ? error.message : "Unbekannter Fehler";
          throw new Error(
            metadataSaved
              ? `Stammdaten gespeichert, Zeitplanänderung fehlgeschlagen: ${detail}. Du kannst die Zeitplanänderung erneut speichern.`
              : detail,
          );
        }
      }
    }

    emit("changed");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

async function remove(): Promise<void> {
  if (isBusy.value || !hasLoaded.value || !confirmDeletion.value) {
    return;
  }

  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      await confirmPreviewedDeletion();
    } else {
      await deleteHabit(props.entityId);
    }

    emit("changed");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Löschen fehlgeschlagen.";
    confirmDeletion.value = false;
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

function retryLoad(): void {
  errorMessage.value = null;
  isLoading.value = true;
  void loadEntity();
}

onMounted(loadEntity);
</script>

<template>
  <section
    class="item-editor"
    :class="{ card: !embedded, 'item-editor--embedded': embedded }"
    :aria-labelledby="embedded ? undefined : 'item-editor-heading'"
  >
    <h2 v-if="!embedded" id="item-editor-heading">
      {{ kind === "todo" ? "Quest" : "Daily" }}
      bearbeiten
    </h2>

    <div
      v-if="isLoading"
      class="skeleton item-editor__skeleton"
      role="status"
      aria-label="Eintrag wird geladen"
    >
      <span />
      <span />
      <span />
    </div>

    <div v-if="!hasLoaded && !isLoading" class="alert">
      <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>
      <div class="item-editor__actions">
        <button class="btn btn--ground" type="button" @click="retryLoad">
          Erneut versuchen
        </button>
        <button class="btn btn--ground" type="button" @click="emit('close')">
          Schließen
        </button>
      </div>
    </div>

    <KindSwitch
      v-if="hasLoaded && canBecomeDaily"
      v-model="form"
      class="item-editor__kind"
    />

    <!-- The quest as a daily: a new daily that replaces it once saved. -->
    <CreateHabitForm
      v-if="hasLoaded && form === 'habit'"
      :initial="habitDraft"
      :replaces="{ id: entityId, title: loadedTodo?.title ?? title }"
      @busy="emit('busy', $event)"
      @created="emit('changed')"
      @cancel="emit('close')"
    />

    <form v-else-if="hasLoaded" novalidate @submit.prevent="save">
      <fieldset :disabled="isBusy">
        <label class="field">
          Titel
          <input v-model="title" name="title" maxlength="200" required />
        </label>

        <!--
          A quest shows what most edits touch; the rarer groups wait behind
          disclosures that open by themselves when they hold a value. A
          campaign is planned through its quests, so its form leaves out day,
          duration and appointment unless one is set.
        -->
        <template v-if="kind === 'todo'">
          <p v-if="isCampaign" class="item-editor__hint">
            Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat
            oder eine Farbe, ein Symbol oder ein Wochenziel bekommt.
          </p>

          <div v-else class="field">
            <label for="planner-edit-parent">Gehört zu · optional</label>
            <ParentPicker
              id="planner-edit-parent"
              v-model="parentId"
              :exclude="entityId"
              :none-label="
                hasChildren ? 'Keine (eigene Kampagne)' : 'Keine (lose Quest)'
              "
              described-by="planner-edit-parent-hint"
              @chosen="chooseParent"
              @ready="readParents"
            />
            <small id="planner-edit-parent-hint" class="item-editor__hint"
              >Alle Unter-Quests ziehen mit.</small
            >
          </div>

          <PlanFields
            v-if="showPlan"
            v-model:date="todoDate"
            id-prefix="planner-edit"
          />

          <div v-if="showDuration" class="item-editor__row">
            <label class="field">
              Dauer in Minuten · optional
              <input
                v-model="duration"
                name="duration"
                type="number"
                min="1"
                step="1"
              />
            </label>
          </div>

          <WhyField
            id="planner-edit-why"
            v-model="why"
            :inherited="inheritedWhy"
          />

          <template v-if="isCampaign">
            <div class="field">
              <label for="planner-edit-category">Kategorie · optional</label>
              <CategoryPicker
                id="planner-edit-category"
                v-model="categoryId"
                @loaded="categories = $event"
              />
            </div>
            <CampaignFields
              v-model:color="campaignColor"
              v-model:icon="campaignIcon"
              v-model:target="weeklyTarget"
              id-prefix="planner-edit-campaign"
              :title="title"
            />
          </template>

          <div class="item-editor__more">
            <FormDisclosure
              v-if="!isCampaign && isTopLevel"
              label="Kampagne"
              detail="Farbe, Symbol, Wochenziel"
              :summary="campaignSummary"
              :start-open="!!campaignSummary"
            >
              <CampaignFields
                v-model:color="campaignColor"
                v-model:icon="campaignIcon"
                v-model:target="weeklyTarget"
                id-prefix="planner-edit-campaign"
                :title="title"
              />
            </FormDisclosure>

            <AppointmentFields
              v-if="showAppointment"
              v-model:time="todoTime"
              :date="todoDate"
              id-prefix="planner-edit"
            />

            <TodoGoalFields
              v-if="showGoal"
              v-model:period-start="periodStart"
              v-model:period-end="periodEnd"
              v-model:habit-id="goalHabitId"
              v-model:target="goalTarget"
            />

            <FormDisclosure
              v-if="!isCampaign"
              label="Kategorie"
              :summary="categoryName"
              :start-open="categoryId !== null"
            >
              <div class="field">
                <label for="planner-edit-category">Kategorie</label>
                <CategoryPicker
                  id="planner-edit-category"
                  v-model="categoryId"
                  @loaded="categories = $event"
                />
              </div>
            </FormDisclosure>

            <FormDisclosure
              v-if="!isCampaign"
              label="Fokus-Sperre"
              :summary="focusBlockSummary"
              :start-open="focusBlockChoice !== 'default'"
            >
              <FocusBlockOverride v-model="focusBlockChoice" kind="todo" />
            </FormDisclosure>
          </div>

          <QuestNotes :target="{ kind: 'todo', id: entityId }" />
        </template>

        <!-- A daily: the rhythm first, then what it belongs to, then why. -->
        <template v-else>
          <div class="item-editor__notice" data-test="schedule-summary">
            <p v-if="loadedHabit?.currentSchedule">
              Rhythmus:
              <strong>{{
                describeSchedule(loadedHabit.currentSchedule)
              }}</strong>, seit
              {{
                formatDateForGermanDisplay(
                  loadedHabit.currentSchedule.effectiveFrom,
                )
              }}
            </p>
            <p v-else>Das Daily hat noch keinen aktuell gültigen Zeitplan.</p>
            <template v-if="loadedHabit?.upcomingSchedule">
              <p>
                Geplant ab
                {{
                  formatDateForGermanDisplay(
                    loadedHabit.upcomingSchedule.effectiveFrom,
                  )
                }}:
                <strong>{{
                  describeSchedule(loadedHabit.upcomingSchedule)
                }}</strong>
              </p>
              <button
                class="btn btn--ground"
                type="button"
                data-test="edit-upcoming"
                @click="editUpcomingSchedule"
              >
                Geplanten Zeitplan bearbeiten
              </button>
            </template>
          </div>

          <label class="item-editor__checkbox">
            <input
              v-model="changeSchedule"
              name="changeSchedule"
              type="checkbox"
            />
            Rhythmus ändern
          </label>

          <fieldset
            v-if="changeSchedule"
            class="item-editor__schedule"
            data-test="schedule-fields"
          >
            <legend class="visually-hidden">Neuer Rhythmus</legend>
            <label class="field">
              Rhythmus
              <select v-model="schedule.type" name="scheduleType">
                <option value="interval">Alle paar Tage</option>
                <option value="fixed_weekdays">An festen Wochentagen</option>
                <option value="weekly_target">Ein paarmal pro Woche</option>
              </select>
            </label>

            <div v-if="schedule.type === 'interval'" class="field">
              <label for="planner-edit-interval">Alle wie viele Tage?</label>
              <input
                id="planner-edit-interval"
                v-model="schedule.intervalDays"
                name="intervalDays"
                type="number"
                min="1"
                step="1"
                aria-describedby="planner-edit-interval-hint"
              />
              <small id="planner-edit-interval-hint" class="item-editor__hint"
                >1 heißt täglich.</small
              >
            </div>

            <fieldset
              v-else-if="schedule.type === 'fixed_weekdays'"
              class="item-editor__weekdays"
            >
              <legend>An welchen Tagen?</legend>

              <label
                v-for="option in WEEKDAY_OPTIONS"
                :key="option.value"
                class="item-editor__weekday"
              >
                <input
                  v-model="schedule.weekdays"
                  name="weekdays"
                  type="checkbox"
                  :value="option.value"
                />
                {{ option.label }}
              </label>
            </fieldset>

            <div v-else class="field">
              <label for="planner-edit-weekly-target">Wie oft pro Woche?</label>
              <input
                id="planner-edit-weekly-target"
                v-model="schedule.weeklyTarget"
                name="weeklyTarget"
                type="number"
                min="1"
                max="7"
                step="1"
                aria-describedby="planner-edit-weekly-hint"
              />
              <small id="planner-edit-weekly-hint" class="item-editor__hint"
                >Die Woche läuft von Montag bis Sonntag.</small
              >
            </div>

            <label v-if="schedule.type !== 'weekly_target'" class="field">
              Wenn du einen Tag verpasst
              <select v-model="schedule.missedPolicy" name="missedPolicy">
                <option value="carry_over">Später nachholen</option>
                <option value="skip">Verfallen lassen</option>
              </select>
            </label>

            <div class="field">
              <label for="planner-edit-effective-from">Gültig ab</label>
              <input
                id="planner-edit-effective-from"
                v-model="effectiveFrom"
                name="effectiveFrom"
                type="date"
                :min="today"
                required
                aria-describedby="planner-edit-effective-hint"
              />
              <small id="planner-edit-effective-hint" class="item-editor__hint"
                >Heute gilt es sofort, ein späterer Tag ab Mitternacht. Ersetzt
                einen schon geplanten Rhythmus; Erledigtes bleibt.</small
              >
            </div>
          </fieldset>

          <div class="item-editor__row">
            <div class="field">
              <label for="planner-edit-category">Kategorie · optional</label>
              <CategoryPicker
                id="planner-edit-category"
                v-model="categoryId"
                @loaded="categories = $event"
              />
            </div>
            <div class="field">
              <label for="planner-edit-campaign">Kampagne · optional</label>
              <ParentPicker
                id="planner-edit-campaign"
                v-model="campaignId"
                campaigns-only
                described-by="planner-edit-campaign-hint"
                @chosen="chooseCampaign"
              />
              <small id="planner-edit-campaign-hint" class="item-editor__hint"
                >Seine gemessene Zeit zählt dort als Kampagnen-Stunden.</small
              >
            </div>
          </div>

          <WhyField
            id="planner-edit-why"
            v-model="why"
            :inherited="inheritedWhy"
          />

          <div class="item-editor__row">
            <label class="field">
              Uhrzeit · optional
              <input v-model="timeOfDay" name="timeOfDay" type="time" />
            </label>
            <div class="field">
              <label for="habit-edit-duration"
                >Dauer in Minuten · optional</label
              >
              <input
                id="habit-edit-duration"
                v-model="duration"
                name="duration"
                type="number"
                min="1"
                :max="TIMER_MAX_MINUTES"
                step="1"
                aria-describedby="habit-edit-duration-hint"
              />
              <small id="habit-edit-duration-hint" class="item-editor__hint"
                >Gilt für jeden Tag ohne eigene Dauer.</small
              >
            </div>
          </div>

          <FormDisclosure
            label="Fokus-Sperre"
            :summary="focusBlockSummary"
            :start-open="focusBlockChoice !== 'default'"
          >
            <FocusBlockOverride v-model="focusBlockChoice" kind="habit" />
          </FormDisclosure>

          <label class="item-editor__checkbox">
            <input v-model="isActive" name="isActive" type="checkbox" />
            Aktiv: erscheint an fälligen Tagen in Heute
          </label>

          <QuestNotes
            v-if="occurrenceId"
            :target="{ kind: 'occurrence', id: occurrenceId }"
          />
        </template>

        <!-- The last, quiet step asks right above the actions. -->
        <div
          v-if="confirmDeletion"
          class="item-editor__confirm"
          data-test="delete-question"
        >
          <TodoDeletionSummary
            v-if="deletionPreview"
            :preview="deletionPreview"
          />
          <p>„{{ title }}“ wirklich löschen?</p>

          <p v-if="kind === 'habit'" class="item-editor__hint">
            Es verschwindet aus Heute. Das Logbuch bleibt erhalten.
          </p>

          <div class="item-editor__actions">
            <button
              class="btn btn--danger"
              type="button"
              data-test="confirm-delete"
              @click="remove"
            >
              Ja, löschen
            </button>

            <button
              ref="keepButton"
              class="btn"
              type="button"
              data-test="cancel-delete"
              @click="keep"
            >
              Nicht löschen
            </button>
          </div>
        </div>

        <!-- In a dialog it is the last thing, flush with the bottom edge. -->
        <div
          class="item-editor__footer"
          :class="{ 'sticky-actions': embedded }"
          data-test="editor-actions"
        >
          <p v-if="errorMessage" class="form-error" role="alert">
            {{ errorMessage }}
          </p>

          <div class="item-editor__actions">
            <button class="btn btn--primary" type="submit">
              {{ isSaving ? "Bitte warten …" : "Speichern" }}
            </button>

            <button class="btn" type="button" @click="emit('close')">
              Abbrechen
            </button>

            <button
              v-if="!confirmDeletion"
              class="btn btn--quiet item-editor__delete"
              type="button"
              data-test="request-delete"
              @click="requestDeletion"
            >
              <AppIcon name="trash" />
              {{ kind === "todo" ? "Quest löschen" : "Gesamtes Daily löschen" }}
            </button>
          </div>
        </div>
      </fieldset>
    </form>
  </section>
</template>

<style scoped>
.item-editor h2 {
  margin: 0 0 var(--space-4);
  font-size: 1.125rem;
  font-weight: 800;
}

.item-editor fieldset {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.item-editor__skeleton > span {
  height: 3rem;
}

.item-editor__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.item-editor__checkbox {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  font-weight: 600;
}

.item-editor__checkbox input {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
}

.item-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

/* The optional groups read as one list between hairlines. */
.item-editor__more {
  display: grid;
  border-bottom: 1px solid var(--color-line);
}

.item-editor__footer {
  display: grid;
  gap: var(--space-3);
}

/* Quest | Daily above the form, with the form's gap below it. */
.item-editor__kind {
  margin-bottom: var(--space-4);
}

.item-editor__hint {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}

/* Info: a calm panel in deep apricot with ink text. */
.item-editor__notice {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground-deep);
  color: var(--color-ink);
}

.item-editor__notice p {
  margin: 0;
}

.item-editor .item-editor__schedule {
  padding-left: var(--space-4);
  border-left: 2px solid var(--color-line);
}

.item-editor .item-editor__weekdays {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  padding: 0;
  border: 0;
}

.item-editor__weekdays legend {
  margin-bottom: var(--space-2);
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.item-editor__weekday {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-4) 0 var(--space-3);
  border: 1.5px solid var(--color-line);
  border-radius: var(--radius-pill);
  color: var(--color-ink-muted);
  font-weight: 700;
  cursor: pointer;
}

.item-editor__weekday:has(input:checked) {
  border-color: var(--color-ink);
  color: var(--color-ink);
}

.item-editor__weekday input {
  width: 1.125rem;
  height: 1.125rem;
}

/* The way to deletion: last in the actions, pushed to their far end. */
.item-editor__delete {
  margin-left: auto;
}

.item-editor__confirm {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.item-editor__confirm p {
  margin: 0;
}

/* The way to deletion stays quiet ink; only "Ja, löschen" is red. */
.item-editor button.btn--quiet:not(:disabled) {
  background: transparent;
  color: var(--color-ink-muted);
}

.item-editor button.btn--quiet:hover:not(:disabled) {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

/* ModalDialog tints every button; destructive ones keep the danger tint. */
.item-editor button.btn--danger:not(:disabled) {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

/* On the deep panel and the alert, side actions sit on white. */
.item-editor button.btn--ground:not(:disabled) {
  background: var(--color-surface);
}

@media (max-width: 32rem) {
  .item-editor__row {
    grid-template-columns: 1fr;
  }
}
</style>
