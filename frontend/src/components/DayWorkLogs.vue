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
    <h3 class="work-logs__title">
      Tatsächliche Arbeitszeit
      <span v-if="day" class="count">{{ day.totalMinutes }} Min.</span>
    </h3>
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <ul v-if="day?.logs.length" class="work-logs__list">
      <li v-for="log in day.logs" :key="log.id">
        <form
          v-if="editingId === log.id"
          class="work-logs__row"
          @submit.prevent="saveEdit(log.id)"
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
              {{ formatTimeForGermanDisplay(log.startedAt) }}–{{
                formatTimeForGermanDisplay(log.endedAt)
              }}
              · {{ log.minutes }} Min. ·
              {{ log.source === "timer" ? "Timer" : "Nachtrag" }}
            </span>
          </span>
          <button
            type="button"
            class="btn"
            :aria-label="`${log.title} ${formatTimeForGermanDisplay(log.startedAt)} korrigieren`"
            @click="startEditing(log)"
          >
            Korrigieren
          </button>
          <button
            type="button"
            class="btn btn--quiet"
            :disabled="saving"
            :aria-label="`${log.title} ${formatTimeForGermanDisplay(log.startedAt)} löschen`"
            @click="run(() => deleteWorkLog(log.id))"
          >
            Löschen
          </button>
        </div>
      </li>
    </ul>
    <form v-if="targets.length" class="work-logs__add" @submit.prevent="add">
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
  </section>
</template>

<style scoped>
.work-logs {
  display: grid;
  gap: var(--space-3);
}

.work-logs__title {
  display: flex;
  gap: var(--space-3);
  justify-content: space-between;
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

@media (min-width: 40rem) {
  .work-logs__add {
    grid-template-columns: minmax(0, 2fr) 1fr 1fr auto;
  }

  .work-logs__target,
  .work-logs__add .btn {
    grid-column: auto;
  }
}
</style>
