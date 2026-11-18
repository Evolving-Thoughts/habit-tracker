<script setup lang="ts">
import { computed, ref } from "vue";
import TodoDeletionSummary from "../components/TodoDeletionSummary.vue";
import { useTodoDeletion } from "../composables/useTodoDeletion";
import {
  getBacklogTodos,
  updateTodo,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { getCategories } from "../api/categories.api";
import { planQuest } from "../api/questlog.api";
import { useListFocus } from "../composables/useListFocus";
import AppIcon from "../components/AppIcon.vue";
import ItemRow from "../components/ItemRow.vue";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import { useUndo } from "../composables/useUndo";
import { useShortcutHandlers } from "../composables/useShortcuts";
import { toggleTimer, useTimer } from "../composables/useTimer";
import { addDays, getCurrentDateInTimeZone, weekStart } from "../utils/date";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import ModalDialog from "../components/ModalDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import type { CreateTodoInput, TodoResponse } from "../types/todo";
import { shownWhy } from "../utils/why";
import PlanFields from "../components/PlanFields.vue";
import QuestNotes from "../components/QuestNotes.vue";
import { campaignMark, categoryMark } from "../utils/category-mark";
import { buildTodoInput } from "../utils/todo-input";
import { dayLabel, fullStop } from "../utils/history";
import {
  quickMoveEntries,
  quickMoves,
  type MenuEntry,
} from "../utils/row-actions";

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
const editDate = ref("");
const editTime = ref("");
const editDuration = ref<string | number>("");

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
  fallbackError: "Die Quests konnten nicht geladen werden.",
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

const { undo, offer, take: takeUndo } = useUndo<TodoResponse>();

function categoryOf(todo: TodoResponse): string | null {
  return todo.categoryId === null
    ? null
    : (categoryNames.value.get(todo.categoryId) ?? null);
}

function detailsOf(todo: TodoResponse): string[] {
  const parts: string[] = [];
  if (todo.plannedDurationMinutes !== null)
    parts.push(`${todo.plannedDurationMinutes} Min.`);
  return parts;
}

async function toggleTodo(todo: TodoResponse): Promise<void> {
  if (isBusy.value) {
    return;
  }

  successMessage.value = null;
  const completing = !todo.completed;
  const written = await write(() => updateTodoCompletion(todo.id, completing), {
    fallbackError: "Die Quest konnte nicht aktualisiert werden.",
  });
  if (!written) return;
  forgetDone(todo.id);
  if (completing) {
    doneHere.value = [{ ...todo, completed: true }, ...doneHere.value];
    offer(todo, `„${todo.title}“ erledigt`);
  }
}

async function undoLast(): Promise<void> {
  const todo = takeUndo();
  if (!todo) return;
  if (
    await write(() => updateTodoCompletion(todo.id, false), {
      fallbackError: "Das Rückgängigmachen hat nicht geklappt.",
    })
  )
    forgetDone(todo.id);
}

/** Where the editor puts the focus: the title, or the day for "Tag wählen …". */
const editorFocus = ref('input[name="editTitle"]');
function openEditing(todo: TodoResponse, { atDay = false } = {}): void {
  if (isBusy.value) {
    return;
  }

  listFocus.remember(`todo-${todo.id}`);
  editorFocus.value = atDay
    ? 'input[name="scheduledDate"]'
    : 'input[name="editTitle"]';
  selectedTodo.value = todo;
  cancelDeletion();

  editTitle.value = todo.title;

  // The Questlog only holds quests without a day.
  editDate.value = "";
  editTime.value = "";

  editDuration.value = todo.plannedDurationMinutes ?? "";

  errorMessage.value = null;
  successMessage.value = null;
}

function closeEditing(): void {
  selectedTodo.value = null;
  cancelDeletion();

  editTitle.value = "";
  editDate.value = "";
  editTime.value = "";
  editDuration.value = "";
}

function buildUpdateInput(): CreateTodoInput {
  return buildTodoInput({
    title: editTitle.value,
    date: editDate.value,
    time: editTime.value,
    duration: editDuration.value,
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
      input.scheduledDate === null
        ? "Änderungen gespeichert."
        : "Eingeplant. Die Quest steht jetzt an ihrem Tag.";
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
      fallbackError: "Die Quest konnte nicht gelöscht werden.",
      notify: null,
    })
  ) {
    forgetDone(removedId);
    successMessage.value = "Quest gelöscht.";
    closeEditing();
  }
}

function openCreation(): void {
  if (isBusy.value || selectedTodo.value) return;
  successMessage.value = null;
  creationOpen.value = true;
}
async function onCreated(): Promise<void> {
  successMessage.value = "Quest erstellt.";
  await applied();
  creationOpen.value = false;
}

/*
 * Keyboard shortcuts on a row: the same writes as its buttons and as saving
 * a day in the editor. Finished rows ignore them.
 */
const timer = useTimer();
function openTodo(key: string | null): TodoResponse | null {
  if (isBusy.value || selectedTodo.value) return null;
  return todos.value.find((todo) => `todo-${todo.id}` === key) ?? null;
}
function whereLabel(date: string): string {
  const today = getCurrentDateInTimeZone();
  if (date === today) return "bei heute";
  if (date === addDays(today, 1)) return "bei morgen";
  return `am ${dayLabel(date)}`;
}
function plan(key: string | null, date: string): boolean {
  const todo = openTodo(key);
  if (!todo) return false;
  void listFocus.around(key!, async () => {
    successMessage.value = null;
    if (
      await write(() => planQuest(todo, date), {
        fallbackError: "Die Quest konnte nicht eingeplant werden.",
      })
    )
      successMessage.value = fullStop(
        `„${todo.title}“ steht jetzt ${whereLabel(date)}`,
      );
  });
  return true;
}

/*
 * "Aktionen für …": Einplanen for today, tomorrow or next week runs the same
 * step as T, D and W; "Tag wählen …" opens the editor at its day field.
 */
function rowMenu(todo: TodoResponse): MenuEntry[] {
  const key = `todo-${todo.id}`;
  return [
    ...quickMoveEntries(
      todo.title,
      quickMoves(getCurrentDateInTimeZone(), { date: null }),
      (move) => void plan(key, move.date),
      { disabled: isBusy.value, plan: true },
    ),
    {
      id: "choose-day",
      label: "Tag wählen …",
      icon: "calendar",
      ariaLabel: `Tag für ${todo.title} wählen`,
      disabled: isBusy.value,
      run: () => openEditing(todo, { atDay: true }),
    },
  ];
}
useShortcutHandlers({
  "quest.new": () => {
    if (isBusy.value || selectedTodo.value) return;
    openCreation();
  },
  "row.timer": ({ key }) => {
    const todo = openTodo(key);
    if (!todo) return false;
    return toggleTimer(
      timer,
      { kind: "todo", targetId: todo.id, title: todo.title },
      todo.timerEligible,
    );
  },
  "row.done": ({ key }) => {
    const todo = openTodo(key);
    if (!todo) return false;
    void listFocus.around(key!, () => toggleTodo(todo));
  },
  "row.today": ({ key }) => plan(key, getCurrentDateInTimeZone()),
  "row.tomorrow": ({ key }) =>
    plan(key, addDays(getCurrentDateInTimeZone(), 1)),
  "row.nextWeek": ({ key }) =>
    plan(key, addDays(weekStart(getCurrentDateInTimeZone()), 7)),
});
</script>

<template>
  <main ref="page" class="page questlog">
    <CreateButton
      label="Quest erstellen"
      :disabled="isBusy || selectedTodo !== null"
      @click="openCreation"
    />
    <header class="page-header">
      <h1 class="page-title">Questlog</h1>
      <p class="page-lead">Quests ohne Tag, an denen du arbeiten kannst.</p>
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
      title="Quest bearbeiten"
      :busy="isSaving"
      :return-focus="listFocus.returnFocus"
      :focus-selector="editorFocus"
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

            <PlanFields
              v-model:date="editDate"
              v-model:time="editTime"
              id-prefix="questlog-edit"
            />

            <div class="todo-editor__row">
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

            <QuestNotes :todo-id="selectedTodo.id" />

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
                Quest löschen
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

    <div v-if="errorMessage && !selectedTodo" class="alert questlog__alert">
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

    <p v-if="successMessage" class="questlog__status" role="status">
      {{ successMessage }}
    </p>

    <div
      v-if="isLoading"
      class="skeleton"
      role="status"
      aria-label="Quests werden geladen"
    >
      <span />
      <span />
      <span />
    </div>

    <template v-else>
      <div
        v-if="todos.length === 0 && !errorMessage"
        class="empty-state questlog__empty"
      >
        <strong>Dein Questlog ist leer.</strong>
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
          :aria-label="list.key === 'done' ? 'Erledigt' : 'Offene Quests'"
        >
          <li
            v-for="todo in list.items"
            :key="todo.id"
            :data-todo-id="todo.id"
            :data-focus-key="`todo-${todo.id}`"
          >
            <ItemRow
              class="dump-item"
              :title="todo.title"
              :state="todo.completed ? 'completed' : 'open'"
              :ring-pressed="todo.completed"
              :busy="isBusy"
              :campaign-mark="campaignMark(todo.campaign)"
              :measure="
                todo.completed
                  ? null
                  : {
                      kind: 'todo',
                      targetId: todo.id,
                      eligible: todo.timerEligible,
                    }
              "
              :menu="todo.completed ? [] : rowMenu(todo)"
              @toggle="toggleTodo(todo)"
              @edit="openEditing(todo)"
            >
              <template
                v-if="
                  categoryOf(todo) || detailsOf(todo).length || todo.campaign
                "
                #meta
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
                <span
                  v-if="todo.campaign && todo.campaign.id !== todo.id"
                  class="dump-item__campaign"
                >
                  {{ todo.campaign.title }}
                </span>
              </template>
              <template v-if="shownWhy(todo)" #below>
                <p class="dump-item__why">{{ shownWhy(todo) }}</p>
              </template>
            </ItemRow>
          </li>
        </ul>
      </template>
    </template>

    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
  </main>
</template>

<style scoped>
.questlog__alert,
.questlog__empty {
  margin-bottom: var(--space-4);
}

.questlog__status {
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

.todo-editor__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
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

/* List: each quest on the shared row (ItemRow). */
.dump-list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.dump-item__why {
  max-width: 60ch;
  margin: 0.1rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
}

.dump-item__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.dump-item__campaign {
  font-weight: 700;
}

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
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
