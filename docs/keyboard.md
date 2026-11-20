# Keyboard: shortcuts, command menu, overview

The app is built for one hand on a phone; on a desktop the keyboard adds
shortcuts for the common moves, a command menu (Ctrl+K) and an overview of
all keys ("?"). Everything a key does is also a button somewhere, and every
key runs the same code as that button.

## One registry

`frontend/src/utils/shortcuts.ts` holds the list (`SHORTCUTS`) and the pure
matching (`matchShortcuts`). The handling at run time, the "?" overview, the
command menu's key hints and the list in Einstellungen all read it, so they
cannot drift apart.

The view keys follow the order of the top bar and use the view's initial
where it is free: D already moves a row to tomorrow, so Dailies takes A
("dAilies"), and Einstellungen takes the comma, the usual key for settings.

| Key | Group | What it does |
|---|---|---|
| H | Ansichten | Heute |
| F | Ansichten | Fokus-Modus |
| K | Ansichten | Kalender |
| P | Ansichten | Plan |
| Q | Ansichten | Questlog |
| C | Ansichten | Kampagnen |
| A | Ansichten | Dailies |
| R | Ansichten | Wochenrückblick |
| , | Ansichten | Einstellungen |
| N | Quests | Neue Quest (see below) |
| Space | Quests | Start or pause the row's stopwatch |
| X | Quests | Tick the row |
| T | Quests | Move the row to today |
| D | Quests | Move the row to tomorrow |
| W | Quests | Move the row to next week's Monday |
| Space | Fokus-Modus | Start, pause or resume its stopwatch |
| Ctrl+Enter / Cmd+Enter | Fokus-Modus | Tick its quest, exactly like "Erledigt" |
| Esc | Fokus-Modus | Back to Heute |
| Ctrl+K / Cmd+K | Allgemein | Open the command menu |
| ? | Allgemein | Open the shortcut overview |

## Who handles a key

`frontend/src/composables/useShortcuts.ts` keeps one `keydown` listener on
the window while any handler is mounted. Components register handlers with
`useShortcutHandlers({ id: handler })` for their lifetime:

- `AppShortcuts.vue` (inside the signed-in shell only, so nothing fires on
  the sign-in page) registers the app-wide defaults as a `fallback` layer:
  view keys (F included), Ctrl+K, "?" and N's default. It also renders the command
  menu and the overview.
- Heute, Plan, Questlog, Kampagnen and the Fokus-Modus register their own
  keys on top. A handler returns `false` when it does not apply; the next
  layer below gets the key, and if nobody takes it the browser does (no
  `preventDefault`), so Space still scrolls.

`runShortcut(id)` runs the same chain without a key; the command menu uses it.

## Rules

Each is covered by `utils/shortcuts.spec.ts` and
`composables/useShortcuts.spec.ts`.

- Single keys (letters, ",", "?", Space) never fire while the focus is in a text
  field, a date field, a select or an editor (contenteditable, so also the
  Tiptap notes), never with Ctrl, Alt or Cmd held (AltGr arrives as Ctrl+Alt
  and is left alone too), and not with Shift, except "?" which needs it.
- Nothing fires while a modal dialog (`dialog[open]`) is open; the command
  menu handles its own keys (arrows, Home, End, Enter, Ctrl+K to close) on
  its field.
- Nothing fires during IME composition (`isComposing`, key "Process",
  keyCode 229) or when another handler already called `preventDefault`
  (Tiptap's Ctrl+Enter line break, for example).
- Keys that write (Space, X, T, D, W, Ctrl+Enter) never repeat while held;
  view keys may.
- Space acts only when the focus is not on a button, link or other control,
  so native activation keeps working; without a row under the pointer or a
  focus view it does nothing and the page scrolls.
- Browser shortcuts stay with the browser. Ctrl+K is the one deliberate
  exception, and only when the menu actually opens. Ctrl+Enter only acts in
  the Fokus-Modus and not while typing there.

## Which row

Row keys act on `[data-focus-key]` rows of Heute, Plan and Questlog: the row
holding the focus if the focus moved there after the pointer last moved,
otherwise the row under the pointer. The pointer is kept as coordinates and
resolved with `elementFromPoint` at key time, because rows move under a still
mouse once one is ticked.

If the focus was in the row, it moves on to the row that takes its place
(`useListFocus().around`), since the row itself usually leaves. A row acted
on by pointer leaves the focus where it was.

Per row kind:

| Row | Space | X | T / D / W |
|---|---|---|---|
| Heute: open quest | stopwatch (as ▶, pause/resume as the timer bar) | tick, undo toast | move like the "Heute"/"Morgen" chips, announced in the live region; no step to its own day |
| Heute: appointment | stopwatch | tick | opens "Verschieben", where moving is confirmed |
| Heute: Daily run | stopwatch if eligible | tick, undo toast | move only up to its `moveUntil`, like the chips; otherwise nothing |
| Heute: done or skipped | nothing | nothing (reopening stays a click) | nothing |
| Plan: open quest | stopwatch | tick, new undo toast in Plan | onto a day of the board like dragging (optimistic, at the end of the day's order); next Monday beyond the board via `reschedule`; never into the past |
| Plan: appointment | stopwatch | tick | opens "Verschieben" |
| Plan: Daily, done quest | nothing | nothing | nothing |
| Plan: open quest, focus on its card | as above | as above | as above; in addition ArrowUp / ArrowDown move it one place in the day's order and ArrowLeft / ArrowRight to the end of the day before or after (as "Nach oben" / "Nach unten" in its menu and dragging; never into the past) |
| Questlog: open quest | stopwatch | tick, undo toast | plans it for that day with the editor's own save (`PATCH /todos/:id`), message in the status line |
| Questlog: ticked here | nothing | nothing | nothing |
| Plan: row of the Questlog column | stopwatch | tick, undo toast in Plan | onto that day of the board like dropping it (end of the day's order); next Monday beyond the board with the editor's save |

The row menus "Aktionen für …" (Heute, Questlog, Kalender) name the same
keys on their entries: Heute/Morgen/Nächste Woche carry `aria-keyshortcuts`
(T, D, W) and show them as key caps where a keyboard is likely, and they run
the same code as the key. While a menu is open its scrim lies over the page,
so a row key under the pointer does nothing; inside the menu the arrow keys,
Home, End, Escape and Tab belong to the menu.

N: Heute focuses its quick add; Plan focuses today's quick add, or the first
day's when the shown week lies ahead; Questlog opens its "Quest erstellen"
dialog; Kampagnen opens its plus dialog (a new top quest). Everywhere else,
and in a past week of the Plan, N goes to Heute and focuses the quick add
once it has loaded (`focusWhenReady`).

## Off switch (WCAG 2.1.4)

Einstellungen › Tastatur has the switch "Tastenkürzel", stored per device in
`localStorage` (`shortcuts:single-keys` = `off`), on by default. Off turns
every single-character key off, "?" and Space included, since 2.1.4 covers
punctuation as well. Ctrl+K, Ctrl+Enter and Esc stay on; the overview is
still reachable from the command menu and in Einstellungen, where the list
shows the switched-off keys dimmed.

## Where hints show

Key hints (in the overview and the menu's entries) and the settings section
show where a keyboard is likely:
`(hover: hover) and (pointer: fine)`, or once a key has reached a shortcut on
this page (a phone or tablet with a keyboard attached). A single key that is
switched off shows no hint in the menu. Nothing breaks on touch-only devices;
the command button is only in the wide bar. Its tooltip names Ctrl+K and
the gear's names the comma; both carry `aria-keyshortcuts`.

## Command menu

`CommandMenu.vue` on `ModalDialog` (focus trap, Escape, focus return): a
combobox field controlling a listbox (`aria-activedescendant`, groups
"Ansichten" and "Aktionen" while nothing is typed, one ranked list while
searching). Entries: every view in the order of the navigation (the Fokus-Modus also
found as "Fokus-Modus starten"), then "Kategorien", which opens its section
in Einstellungen (`#/einstellungen?abschnitt=kategorien`), "Neue Quest", pausing or resuming a running stopwatch, what the
open view adds (Heute: "Offenes auf morgen verschieben", which opens the same
confirmation as its button), the two other looks ("Darstellung: Dunkel",
"Darstellung: Hell", "Darstellung: Wie das Gerät"; see `theme.md`) and
"Tastenkürzel anzeigen". Filtering
(`utils/command-filter.ts`) ignores case and accents, needs every typed word
and lists matches at word starts before matches inside words. The menu
closes before a command runs, so the command finds the focus where it was.

Quest search would fit as a third group filled from a debounced server
search, shown only once something is typed, its entries opening the quest's
editor; it is out of scope for now.
