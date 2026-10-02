<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  deleteTodo,
  getTodos,
  updateTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import CreateTodoForm from "../components/CreateTodoForm.vue";
import type { CreateTodoInput, TodoResponse } from "../types/todo";

const todos = ref<TodoResponse[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);

const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

const selectedTodo = ref<TodoResponse | null>(null);
const confirmDeletion = ref(false);

const editTitle = ref("");
const editScheduledAt = ref("");
const editDuration = ref<string | number>("");
const editIsFixed = ref(false);

const isBusy = computed(() => {
  return isLoading.value || isSaving.value;
});

const openTodos = computed(() => {
  return todos.value.filter((todo) => !todo.completed);
});

const completedTodos = computed(() => {
  return todos.value.filter((todo) => todo.completed);
});

const groups = computed(() => [
  {
    key: "open",
    title: "Offen",
    items: openTodos.value,
  },
  {
    key: "completed",
    title: "Erledigt",
    items: completedTodos.value,
  },
]);

async function loadTodos(): Promise<void> {
  isLoading.value = true;
  errorMessage.value = null;

  try {
    const allTodos = await getTodos();

    todos.value = allTodos.filter((todo) => todo.scheduledAt === null);
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Todos konnten nicht geladen werden.";
  } finally {
    isLoading.value = false;
  }
}

async function toggleTodo(todo: TodoResponse): Promise<void> {
  if (isBusy.value) {
    return;
  }

  isSaving.value = true;
  errorMessage.value = null;
  successMessage.value = null;

  try {
    await updateTodoCompletion(todo.id, !todo.completed);

    await loadTodos();
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Das Todo konnte nicht aktualisiert werden.";
  } finally {
    isSaving.value = false;
  }
}

function openEditing(todo: TodoResponse): void {
  if (isBusy.value) {
    return;
  }

  selectedTodo.value = todo;
  confirmDeletion.value = false;

  editTitle.value = todo.title;

  // Im Dump stehen nur Todos ohne Zeitpunkt.
  editScheduledAt.value = "";

  editDuration.value = todo.plannedDurationMinutes ?? "";

  editIsFixed.value = todo.isFixed;

  errorMessage.value = null;
  successMessage.value = null;
}

function closeEditing(): void {
  selectedTodo.value = null;
  confirmDeletion.value = false;

  editTitle.value = "";
  editScheduledAt.value = "";
  editDuration.value = "";
  editIsFixed.value = false;
}

function buildUpdateInput(): CreateTodoInput {
  const title = editTitle.value.trim();

  if (!title) {
    throw new Error("Bitte gib einen Titel ein.");
  }

  if (title.length > 200) {
    throw new Error("Der Titel darf höchstens 200 Zeichen enthalten.");
  }

  let scheduledAt: string | null = null;

  if (editScheduledAt.value) {
    const date = new Date(editScheduledAt.value);

    if (Number.isNaN(date.getTime())) {
      throw new Error("Bitte gib einen gültigen Zeitpunkt ein.");
    }

    scheduledAt = date.toISOString();
  }

  if (editIsFixed.value && scheduledAt === null) {
    throw new Error("Ein fester Termin benötigt einen Zeitpunkt.");
  }

  let plannedDurationMinutes: number | null = null;

  const rawDuration = editDuration.value;

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
    title,
    scheduledAt,
    plannedDurationMinutes,
    isFixed: editIsFixed.value,
  };
}

async function saveTodo(): Promise<void> {
  if (isBusy.value || !selectedTodo.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;

  try {
    const input = buildUpdateInput();
    const todoId = selectedTodo.value.id;

    isSaving.value = true;

    await updateTodo(todoId, input);

    closeEditing();

    successMessage.value =
      input.scheduledAt === null
        ? "Änderungen gespeichert."
        : "Änderungen gespeichert. Das Todo ist jetzt eingeplant und nicht mehr im Todo-Dump.";

    await loadTodos();
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Änderungen konnten nicht gespeichert werden.";
  } finally {
    isSaving.value = false;
  }
}

async function removeSelectedTodo(): Promise<void> {
  if (isBusy.value || !selectedTodo.value || !confirmDeletion.value) {
    return;
  }

  const todoId = selectedTodo.value.id;

  isSaving.value = true;
  errorMessage.value = null;
  successMessage.value = null;

  try {
    await deleteTodo(todoId);

    closeEditing();
    successMessage.value = "Todo gelöscht.";

    await loadTodos();
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Das Todo konnte nicht gelöscht werden.";
  } finally {
    isSaving.value = false;
  }
}

onMounted(loadTodos);
</script>

<template>
  <main class="todo-dump">
    <header class="todo-dump__header">
      <div>
        <h1>Todo-Dump</h1>
        <p>Ungeplante Aufgaben sammeln und bearbeiten.</p>
      </div>

      <button
        class="todo-dump__refresh"
        type="button"
        :disabled="isBusy"
        @click="loadTodos()"
      >
        Aktualisieren
      </button>
    </header>

    <CreateTodoForm @created="loadTodos()" />

    <section
      v-if="selectedTodo"
      class="todo-editor"
      aria-labelledby="editing-heading"
    >
      <h2 id="editing-heading">Todo bearbeiten</h2>

      <form data-test="editing-form" novalidate @submit.prevent="saveTodo">
        <fieldset :disabled="isBusy">
          <div class="todo-editor__field">
            <label for="edit-title">Titel</label>

            <input
              id="edit-title"
              v-model="editTitle"
              name="editTitle"
              type="text"
              maxlength="200"
              required
            />
          </div>

          <div class="todo-editor__row">
            <div class="todo-editor__field">
              <label for="edit-scheduled-at"> Zeitpunkt · optional </label>

              <input
                id="edit-scheduled-at"
                v-model="editScheduledAt"
                name="editScheduledAt"
                type="datetime-local"
              />

              <small> Lokale Zeitzone deines Geräts. </small>
            </div>

            <div class="todo-editor__field">
              <label for="edit-duration"> Dauer in Minuten · optional </label>

              <input
                id="edit-duration"
                v-model="editDuration"
                name="editDuration"
                type="number"
                min="1"
                step="1"
              />
            </div>
          </div>

          <label class="todo-editor__checkbox">
            <input v-model="editIsFixed" name="editIsFixed" type="checkbox" />
            Fester Termin
          </label>

          <p class="todo-editor__hint">
            Ohne Zeitpunkt bleibt das Todo im Dump. Die Bearbeitung verändert
            seinen Erledigungsstatus nicht.
          </p>

          <div class="todo-editor__actions">
            <button class="todo-editor__save" type="submit">
              {{ isSaving ? "Wird gespeichert …" : "Speichern" }}
            </button>

            <button
              class="todo-dump__secondary"
              type="button"
              @click="closeEditing"
            >
              Abbrechen
            </button>
          </div>

          <div class="todo-editor__delete">
            <button
              v-if="!confirmDeletion"
              type="button"
              data-test="dump-request-delete"
              @click="confirmDeletion = true"
            >
              Todo löschen
            </button>

            <template v-else>
              <p>„{{ selectedTodo.title }}“ wirklich löschen?</p>

              <div class="todo-editor__actions">
                <button
                  type="button"
                  data-test="dump-confirm-delete"
                  @click="removeSelectedTodo"
                >
                  Ja, löschen
                </button>

                <button
                  type="button"
                  data-test="dump-cancel-delete"
                  @click="confirmDeletion = false"
                >
                  Nicht löschen
                </button>
              </div>
            </template>
          </div>
        </fieldset>
      </form>
    </section>

    <p v-if="errorMessage" class="todo-dump__error" role="alert">
      {{ errorMessage }}
    </p>

    <p v-if="successMessage" class="todo-dump__success" role="status">
      {{ successMessage }}
    </p>

    <p v-if="isLoading">Todos werden geladen …</p>

    <p v-else-if="todos.length === 0 && !errorMessage" class="todo-dump__empty">
      Dein Todo-Dump ist leer.
    </p>

    <div v-else class="todo-dump__sections">
      <template v-for="group in groups" :key="group.key">
        <section v-if="group.items.length > 0">
          <header class="todo-dump__section-header">
            <h2>{{ group.title }}</h2>
            <span>{{ group.items.length }}</span>
          </header>

          <ul class="todo-dump__list">
            <li
              v-for="todo in group.items"
              :key="todo.id"
              :data-todo-id="todo.id"
              class="dump-item"
              :class="{
                'dump-item--completed': todo.completed,
              }"
            >
              <button
                class="dump-item__check"
                type="button"
                :disabled="isBusy"
                :aria-pressed="todo.completed"
                :aria-label="
                  todo.completed
                    ? `${todo.title} wieder öffnen`
                    : `${todo.title} erledigen`
                "
                @click="toggleTodo(todo)"
              >
                <span class="dump-item__circle" aria-hidden="true">
                  {{ todo.completed ? "✓" : "" }}
                </span>
              </button>

              <div class="dump-item__content">
                <h3>{{ todo.title }}</h3>

                <div class="dump-item__metadata">
                  <span>Todo</span>

                  <span v-if="todo.plannedDurationMinutes !== null">
                    {{ todo.plannedDurationMinutes }}
                    Min.
                  </span>

                  <span v-if="todo.completed"> Erledigt </span>
                </div>
              </div>

              <button
                class="dump-item__edit"
                type="button"
                :disabled="isBusy"
                :aria-label="`${todo.title} bearbeiten`"
                title="Bearbeiten"
                @click="openEditing(todo)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="m16 3 5 5-12 12-6 1 1-6L16 3Z" />
                  <path d="m14 5 5 5" />
                </svg>
              </button>
            </li>
          </ul>
        </section>
      </template>
    </div>
  </main>
</template>

<style scoped>
.todo-dump {
  width: min(100% - 2rem, 46rem);
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.todo-dump__header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 1.5rem;
}

.todo-dump h1 {
  margin: 0;
  font-size: 2rem;
}

.todo-dump__header p,
.todo-dump small {
  color: #697386;
}

.todo-dump__refresh,
.todo-dump__secondary,
.todo-editor__save {
  padding: 0.65rem 0.9rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #2f3a4f;
  cursor: pointer;
}

.todo-editor__save {
  border-color: #2457c5;
  background: #2457c5;
  color: #ffffff;
}

.todo-dump button:disabled {
  cursor: wait;
  opacity: 0.5;
}

.todo-editor {
  margin: 1.5rem 0;
  padding: 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.875rem;
  background: #ffffff;
}

.todo-editor h2 {
  margin: 0 0 1rem;
  font-size: 1.125rem;
}

.todo-editor fieldset {
  display: grid;
  gap: 1rem;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.todo-editor__field {
  display: grid;
  gap: 0.375rem;
  min-width: 0;
}

.todo-editor__field label {
  color: #39445a;
  font-size: 0.875rem;
  font-weight: 600;
}

.todo-editor__field input {
  width: 100%;
  min-width: 0;
  padding: 0.7rem;
  border: 1px solid #bfc7d4;
  border-radius: 0.5rem;
}

.todo-editor__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}

.todo-editor__checkbox,
.todo-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.todo-editor__hint {
  margin: 0;
  color: #697386;
  font-size: 0.8125rem;
  line-height: 1.5;
}

.todo-editor__delete {
  margin-top: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}

.todo-editor__delete button {
  padding: 0.65rem 0.9rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.5rem;
  background: #ffffff;
  color: #b42318;
  cursor: pointer;
}

.todo-dump__sections {
  display: grid;
  gap: 2rem;
}

.todo-dump__section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.todo-dump__section-header h2 {
  margin: 0;
  color: #273146;
  font-size: 1rem;
}

.todo-dump__section-header span {
  display: grid;
  min-width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 999px;
  background: #e8ebf0;
  color: #59657a;
  font-size: 0.75rem;
  font-weight: 700;
}

.todo-dump__list {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dump-item {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  padding: 0.875rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #ffffff;
  box-shadow: 0 0.125rem 0.5rem rgb(15 23 42 / 6%);
}

.dump-item--completed .dump-item__content {
  opacity: 0.68;
}

.dump-item--completed h3 {
  text-decoration: line-through;
}

.dump-item__check,
.dump-item__edit {
  display: grid;
  flex: 0 0 2.75rem;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 0.625rem;
  background: transparent;
  cursor: pointer;
}

.dump-item__circle {
  display: grid;
  width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border: 2px solid #748096;
  border-radius: 50%;
  color: #ffffff;
  font-size: 1rem;
  font-weight: 700;
}

.dump-item--completed .dump-item__circle {
  border-color: #198754;
  background: #198754;
}

.dump-item__content {
  flex: 1;
  min-width: 0;
}

.dump-item h3 {
  margin: 0;
  color: #182033;
  font-size: 1rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.dump-item__metadata {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
  color: #697386;
  font-size: 0.8125rem;
}

.dump-item__edit {
  color: #697386;
}

.dump-item__edit:hover:not(:disabled),
.dump-item__check:hover:not(:disabled) {
  background: #eef1f5;
}

.dump-item__edit svg {
  width: 1.25rem;
  height: 1.25rem;
}

.todo-dump__error {
  color: #b42318;
}

.todo-dump__success {
  color: #146c43;
}

.todo-dump__empty {
  padding: 2rem;
  border: 1px dashed #c7ced9;
  border-radius: 0.75rem;
  text-align: center;
}

@media (max-width: 32rem) {
  .todo-dump {
    width: min(100% - 1rem, 46rem);
    padding-top: 1rem;
  }

  .todo-editor__row {
    grid-template-columns: 1fr;
  }
}
</style>
