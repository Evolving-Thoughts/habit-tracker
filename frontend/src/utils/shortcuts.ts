/**
 * The one list of keyboard shortcuts. Handling, the "?" overview, the
 * command menu and the settings all read it, so they cannot drift apart.
 */

/** The groups of the overview, in the order it lists them. */
export const SHORTCUT_GROUPS = [
  "Ansichten",
  "Quests",
  "Fokus-Modus",
  "Allgemein",
] as const;
export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

export type ShortcutId =
  | "view.today"
  | "view.calendar"
  | "view.plan"
  | "view.questlog"
  | "view.campaigns"
  | "view.dailies"
  | "view.review"
  | "view.best"
  | "view.settings"
  | "quest.new"
  | "row.timer"
  | "row.done"
  | "row.today"
  | "row.tomorrow"
  | "row.nextWeek"
  | "focus.open"
  | "focus.timer"
  | "focus.done"
  | "focus.leave"
  | "menu.open"
  | "overview.open";

export type Shortcut = {
  id: ShortcutId;
  /** `KeyboardEvent.key`, lower case for letters, " " for Space. */
  key: string;
  /** Held with Ctrl, or with Cmd on a Mac. */
  modifier?: boolean;
  group: ShortcutGroup;
  label: string;
  /** Changes data, so a held key must not repeat it. */
  writes?: boolean;
  /** Also works while the focus is in a text field. */
  whileTyping?: boolean;
};

export const SHORTCUTS: readonly Shortcut[] = [
  // The views in the order of the navigation.
  { id: "view.today", key: "h", group: "Ansichten", label: "Heute" },
  { id: "focus.open", key: "f", group: "Ansichten", label: "Fokus" },
  { id: "view.calendar", key: "k", group: "Ansichten", label: "Kalender" },
  { id: "view.plan", key: "p", group: "Ansichten", label: "Plan" },
  { id: "view.questlog", key: "q", group: "Ansichten", label: "Questlog" },
  { id: "view.campaigns", key: "c", group: "Ansichten", label: "Kampagnen" },
  // D moves a row to tomorrow; A is the free letter in "Dailies".
  { id: "view.dailies", key: "a", group: "Ansichten", label: "Dailies" },
  {
    id: "view.review",
    key: "r",
    group: "Ansichten",
    label: "Wochenrückblick",
  },
  // B for "Das Beste"; D moves a row to tomorrow.
  { id: "view.best", key: "b", group: "Ansichten", label: "Das Beste" },
  {
    id: "view.settings",
    key: ",",
    group: "Ansichten",
    label: "Einstellungen",
  },
  { id: "quest.new", key: "n", group: "Quests", label: "Neue Quest" },
  {
    id: "row.timer",
    key: " ",
    group: "Quests",
    label: "Stoppuhr starten oder pausieren",
    writes: true,
  },
  {
    id: "row.done",
    key: "x",
    group: "Quests",
    label: "Erledigen",
    writes: true,
  },
  {
    id: "row.today",
    key: "t",
    group: "Quests",
    label: "Auf heute verschieben",
    writes: true,
  },
  {
    id: "row.tomorrow",
    key: "d",
    group: "Quests",
    label: "Auf morgen verschieben",
    writes: true,
  },
  {
    id: "row.nextWeek",
    key: "w",
    group: "Quests",
    label: "Auf nächste Woche verschieben (Montag)",
    writes: true,
  },
  {
    id: "focus.timer",
    key: " ",
    group: "Fokus-Modus",
    label: "Stoppuhr starten oder pausieren",
    writes: true,
  },
  {
    id: "focus.done",
    key: "enter",
    modifier: true,
    group: "Fokus-Modus",
    label: "Quest erledigen",
    writes: true,
  },
  {
    id: "focus.leave",
    key: "Escape",
    group: "Fokus-Modus",
    label: "Zurück zu Heute",
  },
  {
    id: "menu.open",
    key: "k",
    modifier: true,
    group: "Allgemein",
    label: "Befehle öffnen",
    whileTyping: true,
  },
  {
    id: "overview.open",
    key: "?",
    group: "Allgemein",
    label: "Tastenkürzel anzeigen",
  },
];

/** What each group means, where the keys alone do not say it. */
export const GROUP_HINTS: Partial<Record<ShortcutGroup, string>> = {
  Quests:
    "Außer N gelten sie für die Zeile unter dem Mauszeiger oder mit dem Fokus, auf Heute, im Plan und im Questlog.",
};

export function shortcutById(id: ShortcutId): Shortcut {
  return SHORTCUTS.find((shortcut) => shortcut.id === id)!;
}

/**
 * A printable key pressed alone. These are the ones the switch in the
 * settings turns off (WCAG 2.1.4); modifier keys and Escape stay on.
 */
export function isSingleKey(shortcut: Shortcut): boolean {
  return !shortcut.modifier && shortcut.key.length === 1;
}

export type KeyInput = Pick<
  KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey" | "repeat"
> & {
  isComposing?: boolean;
  keyCode?: number;
  defaultPrevented?: boolean;
};

export type KeyContext = {
  /** The switch in the settings: single keys on or off. */
  singleKeys: boolean;
  /** The focus is in a text field, a select or an editor. */
  typing: boolean;
  /** The focus is on a control Space would activate. */
  interactive: boolean;
  /** A modal dialog is open; its own keys are its business. */
  dialogOpen: boolean;
};

function matches(
  shortcut: Shortcut,
  input: KeyInput,
  context: KeyContext,
): boolean {
  if (input.repeat && shortcut.writes) return false;
  if (context.typing && !shortcut.whileTyping) return false;
  const key = input.key.toLowerCase();
  if (shortcut.modifier) {
    // Exactly one of Ctrl and Cmd; with Alt or Shift it is someone else's.
    const modifier = input.ctrlKey !== input.metaKey;
    return modifier && !input.altKey && !input.shiftKey && key === shortcut.key;
  }
  // AltGr arrives as Ctrl+Alt, so this also leaves AltGr characters alone.
  if (input.ctrlKey || input.metaKey || input.altKey) return false;
  if (!isSingleKey(shortcut)) return input.key === shortcut.key;
  if (!context.singleKeys) return false;
  if (shortcut.key === " " && context.interactive) return false;
  // "?" needs Shift on most layouts; letters with Shift stay free.
  if (shortcut.key === "?") return input.key === "?";
  return !input.shiftKey && key === shortcut.key;
}

/**
 * The shortcuts a key press asks for, in registry order. Several can share a
 * key (Space on a row and in the Fokus-Modus); whoever is present acts.
 */
export function matchShortcuts(
  input: KeyInput,
  context: KeyContext,
  shortcuts: readonly Shortcut[] = SHORTCUTS,
): Shortcut[] {
  if (input.isComposing || input.key === "Process" || input.keyCode === 229)
    return [];
  if (input.defaultPrevented || context.dialogOpen) return [];
  return shortcuts.filter((shortcut) => matches(shortcut, input, context));
}

const NON_TEXT_INPUTS = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "image",
  "range",
  "color",
  "file",
]);

/** Keys typed here are text, not commands. */
export function isTypingTarget(target: Element | null): boolean {
  if (!target) return false;
  if (target instanceof HTMLElement && target.isContentEditable) return true;
  if (target.closest('[contenteditable]:not([contenteditable="false"])'))
    return true;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(target.type);
  if (target.closest('[role="textbox"], [role="searchbox"], [role="combobox"]'))
    return true;
  return (
    target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
  );
}

const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [role="tab"], [role="radio"], [role="slider"]';

/** Space belongs to this control: it presses it or ticks it. */
export function isInteractiveTarget(target: Element | null): boolean {
  return !!target?.closest(INTERACTIVE);
}

/** The keys as a person reads them, one entry per key cap. */
export function keyCaps(shortcut: Shortcut, mac: boolean): string[] {
  const caps: string[] = [];
  if (shortcut.modifier) caps.push(mac ? "⌘" : "Strg");
  caps.push(capOf(shortcut.key));
  return caps;
}

function capOf(key: string): string {
  if (key === " ") return "Leertaste";
  if (key === "enter") return "Enter";
  if (key === "Escape") return "Esc";
  return key.toUpperCase();
}

/** The same keys for `aria-keyshortcuts`. */
export function ariaKeys(shortcut: Shortcut, mac: boolean): string {
  const key =
    shortcut.key === " "
      ? "Space"
      : shortcut.key === "enter"
        ? "Enter"
        : shortcut.key.length === 1
          ? shortcut.key.toUpperCase()
          : shortcut.key;
  return shortcut.modifier ? `${mac ? "Meta" : "Control"}+${key}` : key;
}

/** The registry in overview groups, empty groups left out. */
export function groupedShortcuts(
  shortcuts: readonly Shortcut[] = SHORTCUTS,
): { group: ShortcutGroup; shortcuts: Shortcut[] }[] {
  return SHORTCUT_GROUPS.map((group) => ({
    group,
    shortcuts: shortcuts.filter((shortcut) => shortcut.group === group),
  })).filter(({ shortcuts: list }) => list.length > 0);
}
