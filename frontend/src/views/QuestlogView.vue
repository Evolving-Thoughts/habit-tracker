<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { getBacklogTodos, reorderBacklog } from "../api/day-planner.api";
import { planQuest } from "../api/questlog.api";
import { useListFocus } from "../composables/useListFocus";
import { useRowDialogs, type RowDialog } from "../composables/useRowDialogs";
import { useSortable } from "../composables/useSortable";
import AppIcon from "../components/AppIcon.vue";
import CampaignChip from "../components/CampaignChip.vue";
import ItemRow from "../components/ItemRow.vue";
import { useCategoryLabels } from "../composables/useCategoryLabels";
import { useViewSession } from "../composables/useViewSession";
import { useTicks } from "../composables/useTicks";
import { useShortcutHandlers } from "../composables/useShortcuts";
import { useTimer } from "../composables/useTimer";
import { getCurrentDateInTimeZone } from "../utils/date";
import CreateButton from "../components/CreateButton.vue";
import QuickAddQuest from "../components/QuickAddQuest.vue";
import CreateItemDialog from "../components/CreateItemDialog.vue";
import RowDialogs from "../components/RowDialogs.vue";
import UndoToast from "../components/UndoToast.vue";
import type { TodoResponse } from "../types/todo";
import { shownWhy } from "../utils/why";
import { campaignMark } from "../utils/category-mark";
import { fullStop } from "../utils/history";
import { moved } from "../utils/today-agenda";
import {
  measureOf,
  questRow,
  rowControl,
  rowMenu,
  rowShortcuts,
  whereLabel,
  type RowActions,
} from "../utils/row-actions";

const page = ref<HTMLElement | null>(null);
const listFocus = useListFocus(page);

const successMessage = ref<string | null>(null);

/** Where "Anderer Tag …" puts the focus in the editor. */
const DAY_FIELD = 'input[name="scheduledDate"]';

const creationOpen = ref(false);
/** Opened by a long press on Plus: a quest, its title dictated at once. */
const creationDictate = ref(false);

/** Category names and marks for the meta line. */
const { load: loadCategories, labelOf } = useCategoryLabels();
async function loadDump(): Promise<TodoResponse[]> {
  const [backlog] = await Promise.all([getBacklogTodos(), loadCategories()]);
  return backlog;
}

const session = useViewSession({
  holding: () => rows.holding() || creationOpen.value,
});
const {
  data: todos,
  isLoading,
  errorMessage,
  reload: loadTodos,
} = session.resource(loadDump, {
  initial: [] as TodoResponse[],
  fallbackError: "Die Quests konnten nicht geladen werden.",
});
const { write, applied, busy: isSaving } = session;

/*
 * A quest's dialogs: the shared editor (at its day for "Anderer Tag …"),
 * "In Kampagne verschieben …" or "Löschen". Each says in the status line
 * what it did; a deleted quest leaves the done list too.
 */
const SAVED: Partial<Record<RowDialog["kind"], string>> = {
  edit: "Änderungen gespeichert.",
  reparent: "Quest verschoben.",
  delete: "Quest gelöscht.",
};
const rows = useRowDialogs({
  root: page,
  session,
  today: getCurrentDateInTimeZone,
  blocked: () => isLoading.value,
  opened: () => {
    errorMessage.value = null;
    successMessage.value = null;
  },
  saved: (dialog) => {
    if (dialog.kind === "delete") forgetDone(dialog.target.id);
    successMessage.value = SAVED[dialog.kind] ?? null;
  },
});
const dialogOpen = computed(() => rows.dialog.value !== null);

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

/* Rings and the undo toast: `useTicks`. */
const ticks = useTicks(write);
const { undo, undoLast } = ticks;

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
  const target = { kind: "todo", id: todo.id, title: todo.title } as const;
  const fallbackError = "Die Quest konnte nicht aktualisiert werden.";
  if (todo.completed) {
    if (await ticks.reopen(target, { fallbackError })) forgetDone(todo.id);
    return;
  }
  // The Questlog lists no campaigns, so nothing asks here.
  const written = await ticks.complete(target, {
    fallbackError,
    onUndone: () => forgetDone(todo.id),
  });
  if (!written) return;
  forgetDone(todo.id);
  doneHere.value = [{ ...todo, completed: true }, ...doneHere.value];
}

/** The editor of a quest; `atDay` starts it at the day field. */
function openEditing(todo: TodoResponse, { atDay = false } = {}): void {
  rows.edit(`todo-${todo.id}`, {
    kind: "todo",
    id: todo.id,
    focus: atDay ? DAY_FIELD : undefined,
  });
}

function openCreation(dictate = false): void {
  if (isBusy.value || dialogOpen.value) return;
  successMessage.value = null;
  creationDictate.value = dictate;
  creationOpen.value = true;
}
async function onCreated(): Promise<void> {
  successMessage.value = "Quest erstellt.";
  await applied();
  creationOpen.value = false;
}

/*
 * The Questlog keeps the order it is sorted into: the whole card drags (a
 * finger after a long press), and "Nach oben" / "Nach unten" in its menu
 * do the same by key. The new order shows at once and is then stored.
 */
const openList = ref<HTMLElement | null>(null);
function listRef(key: string) {
  return (element: unknown) => {
    if (key === "open") openList.value = (element as HTMLElement | null) ?? null;
  };
}
async function moveInList(from: number, to: number): Promise<void> {
  if (isBusy.value || dialogOpen.value) return;
  const before = todos.value;
  const order = moved(before, from, to);
  const todo = order[to];
  if (!todo || order[from] === todo) return;
  todos.value = order;
  successMessage.value = `„${todo.title}“ steht jetzt an Stelle ${to + 1} von ${order.length}.`;
  const written = await write(
    () => reorderBacklog(order.map(({ id }) => id)),
    { fallbackError: "Die Reihenfolge konnte nicht gespeichert werden." },
  );
  if (written) return;
  // Taken back at once; the error says why.
  todos.value = before;
  successMessage.value = null;
}
useSortable(openList, {
  item: "[data-todo-id]",
  onMove: (from, to) => void moveInList(from, to),
});
async function shiftInList(todo: TodoResponse, direction: -1 | 1): Promise<void> {
  const from = todos.value.indexOf(todo);
  if (from === -1) return;
  await moveInList(from, from + direction);
  await nextTick();
  rowControl(page.value, `todo-${todo.id}`)?.focus();
}

/*
 * What a quest of the list can do: its menu and its keys (row-actions).
 * Einplanen for today, tomorrow or next week is the same step as T, D and
 * W; "Anderer Tag …" opens the editor at its day field. Finished rows and
 * keys while a dialog is open are ignored.
 */
const timer = useTimer();
function openTodo(key: string | null): TodoResponse | null {
  if (isBusy.value || dialogOpen.value) return null;
  return todos.value.find((todo) => `todo-${todo.id}` === key) ?? null;
}
function actionsOf(todo: TodoResponse): RowActions {
  const key = `todo-${todo.id}`;
  const today = getCurrentDateInTimeZone();
  const place = todos.value.indexOf(todo);
  return {
    row: questRow(todo),
    today,
    busy: isBusy.value,
    move: (date) =>
      void listFocus.around(key, async () => {
        successMessage.value = null;
        if (
          await write(() => planQuest(todo, date), {
            fallbackError: "Die Quest konnte nicht eingeplant werden.",
          })
        )
          successMessage.value = fullStop(
            `„${todo.title}“ steht jetzt ${whereLabel(date, today)}`,
          );
      }),
    pickDay: () => openEditing(todo, { atDay: true }),
    complete: () => void listFocus.around(key, () => toggleTodo(todo)),
    edit: () => openEditing(todo),
    reparent: () =>
      rows.reparent(key, { todoId: todo.id, title: todo.title }),
    step: (direction) =>
      direction === "up"
        ? place > 0
          ? () => void shiftInList(todo, -1)
          : undefined
        : place !== -1 && place < todos.value.length - 1
          ? () => void shiftInList(todo, 1)
          : undefined,
    remove: () =>
      rows.remove(key, { kind: "todo", id: todo.id, title: todo.title }),
  };
}
useShortcutHandlers({
  "quest.new": () => {
    if (isBusy.value || dialogOpen.value) return;
    openCreation();
  },
  ...rowShortcuts((key) => {
    const todo = openTodo(key);
    return todo ? actionsOf(todo) : null;
  }, timer),
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
      :dictate="creationDictate"
      kind="todo"
      @close="creationOpen = false"
      @created="onCreated"
    />

    <RowDialogs :dialogs="rows" />

    <div v-if="errorMessage && !dialogOpen" class="alert questlog__alert">
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

    <!-- A new quest without a day: at the head or the end of the order (↑ / ↓). -->
    <QuickAddQuest
      :date="null"
      label="Quest ins Questlog hinzufügen"
      @created="applied()"
    />

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
        <span>Schreib oben hinein, was ansteht, oder tippe auf Plus.</span>
      </div>

      <!-- Each list opens with an h2, so the rows' h3 never skip a level. -->
      <template v-for="list in lists" :key="list.key">
        <h2
          v-if="list.key === 'done' && done.length"
          class="dump-done__heading"
        >
          <button
            class="fold-toggle dump-done__toggle"
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
          :ref="listRef(list.key)"
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
              :draggable="!todo.completed"
              :campaign-mark="campaignMark(todo.campaign)"
              :measure="todo.completed ? null : measureOf(questRow(todo))"
              :menu="rowMenu(actionsOf(todo))"
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
      :disabled="isBusy || dialogOpen"
      @click="openCreation()"
      @dictate="openCreation(true)"
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

/* The shared disclosure (.fold-toggle in style.css); only its place here. */
.dump-done__toggle {
  margin: var(--space-5) 0 var(--space-2);
}

</style>
