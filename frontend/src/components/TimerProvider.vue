<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, watch } from "vue";
import {
  createTimerController,
  timerKey,
  notifyTargetChange,
} from "../composables/useTimer";
import {
  updateTodoCompletion,
  updateOccurrenceStatus,
} from "../api/day-planner.api";
import TimerIconButton from "./TimerIconButton.vue";
import ModalDialog from "./ModalDialog.vue";
const controller = createTimerController();
provide(timerKey, controller);
const { timer, remaining, error, busy, switching } = controller;
const stopping = ref(false);
const stoppingId = ref<string>();
const editingId = ref<string>();
const editing = ref(false);
const completing = ref(false);
const minutes = ref<string | number>("");
const durationError = ref("");
watch(
  () => [timer.value?.id, timer.value?.state],
  (current, previous) => {
    if (previous && current[0] !== previous[0]) {
      stopping.value = false;
      editing.value = false;
    }
    if (!timer.value) {
      stopping.value = false;
      editing.value = false;
    }
    if (timer.value?.state !== "paused") editing.value = false;
  },
);
const display = computed(() => {
  const seconds = Math.ceil(remaining.value / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
});
function openStop(): void {
  stoppingId.value = timer.value?.id;
  stopping.value = true;
}
function openDuration(): void {
  editingId.value = timer.value?.id;
  minutes.value = timer.value?.durationMinutes ?? "";
  durationError.value = "";
  editing.value = true;
}
async function saveDuration(): Promise<void> {
  const value = Number(minutes.value);
  if (!Number.isInteger(value) || value < 1 || value > 10080) {
    durationError.value = "Bitte wähle 1 bis 10080 ganze Minuten.";
    return;
  }
  if (await controller.duration(value, editingId.value)) editing.value = false;
}
async function stop(): Promise<void> {
  if (await controller.action("stop", stoppingId.value)) stopping.value = false;
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
    notifyTargetChange();
    await controller.refresh();
  } catch (cause) {
    error.value =
      cause instanceof Error ? cause.message : "Erledigung fehlgeschlagen.";
  } finally {
    completing.value = false;
  }
}
let ticker: ReturnType<typeof setInterval>;
let poller: ReturnType<typeof setInterval>;
function refresh(): void {
  if (document.visibilityState !== "hidden") void controller.refresh();
}
onMounted(() => {
  void controller.refresh();
  ticker = setInterval(controller.pulse, 250);
  poller = setInterval(refresh, 3000);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("timer-target-changed", refresh);
});
onUnmounted(() => {
  controller.dispose();
  clearInterval(ticker);
  clearInterval(poller);
  window.removeEventListener("focus", refresh);
  document.removeEventListener("visibilitychange", refresh);
  window.removeEventListener("timer-target-changed", refresh);
});
</script>
<template>
  <aside v-if="timer || error" class="timer-bar" aria-label="Aktueller Timer">
    <div v-if="timer" class="timer-bar__row">
      <div class="timer-bar__text">
        <small>{{
          timer.state === "paused"
            ? "Pausiert"
            : timer.state === "finished" || remaining === 0
              ? "Zeit abgelaufen"
              : "Timer läuft"
        }}</small
        ><strong>{{ timer.title }}</strong>
      </div>
      <span class="timer-bar__time" aria-label="Verbleibende Zeit">{{
        display
      }}</span>
      <div class="timer-bar__controls">
        <TimerIconButton
          v-if="timer.state === 'running'"
          icon="pause"
          label="Timer pausieren"
          :disabled="busy || remaining === 0"
          @click="controller.action('pause')"
        />
        <TimerIconButton
          v-if="timer.state === 'paused'"
          icon="play"
          label="Timer fortsetzen"
          :disabled="busy"
          @click="controller.action('resume')"
        />
        <TimerIconButton
          v-if="timer.state === 'paused'"
          icon="edit"
          label="Timerdauer ändern"
          :disabled="busy"
          @click="openDuration"
        />
        <TimerIconButton
          v-if="timer.state === 'finished'"
          icon="check"
          :label="`${timer.title} erledigen`"
          :disabled="busy || completing"
          @click="complete"
        />
        <TimerIconButton
          icon="stop"
          :label="
            timer.state === 'finished' ? 'Timer schließen' : 'Timer stoppen'
          "
          :disabled="busy || completing"
          @click="
            timer.state === 'finished' ? controller.action('stop') : openStop()
          "
        />
      </div>
    </div>
    <p v-if="error" role="alert" class="timer-bar__error">
      {{ error }}
      <button type="button" @click="controller.refresh()">
        Erneut synchronisieren
      </button>
    </p>
    <p v-if="timer?.state === 'finished'" class="timer-bar__hint" role="status">
      Zeit abgelaufen. Noch nicht als erledigt markiert.
    </p>
  </aside>
  <slot />
  <ModalDialog
    v-if="stopping"
    title="Timer stoppen?"
    :busy="busy"
    focus-selector="[data-confirm-stop]"
    @close="stopping = false"
  >
    <p>
      Der Timer wird beendet. Die gespeicherte Dauer bleibt erhalten; die
      Aufgabe bleibt offen.
    </p>
    <div class="timer-dialog-actions">
      <button data-confirm-stop type="button" @click="stop">
        Timer stoppen</button
      ><button type="button" @click="stopping = false">Abbrechen</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </ModalDialog>
  <ModalDialog
    v-if="switching"
    title="Anderen Timer starten?"
    :busy="busy"
    focus-selector="[data-confirm-switch]"
    @close="switching = null"
  >
    <p>
      Den bisherigen Timer beenden und „{{ switching.target.title }}“ starten?
      Die bisherige Aufgabe bleibt offen.
    </p>
    <div class="timer-dialog-actions">
      <button data-confirm-switch type="button" @click="replace">
        Timer wechseln</button
      ><button type="button" @click="switching = null">Abbrechen</button>
    </div>
    <p v-if="error" role="alert">{{ error }}</p>
  </ModalDialog>
  <ModalDialog
    v-if="editing"
    title="Timerdauer ändern"
    :busy="busy"
    focus-selector='[name="timerMinutes"]'
    @close="editing = false"
  >
    <form novalidate @submit.prevent="saveDuration">
      <label for="timer-minutes">Gesamtdauer in Minuten</label
      ><input
        id="timer-minutes"
        v-model="minutes"
        name="timerMinutes"
        type="number"
        min="1"
        max="10080"
        step="1"
        :disabled="busy"
      />
      <p>
        Bereits gelaufene Zeit bleibt angerechnet. Gespeichert
        {{
          timer?.kind === "todo"
            ? "am Todo"
            : "nur an dieser Habit-Ausführung, nicht am gesamten Habit"
        }}.
      </p>
      <div class="timer-dialog-actions">
        <button type="submit" :disabled="busy">Dauer speichern</button
        ><button type="button" :disabled="busy" @click="editing = false">
          Abbrechen
        </button>
      </div>
      <p v-if="durationError || error" role="alert">
        {{ durationError || error }}
      </p>
    </form>
  </ModalDialog>
</template>
<style scoped>
.timer-bar {
  position: sticky;
  top: max(0.5rem, env(safe-area-inset-top));
  z-index: 20;
  width: min(100% - 2rem, 46rem);
  margin: 1rem auto 0;
  padding: 1rem;
  border: 1px solid #bacbed;
  border-radius: 0.875rem;
  background: #fff;
  box-shadow: 0 4px 16px #172c5014;
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
  color: #59657a;
  font-size: 0.875rem;
}
.timer-bar__text strong {
  font-size: 1rem;
}
.timer-bar__time {
  font-size: 1.75rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  color: #2457c5;
}
.timer-bar__controls {
  display: flex;
  gap: 0.5rem;
}
.timer-bar__error {
  color: #b42318;
  margin: 0.5rem 0 0;
}
.timer-bar__hint {
  color: #59657a;
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
  min-height: 2.75rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #fff;
  color: #2457c5;
  padding: 0.65rem 0.9rem;
  font: inherit;
  cursor: pointer;
}
input {
  width: 100%;
  margin-top: 0.5rem;
  min-height: 2.75rem;
  padding: 0.7rem;
  border: 1px solid #bfc7d4;
  border-radius: 0.5rem;
  font: inherit;
}
@media (max-width: 32rem) {
  .timer-bar {
    width: calc(100% - 1rem);
    padding: 0.75rem;
  }
  .timer-bar__controls {
    margin-left: auto;
  }
}
</style>
