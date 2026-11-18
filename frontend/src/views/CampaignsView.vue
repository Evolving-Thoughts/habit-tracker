<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import { getQuestHours } from "../api/quest-hours.api";
import { updateTodo, updateTodoCompletion } from "../api/day-planner.api";
import { getCategories } from "../api/categories.api";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import { whyBelow } from "../utils/why";
import {
  hierarchyChildren,
  visibleHierarchy,
  descendantIds,
} from "../utils/todo-hierarchy";
import AppIcon from "../components/AppIcon.vue";
import CreateButton from "../components/CreateButton.vue";
import ModalDialog from "../components/ModalDialog.vue";
import CreateTodoForm from "../components/CreateTodoForm.vue";
import PlannerItemEditor from "../components/PlannerItemEditor.vue";
import GoalBurnup from "../components/GoalBurnup.vue";
import TodoDeletionSummary from "../components/TodoDeletionSummary.vue";
import CampaignTiles from "../components/CampaignTiles.vue";
import QuestTrend from "../components/QuestTrend.vue";
import { useListFocus } from "../composables/useListFocus";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import { useTodoDeletion } from "../composables/useTodoDeletion";
import { useTimer } from "../composables/useTimer";
import { campaignMark, categoryMark } from "../utils/category-mark";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  weekStart,
} from "../utils/date";
import { formatDuration } from "../utils/today-agenda";
import { againstTarget, campaignTiles } from "../utils/quest-hours";
import type { QuestHoursResponse } from "../types/quest-hours";
const page = ref<HTMLElement | null>(null),
  listFocus = useListFocus(page);
const collapsed = ref(new Set<number>());
const saving = ref(false),
  error = ref<string | null>(""),
  success = ref("");
const action = ref<"create" | "move" | "edit" | "delete" | null>(null),
  selected = ref<HierarchyTodo | null>(null);
const formBusy = ref(false),
  parent = ref("");
const burnupTodo = ref<HierarchyTodo | null>(null);
const menuFor = ref<number | null>(null);
const categoryNames = ref(new Map<number, string>());
const timer = useTimer();
const {
  preview,
  prepare: prepareDeletion,
  confirm: confirmPreviewedDeletion,
  cancel: cancelDeletion,
} = useTodoDeletion();
const dragged = ref<number | null>(null),
  dropTarget = ref<number | null | undefined>(undefined);
const busy = computed(() => saving.value || formBusy.value || writing.value);
// Refreshes after timer and other views' changes, unless a dialog is open.
const {
  data: todos,
  isLoading: loading,
  errorMessage: loadError,
  reload: load,
} = useLoader(getTodoHierarchy, {
  initial: [] as HierarchyTodo[],
  fallbackError: "Quests konnten nicht geladen werden.",
  refreshOnChange: () =>
    !busy.value && action.value === null && burnupTodo.value === null,
});
// The tiles' numbers; without them the tiles still open their campaign.
const { data: questHours, reload: loadQuestHours } =
  useLoader<QuestHoursResponse | null>(
    (signal) => getQuestHours(weekStart(getCurrentDateInTimeZone()), signal),
    {
      initial: null,
      fallbackError: "Quest-Stunden konnten nicht geladen werden.",
      refreshOnChange: () =>
        !busy.value && action.value === null && burnupTodo.value === null,
    },
  );
const { write, applied, busy: writing } = useWrites(
  async (showPageLoading) => {
    await Promise.all([load(showPageLoading), loadQuestHours(false)]);
  },
  error,
);
const shownError = computed(() => error.value || loadError.value || "");
const tiles = computed(() => campaignTiles(todos.value, questHours.value));
const trendStarts = computed(
  () => questHours.value?.weeks.map((week) => week.startDate) ?? [],
);

/* The open campaign lives in the address (#/kampagnen?kampagne=…), so Back closes it. */
const route = useRoute();
const router = useRouter();
const openTile = computed(() => {
  const id = Number(route.query.kampagne);
  return tiles.value.find((tile) => tile.todo.id === id) ?? null;
});
const openMark = computed(() =>
  openTile.value
    ? campaignMark({
        title: openTile.value.todo.title,
        color: openTile.value.color,
      })!
    : "",
);
async function openCampaign(id: number) {
  await router.push({ query: { kampagne: String(id) } });
  await nextTick();
  page.value?.querySelector<HTMLElement>("#campaign-detail-title")?.focus();
}
async function closeCampaign() {
  const id = openTile.value?.todo.id;
  await router.push({ query: {} });
  await nextTick();
  page.value
    ?.querySelector<HTMLElement>(`[data-campaign-tile="${id}"] button`)
    ?.focus();
}
const rows = computed(() => {
  if (!openTile.value) return visibleHierarchy(todos.value, collapsed.value);
  const inside = descendantIds(todos.value, openTile.value.todo.id);
  return visibleHierarchy(
    todos.value.filter((todo) => inside.has(todo.id)),
    collapsed.value,
  );
});
const children = computed(() => hierarchyChildren(todos.value));
const titles = computed(
  () => new Map(todos.value.map((todo) => [todo.id, todo.title])),
);
const parentOptions = computed(() => {
  const excluded = selected.value
    ? descendantIds(todos.value, selected.value.id)
    : new Set<number>();
  return todos.value.filter((t) => !excluded.has(t.id));
});
// Category names only decorate the meta line, so a failure stays silent.
onMounted(async () => {
  try {
    const categories = await getCategories();
    categoryNames.value = new Map(categories.map((c) => [c.id, c.name]));
  } catch {
    categoryNames.value = new Map();
  }
});
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && menuFor.value !== null) closeMenu();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onUnmounted(() => window.removeEventListener("keydown", onKeydown));

function shortDate(isoDate: string) {
  return formatDateForGermanDisplay(isoDate).slice(0, 6);
}
function details(todo: HierarchyTodo): string[] {
  const parts: string[] = [];
  if (todo.plannedDurationMinutes != null)
    parts.push(`${todo.plannedDurationMinutes} Min.`);
  if (todo.scheduledDate)
    parts.push(
      todo.timeOfDay
        ? `${shortDate(todo.scheduledDate)}, ${todo.timeOfDay} Uhr`
        : shortDate(todo.scheduledDate),
    );
  if (todo.periodStart && todo.periodEnd)
    parts.push(`${shortDate(todo.periodStart)}–${shortDate(todo.periodEnd)}`);
  if (todo.habitGoal)
    parts.push(
      `${todo.habitGoal.habitTitle} ${todo.habitGoal.completed}/${todo.habitGoal.target}${todo.habitGoal.reached ? ", erreicht" : ""}`,
    );
  return parts;
}
function progressText(todo: HierarchyTodo) {
  const { completed, total, mode } = todo.progress;
  return mode === "duration"
    ? `${completed}/${total} Min.`
    : `${completed}/${total}`;
}

// Timer entry in the menu follows the same rules as ItemPlayButton.
function timerActive(todo: HierarchyTodo) {
  const current = timer?.timer.value;
  return current?.kind === "todo" && current.targetId === todo.id;
}
function timerLabel(todo: HierarchyTodo) {
  return timerActive(todo)
    ? `Timer für ${todo.title} ist bereits aktiv`
    : !todo.timerEligible
      ? `Timer für ${todo.title}: keine offene fällige Ausführung`
      : `Timer für ${todo.title} starten`;
}
function timerDisabled(todo: HierarchyTodo) {
  return (
    busy.value ||
    !todo.timerEligible ||
    timerActive(todo) ||
    Boolean(timer?.busy.value)
  );
}
function startTimer(todo: HierarchyTodo) {
  closeMenu();
  if (timer)
    void timer.start({ kind: "todo", targetId: todo.id, title: todo.title });
}

function menuItems() {
  return Array.from(
    page.value?.querySelectorAll<HTMLElement>(
      `#todo-menu-${menuFor.value} [role=menuitem]:not(:disabled)`,
    ) ?? [],
  );
}
async function toggleMenu(id: number) {
  if (menuFor.value === id) return closeMenu();
  menuFor.value = id;
  await nextTick();
  menuItems()[0]?.focus();
}
function closeMenu({ restoreFocus = true } = {}) {
  const id = menuFor.value;
  menuFor.value = null;
  if (restoreFocus && id !== null)
    void nextTick(() =>
      page.value
        ?.querySelector<HTMLElement>(`[data-menu-trigger="${id}"]`)
        ?.focus(),
    );
}
function moveMenuFocus(event: KeyboardEvent) {
  const items = menuItems();
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (event.key === "ArrowDown") items[(index + 1) % items.length]?.focus();
  else if (event.key === "ArrowUp")
    items[(index - 1 + items.length) % items.length]?.focus();
  else if (event.key === "Home") items[0]?.focus();
  else if (event.key === "End") items[items.length - 1]?.focus();
  else if (event.key === "Tab") return closeMenu({ restoreFocus: false });
  else return;
  event.preventDefault();
}
/** Menu entries hand focus to the dialog, which returns it to the row. */
function fromMenu(fn: () => void) {
  closeMenu({ restoreFocus: false });
  fn();
}

function message(e: unknown) {
  return e instanceof Error ? e.message : "Änderung fehlgeschlagen.";
}
function close() {
  if (!busy.value) {
    action.value = null;
    selected.value = null;
    cancelDeletion();
  }
}
async function run(
  fn: () => Promise<unknown>,
  text: string,
  { notify = true } = {},
) {
  if (busy.value) return;
  const activeLabel = document.activeElement?.getAttribute("aria-label");
  const hadDialog = action.value !== null;
  success.value = "";
  const done = await write(fn, {
    fallbackError: "Änderung fehlgeschlagen.",
    ...(notify ? {} : { notify: null }),
  });
  if (done && !loadError.value) {
    success.value = text;
    action.value = null;
    selected.value = null;
  }
  await nextTick();
  if (!hadDialog && activeLabel)
    page.value?.querySelectorAll<HTMLElement>("[aria-label]").forEach((el) => {
      if (el.getAttribute("aria-label") === activeLabel) el.focus();
    });
}
// The ring fills on tap; the reload afterwards confirms or resets it.
const pendingCompletion = ref(new Map<number, boolean>());
function checked(todo: HierarchyTodo) {
  return pendingCompletion.value.get(todo.id) ?? todo.completed;
}
async function toggleCompletion(todo: HierarchyTodo) {
  if (busy.value) return;
  const next = !checked(todo);
  pendingCompletion.value = new Map(pendingCompletion.value).set(todo.id, next);
  try {
    await run(
      () => updateTodoCompletion(todo.id, next),
      "Erledigung gespeichert.",
    );
  } finally {
    const rest = new Map(pendingCompletion.value);
    rest.delete(todo.id);
    pendingCompletion.value = rest;
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
function showProgress(todo: HierarchyTodo) {
  listFocus.remember(`todo-${todo.id}`);
  burnupTodo.value = todo;
}
async function created() {
  formBusy.value = false;
  if (selected.value) {
    const next = new Set(collapsed.value);
    next.delete(selected.value.id);
    collapsed.value = next;
  }
  await applied();
  action.value = null;
  selected.value = null;
  success.value = "Quest angelegt.";
}
async function changed() {
  formBusy.value = false;
  await applied();
  action.value = null;
  selected.value = null;
  success.value = "Änderungen gespeichert.";
}
function move(todo: HierarchyTodo, target: number | null) {
  return run(
    () => updateTodo(todo.id, { parentId: target }),
    "Quest verschoben.",
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
  menuFor.value = null;
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
    await prepareDeletion(todo.id);
    action.value = "delete";
  } catch (e) {
    error.value = message(e);
  } finally {
    saving.value = false;
  }
}
async function confirmDelete() {
  if (!selected.value || !preview.value) return;
  // confirm() announces the change itself.
  await run(
    confirmPreviewedDeletion,
    "Gelöscht. Das Logbuch bleibt erhalten.",
    {
      notify: false,
    },
  );
  if (error.value) action.value = null;
}
</script>
<template>
  <main ref="page" class="page hierarchy">
    <CreateButton
      label="Neue Kampagne"
      :disabled="busy"
      @click="open('create')"
    />
    <header class="page-header">
      <h1 class="page-title">Kampagnen</h1>
      <p class="page-lead">Kampagnen, Questreihen und ihre Quests.</p>
    </header>
    <div v-if="shownError" class="alert" role="alert">
      <p>{{ shownError }}</p>
      <button
        v-if="!action"
        class="btn btn--ground"
        type="button"
        :disabled="busy"
        @click="load()"
      >
        <AppIcon name="refresh" />Erneut versuchen
      </button>
    </div>
    <p v-if="success" class="status-line" role="status">{{ success }}</p>
    <ModalDialog
      v-if="burnupTodo"
      title="Fortschritt der Kampagne"
      focus-selector="button"
      :return-focus="listFocus.returnFocus"
      @close="burnupTodo = null"
    >
      <p class="burnup-goal">{{ burnupTodo.title }}</p>
      <GoalBurnup :todo-id="burnupTodo.id" />
    </ModalDialog>
    <div
      v-if="loading"
      class="skeleton"
      role="status"
      aria-label="Quests werden geladen"
    >
      <span /><span /><span />
    </div>
    <div v-else-if="!todos.length && !shownError" class="empty-state">
      <strong>Noch keine Kampagnen.</strong>
      <span>Leg mit dem Plus-Button die erste an.</span>
    </div>
    <template v-else-if="todos.length">
      <template v-if="openTile">
        <button
          class="btn btn--quiet campaign-back"
          type="button"
          @click="closeCampaign"
        >
          <AppIcon name="chevron-left" />Alle Kampagnen
        </button>
        <section
          class="card campaign-detail"
          :style="{ '--mark': openMark }"
          aria-labelledby="campaign-detail-title"
        >
          <div class="campaign-detail__head">
            <span class="campaign-detail__badge" aria-hidden="true">
              <AppIcon :name="openTile.icon ?? 'campaigns'" />
            </span>
            <h2 id="campaign-detail-title" tabindex="-1">
              {{ openTile.todo.title }}
            </h2>
          </div>
          <template v-if="questHours">
            <p class="campaign-detail__week">
              <strong>{{
                againstTarget(openTile.minutes, openTile.weeklyTargetMinutes)
              }}</strong>
              Quest-Stunden diese Woche · insgesamt
              {{ formatDuration(openTile.totalMinutes) }}
            </p>
            <QuestTrend
              class="campaign-detail__trend"
              :weeks="openTile.weeks"
              :starts="trendStarts"
              :mark="openMark"
            />
          </template>
          <div
            v-if="children.get(openTile.todo.id)?.length"
            class="row__progress"
          >
            <span
              class="row__bar"
              role="progressbar"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-valuenow="Math.round(openTile.todo.progress.percentage)"
              :aria-valuetext="`${progressText(openTile.todo)} erledigt`"
              :aria-label="`Fortschritt von ${openTile.todo.title}`"
            >
              <span
                :style="{
                  width: `${Math.min(100, Math.max(0, openTile.todo.progress.percentage))}%`,
                }"
              />
            </span>
            <span class="row__count">{{ progressText(openTile.todo) }}</span>
          </div>
          <GoalBurnup :todo-id="openTile.todo.id" />
          <button
            class="btn campaign-detail__edit"
            type="button"
            :disabled="busy"
            :aria-label="`Kampagne ${openTile.todo.title} bearbeiten`"
            @click="open('edit', openTile.todo)"
          >
            <AppIcon name="edit" />Bearbeiten
          </button>
        </section>
        <h2 class="section-title">Quests der Kampagne</h2>
      </template>
      <template v-else>
        <CampaignTiles
          :tiles="tiles"
          :starts="trendStarts"
          :counted="questHours !== null"
          @open="openCampaign"
        />
        <h2 class="section-title">Alle Quests</h2>
      </template>
      <ul class="tree" aria-label="Kampagnen">
        <li
          v-for="{ todo, depth } in rows"
          :key="todo.id"
          class="row"
          :class="{
            'row--over': dropTarget === todo.id,
            'row--done': checked(todo),
            'row--nested': depth > 0,
          }"
          :style="{ '--indent': Math.min(depth, 6) }"
          :data-todo-id="todo.id"
          :data-depth="depth"
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
            v-if="children.get(todo.id)?.length"
            type="button"
            class="btn btn--quiet btn--icon row__expander"
            :class="{ 'row__expander--closed': collapsed.has(todo.id) }"
            :aria-label="`${todo.title} ${collapsed.has(todo.id) ? 'ausklappen' : 'einklappen'}`"
            :aria-expanded="!collapsed.has(todo.id)"
            @click="toggleCollapse(todo.id)"
          >
            <AppIcon name="chevron-down" />
          </button>
          <span v-else class="row__spacer" aria-hidden="true" />
          <button
            type="button"
            role="checkbox"
            class="row__check"
            :aria-checked="checked(todo)"
            :disabled="busy"
            :aria-label="`${todo.title} als eigene Quest erledigen`"
            @click="toggleCompletion(todo)"
          >
            <span class="row__ring">
              <AppIcon v-if="checked(todo)" name="check" />
            </span>
          </button>
          <div class="row__content">
            <h2 :aria-label="todo.title">
              <button
                class="row__title"
                type="button"
                data-edit-button
                :disabled="busy"
                :aria-label="`${todo.title} bearbeiten`"
                @click="open('edit', todo)"
              >
                {{ todo.title }}
              </button>
            </h2>
            <span v-if="todo.parentId !== null" class="visually-hidden">
              Gehört zu „{{ titles.get(todo.parentId) }}“
            </span>
            <p
              v-if="
                (todo.categoryId !== null &&
                  categoryNames.has(todo.categoryId)) ||
                details(todo).length
              "
              class="row__meta"
            >
              <span
                v-if="
                  todo.categoryId !== null && categoryNames.has(todo.categoryId)
                "
                class="row__category"
              >
                <i
                  class="category-mark"
                  :style="{
                    background: categoryMark(
                      categoryNames.get(todo.categoryId)!,
                    ),
                  }"
                  aria-hidden="true"
                />{{ categoryNames.get(todo.categoryId) }}
              </span>
              <span v-for="part in details(todo)" :key="part">{{ part }}</span>
            </p>
            <p v-if="todo.why" class="row__why">{{ todo.why }}</p>
            <div v-if="children.get(todo.id)?.length" class="row__progress">
              <span
                class="row__bar"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="Math.round(todo.progress.percentage)"
                :aria-valuetext="`${progressText(todo)} erledigt`"
                :aria-label="`Fortschritt darunter für ${todo.title}`"
              >
                <span
                  :style="{
                    width: `${Math.min(100, Math.max(0, todo.progress.percentage))}%`,
                  }"
                />
              </span>
              <span class="row__count">{{ progressText(todo) }}</span>
            </div>
          </div>
          <div class="row__more">
            <button
              type="button"
              class="btn btn--quiet btn--icon"
              aria-haspopup="menu"
              :aria-expanded="menuFor === todo.id"
              :aria-controls="`todo-menu-${todo.id}`"
              :aria-label="`Aktionen für ${todo.title}`"
              :data-menu-trigger="todo.id"
              :disabled="busy"
              @click="toggleMenu(todo.id)"
            >
              <AppIcon name="more" />
            </button>
            <template v-if="menuFor === todo.id">
              <div class="menu-scrim" aria-hidden="true" @click="closeMenu()" />
              <div class="menu">
                <p :id="`todo-menu-title-${todo.id}`" class="menu__title">
                  {{ todo.title }}
                </p>
                <div
                  :id="`todo-menu-${todo.id}`"
                  class="menu__list"
                  role="menu"
                  :aria-labelledby="`todo-menu-title-${todo.id}`"
                  @keydown="moveMenuFocus"
                >
                  <button
                    type="button"
                    role="menuitem"
                    class="btn btn--quiet menu__item"
                    :disabled="timerDisabled(todo)"
                    :aria-label="timerLabel(todo)"
                    @click="startTimer(todo)"
                  >
                    <AppIcon name="timer" />Timer starten
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="btn btn--quiet menu__item"
                    :disabled="busy"
                    :aria-label="`Unter-Quest zu ${todo.title} hinzufügen`"
                    @click="fromMenu(() => open('create', todo))"
                  >
                    <AppIcon name="child" />Unter-Quest hinzufügen
                  </button>
                  <button
                    v-if="todo.parentId === null"
                    type="button"
                    role="menuitem"
                    class="btn btn--quiet menu__item"
                    :disabled="busy"
                    :aria-label="`Fortschritt von ${todo.title} anzeigen`"
                    @click="fromMenu(() => showProgress(todo))"
                  >
                    <AppIcon name="chart" />Fortschritt anzeigen
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="btn btn--quiet menu__item"
                    :disabled="busy"
                    :aria-label="`${todo.title} verschieben`"
                    @click="fromMenu(() => open('move', todo))"
                  >
                    <AppIcon name="move" />Verschieben
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    class="btn btn--quiet menu__item menu__item--danger"
                    :disabled="busy"
                    :aria-label="`${todo.title} mit allen Unter-Quests löschen`"
                    @click="fromMenu(() => requestDelete(todo))"
                  >
                    <AppIcon name="trash" />Löschen
                  </button>
                </div>
              </div>
            </template>
          </div>
        </li>
      </ul>
      <div
        v-if="dragged !== null"
        class="root-target"
        :class="{ 'root-target--over': dropTarget === null }"
        @dragover.prevent="dropTarget = null"
        @dragleave="dropTarget = undefined"
        @drop="drop($event, null)"
      >
        Hier ablegen, um daraus eine eigene Kampagne zu machen.
      </div>
    </template>
    <ModalDialog
      v-if="action"
      :title="
        action === 'create'
          ? selected
            ? 'Unter-Quest hinzufügen'
            : 'Neue Kampagne'
          : action === 'move'
            ? 'Quest verschieben'
            : action === 'delete'
              ? 'Quest löschen'
              : 'Quest bearbeiten'
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
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <template v-if="action === 'create'"
        ><p v-if="selected" class="dialog-lead">Unter „{{ selected.title }}“</p>
        <CreateTodoForm
          embedded
          :parent-id="selected?.id ?? null"
          :parent-why="selected ? whyBelow(selected) : null"
          :campaign="!selected"
          @busy="formBusy = $event"
          @created="created"
      /></template>
      <form
        v-else-if="action === 'move'"
        class="move-form"
        @submit.prevent="
          selected && move(selected, parent === '' ? null : Number(parent))
        "
      >
        <label class="field" for="new-parent"
          >Neuer Platz für „{{ selected?.title }}“
          <select id="new-parent" v-model="parent" :disabled="busy">
            <option value="">Eigene Kampagne</option>
            <option
              v-for="todo in parentOptions"
              :key="todo.id"
              :value="String(todo.id)"
            >
              Unter „{{ todo.title }}“
            </option>
          </select></label
        >
        <p class="dialog-lead">
          Alle Unter-Quests ziehen mit. Termine und Timer bleiben erhalten.
        </p>
        <button class="btn btn--primary" type="submit" :disabled="busy">
          Verschieben
        </button>
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
            class="btn"
            type="button"
            :disabled="busy"
            @click="close"
          >
            Nicht löschen</button
          ><button
            class="btn btn--danger"
            type="button"
            :disabled="busy"
            @click="confirmDelete"
          >
            Ja, löschen
          </button>
        </div></template
      >
    </ModalDialog>
  </main>
</template>
<style scoped>
.status-line {
  margin: 0 0 var(--space-3);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.alert {
  margin-bottom: var(--space-4);
}

.tree {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  position: relative;
  display: grid;
  grid-template-columns: var(--tap) var(--tap) minmax(0, 1fr) var(--tap);
  gap: var(--space-1);
  align-items: start;
  margin-left: calc(var(--indent) * 1rem);
  padding: var(--space-2) var(--space-2) var(--space-3) var(--space-1);
  border-radius: var(--radius-card);
  background: var(--color-surface);
}

/* A thin guide joins each sub-task to the row above. */
.row--nested::before {
  position: absolute;
  top: calc(-1 * var(--space-2));
  bottom: var(--space-4);
  left: -0.5rem;
  width: 1px;
  background: var(--color-line);
  content: "";
}

.row--over,
.root-target--over {
  outline: 2px dashed var(--color-ink-muted);
  outline-offset: 2px;
}

.row__spacer {
  width: var(--tap);
}

.row__expander :deep(svg) {
  transition: transform 240ms var(--ease-out);
}

.row__expander--closed :deep(svg) {
  transform: rotate(-90deg);
}

.row__check {
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

.row__check:active:not(:disabled) {
  transform: scale(0.86);
  transition-duration: 90ms;
}

.row__ring {
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

.row__ring :deep(svg) {
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

.row--done .row__ring {
  background: var(--color-action);
}

.row__check:disabled {
  cursor: progress;
}

.row__check:disabled .row__ring {
  border-color: var(--color-ink-soft);
}

.row--done .row__check:disabled .row__ring {
  background: var(--color-ink-soft);
}

.row__content {
  min-width: 0;
  padding-top: 0.55rem;
}

.row__content h2 {
  margin: 0;
  color: var(--color-ink);
  font-size: 1.0625rem;
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.row--done h2 {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.row__title {
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

.row__title:hover:not(:disabled) {
  text-decoration-color: var(--color-line);
}

.row__title:disabled {
  cursor: progress;
}

.row__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.row__category {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
}

.category-mark {
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

.row__why {
  margin: 0.15rem 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  overflow-wrap: anywhere;
}

.row__progress {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-2);
}

.row__bar {
  flex: 1;
  height: 0.375rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.row__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
  transition: width 240ms var(--ease-out);
}

.row__count {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.row__more {
  position: relative;
}

.menu-scrim {
  position: fixed;
  inset: 0;
  z-index: 35;
}

/* Mehr-Menü: a white popover next to the button, a bottom sheet on phones. */
.menu {
  position: fixed;
  inset: auto 0 0;
  z-index: 40;
  display: grid;
  gap: var(--space-1);
  padding: var(--space-3) var(--space-3)
    calc(var(--space-3) + env(safe-area-inset-bottom, 0px));
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  background: var(--color-surface);
  box-shadow:
    var(--shadow-card),
    0 12px 32px rgb(107 50 18 / 16%);
}

@media (max-width: 39.99rem) {
  .menu-scrim {
    background: rgb(43 29 22 / 18%);
  }
}

.menu__title {
  margin: 0;
  padding: var(--space-1) var(--space-3) var(--space-2);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.menu__list {
  display: grid;
  gap: var(--space-1);
}

.menu__item {
  justify-content: flex-start;
  width: 100%;
  color: var(--color-ink);
}

.menu__item:disabled {
  color: var(--color-ink-soft);
}

.menu__item--danger {
  position: relative;
  margin-top: var(--space-2);
}

.menu__item--danger:not(:disabled) {
  color: var(--color-ink);
}

.menu__item--danger::before {
  position: absolute;
  top: calc(-1 * var(--space-1) - 1px);
  right: var(--space-2);
  left: var(--space-2);
  height: 1px;
  background: var(--color-line);
  content: "";
}

@media (min-width: 40rem) {
  .menu {
    position: absolute;
    inset: calc(100% + var(--space-1)) 0 auto auto;
    min-width: 15rem;
    padding: var(--space-2);
    border-radius: var(--radius-card);
  }
}

.root-target {
  margin-top: var(--space-3);
  padding: var(--space-4);
  border: 1.5px dashed var(--color-line);
  border-radius: var(--radius-card);
  color: var(--color-ink-muted);
  font-weight: 700;
}

.campaign-back {
  margin: 0 0 var(--space-3) calc(var(--space-2) * -1);
}

.campaign-detail {
  display: grid;
  gap: var(--space-3);
  padding-left: calc(var(--space-4) + 0.3125rem);
  box-shadow: inset 0.3125rem 0 0 var(--mark);
}

.campaign-detail p {
  margin: 0;
}

.campaign-detail__head {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-width: 0;
}

.campaign-detail__head h2 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.campaign-detail__badge {
  display: grid;
  flex: none;
  width: var(--tap-large);
  height: var(--tap-large);
  place-items: center;
  border-radius: 50%;
  background: var(--mark);
  color: var(--color-on-action);
}

.campaign-detail__week {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.campaign-detail__week strong {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
}

.campaign-detail__trend {
  max-width: 24rem;
}

.campaign-detail .row__progress {
  margin-top: 0;
}

.campaign-detail__edit {
  justify-self: start;
}

.burnup-goal {
  margin: 0 0 var(--space-3);
  font-weight: 800;
  overflow-wrap: anywhere;
}

.dialog-lead {
  margin: 0;
  color: var(--color-ink-muted);
}

.move-form {
  display: grid;
  gap: var(--space-3);
  justify-items: start;
}

.move-form .field {
  width: 100%;
}

.delete-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
