<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import {
  applyReplan,
  getReplan,
  setDayEnd,
  type ReplanPreview,
} from "../api/replan.api";
import { formatTimeForGermanDisplay } from "../utils/date";
import ModalDialog from "./ModalDialog.vue";

defineProps<{
  returnFocus: () => HTMLElement | null;
  /** Open items from earlier days; replanning only covers today. */
  carriedOver?: number;
}>();
const emit = defineEmits<{ close: []; applied: []; busy: [value: boolean] }>();

const preview = ref<ReplanPreview | null>(null);
const dayEnd = ref("");
const busy = ref(true);
const error = ref("");
watch(busy, (value) => emit("busy", value), { immediate: true });

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true;
  error.value = "";
  try {
    await action();
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Die Neuplanung ist fehlgeschlagen.";
  } finally {
    busy.value = false;
  }
}

const load = () =>
  run(async () => {
    preview.value = await getReplan();
    dayEnd.value = preview.value.dayEnd;
  });

const changeDayEnd = () =>
  run(async () => {
    await setDayEnd(dayEnd.value);
    preview.value = await getReplan();
  });

const apply = () =>
  run(async () => {
    await applyReplan(preview.value!.confirmationToken);
    emit("applied");
  });

function close(): void {
  if (!busy.value) emit("close");
}

onMounted(load);
</script>

<template>
  <ModalDialog
    title="Neu planen"
    :busy="busy"
    :return-focus="returnFocus"
    focus-selector='[data-test="day-end"]'
    @close="close"
  >
    <div class="replan">
      <label>
        Tagesende
        <input
          v-model="dayEnd"
          data-test="day-end"
          type="time"
          :disabled="busy"
          @change="changeDayEnd"
        />
      </label>
      <p v-if="error" class="replan__error" role="alert">{{ error }}</p>
      <template v-if="preview">
        <p v-if="!preview.changes.length" role="status">
          Der Rest von heute passt in die verbleibende Zeit.
        </p>
        <ul v-else>
          <li v-for="change in preview.changes" :key="change.todoId">
            <strong>{{ change.title }}</strong>
            <small>bisher {{ formatTimeForGermanDisplay(change.from) }}</small>
            <span v-for="piece in change.pieces" :key="piece.start">
              {{ formatTimeForGermanDisplay(piece.start) }} ·
              {{ piece.minutes }} Min.
            </span>
            <span v-if="change.tomorrow">
              Morgen {{ formatTimeForGermanDisplay(change.tomorrow.start) }} ·
              {{ change.tomorrow.minutes }} Min.
            </span>
          </li>
        </ul>
        <p v-if="carriedOver" class="replan__note">
          {{
            carriedOver === 1
              ? "1 Eintrag von früher ist nicht enthalten."
              : `${carriedOver} Einträge von früher sind nicht enthalten.`
          }}
          Du findest sie unter Nachholen.
        </p>
      </template>
      <div class="replan__actions">
        <button type="button" :disabled="busy" @click="close">Abbrechen</button>
        <button
          type="button"
          data-primary
          :disabled="busy || !preview?.changes.length"
          @click="apply"
        >
          Übernehmen
        </button>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.replan {
  display: grid;
  gap: 0.75rem;
}

.replan label {
  display: grid;
  gap: 0.25rem;
}

.replan p {
  margin: 0;
}

.replan ul {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.replan li {
  display: grid;
  gap: 0.125rem;
  padding: var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-action-tint);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.replan__note {
  color: var(--color-ink-muted);
}

.replan__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.replan__error {
  color: var(--color-danger);
}
</style>
