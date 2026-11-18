<script setup lang="ts">
import { computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import CommandMenu from "./CommandMenu.vue";
import ShortcutOverview from "./ShortcutOverview.vue";
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
import type { Command } from "../utils/command-filter";
import type { ShortcutId } from "../utils/shortcuts";

/**
 * The app-wide shortcuts of a signed-in person, below whatever the open view
 * handles, and the two dialogs they open: the command menu and the overview.
 */
const router = useRouter();
const timer = useTimer();

const VIEW_KEYS: Partial<Record<ViewName, ShortcutId>> = {
  today: "view.today",
  plan: "view.plan",
  questlog: "view.questlog",
  campaigns: "view.campaigns",
  calendar: "view.calendar",
  review: "view.review",
};

function show(name: ViewName): void {
  void router.push({ name });
}

useShortcutHandlers(
  {
    "view.today": () => show("today"),
    "view.plan": () => show("plan"),
    "view.questlog": () => show("questlog"),
    "view.campaigns": () => show("campaigns"),
    "view.calendar": () => show("calendar"),
    "view.review": () => show("review"),
    "focus.open": () => show("focus"),
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

/** Views, then actions; the Fokus-Modus is offered once, as an action. */
const commands = computed<Command[]>(() => {
  const views: Command[] = VIEWS.filter(({ name }) => name !== "focus").map(
    ({ name, label }) => ({
      id: `view.${name}`,
      label,
      group: "Ansichten",
      shortcut: VIEW_KEYS[name],
      run: () => show(name),
    }),
  );
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
      id: "focus.open",
      label: "Fokus-Modus starten",
      group: "Aktionen",
      shortcut: "focus.open",
      run: () => show("focus"),
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
</script>

<template>
  <CommandMenu
    v-if="overlay === 'menu'"
    :commands="commands"
    @run="run"
    @close="overlay = null"
  />
  <ShortcutOverview
    v-else-if="overlay === 'overview'"
    @close="overlay = null"
  />
</template>
