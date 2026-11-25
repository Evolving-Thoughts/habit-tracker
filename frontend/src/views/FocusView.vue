<script setup lang="ts">
import { computed, ref } from "vue";
import { onBeforeRouteLeave, type RouteLocationNormalized } from "vue-router";
import {
  getToday,
  reorderDay,
  updateOccurrenceStatus,
} from "../api/day-planner.api";
import { writeDone } from "../composables/useTicks";
import { postponedToEnd } from "../utils/today-order";
import AppIcon from "../components/AppIcon.vue";
import FocusSoundMenu from "../components/FocusSoundMenu.vue";
import { useFocusSound } from "../composables/useFocusSound";
import ModalDialog from "../components/ModalDialog.vue";
import FocusBlockSetupHint from "../components/FocusBlockSetupHint.vue";
import { useFocusBlock } from "../composables/useFocusBlock";
import type { FocusBlockMode } from "../types/focus-block";
import { blockApplies, blockStatusLine } from "../utils/focus-block";
import QuestNotes from "../components/QuestNotes.vue";
import { notifyDataChanged } from "../composables/data-sync";
import { useDayClock } from "../composables/useDayClock";
import { useLoader } from "../composables/useLoader";
import { toggleTimer, useTimer } from "../composables/useTimer";
import { useShortcutHandlers } from "../composables/useShortcuts";
import { hrefOf } from "../routes";
import type { DayPlannerItem, DayPlannerResponse } from "../types/day-planner";
import CampaignChip from "../components/CampaignChip.vue";
import ChallengeMark from "../components/ChallengeMark.vue";
import { formatStopwatch } from "../utils/stopwatch";
import { streakLine } from "../utils/streak";
import {
  APPOINTMENT_LEAD_MINUTES,
  appointmentWindow,
  arrangeToday,
  formatDuration,
  formatWindow,
  itemKey,
  nextChangeAt,
  plannedClock,
  soonAppointment,
  type AppointmentEntry,
} from "../utils/today-agenda";

/**
 * One quest in view, nothing else: what is up now, its why, and a stopwatch.
 * Finishing it brings up the next one in the order of the day.
 */
const timer = useTimer();
const busy = ref(false);
const actionError = ref<string | null>(null);

const {
  data: planner,
  isLoading,
  errorMessage,
  reload,
} = useLoader<DayPlannerResponse | null>(getToday, {
  initial: null,
  fallbackError: "Der Tag konnte nicht geladen werden.",
  refreshOnChange: () => !busy.value,
});

/*
 * Wakes when an appointment's turn begins or ends, like Heute, and when one
 * comes close enough to be named.
 */
const now = useDayClock((minutes) =>
  planner.value
    ? nextChangeAt(planner.value, minutes, APPOINTMENT_LEAD_MINUTES)
    : null,
);

const agenda = computed(() =>
  planner.value ? arrangeToday(planner.value, now.value) : null,
);

function isTimed(item: DayPlannerItem): boolean {
  const running = timer?.timer.value;
  if (!running) return false;
  return item.type === "todo"
    ? running.kind === "todo" && running.targetId === item.todoId
    : running.kind === "occurrence" && running.targetId === item.occurrenceId;
}

/**
 * What the stopwatch runs on stays in view; otherwise what is up now, by
 * the rule Heute's focus card follows (`currentItem`): an appointment
 * during its turn, else the head of the order.
 */
const current = computed<DayPlannerItem | null>(() => {
  const day = agenda.value;
  if (!day) return null;
  const open = planner.value!.items.filter((item) => item.status === "pending");
  return open.find(isTimed) ?? day.focus;
});
const timed = computed(() => !!current.value && isTimed(current.value));
const running = computed(
  () => timed.value && timer?.timer.value?.state === "running",
);

const display = computed(() =>
  formatStopwatch(timed.value ? (timer?.elapsed.value ?? 0) : 0),
);
const stateLabel = computed(() => {
  if (!timed.value) return "Bereit";
  if (!running.value) return "Pausiert";
  return timer?.reached.value ? "Soll erreicht" : "Läuft";
});
/*
 * Fokus-Klänge: the chosen sound plays while this stopwatch runs, once
 * started from here (useFocusSound has the rule); leaving the view ends it.
 */
const sound = useFocusSound({
  timerKey: () =>
    `${timer?.timer.value?.id ?? ""}:${timer?.timer.value?.state ?? ""}`,
  running: () => running.value,
  reached: () => running.value && !!timer?.reached.value,
});

const facts = computed(() => {
  const item = current.value;
  if (!item) return [];
  const parts: string[] = [];
  // A daily's running series, calm and only while there is one.
  const series = item.type === "habit" ? streakLine(item.streak) : null;
  if (series) parts.push(series);
  if (item.plannedDurationMinutes != null)
    parts.push(`Soll ${formatDuration(item.plannedDurationMinutes)}`);
  if (item.workedMinutes > 0)
    parts.push(`heute schon ${formatDuration(item.workedMinutes)}`);
  const window = appointmentWindow(item);
  if (window) parts.push(`Termin ${formatWindow(window)}`);
  return parts;
});

const titleOf = (entry: AppointmentEntry): string =>
  entry.kind === "item" ? entry.item.title : entry.event.title;
const nextAppointment = computed(() => {
  const entry = agenda.value?.nextAppointment;
  return entry ? `${entry.time} ${titleOf(entry)}` : null;
});
/**
 * A fixed appointment about to begin, named from its last minutes before;
 * or one whose turn began while the stopwatch holds another quest in view.
 */
const comingUp = computed(() => {
  const day = agenda.value;
  if (!day) return null;
  const due = day.focus;
  if (due && due !== current.value && due.timeOfDay)
    return `Seit ${plannedClock(due)!.time}: ${due.title}`;
  const entry = soonAppointment(day, now.value);
  return entry ? `Gleich um ${entry.time}: ${titleOf(entry)}` : null;
});
/** Open appointments of today that are not their turn now. */
const waitingAppointments = computed(() =>
  (agenda.value?.appointments ?? []).some(
    (entry) => entry.kind === "item" && entry.item.status === "pending",
  ),
);
/** Only what is part of the order can be put behind the rest of it. */
const canPostpone = computed(
  () =>
    !!current.value &&
    !current.value.timeOfDay &&
    (agenda.value?.queue.length ?? 0) > 1,
);

async function act(work: () => Promise<unknown>, fallback: string) {
  if (busy.value) return;
  busy.value = true;
  actionError.value = null;
  try {
    await work();
  } catch (cause) {
    actionError.value = cause instanceof Error ? cause.message : fallback;
  } finally {
    busy.value = false;
  }
}

/*
 * Fokus-Sperre: a stopwatch that starts or resumes running, here or
 * anywhere, starts a block when the rule calls for one; here Soft or
 * Hardcore is picked with one tap beforehand. The server applies the rule
 * (useFocusBlock); the screen shows it and what keeps it from working.
 */
const focusBlock = useFocusBlock();
const activeBlock = computed(() => focusBlock?.block.value ?? null);
const pickedMode = ref<FocusBlockMode | null>(null);
const blockMode = computed<FocusBlockMode>(
  () => pickedMode.value ?? focusBlock?.state.value?.settings.mode ?? "soft",
);
const blockWanted = computed(() => {
  const item = current.value;
  const settings = focusBlock?.state.value?.settings;
  return (
    !!item &&
    !!settings &&
    blockApplies(settings, item.focusBlock, item.plannedDurationMinutes)
  );
});
/*
 * The choice of Soft or Hardcore only where a block would block something:
 * a list to block and a phone that can. Otherwise one quiet line below the
 * buttons says why not (`blockQuiet`), instead of a choice that changes
 * nothing.
 */
const blockEmpty = computed(
  () => focusBlock?.setupIssues.value.includes("empty") ?? false,
);
// A browser can choose too: a block started here takes effect on the phone.
const blockChoice = computed(() => blockWanted.value && !blockEmpty.value);
const blockQuiet = computed<"empty" | "browser" | null>(() => {
  if (blockEmpty.value && (activeBlock.value || blockWanted.value))
    return "empty";
  if (!activeBlock.value && blockWanted.value && !focusBlock?.native)
    return "browser";
  return null;
});
const focusSettingsHref = `${hrefOf("settings")}?abschnitt=fokus-sperre`;
/** Hardcore with the stopwatch trigger holds until done or stopped, not to the Soll. */
const untilStopped = computed(
  () => focusBlock?.state.value?.settings.trigger !== "threshold",
);
const blockLine = computed(() =>
  activeBlock.value && focusBlock
    ? blockStatusLine(activeBlock.value, focusBlock.serverNow())
    : "",
);
/** Asked before a Soft block is lifted; `leaveTo` when leaving the view. */
const confirmLift = ref(false);
let leaveTo: RouteLocationNormalized | null = null;
let leaving = false;

async function liftBlock(): Promise<void> {
  if (!(await focusBlock?.end())) return;
  confirmLift.value = false;
  const target = leaveTo;
  leaveTo = null;
  if (target) {
    leaving = true;
    window.location.hash = `#${target.fullPath}`;
  }
}
function keepBlock(): void {
  confirmLift.value = false;
  leaveTo = null;
}
/*
 * With the threshold trigger, leaving the Fokus-Modus asks first while a
 * Soft block holds. With the stopwatch trigger the block belongs to the
 * stopwatch, which runs on outside this view, so leaving asks nothing.
 */
onBeforeRouteLeave((to) => {
  if (leaving || untilStopped.value || activeBlock.value?.mode !== "soft")
    return true;
  leaveTo = to;
  confirmLift.value = true;
  return false;
});

/** False when there is nothing to start, like the disabled button. */
function toggleStopwatch(): boolean {
  const item = current.value;
  if (!item || busy.value) return false;
  // Starting or resuming here lets the chosen sound start with it. When no
  // other stopwatch has to end first (that asks), the sound follows the
  // press at once instead of waiting for the server's answer.
  const other = timer?.timer.value;
  const ownOrNone =
    !other ||
    (item.type === "todo"
      ? other.kind === "todo" && other.targetId === item.todoId
      : other.kind === "occurrence" && other.targetId === item.occurrenceId);
  if (!ownOrNone) sound.gesture();
  else if (running.value) sound.gesture("pause");
  else if (other || item.timerEligible) sound.gesture("start");
  // Without the Fokus-Sperre (no provider) the stopwatch starts as anywhere.
  const focus =
    !focusBlock || activeBlock.value ? undefined : { mode: blockMode.value };
  return toggleTimer(
    timer,
    item.type === "todo"
      ? {
          kind: "todo",
          targetId: item.todoId,
          title: item.title,
          focusBlock: focus,
        }
      : {
          kind: "occurrence",
          targetId: item.occurrenceId,
          title: item.title,
          focusBlock: focus,
        },
    item.timerEligible,
  );
}

/** Done: the server ends its stopwatch, and the next quest comes into view. */
function complete(): Promise<void> {
  const item = current.value;
  if (!item) return Promise.resolve();
  return act(async () => {
    await writeDone(
      item.type === "todo"
        ? { kind: "todo", id: item.todoId, title: item.title }
        : { kind: "occurrence", id: item.occurrenceId, title: item.title },
      true,
    );
    notifyDataChanged();
    await Promise.all([reload(false), timer?.refresh()]);
  }, "Das Erledigen hat nicht geklappt.");
}

function skip(): Promise<void> {
  const item = current.value;
  if (!item || item.type !== "habit") return Promise.resolve();
  return act(async () => {
    await updateOccurrenceStatus(item.occurrenceId, "skipped");
    notifyDataChanged();
    await Promise.all([reload(false), timer?.refresh()]);
  }, "Das Überspringen hat nicht geklappt.");
}

/** Not now: it goes to the end of the order, and its stopwatch ends. */
function postpone(): Promise<void> {
  const item = current.value;
  const sequence = agenda.value?.sequence;
  if (!item || !sequence || !canPostpone.value) return Promise.resolve();
  return act(async () => {
    if (timed.value) await timer?.action("stop");
    // Appointments keep their place; only this one goes to the end.
    await reorderDay(postponedToEnd(sequence, item));
    notifyDataChanged();
    await reload(false);
  }, "Das Verschieben hat nicht geklappt.");
}

/*
 * Space and Ctrl+Enter do what the two big buttons do; Escape leads back;
 * M switches the sound on or off.
 */
useShortcutHandlers({
  "focus.timer": () => toggleStopwatch(),
  "focus.done": () => {
    if (!current.value || busy.value) return false;
    void complete();
  },
  "focus.leave": () => {
    window.location.hash = hrefOf("today");
  },
  "focus.sound": () => sound.toggle(),
});
</script>

<template>
  <main class="focus-view">
    <header class="focus-view__bar">
      <a class="focus-view__back" :href="hrefOf('today')">
        <AppIcon name="chevron-left" />
        <span>Heute</span>
      </a>
      <p class="focus-view__eyebrow">Fokus-Modus</p>
      <FocusSoundMenu :sound="sound" />
      <!--
        Calm, not an error, and in the bar so the stage keeps its row: the
        Fokus-Modus works on without the sound.
      -->
      <p v-if="sound.loadFailed.value" class="focus-view__note" role="status">
        Der Klang konnte nicht geladen werden. Der Fokus-Modus läuft ohne ihn
        weiter.
      </p>
    </header>

    <p v-if="errorMessage || actionError" class="focus-view__error" role="alert">
      {{ errorMessage || actionError }}
    </p>

    <div
      v-if="isLoading"
      class="focus-view__stage"
      role="status"
      aria-label="Fokus-Modus wird geladen"
    >
      <span class="focus-view__bone" />
    </div>

    <section
      v-else-if="current"
      :key="itemKey(current)"
      class="focus-view__stage"
      aria-labelledby="focus-view-title"
    >
      <p v-if="current.campaign" class="focus-view__campaign">
        <CampaignChip :campaign="current.campaign" />
      </p>
      <h1 id="focus-view-title" class="focus-view__title">
        {{ current.title }}
      </h1>
      <p v-if="current.why" class="focus-view__why">{{ current.why }}</p>

      <p
        class="focus-view__time"
        :class="{ 'focus-view__time--idle': !running }"
        role="timer"
        aria-label="Gearbeitete Zeit"
      >
        {{ display }}
      </p>
      <p class="focus-view__state">
        <strong>{{ stateLabel }}</strong>
        <ChallengeMark
          v-if="current.type === 'habit' && current.monthChallenge"
        />
        <span v-for="fact in facts" :key="fact">{{ fact }}</span>
      </p>
      <p v-if="comingUp" class="focus-view__soon">
        <AppIcon name="calendar" />
        <span>{{ comingUp }}</span>
      </p>

      <div
        v-if="activeBlock"
        class="focus-view__block"
        data-test="focus-block-state"
      >
        <p class="focus-view__block-line" role="status">{{ blockLine }}</p>
        <p
          v-if="activeBlock.mode === 'hardcore'"
          class="focus-view__block-hint"
        >
          {{
            activeBlock.endsAt
              ? "Endet mit dem Soll oder wenn die Quest erledigt ist. Pausieren hebt sie nicht auf."
              : "Endet, wenn die Quest erledigt ist oder du die Stoppuhr beendest. Pausieren hebt sie nicht auf."
          }}
        </p>
        <p v-if="!focusBlock?.native" class="focus-view__block-hint">
          Gesperrt wird auf dem Handy in der Android-App.
        </p>
        <button
          v-if="activeBlock.mode === 'soft'"
          class="btn btn--quiet"
          type="button"
          :disabled="focusBlock?.busy.value"
          @click="confirmLift = true"
        >
          Sperre aufheben
        </button>
      </div>
      <div
        v-else-if="blockChoice"
        class="focus-view__block"
        data-test="focus-block-choice"
      >
        <div class="segmented" role="group" aria-label="Art der Fokus-Sperre">
          <button
            type="button"
            :aria-pressed="blockMode === 'soft'"
            @click="pickedMode = 'soft'"
          >
            Soft
          </button>
          <button
            type="button"
            :aria-pressed="blockMode === 'hardcore'"
            @click="pickedMode = 'hardcore'"
          >
            Hardcore
          </button>
        </div>
        <p class="focus-view__block-hint">
          {{
            blockMode === "soft"
              ? "Die Sperre gilt, solange die Stoppuhr läuft; Pausieren hebt sie auf."
              : untilStopped
                ? "Die Sperre hält auch in Pausen, bis die Quest erledigt ist oder du die Stoppuhr beendest."
                : current.plannedDurationMinutes === null
                  ? "Ohne Soll läuft die Sperre als Soft."
                  : "Die Sperre hält, bis die Quest erledigt oder das Soll erreicht ist."
          }}
        </p>
        <button
          v-if="running"
          class="btn btn--quiet"
          type="button"
          :disabled="focusBlock?.busy.value"
          @click="focusBlock?.start(blockMode)"
        >
          Sperre starten
        </button>
      </div>
      <p
        v-if="focusBlock?.error.value && (activeBlock || blockWanted)"
        class="focus-view__block-hint"
        role="alert"
      >
        {{ focusBlock.error.value }}
      </p>

      <div class="focus-view__actions">
        <button
          class="btn btn--primary focus-view__primary"
          type="button"
          :disabled="busy || !current.timerEligible || timer?.busy.value"
          @click="toggleStopwatch"
        >
          <AppIcon :name="running ? 'pause' : 'play'" />
          <span>{{
            !timed ? "Starten" : running ? "Pausieren" : "Fortsetzen"
          }}</span>
        </button>
        <button
          class="btn focus-view__done"
          type="button"
          :disabled="busy"
          :aria-label="`${current.title} erledigen`"
          @click="complete"
        >
          <AppIcon name="check" />
          <span>Erledigt</span>
        </button>
      </div>
      <div class="focus-view__later">
        <button
          v-if="canPostpone"
          class="btn btn--quiet"
          type="button"
          :disabled="busy"
          @click="postpone"
        >
          Später
        </button>
        <button
          v-if="current.type === 'habit'"
          class="btn btn--quiet"
          type="button"
          :disabled="busy"
          :aria-label="`${current.title} überspringen`"
          @click="skip"
        >
          Überspringen
        </button>
      </div>
      <!-- Why the Fokus-Sperre blocks nothing here, read where it stands. -->
      <p
        v-if="blockQuiet"
        class="focus-view__block-quiet"
        data-test="focus-block-quiet"
      >
        <template v-if="blockQuiet === 'empty'">
          Fokus-Sperre: Sperrliste leer ·
          <a class="btn btn--link" :href="focusSettingsHref">Einrichten</a>
        </template>
        <template v-else>Fokus-Sperre: wirkt auf dem Handy in der Android-App</template>
      </p>
      <FocusBlockSetupHint v-if="activeBlock || blockChoice" where="focus" />

      <!-- A quest's notes, or those of this one run of a daily. -->
      <QuestNotes
        :key="
          current.type === 'todo'
            ? `todo-${current.todoId}`
            : `run-${current.occurrenceId}`
        "
        class="focus-view__notes"
        :target="
          current.type === 'todo'
            ? { kind: 'todo', id: current.todoId }
            : { kind: 'occurrence', id: current.occurrenceId }
        "
      />
    </section>

    <!-- An appointment only comes into view during its turn. -->
    <section
      v-else-if="planner && waitingAppointments"
      class="focus-view__stage focus-view__empty"
    >
      <h1 class="focus-view__title">Nichts in der Reihenfolge</h1>
      <p>
        {{
          nextAppointment
            ? `Nächster Termin: ${nextAppointment}.`
            : "Was noch offen ist, steht bei den Terminen."
        }}
      </p>
      <a class="btn btn--primary" :href="hrefOf('today')">Zurück zu Heute</a>
    </section>
    <section v-else-if="planner" class="focus-view__stage focus-view__empty">
      <h1 class="focus-view__title">Alles erledigt</h1>
      <p>
        Für heute ist nichts mehr offen.
        <template v-if="planner.workedMinutes > 0">
          Du hast {{ formatDuration(planner.workedMinutes) }} gearbeitet.
        </template>
      </p>
      <a class="btn btn--primary" :href="hrefOf('today')">Zurück zu Heute</a>
    </section>

    <ModalDialog
      v-if="confirmLift"
      title="Sperre aufheben?"
      :busy="focusBlock?.busy.value"
      focus-selector="[data-test='keep-block']"
      @close="keepBlock"
    >
      <p class="focus-view__dialog-text">
        Apps und Websites der Liste sind dann wieder frei. Die Stoppuhr läuft
        weiter; nach einer Pause sperrt sie beim Fortsetzen wieder.
      </p>
      <div class="focus-view__dialog-actions">
        <button class="btn btn--primary" type="button" @click="liftBlock">
          Sperre aufheben
        </button>
        <button
          class="btn"
          type="button"
          data-test="keep-block"
          @click="keepBlock"
        >
          Weiter sperren
        </button>
      </div>
    </ModalDialog>
  </main>
</template>

<style scoped>
.focus-view {
  display: grid;
  grid-template-rows: auto 1fr;
  width: min(100% - 2rem, 36rem);
  min-height: 100dvh;
  margin: 0 auto;
  padding: var(--space-4) 0 var(--space-6);
}

.focus-view__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  justify-content: space-between;
}

.focus-view__back {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  min-height: var(--tap);
  padding-right: var(--space-3);
  border-radius: var(--radius-control);
  color: var(--color-action-strong);
  font-weight: 700;
  text-decoration: none;
}

.focus-view__back :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

.focus-view__eyebrow {
  margin: 0 0 0 auto;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

/* On a phone the bar keeps "Heute" and the sound; the view names itself. */
@media (max-width: 39.99rem) {
  .focus-view__eyebrow {
    display: none;
  }

  /* The sound button's root carries this view's scope, so it can be placed. */
  .focus-view__bar > .focus-sound {
    margin-left: auto;
  }
}

.focus-view__error {
  margin: var(--space-3) 0 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

.focus-view__note {
  flex: 1 0 100%;
  margin: var(--space-1) 0 0;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-surface-quiet);
  color: var(--color-ink);
  font-size: 0.875rem;
}

.focus-view__stage {
  display: grid;
  align-content: center;
  justify-items: center;
  gap: var(--space-3);
  padding: var(--space-5) 0;
  text-align: center;
}

/* The campaign's chip; on the bare ground its own white carries it. */
.focus-view__campaign {
  display: flex;
  max-width: 100%;
  margin: 0;
}

.focus-view__title {
  margin: 0;
  font-size: clamp(1.5rem, 6vw, 1.875rem);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.015em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}

.focus-view__why {
  max-width: 34ch;
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 1.0625rem;
  text-wrap: pretty;
}

.focus-view__time {
  margin: var(--space-4) 0 0;
  font-size: clamp(4rem, 22vw, 7rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  letter-spacing: -0.03em;
}

.focus-view__time--idle {
  color: var(--color-ink-soft);
}

.focus-view__state {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  justify-content: center;
  margin: 0;
  color: var(--color-ink-muted);
  font-variant-numeric: tabular-nums;
}

.focus-view__state strong {
  color: var(--color-ink);
}

.focus-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  margin-top: var(--space-4);
}

.focus-view__primary {
  min-width: 11rem;
}

.focus-view__primary :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

.focus-view__done {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
}

.focus-view__done :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

.focus-view__later {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: center;
}

.focus-view__notes {
  width: 100%;
  margin-top: var(--space-5);
}

/* Fokus-Sperre: one calm line, and the choice before the start. */
.focus-view__block {
  display: grid;
  justify-items: center;
  gap: var(--space-2);
}

.focus-view__block-line {
  margin: 0;
  color: var(--color-ink);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.focus-view__block-hint {
  max-width: 34ch;
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  text-wrap: pretty;
}

/* No block would apply: one quiet line, its link the only tap in it. */
.focus-view__block-quiet {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  text-align: center;
}

.focus-view__block-quiet .btn--link {
  padding: 0 var(--space-1);
  font-size: inherit;
}

.focus-view__dialog-text {
  margin: 0 0 var(--space-4);
  color: var(--color-ink-muted);
}

.focus-view__dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

/* An appointment about to begin: named calmly, in ink, never as a warning. */
.focus-view__soon {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  margin: 0;
  color: var(--color-ink);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.focus-view__soon :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
  color: var(--color-ink-muted);
}

.focus-view__empty p {
  max-width: 34ch;
  margin: 0;
  color: var(--color-ink-muted);
}

.focus-view__bone {
  width: min(100%, 16rem);
  height: 6rem;
  border-radius: var(--radius-card);
  background: var(--color-ground-deep);
}
</style>
