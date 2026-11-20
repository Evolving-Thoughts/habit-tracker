<script setup lang="ts">
import { useDevicePushRestore } from "../push/restore";
import { notifyDataChanged, onTargetsChanged } from "../composables/data-sync";
import {
  isValidTimerDuration,
  TIMER_DURATION_MESSAGE,
  TIMER_MAX_MINUTES,
} from "../utils/timer-duration";
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import { createTimerController, timerKey } from "../composables/useTimer";
import { useTargetNotice } from "../composables/useTargetNotice";
import {
  updateTodoCompletion,
  updateOccurrenceStatus,
} from "../api/day-planner.api";
import { formatStopwatch } from "../utils/stopwatch";
import type { MenuEntry } from "../utils/row-actions";
import ActionMenu from "./ActionMenu.vue";
import TimerIconButton from "./TimerIconButton.vue";
import ModalDialog from "./ModalDialog.vue";
import NoticeToast from "./NoticeToast.vue";

/**
 * Holds the one stopwatch of the signed-in user for everything below it and
 * shows it in a bar that stays in view. A view that shows the stopwatch large
 * itself hides the bar; the dialogs stay available either way. On a phone
 * the bar is one line (title, time, pause or resume); Soll ändern,
 * erledigen and beenden wait in its menu. Reaching the Soll is announced
 * once on every view, with the bar or without it.
 */
defineProps<{ hideBar?: boolean }>();

useDevicePushRestore();
const controller = createTimerController();
provide(timerKey, controller);
const { timer, elapsed, reached, error, busy, switching } = controller;
const notice = useTargetNotice(controller);
const editingId = ref<string>();
const editing = ref(false);
const completing = ref(false);
const minutes = ref<string | number>("");
const targetError = ref("");
// A dialog about one stopwatch closes when another one takes its place.
watch(
  () => timer.value?.id,
  () => (editing.value = false),
);
const display = computed(() => formatStopwatch(elapsed.value));
function openTarget(): void {
  editingId.value = timer.value?.id;
  minutes.value = timer.value?.targetMinutes ?? "";
  targetError.value = "";
  editing.value = true;
}
async function saveTarget(): Promise<void> {
  const value = Number(minutes.value);
  if (!isValidTimerDuration(value)) {
    targetError.value = TIMER_DURATION_MESSAGE;
    return;
  }
  if (await controller.setTarget(value, editingId.value)) editing.value = false;
}
async function replace(): Promise<void> {
  const choice = switching.value;
  if (choice) await controller.start(choice.target, choice.previousId);
}
async function complete(): Promise<void> {
  const target = timer.value;
  if (!target || completing.value || busy.value) return;
  completing.value = true;
  try {
    if (target.kind === "todo")
      await updateTodoCompletion(target.targetId, true);
    else await updateOccurrenceStatus(target.targetId, "completed");
    notifyDataChanged();
    await controller.refresh();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Erledigung fehlgeschlagen.";
  } finally {
    completing.value = false;
  }
}
/* The phone's menu: the same steps as the round buttons beside the time. */
const moreActions = computed<MenuEntry[]>(() => {
  const current = timer.value;
  if (!current) return [];
  return [
    {
      id: "target",
      label: "Soll ändern",
      icon: "edit",
      disabled: busy.value,
      run: openTarget,
    },
    {
      id: "complete",
      label: "Erledigen",
      icon: "check",
      ariaLabel: `${current.title} erledigen`,
      disabled: busy.value || completing.value,
      run: () => void complete(),
    },
    {
      id: "stop",
      label: "Beenden",
      icon: "stop",
      ariaLabel: "Stoppuhr beenden",
      disabled: busy.value || completing.value,
      run: () => void controller.action("stop"),
    },
  ];
});
let ticker: ReturnType<typeof setInterval>;
let poller: ReturnType<typeof setInterval>;
function refresh(): void {
  if (document.visibilityState !== "hidden") void controller.refresh();
}
onTargetsChanged(refresh);
onMounted(() => {
  void controller.refresh();
  ticker = setInterval(controller.pulse, 250);
  poller = setInterval(refresh, 3000);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
});
onUnmounted(() => {
  controller.dispose();
  clearInterval(ticker);
  clearInterval(poller);
  window.removeEventListener("focus", refresh);
  document.removeEventListener("visibilitychange", refresh);
});
</script>
<template>
  <aside
    v-if="(timer || error) && !hideBar"
    class="timer-bar"
    aria-label="Aktuelle Stoppuhr"
    data-sticky-top
  >
    <div v-if="timer" class="timer-bar__row">
      <div class="timer-bar__text">
        <small>{{
          timer.state === "paused"
            ? "Pausiert"
            : reached
              ? "Soll erreicht"
              : "Stoppuhr läuft"
        }}</small><strong>{{ timer.title }}</strong>
      </div>
      <span class="timer-bar__time">
        <span aria-label="Gearbeitete Zeit">{{ display }}</span>
        <small v-if="timer.targetMinutes !== null" class="timer-bar__target">
          von {{ timer.targetMinutes }} Min.
        </small>
      </span>
      <div class="timer-bar__controls">
        <TimerIconButton
          v-if="timer.state === 'running'"
          icon="pause"
          label="Stoppuhr pausieren"
          :disabled="busy"
          @click="controller.action('pause')"
        />
        <TimerIconButton
          v-if="timer.state === 'paused'"
          icon="play"
          label="Stoppuhr fortsetzen"
          :disabled="busy"
          @click="controller.action('resume')"
        />
        <TimerIconButton
          class="timer-bar__wide"
          icon="edit"
          label="Soll ändern"
          :disabled="busy"
          @click="openTarget"
        />
        <TimerIconButton
          class="timer-bar__wide"
          icon="check"
          :label="`${timer.title} erledigen`"
          :disabled="busy || completing"
          @click="complete"
        />
        <TimerIconButton
          class="timer-bar__wide"
          icon="stop"
          label="Stoppuhr beenden"
          :disabled="busy || completing"
          @click="controller.action('stop')"
        />
        <span class="timer-bar__more">
          <ActionMenu
            :title="timer.title"
            :entries="moreActions"
            label="Weitere Aktionen der Stoppuhr"
          />
        </span>
      </div>
    </div>
    <p v-if="error" role="alert" class="timer-bar__error">
      {{ error }}
      <button type="button" @click="controller.refresh()">
        Erneut synchronisieren
      </button>
    </p>
    <p v-if="timer && reached" class="timer-bar__hint" role="status">
      Soll erreicht. Die Stoppuhr läuft weiter, bis du pausierst oder beendest.
    </p>
  </aside>
  <slot />
  <NoticeToast :message="notice.message.value" @close="notice.dismiss" />
  <ModalDialog
    v-if="switching"
    title="Andere Stoppuhr starten?"
    :busy="busy"
    focus-selector="[data-confirm-switch]"
    @close="switching = null"
  >
    <p>
      Die bisherige Stoppuhr beenden und „{{ switching.target.title }}“ starten?
      Die bisher gearbeitete Zeit bleibt im Logbuch, die Quest bleibt offen.
    </p>
    <div class="timer-dialog-actions">
      <button data-confirm-switch type="button" @click="replace">
        Stoppuhr wechseln</button
      ><button type="button" @click="switching = null">Abbrechen</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </ModalDialog>
  <ModalDialog
    v-if="editing"
    title="Soll ändern"
    :busy="busy"
    focus-selector='[name="timerMinutes"]'
    @close="editing = false"
  >
    <form novalidate @submit.prevent="saveTarget">
      <label for="timer-minutes">Geplante Minuten</label
      ><input
        id="timer-minutes"
        v-model="minutes"
        name="timerMinutes"
        type="number"
        min="1"
        :max="TIMER_MAX_MINUTES"
        step="1"
        :disabled="busy"
      />
      <p>
        Die gearbeitete Zeit bleibt, wie sie ist. Gespeichert
        {{
          timer?.kind === "todo"
            ? "an der Quest"
            : "nur an dieser Daily-Ausführung, nicht am gesamten Daily"
        }}.
      </p>
      <div class="timer-dialog-actions">
        <button type="submit" :disabled="busy">Soll speichern</button
        ><button type="button" :disabled="busy" @click="editing = false">
          Abbrechen
        </button>
      </div>
      <p v-if="targetError || error" role="alert">
        {{ targetError || error }}
      </p>
    </form>
  </ModalDialog>
</template>
<style scoped>
.timer-bar {
  position: sticky;
  top: max(0.5rem, env(safe-area-inset-top));
  z-index: 20;
  width: min(100% - 2rem, var(--page-width));
  margin: 1rem auto 0;
  padding: var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
}
@media (min-width: 56rem) {
  .timer-bar {
    top: calc(3.5rem + 0.5rem);
  }
}
.timer-bar__row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.timer-bar__text {
  display: grid;
  flex: 1;
  min-width: 8rem;
  overflow-wrap: anywhere;
}
.timer-bar__text small {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}
.timer-bar__text strong {
  font-size: 1rem;
}
.timer-bar__time {
  display: grid;
  justify-items: end;
  font-size: 1.75rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  color: var(--color-ink);
}
.timer-bar__target {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
}
.timer-bar__controls {
  display: flex;
  gap: 0.5rem;
}
.timer-bar__error {
  color: var(--color-danger);
  margin: 0.5rem 0 0;
}
.timer-bar__hint {
  color: var(--color-ink-muted);
  margin: 0.75rem 0 0;
  font-size: 0.875rem;
}
.timer-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}
.timer-dialog-actions button,
.timer-bar__error button {
  min-height: var(--tap);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-action-tint);
  color: var(--color-action-strong);
  font-weight: 700;
  padding: 0 var(--space-4);
  font: inherit;
  cursor: pointer;
}
input {
  width: 100%;
  margin-top: 0.5rem;
  min-height: 2.75rem;
  padding: 0 var(--space-3);
  border: 1.5px solid var(--color-line-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
}
.timer-bar__more {
  display: none;
}
/*
 * A phone keeps the bar to one line: state and title (cut with an ellipsis),
 * the time, pause or resume, and the menu with the rarer steps.
 */
@media (max-width: 39.99rem) {
  .timer-bar {
    width: calc(100% - 1rem);
    margin-top: 0.5rem;
    padding: var(--space-2) var(--space-2) var(--space-2) var(--space-4);
  }
  .timer-bar__row {
    flex-wrap: nowrap;
    gap: var(--space-2);
  }
  .timer-bar__text {
    min-width: 0;
    overflow-wrap: normal;
  }
  .timer-bar__text small,
  .timer-bar__text strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .timer-bar__text small {
    font-size: 0.8125rem;
    line-height: 1.3;
  }
  .timer-bar__text strong {
    line-height: 1.3;
  }
  .timer-bar__time {
    font-size: 1.25rem;
  }
  .timer-bar__target {
    font-size: 0.75rem;
  }
  .timer-bar__controls {
    gap: 0;
    margin-left: auto;
  }
  .timer-bar__wide {
    display: none;
  }
  .timer-bar__more {
    display: contents;
  }
  /* Still announced; the state above the title says it in one word. */
  .timer-bar__hint {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
</style>
