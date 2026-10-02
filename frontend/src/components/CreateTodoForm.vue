<script setup lang="ts">
import { ref } from "vue";
import { createTodo } from "../api/day-planner.api";
import type { CreateTodoInput } from "../types/todo";

const emit = defineEmits<{
  created: [];
}>();

const title = ref("");
const scheduledAt = ref("");
const durationMinutes = ref<string | number>("");
const isFixed = ref(false);

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

function buildInput(): CreateTodoInput {
  const trimmedTitle = title.value.trim();

  if (!trimmedTitle) {
    throw new Error("Bitte gib einen Titel ein.");
  }

  if (trimmedTitle.length > 200) {
    throw new Error("Der Titel darf höchstens 200 Zeichen enthalten.");
  }

  let scheduledDateTime: string | null = null;

  if (scheduledAt.value) {
    const parsedDate = new Date(scheduledAt.value);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error("Bitte gib einen gültigen Zeitpunkt ein.");
    }

    scheduledDateTime = parsedDate.toISOString();
  }

  if (isFixed.value && scheduledDateTime === null) {
    throw new Error("Ein fester Termin benötigt einen Zeitpunkt.");
  }

  let plannedDurationMinutes: number | null = null;

  const rawDuration = durationMinutes.value;

  const isDurationEmpty =
    typeof rawDuration === "string" && rawDuration.trim() === "";

  if (!isDurationEmpty) {
    const duration = Number(rawDuration);

    if (!Number.isInteger(duration) || duration < 1) {
      throw new Error("Die Dauer muss eine ganze Zahl ab 1 Minute sein.");
    }

    plannedDurationMinutes = duration;
  }

  return {
    title: trimmedTitle,
    scheduledAt: scheduledDateTime,
    plannedDurationMinutes,
    isFixed: isFixed.value,
  };
}

function resetForm(): void {
  title.value = "";
  scheduledAt.value = "";
  durationMinutes.value = "";
  isFixed.value = false;
}

async function submit(): Promise<void> {
  if (isSubmitting.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;

  try {
    const input = buildInput();

    isSubmitting.value = true;

    await createTodo(input);

    resetForm();

    successMessage.value =
      input.scheduledAt === null
        ? "Todo erstellt. Es liegt im Todo-Dump und erscheint nicht in „Heute“."
        : "Todo erstellt. Es erscheint am geplanten Tag in „Heute“.";

    emit("created");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Das Todo konnte nicht erstellt werden.";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <section class="create-todo" aria-labelledby="create-todo-heading">
    <h2 id="create-todo-heading">Neues Todo</h2>

    <form novalidate @submit.prevent="submit">
      <fieldset :disabled="isSubmitting">
        <div class="create-todo__field">
          <label for="todo-title">Titel</label>

          <input
            id="todo-title"
            v-model="title"
            name="title"
            type="text"
            maxlength="200"
            required
            placeholder="Was möchtest du erledigen?"
          />
        </div>

        <div class="create-todo__row">
          <div class="create-todo__field">
            <label for="todo-scheduled-at"> Zeitpunkt · optional </label>

            <input
              id="todo-scheduled-at"
              v-model="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
            />

            <small> Verwendet die lokale Zeitzone deines Geräts. </small>
          </div>

          <div class="create-todo__field">
            <label for="todo-duration"> Dauer in Minuten · optional </label>

            <input
              id="todo-duration"
              v-model="durationMinutes"
              name="duration"
              type="number"
              min="1"
              step="1"
              placeholder="30"
            />
          </div>
        </div>

        <label class="create-todo__checkbox">
          <input v-model="isFixed" name="isFixed" type="checkbox" />

          Fester Termin
        </label>

        <p class="create-todo__hint">
          Ohne Zeitpunkt landet das Todo im Todo-Dump. Ein fester Termin
          benötigt einen Zeitpunkt.
        </p>

        <button type="submit">
          {{ isSubmitting ? "Wird gespeichert …" : "Todo erstellen" }}
        </button>
      </fieldset>
    </form>

    <p v-if="errorMessage" class="create-todo__error" role="alert">
      {{ errorMessage }}
    </p>

    <p v-if="successMessage" class="create-todo__success" role="status">
      {{ successMessage }}
    </p>
  </section>
</template>

<style scoped>
.create-todo {
  margin-bottom: 2rem;
  padding: 1rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #ffffff;
}

.create-todo h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}

.create-todo fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.create-todo__field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
}

.create-todo__field label {
  color: #39445a;
  font-size: 0.875rem;
  font-weight: 600;
}

.create-todo__field input {
  width: 100%;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid #bfc7d4;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #182033;
}

.create-todo__field small,
.create-todo__hint {
  color: #697386;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.create-todo__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-top: 1rem;
}

.create-todo__checkbox {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-top: 1rem;
  font-size: 0.875rem;
}

.create-todo button {
  padding: 0.7rem 1rem;
  border: 0;
  border-radius: 0.5rem;
  background: #2457c5;
  color: #ffffff;
  font: inherit;
  cursor: pointer;
}

.create-todo fieldset:disabled {
  opacity: 0.65;
}

.create-todo fieldset:disabled button {
  cursor: wait;
}

.create-todo__error,
.create-todo__success {
  margin: 1rem 0 0;
  font-size: 0.875rem;
  line-height: 1.5;
}

.create-todo__error {
  color: #b42318;
}

.create-todo__success {
  color: #146c43;
}

@media (max-width: 32rem) {
  .create-todo__row {
    grid-template-columns: 1fr;
  }
}
</style>
