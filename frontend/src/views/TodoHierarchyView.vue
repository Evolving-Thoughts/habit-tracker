<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import {
  getTodoHierarchy,
  getDeletionPreview,
} from "../api/todo-hierarchy.api";
import {
  updateTodo,
  updateTodoCompletion,
  deleteTodo,
} from "../api/day-planner.api";
import type { HierarchyTodo, DeletionPreview } from "../types/todo-hierarchy";
import {
  hierarchyChildren,
  visibleHierarchy,
  descendantIds,
} from "../utils/todo-hierarchy";
import ModalDialog from "../components/ModalDialog.vue";
import CreateTodoForm from "../components/CreateTodoForm.vue";
import PlannerItemEditor from "../components/PlannerItemEditor.vue";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import TodoDeletionSummary from "../components/TodoDeletionSummary.vue";
import { useListFocus } from "../composables/useListFocus";
import { notifyTargetChange } from "../composables/useTimer";
const page = ref<HTMLElement | null>(null),
  listFocus = useListFocus(page);
const todos = ref<HierarchyTodo[]>([]),
  collapsed = ref(new Set<number>());
const loading = ref(true),
  saving = ref(false),
  error = ref(""),
  success = ref("");
const action = ref<"create" | "move" | "edit" | "delete" | null>(null),
  selected = ref<HierarchyTodo | null>(null);
const formBusy = ref(false),
  parent = ref(""),
  preview = ref<DeletionPreview | null>(null);
const dragged = ref<number | null>(null),
  dropTarget = ref<number | null | undefined>(undefined);
const busy = computed(() => saving.value || formBusy.value);
const rows = computed(() => visibleHierarchy(todos.value, collapsed.value));
const children = computed(() => hierarchyChildren(todos.value));
const parentOptions = computed(() => {
  const excluded = selected.value
    ? descendantIds(todos.value, selected.value.id)
    : new Set<number>();
  return todos.value.filter((t) => !excluded.has(t.id));
});
async function load() {
  loading.value = true;
  error.value = "";
  try {
    todos.value = await getTodoHierarchy();
  } catch (e) {
    error.value = message(e);
  } finally {
    loading.value = false;
  }
}
function message(e: unknown) {
  return e instanceof Error ? e.message : "Änderung fehlgeschlagen.";
}
function close() {
  if (!busy.value) {
    action.value = null;
    selected.value = null;
    preview.value = null;
  }
}
async function run(fn: () => Promise<unknown>, text: string) {
  if (busy.value) return;
  const activeLabel = document.activeElement?.getAttribute("aria-label");
  const hadDialog = action.value !== null;
  saving.value = true;
  error.value = "";
  success.value = "";
  try {
    await fn();
    notifyTargetChange();
    await load();
    if (error.value) return;
    success.value = text;
    action.value = null;
    preview.value = null;
    selected.value = null;
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
    await nextTick();
    if (!hadDialog && activeLabel)
      page.value
        ?.querySelectorAll<HTMLElement>("[aria-label]")
        .forEach((el) => {
          if (el.getAttribute("aria-label") === activeLabel) el.focus();
        });
  }
}
function toggleCollapse(id: number) {
  const next = new Set(collapsed.value);
  next.has(id) ? next.delete(id) : next.add(id);
  collapsed.value = next;
}
function open(
  kind: "create" | "move" | "edit",
  todo: HierarchyTodo | null = null,
) {
  if (todo) listFocus.remember(`todo-${todo.id}`);
  selected.value = todo;
  action.value = kind;
  error.value = "";
  formBusy.value = false;
  parent.value = todo?.parentId == null ? "" : String(todo.parentId);
}
async function created() {
  formBusy.value = false;
  if (selected.value) {
    const next = new Set(collapsed.value);
    next.delete(selected.value.id);
    collapsed.value = next;
  }
  await load();
  action.value = null;
  selected.value = null;
  notifyTargetChange();
  success.value = "Todo angelegt.";
}
async function changed() {
  formBusy.value = false;
  await load();
  action.value = null;
  selected.value = null;
  notifyTargetChange();
  success.value = "Änderungen gespeichert.";
}
function move(todo: HierarchyTodo, target: number | null) {
  return run(
    () => updateTodo(todo.id, { parentId: target }),
    "Teilbaum verschoben.",
  );
}
function drop(event: DragEvent, target: number | null) {
  event.preventDefault();
  dropTarget.value = undefined;
  const todo = todos.value.find((t) => t.id === dragged.value);
  dragged.value = null;
  if (todo && !busy.value) void move(todo, target);
}
function startDrag(event: DragEvent, id: number) {
  if (busy.value) {
    event.preventDefault();
    return;
  }
  dragged.value = id;
  event.dataTransfer?.setData("text/plain", String(id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
async function requestDelete(todo: HierarchyTodo) {
  if (busy.value) return;
  listFocus.remember(`todo-${todo.id}`);
  selected.value = todo;
  saving.value = true;
  error.value = "";
  try {
    preview.value = await getDeletionPreview(todo.id);
    action.value = "delete";
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
async function confirmDelete() {
  if (!selected.value || !preview.value) return;
  await run(
    () => deleteTodo(selected.value!.id, preview.value!.confirmationToken),
    "Teilbaum gelöscht. Verlauf bleibt erhalten.",
  );
  if (error.value) {
    action.value = null;
    preview.value = null;
  }
}
onMounted(load);
</script>
<template>
  <main ref="page" class="hierarchy">
    <header class="heading">
      <div>
        <h1>Aufgabenbaum</h1>
        <p>
          Jedes Todo ist eine eigene Aufgabe. Der Fortschritt zählt den ganzen
          Teilbaum.
        </p>
      </div>
      <button
        class="create-button"
        type="button"
        :disabled="busy"
        @click="open('create')"
      >
        ＋ Todo
      </button>
    </header>
    <p v-if="error" role="alert">
      {{ error }}
      <button v-if="!action" type="button" :disabled="busy" @click="load">
        Erneut laden
      </button>
    </p>
    <p v-if="success" role="status">{{ success }}</p>
    <p v-if="loading" role="status">Aufgaben werden geladen …</p>
    <p v-else-if="!todos.length && !error">
      Noch keine Todos. Lege dein erstes Todo an.
    </p>
    <template v-else-if="todos.length">
      <p class="hint">
        Checkbox = eigene Erledigung · Balken = Teilbaum. Verschiebe über
        „Verschieben“ oder per Drag-and-drop.
      </p>
      <ul class="tree" aria-label="Todo-Hierarchie">
        <li
          v-for="{ todo, depth } in rows"
          :key="todo.id"
          class="row"
          :class="{ over: dropTarget === todo.id }"
          :style="{ '--indent': Math.min(depth, 6) }"
          :data-todo-id="todo.id"
          :data-focus-key="`todo-${todo.id}`"
          :draggable="!busy"
          @dragstart="startDrag($event, todo.id)"
          @dragend="
            dragged = null;
            dropTarget = undefined;
          "
          @dragover.prevent="dropTarget = todo.id"
          @dragleave="dropTarget = undefined"
          @drop.stop="drop($event, todo.id)"
        >
          <button
            type="button"
            class="collapse"
            :disabled="!children.get(todo.id)?.length"
            :aria-label="`${todo.title} ${collapsed.has(todo.id) ? 'ausklappen' : 'einklappen'}`"
            :aria-expanded="!collapsed.has(todo.id)"
            @click="toggleCollapse(todo.id)"
          >
            {{
              children.get(todo.id)?.length
                ? collapsed.has(todo.id)
                  ? ">"
                  : "v"
                : "·"
            }}
          </button>
          <input
            type="checkbox"
            :checked="todo.completed"
            :disabled="busy"
            :aria-label="`${todo.title} als eigene Aufgabe erledigen`"
            @change="
              run(
                () => updateTodoCompletion(todo.id, !todo.completed),
                'Erledigung aktualisiert.',
              )
            "
          />
          <div class="content">
            <h2 :class="{ done: todo.completed }">{{ todo.title }}</h2>
            <p class="meta">
              Ebene {{ depth + 1 }} · Eigene Dauer:
              {{
                todo.plannedDurationMinutes == null
                  ? "offen"
                  : `${todo.plannedDurationMinutes} Min.`
              }}<span v-if="todo.scheduledAt">
                · {{ new Date(todo.scheduledAt).toLocaleString("de-DE")
                }}{{ todo.isFixed ? " · fix" : "" }}</span
              >
            </p>
            <progress
              max="100"
              :value="todo.progress.percentage"
              :aria-label="`Teilbaumfortschritt für ${todo.title}`"
            ></progress>
            <p class="meta">
              Teilbaum {{ Math.round(todo.progress.percentage) }} % ·
              {{ todo.progress.completed }}/{{ todo.progress.total }}
              {{ todo.progress.mode === "duration" ? "Min." : "Todos"
              }}<span v-if="todo.progress.mode === 'count'">
                · mind. {{ todo.progress.knownDurationMinutes }} Min.
                geschätzt</span
              >
            </p>
          </div>
          <div class="actions">
            <ItemPlayButton
              kind="todo"
              :target-id="todo.id"
              :title="todo.title"
              :duration="todo.plannedDurationMinutes"
              :eligible="!todo.completed"
              :disabled="busy"
            /><button
              type="button"
              :disabled="busy"
              :aria-label="`Kind zu ${todo.title} anlegen`"
              @click="open('create', todo)"
            >
              ＋ Kind</button
            ><button
              type="button"
              :disabled="busy"
              :aria-label="`${todo.title} verschieben`"
              @click="open('move', todo)"
            >
              Verschieben</button
            ><button
              type="button"
              :disabled="busy"
              data-edit-button
              :aria-label="`${todo.title} bearbeiten`"
              @click="open('edit', todo)"
            >
              Bearbeiten</button
            ><button
              type="button"
              :disabled="busy"
              :aria-label="`${todo.title} mit Teilbaum löschen`"
              @click="requestDelete(todo)"
            >
              Löschen
            </button>
          </div>
        </li>
      </ul>
      <div
        class="root-target"
        :class="{ over: dropTarget === null }"
        @dragover.prevent="dropTarget = null"
        @dragleave="dropTarget = undefined"
        @drop="drop($event, null)"
      >
        Ohne Parent · Teilbaum hier auf Wurzelebene ablegen. Alternativ:
        „Verschieben“.
      </div>
    </template>
    <ModalDialog
      v-if="action"
      :title="
        action === 'create'
          ? selected
            ? 'Kind anlegen'
            : 'Todo anlegen'
          : action === 'move'
            ? 'Teilbaum verschieben'
            : action === 'delete'
              ? 'Teilbaum löschen'
              : 'Todo bearbeiten'
      "
      :busy="busy"
      :return-focus="listFocus.returnFocus"
      :focus-selector="
        action === 'move'
          ? 'select'
          : action === 'delete'
            ? '[data-cancel-delete]'
            : 'input[name=title]'
      "
      @close="close"
    >
      <p v-if="error" role="alert">{{ error }}</p>
      <template v-if="action === 'create'"
        ><p v-if="selected">Unter „{{ selected.title }}“</p>
        <CreateTodoForm
          embedded
          :parent-id="selected?.id ?? null"
          @busy="formBusy = $event"
          @created="created"
      /></template>
      <form
        v-else-if="action === 'move'"
        @submit.prevent="
          selected && move(selected, parent === '' ? null : Number(parent))
        "
      >
        <label for="new-parent">Verschiebe „{{ selected?.title }}“ unter</label
        ><select id="new-parent" v-model="parent" :disabled="busy">
          <option value="">Ohne Parent · Wurzel</option>
          <option
            v-for="todo in parentOptions"
            :key="todo.id"
            :value="String(todo.id)"
          >
            {{ todo.title }} (#{{ todo.id }})
          </option>
        </select>
        <p>
          Der gesamte Teilbaum wird verschoben. Eigene Termine und Timer bleiben
          erhalten.
        </p>
        <button type="submit" :disabled="busy">Verschieben</button>
      </form>
      <PlannerItemEditor
        v-else-if="action === 'edit' && selected"
        kind="todo"
        :entity-id="selected.id"
        embedded
        @busy="formBusy = $event"
        @changed="changed"
        @close="close"
      />
      <template v-else-if="action === 'delete' && preview"
        ><TodoDeletionSummary :preview="preview" />
        <div class="delete-actions">
          <button
            data-cancel-delete
            type="button"
            :disabled="busy"
            @click="close"
          >
            Nicht löschen</button
          ><button type="button" :disabled="busy" @click="confirmDelete">
            Ja, Teilbaum löschen
          </button>
        </div></template
      >
    </ModalDialog>
  </main>
</template>
<style scoped>
.hierarchy {
  max-width: 1120px;
  margin: auto;
  padding: 32px 24px 120px;
}
.heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.heading h1 {
  margin: 0;
  font-size: 28px;
}
.heading p,
.hint {
  color: #566176;
}
.hierarchy button,
.hierarchy select {
  font: inherit;
  color: #182033;
  background: white;
  border: 1px solid #ccd2dc;
  border-radius: 8px;
  min-height: 44px;
  padding: 8px 12px;
  cursor: pointer;
}
.hierarchy button:focus-visible,
.hierarchy select:focus-visible {
  outline: 3px solid #5687dd;
  outline-offset: 2px;
}
.hierarchy button:disabled {
  opacity: 0.5;
  cursor: default;
}
.tree {
  list-style: none;
  padding: 0;
  background: white;
  border: 1px solid #d9dee7;
  border-radius: 12px;
  overflow: hidden;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid #d9dee7;
  padding: 16px 16px 16px calc(16px + var(--indent) * 24px);
}
.row:last-child {
  border: 0;
}
.row.over,
.root-target.over {
  outline: 3px dashed #2457c5;
  outline-offset: -3px;
}
.collapse {
  width: 44px;
  flex-shrink: 0;
}
.row input[type="checkbox"] {
  width: 24px;
  height: 24px;
  margin: 10px 0;
  flex-shrink: 0;
  accent-color: #2457c5;
}
.content {
  flex: 1;
  min-width: 0;
}
.content h2 {
  font-size: 17px;
  margin: 0;
  overflow-wrap: anywhere;
}
.done {
  text-decoration: line-through;
  color: #566176;
}
.meta {
  font-size: 14px;
  color: #566176;
  margin: 4px 0;
  overflow-wrap: anywhere;
}
.content progress {
  display: block;
  width: min(200px, 100%);
  height: 8px;
  accent-color: #2457c5;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  max-width: 270px;
}
.actions button {
  font-size: 14px;
}
.root-target {
  padding: 16px;
  background: #edf2fc;
  border-radius: 8px;
  color: #334361;
}
.hierarchy [role="alert"] {
  color: #a62828;
}
.hierarchy [role="status"] {
  color: #146c43;
}
.hierarchy select {
  width: 100%;
  margin: 8px 0;
}
.delete-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
@media (max-width: 700px) {
  .hierarchy {
    padding: 24px 12px 120px;
  }
  .row {
    gap: 8px;
    flex-wrap: wrap;
    padding: 12px 8px 12px calc(8px + var(--indent) * 8px);
  }
  .content {
    flex-basis: calc(100% - 92px);
  }
  .actions {
    margin-left: 60px;
    justify-content: flex-start;
    max-width: none;
  }
  .heading {
    flex-wrap: wrap;
  }
  .hint {
    font-size: 14px;
  }
}
</style>
