<script setup lang="ts">
import { computed, onUnmounted, ref } from "vue";
import TodoDeletionSummary from "../components/TodoDeletionSummary.vue";
import { useTodoDeletion } from "../composables/useTodoDeletion";
import {
  getBacklogTodos,
  updateTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { getCategories } from "../api/categories.api";
import { useListFocus } from "../composables/useListFocus";
import AppIcon from "../components/AppIcon.vue";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import ModalDialog from "../components/ModalDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import type { CreateTodoInput, TodoResponse } from "../types/todo";
import { categoryMark } from "../utils/category-mark";
import { buildTodoInput } from "../utils/todo-input";

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const successMessage = ref<string | null>(null);

const selectedTodo = ref<TodoResponse | null>(null);
const {
  preview: deletionPreview,
  prepare: prepareDeletion,
  confirm: confirmPreviewedDeletion,
  cancel: cancelDeletion,
} = useTodoDeletion();
const confirmDeletion = computed(() => deletionPreview.value !== null);
async function requestDeletion(): Promise<void> {
  if (isBusy.value) return;
  errorMessage.value = null;
  try {
    await prepareDeletion(selectedTodo.value!.id);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Löschvorschau konnte nicht geladen werden.";
  }
}

const creationOpen = ref(false);

const editTitle = ref("");
const editScheduledAt = ref("");
const editDuration = ref<string | number>("");
const editIsFixed = ref(false);

/** Category names for the meta line; the list stays usable without them. */
const categoryNames = ref(new Map<number, string>());
async function loadCategoryNames(): Promise<void> {
  try {
    const categories = await getCategories();
    categoryNames.value = new Map(categories.map((c) => [c.id, c.name]));
  } catch {
    // Without names the items simply show no category mark.
  }
}
async function loadDump(): Promise<TodoResponse[]> {
  const [backlog] = await Promise.all([getBacklogTodos(), loadCategoryNames()]);
  return backlog;
}

const {
  data: todos,
  isLoading,
  errorMessage,
  reload: loadTodos,
} = useLoader(loadDump, {
  initial: [] as TodoResponse[],
  fallbackError: "Die Todos konnten nicht geladen werden.",
  refreshOnChange: () =>
    !(isSaving.value || selectedTodo.value || creationOpen.value),
});
const { write, applied, busy: isSaving } = useWrites(loadTodos, errorMessage);

const isBusy = computed(() => {
  return isLoading.value || isSaving.value;
});

/*
 * The server's backlog holds only open todos. Items ticked here stay visible
 * under "N erledigt" until the view is left, so a slip can be taken back.
 */
const doneHere = ref<TodoResponse[]>([]);
const doneOpen = ref(false);
const done = computed(() =>
  doneHere.value.filter(
    (item) => !todos.value.some((open) => open.id === item.id),
  ),
);
const lists = computed(() => [
  { key: "open", items: todos.value },
  { key: "done", items: doneOpen.value ? done.value : [] },
]);
function forgetDone(id: number): void {
  doneHere.value = doneHere.value.filter((item) => item.id !== id);
}

type Undo = { todo: TodoResponse; label: string };
const undo = ref<Undo | null>(null);
let undoTimer: ReturnType<typeof setTimeout> | undefined;
function offerUndo(todo: TodoResponse): void {
  clearTimeout(undoTimer);
  undo.value = { todo, label: `„${todo.title}“ erledigt` };
  undoTimer = setTimeout(() => (undo.value = null), 5000);
}
onUnmounted(() => clearTimeout(undoTimer));

function categoryOf(todo: TodoResponse): string | null {
  return todo.categoryId === null
    ? null
    : (categoryNames.value.get(todo.categoryId) ?? null);
}

function detailsOf(todo: TodoResponse): string[] {
  const parts: string[] = [];
  if (todo.plannedDurationMinutes !== null)
    parts.push(`${todo.plannedDurationMinutes} Min.`);
  if (todo.isFixed) parts.push("Fester Termin");
  return parts;
}

async function toggleTodo(todo: TodoResponse): Promise<void> {
  if (isBusy.value) {
    return;
  }

  successMessage.value = null;
  const completing = !todo.completed;
  const written = await write(() => updateTodoCompletion(todo.id, completing), {
    fallbackError: "Das Todo konnte nicht aktualisiert werden.",
  });
  if (!written) return;
  forgetDone(todo.id);
  if (completing) {
    doneHere.value = [{ ...todo, completed: true }, ...doneHere.value];
    offerUndo(todo);
  }
}

async function undoLast(): Promise<void> {
  const last = undo.value;
  if (!last) return;
  clearTimeout(undoTimer);
  undo.value = null;
  if (
    await write(() => updateTodoCompletion(last.todo.id, false), {
      fallbackError: "Das Rückgängigmachen hat nicht geklappt.",
    })
  )
    forgetDone(last.todo.id);
}

function openEditing(todo: TodoResponse): void {
  if (isBusy.value) {
    return;
  }

  listFocus.remember(`todo-${todo.id}`);
  selectedTodo.value = todo;
  cancelDeletion();

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
  cancelDeletion();

  editTitle.value = "";
  editScheduledAt.value = "";
  editDuration.value = "";
  editIsFixed.value = false;
}

function buildUpdateInput(): CreateTodoInput {
  return buildTodoInput({
    title: editTitle.value,
    scheduledAt: editScheduledAt.value,
    duration: editDuration.value,
    isFixed: editIsFixed.value,
  });
}

async function saveTodo(): Promise<void> {
  if (isBusy.value || !selectedTodo.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;

  let input: CreateTodoInput;
  try {
    input = buildUpdateInput();
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Änderungen konnten nicht gespeichert werden.";
    return;
  }
  const todoId = selectedTodo.value.id;
  if (
    await write(() => updateTodo(todoId, input), {
      fallbackError: "Die Änderungen konnten nicht gespeichert werden.",
    })
  ) {
    successMessage.value =
      input.scheduledAt === null
        ? "Änderungen gespeichert."
        : "Eingeplant. Das Todo steht jetzt in Heute.";
    closeEditing();
  }
}

async function removeSelectedTodo(): Promise<void> {
  if (isBusy.value || !selectedTodo.value || !confirmDeletion.value) {
    return;
  }

  successMessage.value = null;
  const removedId = selectedTodo.value.id;
  if (
    await write(confirmPreviewedDeletion, {
      fallbackError: "Das Todo konnte nicht gelöscht werden.",
      notify: null,
    })
  ) {
    forgetDone(removedId);
    successMessage.value = "Todo gelöscht.";
    closeEditing();
  }
}

function openCreation(): void {
  if (isBusy.value || selectedTodo.value) return;
  successMessage.value = null;
  creationOpen.value = true;
}
async function onCreated(): Promise<void> {
  successMessage.value = "Todo erstellt.";
  await applied();
  creationOpen.value = false;
}
</script>

<template>
  <main ref="page" class="page todo-dump">
    <CreateButton
      label="Todo erstellen"
      :disabled="isBusy || selectedTodo !== null"
      @click="openCreation"
    />
    <header class="page-header">
      <h1 class="page-title">Todo-Dump</h1>
      <p class="page-lead">Alles, was noch keinen Tag hat.</p>
    </header>

    <CreateItemDialog
      v-if="creationOpen"
      mode="todo"
      @close="creationOpen = false"
      @created="onCreated"
    />

    <ModalDialog
      v-if="selectedTodo"
      class="dump-edit-dialog"
      title="Todo bearbeiten"
      :busy="isSaving"
      :return-focus="listFocus.returnFocus"
      focus-selector='input[name="editTitle"]'
      @close="closeEditing"
    >
      <section class="todo-editor">
        <form data-test="editing-form" novalidate @submit.prevent="saveTodo">
          <fieldset :disabled="isBusy">
            <label class="field">
              Titel
              <input
                v-model="editTitle"
                name="editTitle"
                type="text"
                maxlength="200"
                required
              />
            </label>

            <div class="todo-editor__row">
              <label class="field">
                Zeitpunkt · optional
                <input
                  v-model="editScheduledAt"
                  name="editScheduledAt"
                  type="datetime-local"
                />
              </label>

              <label class="field">
                Dauer in Minuten · optional
                <input
                  v-model="editDuration"
                  name="editDuration"
                  type="number"
                  min="1"
                  step="1"
                />
              </label>
            </div>

            <label class="todo-editor__checkbox">
              <input v-model="editIsFixed" name="editIsFixed" type="checkbox" />
              Fester Termin
            </label>

            <p class="todo-editor__hint">
              Mit Zeitpunkt wandert das Todo nach Heute.
            </p>

            <p v-if="errorMessage" class="form-error" role="alert">
              {{ errorMessage }}
            </p>

            <div class="todo-editor__actions">
              <button class="btn btn--primary" type="submit">
                {{ isSaving ? "Wird gespeichert …" : "Speichern" }}
              </button>

              <button class="btn" type="button" @click="closeEditing">
                Abbrechen
              </button>
            </div>

            <div class="todo-editor__delete">
              <button
                v-if="!confirmDeletion"
                class="btn btn--quiet"
                type="button"
                data-test="dump-request-delete"
                @click="requestDeletion"
              >
                <AppIcon name="trash" />
                Todo löschen
              </button>

              <template v-else>
                <TodoDeletionSummary
                  v-if="deletionPreview"
                  :preview="deletionPreview"
                />
                <p>„{{ selectedTodo.title }}“ wirklich löschen?</p>

                <div class="todo-editor__actions">
                  <button
                    class="btn btn--danger"
                    type="button"
                    data-test="dump-confirm-delete"
                    @click="removeSelectedTodo"
                  >
                    Ja, löschen
                  </button>

                  <button
                    class="btn"
                    type="button"
                    data-test="dump-cancel-delete"
                    @click="cancelDeletion"
                  >
                    Nicht löschen
                  </button>
                </div>
              </template>
            </div>
          </fieldset>
        </form>
      </section>
    </ModalDialog>

    <div v-if="errorMessage && !selectedTodo" class="alert todo-dump__alert">
      <p role="alert">{{ errorMessage }}</p>
      <button
        class="btn btn--ground"
        type="button"
        :disabled="isLoading"
        @click="loadTodos()"
      >
        Erneut versuchen
      </button>
    </div>

    <p v-if="successMessage" class="todo-dump__status" role="status">
      {{ successMessage }}
    </p>

    <div
      v-if="isLoading"
      class="skeleton"
      role="status"
      aria-label="Todos werden geladen"
    >
      <span />
      <span />
      <span />
    </div>

    <template v-else>
      <div
        v-if="todos.length === 0 && !errorMessage"
        class="empty-state todo-dump__empty"
      >
        <strong>Dein Todo-Dump ist leer.</strong>
        <span>Tippe auf Plus, um etwas abzulegen.</span>
      </div>

      <template v-for="list in lists" :key="list.key">
        <button
          v-if="list.key === 'done' && done.length"
          class="dump-done__toggle"
          type="button"
          :aria-expanded="doneOpen"
          aria-controls="dump-done-list"
          @click="doneOpen = !doneOpen"
        >
          {{ done.length }} erledigt
          <AppIcon name="chevron" />
        </button>

        <ul
          v-if="list.items.length"
          :id="list.key === 'done' ? 'dump-done-list' : undefined"
          class="dump-list"
          :aria-label="list.key === 'done' ? 'Erledigt' : 'Offene Todos'"
        >
          <li
            v-for="todo in list.items"
            :key="todo.id"
            :data-todo-id="todo.id"
            :data-focus-key="`todo-${todo.id}`"
            class="dump-item"
            :class="{ 'dump-item--completed': todo.completed }"
          >
            <button
              class="dump-item__check"
              type="button"
              :disabled="isBusy"
              :aria-busy="isSaving || undefined"
              :aria-pressed="todo.completed"
              :aria-label="
                todo.completed
                  ? `${todo.title} wieder öffnen`
                  : `${todo.title} erledigen`
              "
              @click="toggleTodo(todo)"
            >
              <span class="dump-item__ring">
                <AppIcon v-if="todo.completed" name="check" />
              </span>
            </button>

            <div class="dump-item__content">
              <!-- The heading keeps the plain title; the button says "bearbeiten". -->
              <h3 :aria-label="todo.title">
                <button
                  class="dump-item__title"
                  data-edit-button
                  type="button"
                  :disabled="isBusy"
                  :aria-label="`${todo.title} bearbeiten`"
                  @click="openEditing(todo)"
                >
                  {{ todo.title }}
                </button>
              </h3>
              <p v-if="todo.why" class="dump-item__why">{{ todo.why }}</p>
              <p
                v-if="categoryOf(todo) || detailsOf(todo).length"
                class="dump-item__details"
              >
                <span v-if="categoryOf(todo)" class="dump-item__category">
                  <i
                    class="category-mark"
                    :style="{ background: categoryMark(categoryOf(todo)!) }"
                    aria-hidden="true"
                  />{{ categoryOf(todo) }}
                </span>
                <span v-for="part in detailsOf(todo)" :key="part">{{
                  part
                }}</span>
              </p>
            </div>
            <ItemPlayButton
              v-if="!todo.completed"
              class="dump-item__play"
              kind="todo"
              :target-id="todo.id"
              :title="todo.title"
              :duration="todo.plannedDurationMinutes"
              :eligible="todo.timerEligible"
              :disabled="isBusy"
            />
          </li>
        </ul>
      </template>
    </template>

    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
  </main>
</template>

<style scoped>
.todo-dump__alert,
.todo-dump__empty {
  margin-bottom: var(--space-4);
}

.todo-dump__status {
  margin: 0 0 var(--space-4);
  color: var(--color-ink-muted);
  font-weight: 600;
}

/* Dialog body. */
.todo-editor fieldset {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.todo-editor__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.todo-editor__checkbox {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  font-weight: 600;
}

.todo-editor__checkbox input {
  width: 1.25rem;
  height: 1.25rem;
}

.todo-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

.todo-editor__hint {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.todo-editor__delete {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}

.todo-editor__delete p {
  margin: 0;
}

/* ModalDialog tints every button; destructive ones keep the danger tint. */
.todo-editor button.btn--danger:not(:disabled) {
  background: var(--color-danger-tint);
  color: var(--color-danger);
}

/* List. */
.dump-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.dump-item {
  display: grid;
  grid-template-columns: var(--tap) minmax(0, 1fr) auto;
  gap: var(--space-2);
  align-items: start;
  padding: var(--space-2) var(--space-3) var(--space-3) var(--space-2);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

.dump-item__check {
  display: grid;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--color-on-action);
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.dump-item__check:active:not(:disabled) {
  transform: scale(0.86);
  transition-duration: 90ms;
}

.dump-item__check:disabled {
  cursor: progress;
}

.dump-item__ring {
  display: grid;
  width: 1.875rem;
  height: 1.875rem;
  place-items: center;
  border: 2.5px solid var(--color-action);
  border-radius: 50%;
  transition:
    background-color 240ms var(--ease-out),
    border-color 240ms var(--ease-out);
}

.dump-item__ring :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
  stroke-width: 3;
  animation: check-pop 420ms var(--spring);
}

@keyframes check-pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
}

.dump-item--completed .dump-item__ring {
  background: var(--color-action);
}

.dump-item__check:disabled .dump-item__ring {
  border-color: var(--color-ink-soft);
}

.dump-item--completed .dump-item__check:disabled .dump-item__ring {
  background: var(--color-ink-soft);
}

.dump-item__content {
  min-width: 0;
  padding-top: 0.55rem;
}

.dump-item h3 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.dump-item--completed h3 {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.dump-item__title {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 0.2em;
  cursor: pointer;
  transition: text-decoration-color 160ms var(--ease-out);
}

.dump-item__title:hover:not(:disabled) {
  text-decoration-color: var(--color-line);
}

.dump-item__title:disabled {
  cursor: progress;
}

.dump-item__why {
  max-width: 60ch;
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
}

.dump-item__details {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.dump-item__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

/* The timer sits beside the title, so a card stays one line tall. */
.dump-item__play {
  align-self: start;
}

/* Finished items fold away, like on Heute. */
.dump-done__toggle {
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  margin: var(--space-5) 0 var(--space-2);
  padding: 0 var(--space-3);
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-ink-muted);
  font-weight: 700;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.dump-done__toggle:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.dump-done__toggle :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
  transition: transform 200ms var(--ease-out);
}

.dump-done__toggle[aria-expanded="true"] :deep(svg) {
  transform: rotate(90deg);
}

@media (max-width: 32rem) {
  .todo-editor__row {
    grid-template-columns: 1fr;
  }
}
</style>
