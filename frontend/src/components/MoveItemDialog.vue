<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { rescheduleOccurrence, rescheduleTodo } from "../api/day-planner.api";
import { addDays, formatDateForGermanDisplay, weekStart } from "../utils/date";
import ModalDialog from "./ModalDialog.vue";

/** What moving needs to know; planner and calendar items both provide it. */
export type MoveTarget =
  | { type: "todo"; todoId: number; title: string; isFixed: boolean }
  | {
      type: "habit";
      occurrenceId: number;
      title: string;
      moveUntil: string | null;
    };

const props = defineProps<{
  item: MoveTarget;
  today: string;
  returnFocus: () => HTMLElement | null;
}>();
const emit = defineEmits<{ close: []; moved: []; busy: [value: boolean] }>();

const busy = ref(false);
const errorMessage = ref<string | null>(null);
const chosenDate = ref("");
const confirmFixed = ref(false);
watch(busy, (value) => emit("busy", value));

const lastDate = computed(() =>
  props.item.type === "habit" ? props.item.moveUntil : null,
);
const isFixed = computed(
  () => props.item.type === "todo" && props.item.isFixed,
);
const blockedByFixed = computed(() => isFixed.value && !confirmFixed.value);

function allowed(date: string): boolean {
  return (
    date >= props.today && (lastDate.value === null || date <= lastDate.value)
  );
}

const shortcuts = computed(() =>
  [
    { label: "Morgen", date: addDays(props.today, 1) },
    { label: "Nächster Montag", date: addDays(weekStart(props.today), 7) },
  ].filter((shortcut) => allowed(shortcut.date)),
);

async function move(date: string): Promise<void> {
  if (busy.value || blockedByFixed.value || !allowed(date)) return;
  busy.value = true;
  errorMessage.value = null;
  try {
    if (props.item.type === "todo") {
      await rescheduleTodo(props.item.todoId, date, confirmFixed.value);
    } else {
      await rescheduleOccurrence(props.item.occurrenceId, date);
    }
    emit("moved");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Der Eintrag konnte nicht verschoben werden.";
  } finally {
    busy.value = false;
  }
}

function close(): void {
  if (!busy.value) emit("close");
}
</script>

<template>
  <ModalDialog
    title="Verschieben"
    :busy="busy"
    :return-focus="returnFocus"
    focus-selector='[data-test="move-date"]'
    @close="close"
  >
    <form class="move-dialog" @submit.prevent="move(chosenDate)">
      <p class="move-dialog__title">{{ item.title }}</p>
      <p v-if="lastDate" class="move-dialog__hint">
        Möglich bis {{ formatDateForGermanDisplay(lastDate) }}.
      </p>

      <label v-if="isFixed" class="move-dialog__confirm">
        <input v-model="confirmFixed" type="checkbox" data-test="move-confirm" />
        Festen Termin wirklich verschieben
      </label>

      <div v-if="shortcuts.length" class="move-dialog__shortcuts">
        <button
          v-for="shortcut in shortcuts"
          :key="shortcut.label"
          type="button"
          :disabled="busy || blockedByFixed"
          @click="move(shortcut.date)"
        >
          {{ shortcut.label }}
        </button>
      </div>

      <label class="move-dialog__date">
        Tag wählen
        <input
          v-model="chosenDate"
          data-test="move-date"
          type="date"
          :min="today"
          :max="lastDate ?? undefined"
        />
      </label>

      <p v-if="errorMessage" class="move-dialog__error" role="alert">
        {{ errorMessage }}
      </p>

      <div class="move-dialog__actions">
        <button type="button" :disabled="busy" @click="close">Abbrechen</button>
        <button
          type="submit"
          :disabled="busy || blockedByFixed || !allowed(chosenDate)"
        >
          Verschieben
        </button>
      </div>
    </form>
  </ModalDialog>
</template>

<style scoped>
.move-dialog {
  display: grid;
  gap: 0.875rem;
}

.move-dialog p {
  margin: 0;
}

.move-dialog__title {
  color: #182033;
  font-weight: 600;
}

.move-dialog__hint {
  color: #697386;
  font-size: 0.875rem;
}

.move-dialog__confirm {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.move-dialog__shortcuts,
.move-dialog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.move-dialog__actions {
  justify-content: flex-end;
}

.move-dialog__date {
  display: grid;
  gap: 0.25rem;
}

.move-dialog button {
  min-height: 2.75rem;
  padding: 0 0.875rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
  cursor: pointer;
}

.move-dialog button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.move-dialog input[type="date"] {
  min-height: 2.75rem;
  padding: 0 0.625rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  font: inherit;
}

.move-dialog__error {
  color: #b42318;
}
</style>
