<script setup lang="ts">
import { computed, ref, watch } from "vue";
import {
  createWorkLog,
  deleteWorkLog,
  getWorkDay,
  updateWorkLog,
  type WorkDay,
  type WorkLog,
  type WorkTarget,
} from "../api/work-logs.api";
import { notifyViewsChanged } from "../composables/data-sync";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import {
  formatTimeForGermanDisplay,
  fromLocalInput,
  toLocalInput,
} from "../utils/date";

const props = defineProps<{ date: string; targets: WorkTarget[] }>();

const saveError = ref<string | null>(null);
const {
  data: day,
  errorMessage: loadError,
  reload,
} = useLoader<WorkDay | null>(() => getWorkDay(props.date), {
  initial: null,
  fallbackError: "Die Arbeitszeit konnte nicht geladen werden.",
  params: [() => props.date],
  resetOnLoad: true,
  refreshOnChange: () => !saving.value,
});
const { write, busy: saving } = useWrites(reload, saveError);
const error = computed(() => saveError.value || loadError.value);
const targetKey = ref("");
const from = ref("");
const to = ref("");
const editingId = ref<number | null>(null);
const editFrom = ref("");
const editTo = ref("");

const canAdd = computed(() => targetKey.value && from.value && to.value);
const keyOf = (target: WorkTarget): string =>
  `${target.kind}-${target.targetId}`;

function times(start: string, end: string) {
  const startedAt = fromLocalInput(`${props.date}T${start}`);
  const endedAt = fromLocalInput(`${props.date}T${end}`);
  if (!startedAt || !endedAt) throw new Error("Bitte gültige Zeiten angeben.");
  return { startedAt, endedAt };
}

const run = (action: () => Promise<unknown>): Promise<boolean> =>
  write(action, {
    fallbackError: "Die Arbeitszeit konnte nicht gespeichert werden.",
    notify: notifyViewsChanged,
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

function startEditing(log: WorkLog): void {
  editingId.value = log.id;
  editFrom.value = toLocalInput(log.startedAt).slice(11);
  editTo.value = toLocalInput(log.endedAt).slice(11);
}

async function saveEdit(id: number): Promise<void> {
  if (await run(() => updateWorkLog(id, times(editFrom.value, editTo.value))))
    editingId.value = null;
}

watch(
  () => props.date,
  () => {
    editingId.value = null;
    saveError.value = null;
  },
);
</script>

<template>
  <section class="work-logs" aria-label="Arbeitszeit">
    <h3>
      Tatsächliche Arbeitszeit
      <span v-if="day">{{ day.totalMinutes }} Min.</span>
    </h3>
    <p v-if="error" class="work-logs__error" role="alert">{{ error }}</p>
    <ul v-if="day?.logs.length">
      <li v-for="log in day.logs" :key="log.id">
        <form
          v-if="editingId === log.id"
          class="work-logs__row"
          @submit.prevent="saveEdit(log.id)"
        >
          <input v-model="editFrom" type="time" aria-label="Start" />
          <input v-model="editTo" type="time" aria-label="Ende" />
          <button type="submit" :disabled="saving">Speichern</button>
          <button type="button" @click="editingId = null">Abbrechen</button>
        </form>
        <div v-else class="work-logs__row">
          <span class="work-logs__grow">
            {{ log.title }} ·
            {{ formatTimeForGermanDisplay(log.startedAt) }}–{{
              formatTimeForGermanDisplay(log.endedAt)
            }}
            · {{ log.minutes }} Min.
            <small>{{ log.source === "timer" ? "Timer" : "Nachtrag" }}</small>
          </span>
          <button type="button" @click="startEditing(log)">Korrigieren</button>
          <button
            type="button"
            :disabled="saving"
            @click="run(() => deleteWorkLog(log.id))"
          >
            Löschen
          </button>
        </div>
      </li>
    </ul>
    <form
      v-if="targets.length"
      class="work-logs__row"
      @submit.prevent="add"
    >
      <select v-model="targetKey" name="target" aria-label="Eintrag">
        <option value="">Eintrag wählen</option>
        <option
          v-for="target in targets"
          :key="keyOf(target)"
          :value="keyOf(target)"
        >
          {{ target.title }}
        </option>
      </select>
      <input v-model="from" name="from" type="time" aria-label="Start" />
      <input v-model="to" name="to" type="time" aria-label="Ende" />
      <button type="submit" :disabled="saving || !canAdd">Nachtragen</button>
    </form>
  </section>
</template>

<style scoped>
.work-logs {
  display: grid;
  gap: 0.5rem;
  margin: 1rem 0;
}

.work-logs h3 {
  display: flex;
  justify-content: space-between;
  margin: 0;
  font-size: 1rem;
}

.work-logs ul {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.work-logs__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.work-logs__grow {
  flex: 1 1 12rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.work-logs small {
  color: #697386;
}

.work-logs input,
.work-logs select,
.work-logs button {
  min-height: 2.75rem;
  padding: 0 0.625rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
}

.work-logs select {
  flex: 1 1 10rem;
  min-width: 0;
}

.work-logs button {
  cursor: pointer;
}

.work-logs__error {
  margin: 0;
  color: #b42318;
}
</style>
