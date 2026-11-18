<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  createWorkLog,
  updateWorkLog,
  type WorkTarget,
} from "../api/work-logs.api";
import { useWrites } from "../composables/useWrites";
import type { HistoryWorkLog } from "../types/history";
import { campaignMark } from "../utils/category-mark";
import {
  formatTimeForGermanDisplay,
  fromLocalInput,
  toLocalInput,
} from "../utils/date";
import { formatDuration, logTimes } from "../utils/logbook";

const props = defineProps<{
  date: string;
  logs: HistoryWorkLog[];
  targets: WorkTarget[];
  /** Loads the day again; the calendar is the only view that shows these. */
  reload: (showPageLoading?: boolean) => Promise<void>;
}>();
/** The stretch being corrected; the time axis opens one by a tap. */
const editingId = defineModel<number | null>("editing", { default: null });
/*
 * Deleting is the calendar's: it holds the delete back behind its undo
 * toast, so this list only says which stretch should go.
 */
const emit = defineEmits<{ remove: [log: HistoryWorkLog] }>();

const error = ref<string | null>(null);
const { write, busy: saving } = useWrites(props.reload, error);
const targetKey = ref("");
const from = ref("");
const to = ref("");
const editFrom = ref("");
const editTo = ref("");
const list = ref<HTMLElement | null>(null);

const canAdd = computed(() => targetKey.value && from.value && to.value);
const keyOf = (target: WorkTarget): string =>
  `${target.kind}-${target.targetId}`;

/** Berlin wall times on given days; a stretch keeps the days it covers. */
function times(
  start: string,
  end: string,
  startDate = props.date,
  endDate = props.date,
) {
  const startedAt = fromLocalInput(`${startDate}T${start}`);
  const endedAt = fromLocalInput(`${endDate}T${end}`);
  if (!startedAt || !endedAt) throw new Error("Bitte gültige Zeiten angeben.");
  return { startedAt, endedAt };
}

const run = (action: () => Promise<unknown>): Promise<boolean> =>
  write(action, {
    fallbackError: "Die Arbeitszeit konnte nicht gespeichert werden.",
    notify: null,
  });

async function add(): Promise<void> {
  const target = props.targets.find((item) => keyOf(item) === targetKey.value);
  if (!target) return;
  const added = await run(() =>
    createWorkLog(
      { kind: target.kind, targetId: target.targetId },
      times(from.value, to.value),
    ),
  );
  if (added) from.value = to.value = "";
}

const editing = computed(() =>
  props.logs.find((log) => log.id === editingId.value),
);

watch(editingId, async (id) => {
  const log = editing.value;
  if (id === null) return;
  if (!log) {
    editingId.value = null;
    return;
  }
  editFrom.value = toLocalInput(log.startedAt).slice(11);
  editTo.value = toLocalInput(log.endedAt).slice(11);
  await nextTick();
  list.value
    ?.querySelector<HTMLInputElement>(`[data-log="${id}"] input`)
    ?.focus();
});

/** The row goes at once; the focus moves to its neighbour, not to nowhere. */
async function remove(log: HistoryWorkLog): Promise<void> {
  const index = props.logs.findIndex((item) => item.id === log.id);
  const neighbour = props.logs[index + 1] ?? props.logs[index - 1];
  emit("remove", log);
  await nextTick();
  const target = neighbour
    ? list.value?.querySelector<HTMLElement>(
        `[data-log="${neighbour.id}"] button`,
      )
    : null;
  (target ?? document.querySelector<HTMLElement>("#day-axis-title"))?.focus();
}

async function saveEdit(log: HistoryWorkLog): Promise<void> {
  const saved = await run(() =>
    updateWorkLog(
      log.id,
      times(
        editFrom.value,
        editTo.value,
        toLocalInput(log.startedAt).slice(0, 10),
        toLocalInput(log.endedAt).slice(0, 10),
      ),
    ),
  );
  if (saved) editingId.value = null;
}

watch(
  () => props.date,
  () => {
    editingId.value = null;
    error.value = null;
  },
);
</script>

<template>
  <div class="work-logs">
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <ul
      v-if="logs.length"
      ref="list"
      class="work-logs__list"
      aria-label="Einträge im Logbuch"
    >
      <li v-for="log in logs" :key="log.id" :data-log="log.id">
        <form
          v-if="editingId === log.id"
          class="work-logs__row"
          @submit.prevent="saveEdit(log)"
        >
          <input
            v-model="editFrom"
            class="input work-logs__time"
            type="time"
            aria-label="Start"
          />
          <input
            v-model="editTo"
            class="input work-logs__time"
            type="time"
            aria-label="Ende"
          />
          <button type="submit" class="btn btn--primary" :disabled="saving">
            Speichern
          </button>
          <button
            type="button"
            class="btn btn--quiet"
            @click="editingId = null"
          >
            Abbrechen
          </button>
        </form>
        <div v-else class="work-logs__row">
          <span class="work-logs__grow">
            <strong>{{ log.title }}</strong>
            <span class="work-logs__meta">
              {{ logTimes(log) }} · {{ formatDuration(log.minutes) }} ·
              {{ log.source === "timer" ? "Stoppuhr" : "Nachtrag" }}
              <template v-if="log.campaign">
                ·
                <span class="work-logs__campaign"
                  ><i
                    class="work-logs__mark"
                    :style="{ background: campaignMark(log.campaign) ?? '' }"
                    aria-hidden="true"
                  />{{ log.campaign.title }}</span
                >
              </template>
            </span>
          </span>
          <button
            type="button"
            class="btn"
            :aria-label="`${log.title} ${formatTimeForGermanDisplay(log.startedAt)} korrigieren`"
            @click="editingId = log.id"
          >
            Korrigieren
          </button>
          <button
            type="button"
            class="btn btn--quiet"
            :disabled="saving"
            :aria-label="`${log.title} ${formatTimeForGermanDisplay(log.startedAt)} löschen`"
            @click="remove(log)"
          >
            Löschen
          </button>
        </div>
      </li>
    </ul>
    <form v-if="targets.length" class="work-logs__add" @submit.prevent="add">
      <h3 class="work-logs__title">Zeit nachtragen</h3>
      <label class="field work-logs__target">
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
        Von
        <input v-model="from" name="from" type="time" />
      </label>
      <label class="field">
        Bis
        <input v-model="to" name="to" type="time" />
      </label>
      <button type="submit" class="btn" :disabled="saving || !canAdd">
        Nachtragen
      </button>
    </form>
  </div>
</template>

<style scoped>
.work-logs {
  display: grid;
  gap: var(--space-4);
  container-type: inline-size;
}

.work-logs__title {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 1rem;
  font-weight: 800;
}

.work-logs__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.work-logs__list li + li {
  border-top: 1px solid var(--color-line);
}

.work-logs__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2) 0;
}

.work-logs__grow {
  display: grid;
  flex: 1 1 12rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.work-logs__meta {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.work-logs__campaign {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  font-weight: 700;
}

.work-logs__mark {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

/* In a narrow column the text takes the line and both actions sit below it. */
@container (max-width: 30rem) {
  .work-logs__grow {
    flex-basis: 100%;
  }
}

.work-logs__time {
  flex: 1 1 6rem;
  width: auto;
}

.work-logs__add {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  align-items: end;
}

.work-logs__target {
  grid-column: 1 / -1;
}

.work-logs__add .btn {
  grid-column: 1 / -1;
  justify-self: start;
}
</style>
