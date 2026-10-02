<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  deleteHabit,
  deleteTodo,
  getHabit,
  getTodo,
  updateHabit,
  updateTodo,
} from "../api/day-planner.api";
import type { MissedOccurrencePolicy } from "../types/habit";
import type { CreateTodoInput } from "../types/todo";

const props = defineProps<{
  kind: "todo" | "habit";
  entityId: number;
}>();

const emit = defineEmits<{
  changed: [];
  close: [];
  busy: [value: boolean];
}>();

const isLoading = ref(true);
const isSaving = ref(false);
const hasLoaded = ref(false);
const errorMessage = ref<string | null>(null);
const confirmDeletion = ref(false);

const title = ref("");
const scheduledAt = ref("");
const duration = ref<string | number>("");
const isFixed = ref(false);

const isActive = ref(true);
const missedPolicy = ref<MissedOccurrencePolicy>("carry_over");

const originalScheduledAt = ref<string | null>(null);
const originalLocalInput = ref("");

const isBusy = computed(() => {
  return isLoading.value || isSaving.value;
});

function toLocalInput(isoDateTime: string): string {
  const date = new Date(isoDateTime);

  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-` +
    `${pad(date.getMonth() + 1)}-` +
    `${pad(date.getDate())}T` +
    `${pad(date.getHours())}:` +
    `${pad(date.getMinutes())}`
  );
}

async function loadEntity(): Promise<void> {
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      const todo = await getTodo(props.entityId);

      title.value = todo.title;
      duration.value = todo.plannedDurationMinutes ?? "";
      isFixed.value = todo.isFixed;

      originalScheduledAt.value = todo.scheduledAt;

      scheduledAt.value = todo.scheduledAt
        ? toLocalInput(todo.scheduledAt)
        : "";

      originalLocalInput.value = scheduledAt.value;
    } else {
      const habit = await getHabit(props.entityId);

      title.value = habit.title;
      isActive.value = habit.isActive;
      missedPolicy.value = habit.missedOccurrencePolicy;
    }

    hasLoaded.value = true;
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Der Eintrag konnte nicht geladen werden.";
  } finally {
    isLoading.value = false;
    emit("busy", false);
  }
}

function validatedTitle(): string {
  const value = title.value.trim();

  if (!value || value.length > 200) {
    throw new Error("Der Titel muss 1 bis 200 Zeichen enthalten.");
  }

  return value;
}

function buildTodoInput(): CreateTodoInput {
  let isoDate: string | null = null;

  if (scheduledAt.value === originalLocalInput.value) {
    isoDate = originalScheduledAt.value;
  } else if (scheduledAt.value) {
    const date = new Date(scheduledAt.value);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Ungültiger Zeitpunkt.");
    }

    isoDate = date.toISOString();
  }

  if (isFixed.value && isoDate === null) {
    throw new Error("Ein fester Termin benötigt einen Zeitpunkt.");
  }

  let minutes: number | null = null;

  const empty =
    typeof duration.value === "string" && duration.value.trim() === "";

  if (!empty) {
    minutes = Number(duration.value);

    if (!Number.isInteger(minutes) || minutes < 1) {
      throw new Error("Die Dauer muss eine ganze Zahl ab 1 Minute sein.");
    }
  }

  return {
    title: validatedTitle(),
    scheduledAt: isoDate,
    plannedDurationMinutes: minutes,
    isFixed: isFixed.value,
  };
}

async function save(): Promise<void> {
  if (isBusy.value || !hasLoaded.value) {
    return;
  }

  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      await updateTodo(props.entityId, buildTodoInput());
    } else {
      await updateHabit(props.entityId, {
        title: validatedTitle(),
        isActive: isActive.value,
        missedOccurrencePolicy: missedPolicy.value,
      });
    }

    emit("changed");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Speichern fehlgeschlagen.";
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

async function remove(): Promise<void> {
  if (isBusy.value || !hasLoaded.value || !confirmDeletion.value) {
    return;
  }

  errorMessage.value = null;
  isSaving.value = true;
  emit("busy", true);

  try {
    if (props.kind === "todo") {
      await deleteTodo(props.entityId);
    } else {
      await deleteHabit(props.entityId);
    }

    emit("changed");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error ? error.message : "Löschen fehlgeschlagen.";
  } finally {
    isSaving.value = false;
    emit("busy", false);
  }
}

onMounted(loadEntity);
</script>

<template>
  <section class="item-editor" aria-labelledby="item-editor-heading">
    <h2 id="item-editor-heading">
      {{ kind === "todo" ? "Todo" : "Habit" }}
      bearbeiten
    </h2>

    <p v-if="isLoading">Eintrag wird geladen …</p>

    <p v-if="errorMessage" role="alert">
      {{ errorMessage }}
    </p>

    <form v-if="hasLoaded" novalidate @submit.prevent="save">
      <fieldset :disabled="isBusy">
        <label for="planner-edit-title">Titel</label>
        <input
          id="planner-edit-title"
          v-model="title"
          name="title"
          maxlength="200"
          required
        />

        <template v-if="kind === 'todo'">
          <label for="planner-edit-date"> Zeitpunkt · optional </label>
          <input
            id="planner-edit-date"
            v-model="scheduledAt"
            name="scheduledAt"
            type="datetime-local"
          />

          <small>
            Lokale Zeitzone deines Geräts. Ohne Zeitpunkt landet das Todo im
            Dump.
          </small>

          <label for="planner-edit-duration">
            Dauer in Minuten · optional
          </label>
          <input
            id="planner-edit-duration"
            v-model="duration"
            name="duration"
            type="number"
            min="1"
            step="1"
          />

          <label class="item-editor__checkbox">
            <input v-model="isFixed" name="isFixed" type="checkbox" />
            Fester Termin
          </label>
        </template>

        <template v-else>
          <label class="item-editor__checkbox">
            <input v-model="isActive" name="isActive" type="checkbox" />
            Habit aktiv
          </label>

          <label for="planner-edit-policy">
            Verhalten bei verpassten Terminen
          </label>
          <select
            id="planner-edit-policy"
            v-model="missedPolicy"
            name="missedPolicy"
          >
            <option value="carry_over">Übertragen</option>
            <option value="skip">Verfallen lassen</option>
          </select>

          <small>
            Die Änderung betrifft das gesamte Habit, nicht nur diese Ausführung.
            Bei Wochenzielen gilt weiterhin eine tägliche Chance unabhängig von
            dieser Policy.
          </small>
        </template>

        <div class="item-editor__actions">
          <button type="submit">
            {{ isSaving ? "Bitte warten …" : "Speichern" }}
          </button>

          <button type="button" @click="emit('close')">Abbrechen</button>
        </div>

        <div class="item-editor__delete">
          <button
            v-if="!confirmDeletion"
            type="button"
            data-test="request-delete"
            @click="confirmDeletion = true"
          >
            {{ kind === "todo" ? "Todo löschen" : "Gesamtes Habit löschen" }}
          </button>

          <template v-else>
            <p>„{{ title }}“ wirklich löschen?</p>

            <p v-if="kind === 'habit'">
              Das Habit verschwindet aus dem Tagesplan. Seine bisherigen
              Ausführungen bleiben für die Historie gespeichert.
            </p>

            <div class="item-editor__actions">
              <button type="button" data-test="confirm-delete" @click="remove">
                Ja, löschen
              </button>

              <button type="button" @click="confirmDeletion = false">
                Nicht löschen
              </button>
            </div>
          </template>
        </div>
      </fieldset>
    </form>

    <button
      v-if="!hasLoaded && !isLoading"
      type="button"
      @click="emit('close')"
    >
      Schließen
    </button>
  </section>
</template>

<style scoped>
.item-editor {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.875rem;
  background: #ffffff;
}

.item-editor h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}

.item-editor fieldset {
  display: grid;
  gap: 0.75rem;
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}

.item-editor input:not([type="checkbox"]),
.item-editor select {
  width: 100%;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid #bfc7d4;
  border-radius: 0.5rem;
  font: inherit;
}

.item-editor__checkbox,
.item-editor__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
}

.item-editor button {
  padding: 0.65rem 0.9rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.5rem;
  background: #ffffff;
  cursor: pointer;
}

.item-editor button:disabled {
  opacity: 0.5;
  cursor: wait;
}

.item-editor small {
  color: #697386;
  line-height: 1.5;
}

.item-editor [role="alert"],
.item-editor__delete button {
  color: #b42318;
}

.item-editor__delete {
  margin-top: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
</style>
