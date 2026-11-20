<script setup lang="ts">
import { computed, ref } from "vue";
import ModalDialog from "./ModalDialog.vue";
import {
  createWorkLog,
  updateWorkLog,
  type WorkTarget,
} from "../api/work-logs.api";
import { notifyViewsChanged } from "../composables/data-sync";
import { useWrites } from "../composables/useWrites";
import type { HistoryWorkLog } from "../types/history";
import { fromLocalInput, toLocalInput } from "../utils/date";
import { formatDuration, logTimes } from "../utils/logbook";

/**
 * One stretch of the Logbuch in a dialog: "Abschnitt korrigieren" (start,
 * end, delete) for a block of the day calendar, or "Zeit nachtragen" (entry,
 * from, until) for a new one. The keyboard's way to everything a block's
 * drag does. Deleting is the host's: it holds the delete back behind its
 * undo toast, so this dialog only says which stretch should go.
 */
const props = defineProps<{
  /** The day the times are on. */
  date: string;
  /** Loads the day again after a save. */
  reload: (showPageLoading?: boolean) => Promise<void>;
  /** The stretch to correct; without it the dialog adds one. */
  log?: HistoryWorkLog | null;
  /** What a new stretch can be booked on. */
  targets?: WorkTarget[];
  /** "HH:mm" a new stretch starts with, e.g. where the column was clicked. */
  from?: string;
  to?: string;
  returnFocus?: () => HTMLElement | null;
}>();
const emit = defineEmits<{ close: []; remove: [log: HistoryWorkLog] }>();

const error = ref<string | null>(null);
const { write, busy } = useWrites(props.reload, error);

const keyOf = (target: WorkTarget): string =>
  `${target.kind}-${target.targetId}`;
const targetKey = ref(
  props.targets?.length === 1 ? keyOf(props.targets[0]!) : "",
);
const start = ref(
  props.log ? toLocalInput(props.log.startedAt).slice(11) : (props.from ?? ""),
);
const end = ref(
  props.log ? toLocalInput(props.log.endedAt).slice(11) : (props.to ?? ""),
);

const canSave = computed(
  () => !!start.value && !!end.value && (!!props.log || !!targetKey.value),
);

/** Berlin wall times on given days; a stretch keeps the days it covers. */
function times(startDate: string, endDate: string) {
  const startedAt = fromLocalInput(`${startDate}T${start.value}`);
  const endedAt = fromLocalInput(`${endDate}T${end.value}`);
  if (!startedAt || !endedAt) throw new Error("Bitte gültige Zeiten angeben.");
  return { startedAt, endedAt };
}

async function save(): Promise<void> {
  const log = props.log;
  const target = props.targets?.find((item) => keyOf(item) === targetKey.value);
  if (!log && !target) return;
  const saved = await write(
    () =>
      log
        ? updateWorkLog(
            log.id,
            times(
              toLocalInput(log.startedAt).slice(0, 10),
              toLocalInput(log.endedAt).slice(0, 10),
            ),
          )
        : createWorkLog(
            { kind: target!.kind, targetId: target!.targetId },
            times(props.date, props.date),
          ),
    {
      fallbackError: "Die Arbeitszeit konnte nicht gespeichert werden.",
      // Heute names the worked time too; the calendar reloads itself.
      notify: notifyViewsChanged,
    },
  );
  if (saved) emit("close");
}

function remove(): void {
  if (!props.log) return;
  emit("remove", props.log);
  emit("close");
}
</script>

<template>
  <ModalDialog
    :title="log ? 'Abschnitt korrigieren' : 'Zeit nachtragen'"
    :busy="busy"
    :focus-selector="log ? 'input[name=start]' : 'select[name=target]'"
    :return-focus="returnFocus"
    @close="emit('close')"
  >
    <form class="work-log-dialog" @submit.prevent="save">
      <p v-if="log" class="work-log-dialog__lead">
        <strong>{{ log.title }}</strong>
        <span>
          {{ logTimes(log) }} · {{ formatDuration(log.minutes) }} ·
          {{ log.source === "timer" ? "Stoppuhr" : "Nachtrag" }}
        </span>
      </p>
      <label v-else class="field work-log-dialog__wide">
        Eintrag
        <select v-model="targetKey" name="target">
          <option value="">Eintrag wählen</option>
          <option
            v-for="target in targets"
            :key="keyOf(target)"
            :value="keyOf(target)"
          >
            {{ target.title }}
          </option>
        </select>
      </label>
      <label class="field">
        {{ log ? "Start" : "Von" }}
        <input v-model="start" :name="log ? 'start' : 'from'" type="time" />
      </label>
      <label class="field">
        {{ log ? "Ende" : "Bis" }}
        <input v-model="end" :name="log ? 'end' : 'to'" type="time" />
      </label>
      <p v-if="error" class="form-error work-log-dialog__wide" role="alert">
        {{ error }}
      </p>
      <div class="work-log-dialog__actions">
        <button type="submit" :disabled="busy || !canSave">
          {{ log ? "Speichern" : "Nachtragen" }}
        </button>
        <button v-if="log" type="button" @click="remove">Löschen</button>
        <button type="button" @click="emit('close')">Abbrechen</button>
      </div>
    </form>
  </ModalDialog>
</template>

<style scoped>
.work-log-dialog {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  align-items: end;
}

.work-log-dialog__lead,
.work-log-dialog__wide,
.work-log-dialog__actions {
  grid-column: 1 / -1;
}

.work-log-dialog__lead {
  display: grid;
  margin: 0;
  overflow-wrap: anywhere;
}

.work-log-dialog__lead span {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.work-log-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
</style>
