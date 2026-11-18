<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import { getQuestHours } from "../api/quest-hours.api";
import { updateTodo, updateTodoCompletion } from "../api/day-planner.api";
import { getCategories } from "../api/categories.api";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import type { TodoResponse } from "../types/todo";
import { whyBelow } from "../utils/why";
import {
  hasProgress,
  hierarchyChildren,
  openBelow,
  progressText,
  progressWords,
  visibleHierarchy,
  descendantIds,
} from "../utils/todo-hierarchy";
import ActionMenu from "../components/ActionMenu.vue";
import AppIcon from "../components/AppIcon.vue";
import CheckRing from "../components/CheckRing.vue";
import CreateButton from "../components/CreateButton.vue";
import ModalDialog from "../components/ModalDialog.vue";
import CreateTodoForm from "../components/CreateTodoForm.vue";
import PlannerItemEditor from "../components/PlannerItemEditor.vue";
import GoalBurnup from "../components/GoalBurnup.vue";
import TodoDeletionSummary from "../components/TodoDeletionSummary.vue";
import CampaignTiles from "../components/CampaignTiles.vue";
import CampaignCompletionDialog from "../components/CampaignCompletionDialog.vue";
import UndoToast from "../components/UndoToast.vue";
import QuestTrend from "../components/QuestTrend.vue";
import { useListFocus } from "../composables/useListFocus";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import { useTodoDeletion } from "../composables/useTodoDeletion";
import { useUndo } from "../composables/useUndo";
import { useCampaignCompletion } from "../composables/useCampaignCompletion";
import { useTimer } from "../composables/useTimer";
import { useShortcutHandlers } from "../composables/useShortcuts";
import { campaignMark, categoryMark } from "../utils/category-mark";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  weekStart,
} from "../utils/date";
import { formatDuration } from "../utils/today-agenda";
import { againstTarget, campaignTiles } from "../utils/quest-hours";
import type { QuestHoursResponse } from "../types/quest-hours";
import type { MenuEntry } from "../utils/row-actions";
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
const campaignCompletion = useCampaignCompletion();
const quiet = () =>
  !busy.value &&
  action.value === null &&
  burnupTodo.value === null &&
  campaignCompletion.question.value === null;
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
      fallbackError: "Quest-Stunden konnten nicht geladen werden.",
      refreshOnChange: quiet,
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
/*
 * The tree holds campaigns only: loose quests live in the Questlog, Heute and
 * the Plan. An opened campaign is its detail card, so its tree starts with
 * the quests below it instead of repeating it as a row.
 */
const campaignIds = computed(
  () => new Set(tiles.value.map((tile) => tile.todo.id)),
);
const rows = computed(() =>
  openTile.value
    ? visibleHierarchy(todos.value, collapsed.value, {
        under: openTile.value.todo.id,
      })
    : visibleHierarchy(todos.value, collapsed.value, {
        keepTop: (todo) => campaignIds.value.has(todo.id),
      }),
);
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
// The stopwatch entry in the menu follows the same rules as ItemPlayButton.
function timerActive(todo: HierarchyTodo) {
  const current = timer?.timer.value;
  return current?.kind === "todo" && current.targetId === todo.id;
}
function timerLabel(todo: HierarchyTodo) {
  return timerActive(todo)
    ? `Stoppuhr für ${todo.title} läuft bereits`
    : !todo.timerEligible
      ? `Stoppuhr für ${todo.title}: keine offene fällige Ausführung`
      : `Stoppuhr für ${todo.title} starten`;
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
  if (timer)
    void timer.start({ kind: "todo", targetId: todo.id, title: todo.title });
}

/*
 * "Aktionen für …": the tree structures campaigns, so measuring is one entry
 * here instead of a ▶ on every row.
 */
function rowMenu(todo: HierarchyTodo): MenuEntry[] {
  const entries: MenuEntry[] = [
    {
      id: "timer",
      label: "Stoppuhr starten",
      icon: "timer",
      ariaLabel: timerLabel(todo),
      disabled: timerDisabled(todo),
      run: () => startTimer(todo),
    },
    {
      id: "child",
      label: "Unter-Quest hinzufügen",
      icon: "child",
      ariaLabel: `Unter-Quest zu ${todo.title} hinzufügen`,
      disabled: busy.value,
      run: () => open("create", todo),
    },
  ];
  if (todo.parentId === null)
    entries.push({
      id: "progress",
      label: "Fortschritt anzeigen",
      icon: "chart",
      ariaLabel: `Fortschritt von ${todo.title} anzeigen`,
      disabled: busy.value,
      run: () => showProgress(todo),
    });
  entries.push(
    {
      id: "move",
      label: "Verschieben",
      icon: "move",
      ariaLabel: `${todo.title} verschieben`,
      disabled: busy.value,
      run: () => open("move", todo),
    },
    {
      id: "delete",
      label: "Löschen",
      icon: "trash",
      ariaLabel: `${todo.title} mit allen Unter-Quests löschen`,
      disabled: busy.value,
      last: true,
      run: () => void requestDelete(todo),
    },
  );
  return entries;
}

/*
 * The opened campaign's "…": what its row offered, now that the detail card
 * stands for it. Its ring becomes "Kampagne abschließen" (asking as the ring
 * did), and its progress is already on the card.
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
    ...rowMenu(todo).filter((entry) => entry.id !== "progress"),
  ];
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
const { undo, offer: offerUndo, take: takeUndo } = useUndo<HierarchyTodo>();
async function toggleCompletion(todo: HierarchyTodo) {
  if (busy.value) return;
  const next = !checked(todo);
  // A campaign with open quests asks first; they stay open either way.
  const open = next && todo.parentId === null ? openBelow(todo.progress) : 0;
  if (!(await campaignCompletion.confirm(todo.title, open))) return;
  pendingCompletion.value = new Map(pendingCompletion.value).set(todo.id, next);
  try {
    const done = await run(() => updateTodoCompletion(todo.id, next), "", {
      fallbackError: "Die Quest konnte nicht aktualisiert werden.",
    });
    if (done && next)
      offerUndo(
        todo,
        open > 0 ? `„${todo.title}“ abgeschlossen` : `„${todo.title}“ erledigt`,
      );
  } finally {
    const rest = new Map(pendingCompletion.value);
    rest.delete(todo.id);
    pendingCompletion.value = rest;
  }
}
async function undoLast() {
  const todo = takeUndo();
  if (!todo) return;
  await run(() => updateTodoCompletion(todo.id, false), "", {
    fallbackError: "Das Rückgängigmachen hat nicht geklappt.",
  });
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
// N opens the plus button's dialog: a new quest at the top, a campaign to be.
useShortcutHandlers({
  "quest.new": () => {
    if (!busy.value && !action.value) open("create");
  },
});
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
    <div v-else-if="!tiles.length && !shownError" class="empty-state">
      <strong>Noch keine Kampagnen.</strong>
      <span
        >Leg mit dem Plus-Button die erste an. Quests ohne Kampagne stehen im
        Questlog.</span
      >
    </div>
    <template v-else-if="tiles.length">
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
              <h2 id="campaign-detail-title" tabindex="-1">
                {{ openTile.todo.title }}
              </h2>
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
          <div v-if="hasProgress(openTile.todo.progress)" class="row__progress">
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
            <span class="row__count">{{
              progressText(openTile.todo.progress)
            }}</span>
          </div>
          <GoalBurnup :todo-id="openTile.todo.id" />
          <button
            class="btn campaign-detail__edit"
            type="button"
            data-edit-button
            :disabled="busy"
            :aria-label="`Kampagne ${openTile.todo.title} bearbeiten`"
            @click="open('edit', openTile.todo)"
          >
            <AppIcon name="edit" />Bearbeiten
          </button>
        </section>
        <h2 class="section-title">Quests der Kampagne</h2>
        <p v-if="!rows.length" class="status-line">
          Noch keine Quests. „Unter-Quest hinzufügen“ steht im Menü der
          Kampagne.
        </p>
      </template>
      <template v-else>
        <CampaignTiles
          :tiles="tiles"
          :starts="trendStarts"
          :counted="questHours !== null"
          @open="openCampaign"
        />
        <h2 class="section-title">Kampagnen und ihre Quests</h2>
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
          <ActionMenu
            :title="todo.title"
            :entries="rowMenu(todo)"
            :disabled="busy"
            :trigger-key="todo.id"
          />
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
        {{
          becomesCampaign(dragged)
            ? "Hier ablegen, um daraus eine eigene Kampagne zu machen."
            : "Hier ablegen, um die Quest aus der Kampagne zu lösen. Sie steht dann im Questlog oder an ihrem Tag."
        }}
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
            <option value="">
              {{
                becomesCampaign(selected?.id ?? null)
                  ? "Eigene Kampagne"
                  : "Keine Kampagne (Questlog oder ihr Tag)"
              }}
            </option>
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
          Alle Unter-Quests ziehen mit. Termine und eine laufende Stoppuhr
          bleiben erhalten.
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
    <CampaignCompletionDialog
      v-if="campaignCompletion.question.value"
      :title="campaignCompletion.question.value.title"
      :open="campaignCompletion.question.value.open"
      @confirm="campaignCompletion.reply(true)"
      @cancel="campaignCompletion.reply(false)"
    />
    <UndoToast :label="undo?.label ?? null" @undo="undoLast" />
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
