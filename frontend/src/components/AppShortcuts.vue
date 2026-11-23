<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import CommandMenu from "./CommandMenu.vue";
import CreateItemDialog from "./CreateItemDialog.vue";
import CreateTodoForm from "./CreateTodoForm.vue";
import EditItemDialog from "./EditItemDialog.vue";
import ModalDialog from "./ModalDialog.vue";
import ShortcutOverview from "./ShortcutOverview.vue";
import { notifyDataChanged } from "../composables/data-sync";
import {
  focusWhenReady,
  layerCommands,
  overlay,
  runShortcut,
  useShortcutHandlers,
} from "../composables/useShortcuts";
import {
  THEME_CHOICES,
  setThemeChoice,
  themeChoice,
} from "../composables/useTheme";
import { useTimer } from "../composables/useTimer";
import { VIEWS, type ViewName } from "../router";
import { DAY_QUERY, SECTION_QUERY } from "../routes";
import type { TodoResponse } from "../types/todo";
import type { Command } from "../utils/command-filter";
import type { SearchAction } from "../utils/search-entries";
import type { ShortcutId } from "../utils/shortcuts";

/**
 * The app-wide shortcuts of a signed-in person, below whatever the open view
 * handles, and the dialogs they open: the command menu, the overview, and
 * what the menu leads to on any view (an editor for a found quest or daily,
 * a new campaign or daily). Those write and then tell every view.
 */
const router = useRouter();
const timer = useTimer();

const VIEW_KEYS: Record<ViewName, ShortcutId> = {
  today: "view.today",
  focus: "focus.open",
  calendar: "view.calendar",
  plan: "view.plan",
  questlog: "view.questlog",
  campaigns: "view.campaigns",
  dailies: "view.dailies",
  review: "view.review",
  best: "view.best",
  settings: "view.settings",
};

function show(name: ViewName): void {
  void router.push({ name });
}

useShortcutHandlers(
  {
    "view.today": () => show("today"),
    "focus.open": () => show("focus"),
    "view.calendar": () => show("calendar"),
    "view.plan": () => show("plan"),
    "view.questlog": () => show("questlog"),
    "view.campaigns": () => show("campaigns"),
    "view.dailies": () => show("dailies"),
    "view.review": () => show("review"),
    "view.best": () => show("best"),
    "view.settings": () => show("settings"),
    // Views without a quest dialog of their own: write it on Heute.
    "quest.new": () => {
      void router
        .push({ name: "today" })
        .then(() =>
          focusWhenReady(() =>
            document.querySelector<HTMLElement>(
              '.today-view input[name="quickTitle"]',
            ),
          ),
        );
    },
    "menu.open": () => {
      overlay.value = "menu";
    },
    "overview.open": () => {
      overlay.value = "overview";
    },
  },
  { fallback: true },
);

/** Further words a view is found by. */
const VIEW_KEYWORDS: Partial<Record<ViewName, string[]>> = {
  focus: ["Fokus-Modus", "starten"],
  best: ["Das Beste des Tages", "Tagebuch", "Erinnerung"],
};

/**
 * Views in the order of the navigation, Kategorien (a section of
 * Einstellungen) right after it, then actions.
 */
const commands = computed<Command[]>(() => {
  const views: Command[] = VIEWS.map(({ name, label }) => ({
    id: `view.${name}`,
    label,
    group: "Ansichten",
    shortcut: VIEW_KEYS[name],
    keywords: VIEW_KEYWORDS[name],
    run: () => show(name),
  }));
  views.push({
    id: "settings.categories",
    label: "Kategorien",
    group: "Ansichten",
    keywords: ["Einstellungen", "Wochensoll"],
    run: () =>
      void router.push({
        name: "settings",
        query: { [SECTION_QUERY]: "kategorien" },
      }),
  });
  const actions: Command[] = [
    {
      id: "quest.new",
      label: "Neue Quest",
      group: "Aktionen",
      shortcut: "quest.new",
      keywords: ["Quest hinzufügen", "erstellen"],
      run: () => runShortcut("quest.new"),
    },
    {
      id: "campaign.new",
      label: "Neue Kampagne",
      group: "Aktionen",
      keywords: ["Kampagne anlegen", "erstellen", "Ziel"],
      run: () => (dialog.value = { type: "new-campaign" }),
    },
    {
      id: "daily.new",
      label: "Neues Daily",
      group: "Aktionen",
      keywords: ["Daily anlegen", "erstellen", "Gewohnheit"],
      run: () => (dialog.value = { type: "new-daily" }),
    },
  ];
  const running = timer?.timer.value;
  if (running)
    actions.push({
      id: "timer.toggle",
      label:
        running.state === "running"
          ? `Stoppuhr pausieren: ${running.title}`
          : `Stoppuhr fortsetzen: ${running.title}`,
      group: "Aktionen",
      keywords: ["Timer"],
      run: () =>
        void timer?.action(running.state === "running" ? "pause" : "resume"),
    });
  actions.push(...layerCommands());
  // The other two looks; the one on screen needs no command.
  for (const choice of THEME_CHOICES)
    if (choice.value !== themeChoice.value)
      actions.push({
        id: `theme.${choice.value}`,
        label: `Darstellung: ${choice.label}`,
        group: "Aktionen",
        keywords: ["Design", "Farben", "Dark Mode", "Nachtmodus", "Theme"],
        run: () => setThemeChoice(choice.value),
      });
  actions.push({
    id: "overview.open",
    label: "Tastenkürzel anzeigen",
    group: "Aktionen",
    shortcut: "overview.open",
    keywords: ["Tastatur", "Hilfe"],
    run: () => (overlay.value = "overview"),
  });
  return [...views, ...actions];
});

/** The menu closes first, so the command finds the focus where it was. */
async function run(command: Command): Promise<void> {
  overlay.value = null;
  await nextTick();
  command.run();
}

/** A dialog the menu opened over whatever view is shown. */
type Dialog =
  | { type: "edit"; kind: "todo" | "habit"; id: number; occurrenceId?: number }
  | { type: "new-campaign" }
  | { type: "new-daily" };
const dialog = ref<Dialog | null>(null);
const dialogBusy = ref(false);

/** Notes found by the search: once their editor shows them, scroll there. */
function revealNotes(): void {
  const observer = new MutationObserver(() => {
    const notes = document.querySelector<HTMLElement>(
      ".edit-dialog .quest-notes",
    );
    if (!notes) return;
    observer.disconnect();
    notes.scrollIntoView?.({ block: "start" });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 5000);
}

/** Carries out a search result: an editor here, or the view it lives in. */
async function open(action: SearchAction): Promise<void> {
  overlay.value = null;
  await nextTick();
  switch (action.type) {
    case "edit-todo":
      dialog.value = { type: "edit", kind: "todo", id: action.id };
      if (action.notes) revealNotes();
      return;
    case "edit-habit":
      dialog.value = {
        type: "edit",
        kind: "habit",
        id: action.id,
        occurrenceId: action.occurrenceId,
      };
      if (action.occurrenceId) revealNotes();
      return;
    case "timer": {
      // Its own stopwatch already runs or waits: nothing to start.
      const current = timer?.timer.value;
      if (current?.kind === "todo" && current.targetId === action.id) return;
      void timer?.start({
        kind: "todo",
        targetId: action.id,
        title: action.title,
      });
      return;
    }
    case "campaign":
      void router.push({
        name: "campaigns",
        query: { kampagne: String(action.id) },
      });
      return;
    case "day":
      void router.push({
        name: "calendar",
        query: { [DAY_QUERY]: action.date },
      });
      return;
    case "week":
      void router.push({ name: "review", query: { woche: action.date } });
      return;
    case "day-best":
      void router.push({ name: "best", query: { [DAY_QUERY]: action.date } });
      return;
  }
}

function closeDialog(): void {
  if (!dialogBusy.value) dialog.value = null;
}
/** A write from one of these dialogs: every view refreshes. */
function written(): void {
  dialogBusy.value = false;
  dialog.value = null;
  notifyDataChanged();
}
function campaignCreated(todo: TodoResponse): void {
  written();
  void router.push({ name: "campaigns", query: { kampagne: String(todo.id) } });
}
function itemCreated(kind: "todo" | "habit"): void {
  written();
  if (kind === "habit") void router.push({ name: "dailies" });
}
</script>

<template>
  <CommandMenu
    v-if="overlay === 'menu'"
    :commands="commands"
    @run="run"
    @open="open"
    @close="overlay = null"
  />
  <ShortcutOverview
    v-else-if="overlay === 'overview'"
    @close="overlay = null"
  />
  <EditItemDialog
    v-if="dialog?.type === 'edit'"
    :key="`${dialog.kind}-${dialog.id}-${dialog.occurrenceId ?? ''}`"
    :kind="dialog.kind"
    :entity-id="dialog.id"
    :occurrence-id="dialog.occurrenceId"
    :return-focus="() => null"
    @busy="dialogBusy = $event"
    @changed="written"
    @close="closeDialog"
  />
  <ModalDialog
    v-else-if="dialog?.type === 'new-campaign'"
    title="Neue Kampagne"
    :busy="dialogBusy"
    focus-selector="input[name=title]"
    @close="closeDialog"
  >
    <CreateTodoForm
      campaign
      @busy="dialogBusy = $event"
      @created="campaignCreated"
      @cancel="closeDialog"
    />
  </ModalDialog>
  <CreateItemDialog
    v-else-if="dialog?.type === 'new-daily'"
    kind="habit"
    @created="itemCreated"
    @close="closeDialog"
  />
</template>
