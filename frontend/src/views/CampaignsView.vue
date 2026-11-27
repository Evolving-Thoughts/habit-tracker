<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import { getQuestHours } from "../api/quest-hours.api";
import { updateTodo } from "../api/day-planner.api";
import type { HierarchyTodo, TodoProgress } from "../types/todo-hierarchy";
import type { TodoResponse } from "../types/todo";
import {
  hasProgress,
  hierarchyChildren,
  openBelow,
  progressText,
  progressWords,
  questWord,
  visibleHierarchy,
} from "../utils/todo-hierarchy";
import ActionMenu from "../components/ActionMenu.vue";
import AppIcon from "../components/AppIcon.vue";
import CheckRing from "../components/CheckRing.vue";
import CreateButton from "../components/CreateButton.vue";
import ModalDialog from "../components/ModalDialog.vue";
import CreateTodoForm from "../components/CreateTodoForm.vue";
import PlannerItemEditor from "../components/PlannerItemEditor.vue";
import CampaignMoveDialog from "../components/CampaignMoveDialog.vue";
import DeleteItemDialog from "../components/DeleteItemDialog.vue";
import GoalBurnup from "../components/GoalBurnup.vue";
import CampaignTiles from "../components/CampaignTiles.vue";
import CampaignStats from "../components/CampaignStats.vue";
import CampaignCompletionDialog from "../components/CampaignCompletionDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import QuestTrend from "../components/QuestTrend.vue";
import CampaignBoard from "../components/CampaignBoard.vue";
import { useListFocus } from "../composables/useListFocus";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import { useTicks } from "../composables/useTicks";
import { useTimer } from "../composables/useTimer";
import { useShortcutHandlers } from "../composables/useShortcuts";
import { campaignMark } from "../utils/category-mark";
import { onCardClick } from "../utils/card-click";
import { useCategoryLabels } from "../composables/useCategoryLabels";
import ItemPlayButton from "../components/ItemPlayButton.vue";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  weekStart,
} from "../utils/date";
import { formatDuration } from "../utils/today-agenda";
import { againstTargetParts, campaignTiles } from "../utils/quest-hours";
import { readyToComplete } from "../utils/campaign-next";
import type { QuestHoursResponse } from "../types/quest-hours";
import {
  rowMenu as cardMenu,
  timerStep,
  type MenuEntry,
} from "../utils/row-actions";
const page = ref<HTMLElement | null>(null),
  listFocus = useListFocus(page);
const collapsed = ref(new Set<number>());
const error = ref<string | null>(""),
  success = ref("");
const action = ref<"create" | "move" | "edit" | "delete" | null>(null),
  selected = ref<HierarchyTodo | null>(null);
const formBusy = ref(false);
/** The create dialog was opened by a long press on Plus: dictate the title. */
const dictating = ref(false);
const timer = useTimer();
const dragged = ref<number | null>(null),
  dropTarget = ref<number | null | undefined>(undefined);
const busy = computed(() => formBusy.value || writing.value);
/* Rings, the campaign question and the undo toast: `useTicks`. */
const ticks = useTicks((action, { fallbackError }) =>
  run(action, "", { fallbackError }),
);
const { undo, undoLast } = ticks;
const quiet = () =>
  !busy.value && action.value === null && ticks.campaignQuestion.value === null;
// Refreshes after timer and other views' changes, unless a dialog is open.
const {
  data: todos,
  isLoading: loading,
  errorMessage: loadError,
  reload: load,
} = useLoader(getTodoHierarchy, {
  initial: [] as HierarchyTodo[],
  fallbackError: "Quests konnten nicht geladen werden.",
  refreshOnChange: quiet,
});
// The tiles' numbers; without them the tiles still open their campaign.
const { data: questHours, reload: loadQuestHours } =
  useLoader<QuestHoursResponse | null>(
    (signal) => getQuestHours(weekStart(getCurrentDateInTimeZone()), signal),
    {
      initial: null,
      fallbackError: "Kampagnen-Stunden konnten nicht geladen werden.",
      refreshOnChange: quiet,
    },
  );
const writes = useWrites(async (showPageLoading) => {
  await Promise.all([load(showPageLoading), loadQuestHours(false)]);
}, error);
const { write, applied, busy: writing } = writes;
const shownError = computed(() => error.value || loadError.value || "");
const tiles = computed(() => campaignTiles(todos.value, questHours.value));
const doneCount = computed(
  () => tiles.value.filter((tile) => tile.todo.completed).length,
);
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
/** An opened campaign is the page: its title is the heading, "Alle Kampagnen" above it. */
const campaignOpen = computed(
  () =>
    route.query.kampagne !== undefined &&
    (openTile.value !== null || loading.value),
);
const openMark = computed(() =>
  openTile.value
    ? campaignMark({
        title: openTile.value.todo.title,
        color: openTile.value.color,
      })!
    : "",
);
/** This week against the campaign's goal, for its bar; full when exceeded. */
const weekShare = computed(() => {
  const tile = openTile.value;
  if (!tile?.weeklyTargetMinutes) return 0;
  return Math.min(100, (tile.minutes / tile.weeklyTargetMinutes) * 100);
});
/*
 * "Abschließen" stands as a pill only when nothing is open (no quest, no
 * running daily goal), the tiles' rule; otherwise it waits in the "…".
 * A completed campaign keeps "Wieder öffnen" visible.
 */
const completeVisible = computed(() => {
  const tile = openTile.value;
  if (!tile) return false;
  return checked(tile.todo) || readyToComplete(tile.todo);
});
/** "1 von 3 Quests", with the minutes when the bar counts them. */
function questCount(progress: TodoProgress): string {
  const quests = `${progress.doneCount} von ${progress.todoCount} ${questWord(progress.todoCount)}`;
  return progress.mode === "duration"
    ? `${quests} · ${progress.completed} von ${progress.total} Min.`
    : quests;
}
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
/*
 * The overview holds the tiles only. An opened campaign is its detail card
 * with the tree of the quests below it (it does not repeat itself as a row).
 */
const campaignIds = computed(
  () => new Set(tiles.value.map((tile) => tile.todo.id)),
);
/*
 * Open quests first, in their order; the done ones fold away below under
 * "N erledigt", like in the Questlog. A quest goes with everything below it,
 * so only one whose whole branch is done folds away: a done quest with an
 * open quest below it stays with the open ones, and nothing open hides.
 */
function settled(todo: HierarchyTodo): boolean {
  return (
    todo.completed &&
    (children.value.get(todo.id) ?? []).every((child) => settled(child))
  );
}
const rowsWhere = (completed: boolean, folded = collapsed.value) =>
  openTile.value
    ? visibleHierarchy(todos.value, folded, {
        under: openTile.value.todo.id,
        keepTop: (todo) => settled(todo) === completed,
      })
    : [];
/*
 * "Liste · Board": the quests of an opened campaign as the tree or as the
 * board's four columns, remembered on this device; the list comes first.
 */
type QuestView = "list" | "board";
const VIEW_KEY = "campaign:view";
const VIEWS: { value: QuestView; label: string }[] = [
  { value: "list", label: "Liste" },
  { value: "board", label: "Board" },
];
function storedView(): QuestView {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}
const questView = ref<QuestView>(storedView());
function chooseView(next: QuestView): void {
  questView.value = next;
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    // Without storage the choice lasts until the page is left.
  }
}
const boardShown = computed(
  () => questView.value === "board" && openTile.value !== null,
);
const doneOpen = ref(false);
watch(
  () => openTile.value?.todo.id,
  () => (doneOpen.value = false),
);
const doneQuests = computed(() => rowsWhere(true, new Set()).length);
const lists = computed(() => [
  { key: "open", rows: rowsWhere(false) },
  { key: "done", rows: doneOpen.value ? rowsWhere(true) : [] },
]);
const children = computed(() => hierarchyChildren(todos.value));
const titles = computed(
  () => new Map(todos.value.map((todo) => [todo.id, todo.title])),
);
// Category names only decorate the meta line, so a failure stays silent.
const { load: loadCategories, labelOf } = useCategoryLabels();
onMounted(loadCategories);
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
/** "Aktionen für …" of a row; its ▶ measures, so the menu needs no stopwatch. */
function rowMenu(todo: HierarchyTodo): MenuEntry[] {
  return cardMenu(
    todo.title,
    {
      edit: () => open("edit", todo),
      child: () => open("create", todo),
      reparent: () => open("move", todo),
      remove: {
        run: () => open("delete", todo),
        ariaLabel: `${todo.title} mit allen Unter-Quests löschen`,
      },
    },
    busy.value,
  );
}

/*
 * The opened campaign's "…": what its row offered, now that the detail card
 * stands for it. Its ring becomes "Kampagne abschließen" (asking as the ring
 * did), the card has no ▶, so the stopwatch is an entry, and its progress
 * is already on the card.
 */
function campaignMenu(todo: HierarchyTodo): MenuEntry[] {
  return [
    {
      id: "complete",
      label: checked(todo) ? "Wieder öffnen" : "Kampagne abschließen",
      icon: "check",
      ariaLabel: checked(todo)
        ? `${todo.title} wieder öffnen`
        : `${todo.title} abschließen`,
      disabled: busy.value,
      run: () => void toggleCompletion(todo),
    },
    ...cardMenu(
      todo.title,
      {
        edit: () => open("edit", todo),
        timer: timerStep(
          timer,
          { kind: "todo", targetId: todo.id, title: todo.title },
          todo.timerEligible,
        ),
        child: () => open("create", todo),
        reparent: () => open("move", todo),
        remove: {
          run: () => open("delete", todo),
          ariaLabel: `${todo.title} mit allen Unter-Quests löschen`,
        },
      },
      busy.value,
    ),
  ];
}

/** The card contract: a tap anywhere on a row but its controls edits it. */
function openFromCard(event: MouseEvent, todo: HierarchyTodo): void {
  if (!busy.value) onCardClick(event, () => open("edit", todo));
}

function close() {
  if (!busy.value) {
    action.value = null;
    selected.value = null;
    formBusy.value = false;
  }
}
/** Resolves to whether the write went through. */
async function run(
  fn: () => Promise<unknown>,
  text: string,
  { notify = true, fallbackError = "Änderung fehlgeschlagen." } = {},
): Promise<boolean> {
  if (busy.value) return false;
  const activeLabel = document.activeElement?.getAttribute("aria-label");
  const hadDialog = action.value !== null;
  success.value = "";
  const done = await write(fn, {
    fallbackError,
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
  return done;
}
// The ring fills on tap; the reload afterwards confirms or resets it.
const pendingCompletion = ref(new Map<number, boolean>());
function checked(todo: HierarchyTodo) {
  return pendingCompletion.value.get(todo.id) ?? todo.completed;
}
/* A completion can be taken back in the toast, as on Heute. */
async function toggleCompletion(todo: HierarchyTodo) {
  if (busy.value) return;
  const next = !checked(todo);
  const target = { kind: "todo", id: todo.id, title: todo.title } as const;
  const fallbackError = "Die Quest konnte nicht aktualisiert werden.";
  const fill = () =>
    (pendingCompletion.value = new Map(pendingCompletion.value).set(
      todo.id,
      next,
    ));
  try {
    if (next)
      // A campaign with open quests asks first; they stay open either way.
      await ticks.complete(target, {
        fallbackError,
        campaign: todo.parentId === null ? openBelow(todo.progress) : undefined,
        onConfirmed: fill,
      });
    else {
      fill();
      await ticks.reopen(target, { fallbackError });
    }
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
  kind: "create" | "move" | "edit" | "delete",
  todo: HierarchyTodo | null = null,
) {
  if (busy.value) return;
  if (todo) listFocus.remember(`todo-${todo.id}`);
  selected.value = todo;
  action.value = kind;
  error.value = "";
  formBusy.value = false;
}
async function created(todo: TodoResponse) {
  formBusy.value = false;
  if (selected.value) {
    const next = new Set(collapsed.value);
    next.delete(selected.value.id);
    collapsed.value = next;
  }
  await applied();
  action.value = null;
  selected.value = null;
  // A plain top-level quest is no campaign yet, so it does not show here.
  success.value =
    todo.parentId === null && !campaignIds.value.has(todo.id)
      ? "Quest angelegt. Sie wird zur Kampagne, sobald sie Unter-Quests, eine Farbe, ein Symbol oder ein Wochenziel hat; bis dahin steht sie im Questlog oder an ihrem Tag."
      : "Quest angelegt.";
}
/** At the top, a quest without quests below it (and no look or goal) is no campaign. */
const becomesCampaign = (id: number | null) =>
  id !== null &&
  (campaignIds.value.has(id) || Boolean(children.value.get(id)?.length));
/** A dialog wrote on its own: reload, close it and say what happened. */
async function done(text: string) {
  formBusy.value = false;
  await applied();
  action.value = null;
  selected.value = null;
  success.value = text;
}
const changed = () => done("Änderungen gespeichert.");
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
  dragged.value = id;
  event.dataTransfer?.setData("text/plain", String(id));
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}
/*
 * The plus button and N: a new campaign on the overview; inside a campaign a
 * new quest below it, with its Warum and category taken over.
 */
function create(dictate = false): void {
  open("create", openTile.value?.todo ?? null);
  dictating.value = dictate && action.value === "create";
}
useShortcutHandlers({
  "quest.new": () => {
    if (!busy.value && !action.value) create();
  },
});
</script>
<template>
  <main
    ref="page"
    class="page hierarchy"
    :class="{ 'hierarchy--board': boardShown }"
  >
    <header v-if="!campaignOpen" class="page-header">
      <h1 class="page-title">Kampagnen</h1>
      <p class="page-lead">Deine längerfristigen Ziele und wie weit sie sind.</p>
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
    <div
      v-if="loading"
      class="skeleton"
      role="status"
      aria-label="Quests werden geladen"
    >
      <span /><span /><span />
    </div>
    <template v-else-if="openTile">
        <button
          class="btn btn--quiet campaign-back"
          type="button"
          @click="closeCampaign"
        >
          <AppIcon name="chevron-left" />Alle Kampagnen
        </button>
        <section
          class="card campaign-detail"
          :class="{ 'row--over': dropTarget === openTile.todo.id }"
          :style="{ '--mark': openMark }"
          aria-labelledby="campaign-detail-title"
          :data-focus-key="`todo-${openTile.todo.id}`"
          @dragover.prevent="dropTarget = openTile.todo.id"
          @dragleave="dropTarget = undefined"
          @drop.stop="drop($event, openTile.todo.id)"
        >
          <div class="campaign-detail__head">
            <span class="campaign-detail__badge" aria-hidden="true">
              <AppIcon :name="openTile.icon ?? 'campaigns'" />
            </span>
            <div class="campaign-detail__name">
              <h1 id="campaign-detail-title" tabindex="-1">
                {{ openTile.todo.title }}
              </h1>
              <p v-if="checked(openTile.todo)" class="campaign-detail__state">
                Abgeschlossen
              </p>
            </div>
            <ActionMenu
              :title="openTile.todo.title"
              :entries="campaignMenu(openTile.todo)"
              :disabled="busy"
              :trigger-key="openTile.todo.id"
            />
          </div>
          <!-- Its own reason under its name: what the campaign is for. -->
          <p v-if="openTile.todo.why" class="campaign-detail__why">
            {{ openTile.todo.why }}
          </p>
          <section
            v-if="questHours"
            class="campaign-detail__group"
            aria-labelledby="campaign-week-title"
          >
            <h3 id="campaign-week-title" class="card-title">Diese Woche</h3>
            <!-- Wraps between the figures, never inside one. -->
            <p class="campaign-detail__week">
              <strong
                ><template
                  v-for="(part, index) in againstTargetParts(
                    openTile.minutes,
                    openTile.weeklyTargetMinutes,
                  )"
                  :key="index"
                  >{{ index ? " " : "" }}<span class="campaign-detail__figure">{{
                    part
                  }}</span></template
                ></strong
              >
              Kampagnen-Stunden
            </p>
            <span
              v-if="openTile.weeklyTargetMinutes !== null"
              class="campaign-detail__bar"
              aria-hidden="true"
            >
              <span :style="{ width: `${weekShare}%` }" />
            </span>
            <div class="campaign-detail__trend">
              <p class="campaign-detail__trend-head">
                <span>letzte {{ openTile.weeks.length }} Wochen</span>
                <span class="campaign-detail__figure"
                  >insgesamt {{ formatDuration(openTile.totalMinutes) }}</span
                >
              </p>
              <QuestTrend
                :weeks="openTile.weeks"
                :starts="trendStarts"
                :mark="openMark"
              />
            </div>
          </section>
          <section
            v-if="hasProgress(openTile.todo.progress)"
            class="campaign-detail__group"
            aria-labelledby="campaign-progress-title"
          >
            <h3 id="campaign-progress-title" class="card-title">Fortschritt</h3>
            <p class="campaign-detail__count">
              {{ questCount(openTile.todo.progress) }}
            </p>
            <div class="row__progress">
              <span
                class="row__bar"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="Math.round(openTile.todo.progress.percentage)"
                :aria-valuetext="progressWords(openTile.todo.progress)"
                :aria-label="`Fortschritt von ${openTile.todo.title}`"
              >
                <span
                  :style="{
                    width: `${Math.min(100, Math.max(0, openTile.todo.progress.percentage))}%`,
                  }"
                />
              </span>
            </div>
            <GoalBurnup :todo-id="openTile.todo.id" beside-bar />
          </section>
          <div class="campaign-detail__actions">
            <button
              class="btn"
              type="button"
              data-edit-button
              :disabled="busy"
              :aria-label="`Kampagne ${openTile.todo.title} bearbeiten`"
              @click="open('edit', openTile.todo)"
            >
              <AppIcon name="edit" />Bearbeiten
            </button>
            <button
              v-if="completeVisible"
              class="btn"
              type="button"
              data-complete-button
              :disabled="busy"
              :aria-label="
                checked(openTile.todo)
                  ? `Kampagne ${openTile.todo.title} wieder öffnen`
                  : `Kampagne ${openTile.todo.title} abschließen`
              "
              @click="toggleCompletion(openTile.todo)"
            >
              <AppIcon name="check" />{{
                checked(openTile.todo) ? "Wieder öffnen" : "Abschließen"
              }}
            </button>
          </div>
        </section>
        <div class="quests-head">
          <h2 class="section-title">Quests der Kampagne</h2>
          <div
            class="segmented quests-head__views"
            role="radiogroup"
            aria-label="Quests zeigen als"
          >
            <label v-for="option in VIEWS" :key="option.value">
              <input
                type="radio"
                name="campaignView"
                :value="option.value"
                :checked="questView === option.value"
                @change="chooseView(option.value)"
              />
              {{ option.label }}
            </label>
          </div>
        </div>
        <p v-if="!lists[0]!.rows.length && !doneQuests" class="status-line">
          {{
            boardShown
              ? "Noch keine Quests. Schreib die erste ins To-Do oder nimm den Plus-Button."
              : "Noch keine Quests. Der Plus-Button legt die erste an."
          }}
        </p>
      <CampaignBoard
        v-if="boardShown"
        :todos="todos"
        :campaign="openTile.todo"
        :busy="busy"
        :writes="writes"
        :ticks="ticks"
        @edit="(todo) => open('edit', todo)"
        @reparent="(todo) => open('move', todo)"
        @remove="(todo) => open('delete', todo)"
        @created="applied()"
      />
      <template v-else>
      <template v-for="list in lists" :key="list.key">
      <!-- An h2 like the rows' titles, so no level is skipped. -->
      <h2 v-if="list.key === 'done' && doneQuests" class="done-heading">
        <button
          class="fold-toggle done-toggle"
          type="button"
          :aria-expanded="doneOpen"
          aria-controls="campaign-done-list"
          @click="doneOpen = !doneOpen"
        >
          {{ doneQuests }} erledigt
          <AppIcon name="chevron" />
        </button>
      </h2>
      <ul
        v-if="list.rows.length"
        :id="list.key === 'done' ? 'campaign-done-list' : undefined"
        class="tree"
        :aria-label="list.key === 'done' ? 'Erledigte Quests der Kampagne' : 'Quests der Kampagne'"
      >
        <li
          v-for="{ todo, depth } in list.rows"
          :key="todo.id"
          class="row card-target"
          :class="{
            'row--over': dropTarget === todo.id,
            'row--done': checked(todo),
            'row--nested': depth > 0,
            'row--leaf': !children.get(todo.id)?.length,
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
          @click="openFromCard($event, todo)"
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
          <CheckRing
            role="checkbox"
            class="row__check"
            :aria-checked="checked(todo)"
            :checked="checked(todo)"
            :disabled="busy"
            :label="`${todo.title} als eigene Quest erledigen`"
            @toggle="toggleCompletion(todo)"
          />
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
              v-if="labelOf(todo.categoryId) || details(todo).length"
              class="row__meta"
            >
              <span v-if="labelOf(todo.categoryId)" class="row__category">
                <i
                  class="category-mark"
                  :style="{ background: labelOf(todo.categoryId)!.mark }"
                  aria-hidden="true"
                />{{ labelOf(todo.categoryId)!.name }}
              </span>
              <span v-for="part in details(todo)" :key="part">{{ part }}</span>
            </p>
            <p v-if="todo.why" class="row__why">{{ todo.why }}</p>
            <div v-if="hasProgress(todo.progress)" class="row__progress">
              <span
                class="row__bar"
                role="progressbar"
                aria-valuemin="0"
                aria-valuemax="100"
                :aria-valuenow="Math.round(todo.progress.percentage)"
                :aria-valuetext="progressWords(todo.progress)"
                :aria-label="`Fortschritt darunter für ${todo.title}`"
              >
                <span
                  :style="{
                    width: `${Math.min(100, Math.max(0, todo.progress.percentage))}%`,
                  }"
                />
              </span>
              <span class="row__count">{{ progressText(todo.progress) }}</span>
            </div>
          </div>
          <div class="row__end">
            <ItemPlayButton
              v-if="!checked(todo)"
              kind="todo"
              :target-id="todo.id"
              :title="todo.title"
              :eligible="todo.timerEligible"
              :disabled="busy"
            />
            <ActionMenu
              :title="todo.title"
              :entries="rowMenu(todo)"
              :disabled="busy"
              :trigger-key="todo.id"
            />
          </div>
        </li>
      </ul>
      </template>
      <div
        v-if="dragged !== null"
        class="root-target"
        :class="{ 'root-target--over': dropTarget === null }"
        @dragover.prevent="dropTarget = null"
        @dragleave="dropTarget = undefined"
        @drop="drop($event, null)"
      >
        {{
          becomesCampaign(dragged)
            ? "Hier ablegen, um daraus eine eigene Kampagne zu machen."
            : "Hier ablegen, um die Quest aus der Kampagne zu lösen. Sie steht dann im Questlog oder an ihrem Tag."
        }}
      </div>
      </template>
    </template>
    <!-- The overview: the figures, then a tile per campaign; quests live inside a campaign. -->
    <template v-else-if="!loadError">
      <CampaignStats
        class="campaigns-stats"
        :week-minutes="questHours?.questMinutes ?? null"
        :total-minutes="questHours?.totalQuestMinutes ?? null"
        :active="tiles.length - doneCount"
        :done="doneCount"
      />
      <CampaignTiles
        :tiles="tiles"
        :starts="trendStarts"
        :counted="questHours !== null"
        :busy="busy"
        :completed="(tile) => checked(tile.todo)"
        @open="openCampaign"
        @complete="(tile) => toggleCompletion(tile.todo)"
        @edit="(tile) => open('edit', tile.todo)"
        @remove="(tile) => open('delete', tile.todo)"
        @create="create()"
      />
    </template>
    <ModalDialog
      v-if="action === 'create' || action === 'edit'"
      :title="
        action === 'create'
          ? selected
            ? selected.id === openTile?.todo.id
              ? 'Neue Quest'
              : 'Unter-Quest hinzufügen'
            : 'Neue Kampagne'
          : selected && campaignIds.has(selected.id)
            ? 'Kampagne bearbeiten'
            : 'Quest bearbeiten'
      "
      :busy="busy"
      :return-focus="listFocus.returnFocus"
      focus-selector="input[name=title]"
      @close="close"
    >
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <template v-if="action === 'create'"
        ><p v-if="selected" class="dialog-lead">Unter „{{ selected.title }}“</p>
        <CreateTodoForm
          :parent="selected"
          :campaign="!selected"
          :dictate="dictating"
          @busy="formBusy = $event"
          @created="created"
          @cancel="close"
      /></template>
      <PlannerItemEditor
        v-else-if="selected"
        kind="todo"
        :entity-id="selected.id"
        embedded
        @busy="formBusy = $event"
        @changed="changed"
        @close="close"
      />
    </ModalDialog>
    <CampaignMoveDialog
      v-if="action === 'move' && selected"
      :todo-id="selected.id"
      :title="selected.title"
      :return-focus="listFocus.returnFocus"
      @busy="formBusy = $event"
      @moved="done('Quest verschoben.')"
      @close="close"
    />
    <DeleteItemDialog
      v-if="action === 'delete' && selected"
      :target="{
        kind: 'todo',
        id: selected.id,
        title: selected.title,
        campaign: campaignIds.has(selected.id),
      }"
      :return-focus="listFocus.returnFocus"
      @busy="formBusy = $event"
      @deleted="done('Gelöscht. Das Logbuch bleibt erhalten.')"
      @close="close"
    />
    <CampaignCompletionDialog
      v-if="ticks.campaignQuestion.value"
      :title="ticks.campaignQuestion.value.title"
      :open="ticks.campaignQuestion.value.open"
      @confirm="ticks.answerCampaign(true)"
      @cancel="ticks.answerCampaign(false)"
    />
    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
    <!-- After the content in reading order; fixed in place, it looks the same. -->
    <CreateButton
      :label="
        openTile ? `Neue Quest in „${openTile.todo.title}“` : 'Neue Kampagne'
      "
      :disabled="busy"
      @click="create()"
      @dictate="create(true)"
    />
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
  grid-template-columns: var(--tap) var(--tap) minmax(0, 1fr) auto;
  gap: var(--space-1);
  align-items: start;
  margin-left: calc(var(--indent) * var(--indent-step, 1rem));
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

.page-lead {
  /* No single word ("sind.") alone on the last line. */
  text-wrap: pretty;
}

.row__end {
  display: flex;
  align-items: center;
}

.row__expander :deep(svg) {
  transition: transform 240ms var(--ease-out);
}

.row__expander--closed :deep(svg) {
  transform: rotate(-90deg);
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
  /* Whole-Word: "Wohnungsübergabe-Protokoll" breaks at its hyphen, not mid-word. */
  overflow-wrap: break-word;
  hyphens: manual;
}

.row--done h2 {
  color: var(--color-ink-muted);
  text-decoration: line-through;
  text-decoration-thickness: 1.5px;
}

.row__title {
  display: inline;
  /* A button sizes to its longest word: held to the column, it wraps there. */
  max-width: 100%;
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

/* Done quests fold away, like in the Questlog; the heading only carries the level. */
.done-heading {
  margin: 0;
  font: inherit;
}

/* The shared disclosure (.fold-toggle in style.css); only its place here. */
.done-toggle {
  margin: var(--space-3) 0 var(--space-1);
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

.campaign-detail__name {
  flex: 1 1 auto;
  min-width: 0;
}

.campaign-detail__state {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.campaign-detail__head h1 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.25;
  overflow-wrap: break-word;
  hyphens: manual;
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

/* Body large and quiet, like the Warum on the focus card. */
.campaign-detail__why {
  max-width: 60ch;
  color: var(--color-ink-muted);
  font-size: 1.0625rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

/* "Diese Woche" and "Fortschritt": each a labelled group under a hairline. */
.campaign-detail__group {
  display: grid;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--color-line);
}

.campaign-detail__group > .card-title {
  margin: 0;
}

.campaign-detail__week,
.campaign-detail__count {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.campaign-detail__week strong {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
}

.campaign-detail__count {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 700;
}

.campaign-detail__figure {
  white-space: nowrap;
}

.campaign-detail__bar {
  display: block;
  height: 0.5rem;
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-ground-deep);
}

.campaign-detail__bar > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-ink);
  transition: width 240ms var(--ease-out);
}

.campaign-detail__trend {
  display: grid;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.campaign-detail__trend-head {
  display: flex;
  flex-wrap: wrap;
  gap: 0 var(--space-3);
  justify-content: space-between;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.campaign-detail .row__progress {
  margin-top: 0;
}

.campaign-detail .row__bar {
  height: 0.5rem;
}

.campaign-detail__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

/*
 * A phone indents each level less, so deep quests keep their width, and
 * keeps the detail card's buttons clear of the plus button on the right.
 */
@media (max-width: 39.99rem) {
  .tree {
    --indent-step: 0.625rem;
  }

  .row--nested::before {
    left: -0.375rem;
  }

  /*
   * Only a row that can fold keeps the expander column: a leaf gives its
   * width to the title, so "Wohnungsübergabe-Protokoll" breaks at its hyphen.
   */
  .row--leaf {
    grid-template-columns: var(--tap) minmax(0, 1fr) auto;
    padding-left: var(--space-2);
  }

  .row--leaf .row__spacer {
    display: none;
  }

  .campaign-detail__actions {
    padding-right: calc(var(--fab-size) + var(--space-2));
  }
}

.campaigns-stats {
  margin-bottom: var(--space-4);
}

/* "Quests der Kampagne" with "Liste · Board" beside it, wrapping below when narrow. */
.quests-head {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  justify-content: space-between;
  margin: var(--space-6) 0 var(--space-3);
}

.quests-head .section-title {
  margin: 0;
}

/*
 * The board takes the window's width for its four columns, like the Plan;
 * the detail card above keeps the reading width of the page.
 */
.hierarchy--board {
  width: min(100% - 2rem, 90rem);
}

.hierarchy--board > .campaign-detail {
  max-width: 46rem;
}

/* On a phone in two even halves, like Heute's "Liste · Logbuch". */
@media (max-width: 39.99rem) {
  .quests-head__views {
    display: grid;
    flex: 1 1 100%;
    grid-template-columns: 1fr 1fr;
  }
}

.dialog-lead {
  margin: 0 0 var(--space-4);
  color: var(--color-ink-muted);
}
</style>
