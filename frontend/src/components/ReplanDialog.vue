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

defineProps<{ returnFocus: () => HTMLElement | null }>();
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
          Der Tag passt. Es gibt nichts zu verschieben.
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
      </template>
      <div class="replan__actions">
        <button type="button" :disabled="busy" @click="close">Abbrechen</button>
        <button
          type="button"
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
  padding: 0.625rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  overflow-wrap: anywhere;
}

.replan input,
.replan button {
  min-height: 2.75rem;
  padding: 0 0.625rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
}

.replan button {
  cursor: pointer;
}

.replan__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

.replan__error {
  color: #b42318;
}
</style>
