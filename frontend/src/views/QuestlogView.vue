<script setup lang="ts">
import { computed, ref } from "vue";
import {
  getBacklogTodos,
  updateTodoCompletion,
} from "../api/day-planner.api";
import { planQuest } from "../api/questlog.api";
import { useListFocus } from "../composables/useListFocus";
import AppIcon from "../components/AppIcon.vue";
import CampaignChip from "../components/CampaignChip.vue";
import ItemRow from "../components/ItemRow.vue";
import { useCategoryLabels } from "../composables/useCategoryLabels";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import { useUndo } from "../composables/useUndo";
import { useShortcutHandlers } from "../composables/useShortcuts";
import { toggleTimer, useTimer } from "../composables/useTimer";
import { addDays, getCurrentDateInTimeZone, weekStart } from "../utils/date";
import CreateButton from "../components/CreateButton.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import CampaignMoveDialog from "../components/CampaignMoveDialog.vue";
import DeleteItemDialog from "../components/DeleteItemDialog.vue";
import EditItemDialog from "../components/EditItemDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import type { TodoResponse } from "../types/todo";
import { shownWhy } from "../utils/why";
import { campaignMark } from "../utils/category-mark";
import { dayLabel, fullStop } from "../utils/history";
import {
  quickMoveEntries,
  quickMoves,
  rowMenu as cardMenu,
  type MenuEntry,
} from "../utils/row-actions";

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const successMessage = ref<string | null>(null);

/*
 * One dialog at a time for a quest of the list: the shared editor (at its
 * day for "Anderer Tag …"), "In Kampagne verschieben …" or "Löschen".
 */
type Dialog = {
  kind: "edit" | "move" | "delete";
  todo: TodoResponse;
  atDay?: boolean;
};
const dialog = ref<Dialog | null>(null);
/** Where "Anderer Tag …" puts the focus in the editor. */
const DAY_FIELD = 'input[name="scheduledDate"]';
const dialogBusy = ref(false);
const selectedTodo = computed(() => dialog.value?.todo ?? null);

const creationOpen = ref(false);

/** Category names and marks for the meta line. */
const { load: loadCategories, labelOf } = useCategoryLabels();
async function loadDump(): Promise<TodoResponse[]> {
  const [backlog] = await Promise.all([getBacklogTodos(), loadCategories()]);
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
    !(isSaving.value || dialog.value || dialogBusy.value || creationOpen.value),
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

const categoryOf = (todo: TodoResponse) => labelOf(todo.categoryId);
/** A campaign's own quest wears its stripe but does not repeat its name. */
const campaignOf = (todo: TodoResponse) =>
  todo.campaign && todo.campaign.id !== todo.id ? todo.campaign : null;

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

function openDialog(
  kind: Dialog["kind"],
  todo: TodoResponse,
  { atDay = false } = {},
): void {
  if (isBusy.value || dialog.value) return;
  listFocus.remember(`todo-${todo.id}`);
  errorMessage.value = null;
  successMessage.value = null;
  dialog.value = { kind, todo, atDay };
}
function openEditing(todo: TodoResponse, options = {}): void {
  openDialog("edit", todo, options);
}
function closeDialog(): void {
  dialog.value = null;
  dialogBusy.value = false;
}
async function onDialogDone(message: string): Promise<void> {
  const done = dialog.value;
  await applied();
  if (done?.kind === "delete") forgetDone(done.todo.id);
  successMessage.value = message;
  closeDialog();
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
 * step as T, D and W; "Anderer Tag …" opens the editor at its day field.
 */
function rowMenu(todo: TodoResponse): MenuEntry[] {
  const key = `todo-${todo.id}`;
  return cardMenu(
    todo.title,
    {
      quickMoves: quickMoveEntries(
        todo.title,
        quickMoves(getCurrentDateInTimeZone(), { date: null }),
        (move) => void plan(key, move.date),
        { disabled: isBusy.value, plan: true },
      ),
      otherDay: {
        run: () => openEditing(todo, { atDay: true }),
        plan: true,
      },
      edit: () => openEditing(todo),
      reparent: () => openDialog("move", todo),
      remove: { run: () => openDialog("delete", todo) },
    },
    isBusy.value,
  );
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
    <header class="page-header">
      <h1 class="page-title">Questlog</h1>
      <p class="page-lead">Quests ohne Tag, an denen du arbeiten kannst.</p>
    </header>

    <CreateItemDialog
      v-if="creationOpen"
      kind="todo"
      @close="creationOpen = false"
      @created="onCreated"
    />

    <EditItemDialog
      v-if="dialog?.kind === 'edit'"
      :key="dialog.todo.id"
      kind="todo"
      :entity-id="dialog.todo.id"
      :focus="dialog.atDay ? DAY_FIELD : undefined"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @changed="onDialogDone('Änderungen gespeichert.')"
      @close="closeDialog"
    />
    <CampaignMoveDialog
      v-if="dialog?.kind === 'move'"
      :todo-id="dialog.todo.id"
      :title="dialog.todo.title"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @moved="onDialogDone('Quest verschoben.')"
      @close="closeDialog"
    />
    <DeleteItemDialog
      v-if="dialog?.kind === 'delete'"
      :target="{ kind: 'todo', id: dialog.todo.id, title: dialog.todo.title }"
      :return-focus="listFocus.returnFocus"
      @busy="dialogBusy = $event"
      @deleted="onDialogDone('Quest gelöscht.')"
      @close="closeDialog"
    />

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

      <!-- Each list opens with an h2, so the rows' h3 never skip a level. -->
      <template v-for="list in lists" :key="list.key">
        <h2
          v-if="list.key === 'done' && done.length"
          class="dump-done__heading"
        >
          <button
            class="dump-done__toggle"
            type="button"
            :aria-expanded="doneOpen"
            aria-controls="dump-done-list"
            @click="doneOpen = !doneOpen"
          >
            {{ done.length }} erledigt
            <AppIcon name="chevron" />
          </button>
        </h2>
        <h2
          v-else-if="list.key !== 'done' && list.items.length"
          class="visually-hidden"
        >
          Offene Quests
        </h2>

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
                  categoryOf(todo) || detailsOf(todo).length || campaignOf(todo)
                "
                #meta
              >
                <span v-if="categoryOf(todo)" class="dump-item__category">
                  <i
                    class="category-mark"
                    :style="{ background: categoryOf(todo)!.mark }"
                    aria-hidden="true"
                  />{{ categoryOf(todo)!.name }}
                </span>
                <span v-for="part in detailsOf(todo)" :key="part">{{
                  part
                }}</span>
                <CampaignChip
                  v-if="campaignOf(todo)"
                  :campaign="campaignOf(todo)!"
                />
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
    <!-- After the content in reading order; fixed in place, it looks the same. -->
    <CreateButton
      label="Quest erstellen"
      :disabled="isBusy || selectedTodo !== null"
      @click="openCreation"
    />
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

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

/* Finished items fold away, like on Heute; the heading only carries the level. */
.dump-done__heading {
  margin: 0;
  font: inherit;
}

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

</style>
