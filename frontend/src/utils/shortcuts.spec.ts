import { afterEach, describe, expect, it } from "vitest";
import {
  SHORTCUTS,
  SHORTCUT_GROUPS,
  ariaKeys,
  groupedShortcuts,
  isInteractiveTarget,
  isSingleKey,
  isTypingTarget,
  keyCaps,
  matchShortcuts,
  shortcutById,
  type KeyContext,
  type KeyInput,
} from "./shortcuts";

const press = (key: string, extra: Partial<KeyInput> = {}): KeyInput => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  ...extra,
});
const calm: KeyContext = {
  singleKeys: true,
  typing: false,
  interactive: false,
  dialogOpen: false,
};
const ids = (input: KeyInput, context: Partial<KeyContext> = {}) =>
  matchShortcuts(input, { ...calm, ...context }).map(({ id }) => id);

describe("the shortcut registry", () => {
  it("names every shortcut once and lists each in a known group", () => {
    const all = SHORTCUTS.map(({ id }) => id);
    expect(new Set(all).size).toBe(all.length);
    expect(
      SHORTCUTS.every(({ group }) => SHORTCUT_GROUPS.includes(group)),
    ).toBe(true);
    expect(
      groupedShortcuts().flatMap(({ shortcuts }) => shortcuts.map((s) => s.id)),
    ).toHaveLength(all.length);
  });

  it("gives no two shortcuts of one place the same key", () => {
    const seen = new Map<string, string>();
    for (const shortcut of SHORTCUTS) {
      const key = `${shortcut.modifier ? "mod+" : ""}${shortcut.key}`;
      // Space means the same in two places: on a row and in the Fokus-Modus.
      if (key === " ") continue;
      expect(seen.get(key), key).toBeUndefined();
      seen.set(key, shortcut.id);
    }
  });

  it("lists the view keys in the order of the navigation", () => {
    const views = SHORTCUTS.filter(({ group }) => group === "Ansichten");
    expect(views.map(({ label, key }) => `${key} ${label}`)).toEqual([
      "h Heute",
      "f Fokus",
      "k Kalender",
      "p Plan",
      "q Questlog",
      "c Kampagnen",
      "a Dailies",
      "r Wochenrückblick",
      "b Das Beste",
      ", Einstellungen",
    ]);
  });

  it("groups the overview as Ansichten, Quests, Fokus-Modus, Allgemein", () => {
    expect(groupedShortcuts().map(({ group }) => group)).toEqual([
      "Ansichten",
      "Quests",
      "Fokus-Modus",
      "Allgemein",
    ]);
  });

  it("counts letters, ? and Space as single keys, but not Esc or modifiers", () => {
    expect(isSingleKey(shortcutById("view.today"))).toBe(true);
    expect(isSingleKey(shortcutById("overview.open"))).toBe(true);
    expect(isSingleKey(shortcutById("row.timer"))).toBe(true);
    expect(isSingleKey(shortcutById("focus.leave"))).toBe(false);
    expect(isSingleKey(shortcutById("menu.open"))).toBe(false);
    expect(isSingleKey(shortcutById("focus.done"))).toBe(false);
  });
});

describe("matchShortcuts", () => {
  it("matches the view letters, also with Caps Lock, but not with Shift", () => {
    expect(ids(press("h"))).toEqual(["view.today"]);
    expect(ids(press("K"))).toEqual(["view.calendar"]);
    expect(ids(press("a"))).toEqual(["view.dailies"]);
    expect(ids(press(","))).toEqual(["view.settings"]);
    expect(ids(press("H", { shiftKey: true }))).toEqual([]);
  });

  it("never takes a single key held with Ctrl, Alt, Cmd or AltGr", () => {
    expect(ids(press("x", { ctrlKey: true }))).toEqual([]);
    expect(ids(press("x", { altKey: true }))).toEqual([]);
    expect(ids(press("x", { metaKey: true }))).toEqual([]);
    expect(ids(press("q", { ctrlKey: true, altKey: true }))).toEqual([]);
  });

  it("takes Ctrl+K and Cmd+K for the menu, but not with Shift or Alt", () => {
    expect(ids(press("k", { ctrlKey: true }))).toEqual(["menu.open"]);
    expect(ids(press("k", { metaKey: true }))).toEqual(["menu.open"]);
    expect(ids(press("K", { ctrlKey: true, shiftKey: true }))).toEqual([]);
    expect(ids(press("k", { ctrlKey: true, altKey: true }))).toEqual([]);
    expect(ids(press("k", { ctrlKey: true, metaKey: true }))).toEqual([]);
  });

  it("leaves other browser keys alone", () => {
    for (const key of ["r", "t", "w", "f", "l", "n", "d"])
      expect(ids(press(key, { ctrlKey: true })), key).toEqual([]);
    expect(ids(press("F5"))).toEqual([]);
    expect(ids(press("/"))).toEqual([]);
  });

  it("does nothing while typing, except Ctrl+K", () => {
    expect(ids(press("x"), { typing: true })).toEqual([]);
    expect(ids(press(" "), { typing: true })).toEqual([]);
    expect(ids(press("?", { shiftKey: true }), { typing: true })).toEqual([]);
    expect(ids(press("Enter", { ctrlKey: true }), { typing: true })).toEqual(
      [],
    );
    expect(ids(press("Escape"), { typing: true })).toEqual([]);
    expect(ids(press("k", { ctrlKey: true }), { typing: true })).toEqual([
      "menu.open",
    ]);
  });

  it("does nothing while a dialog is open", () => {
    expect(ids(press("h"), { dialogOpen: true })).toEqual([]);
    expect(ids(press("k", { ctrlKey: true }), { dialogOpen: true })).toEqual(
      [],
    );
    expect(ids(press("Escape"), { dialogOpen: true })).toEqual([]);
  });

  it("does nothing during IME composition", () => {
    expect(ids(press("x", { isComposing: true }))).toEqual([]);
    expect(ids(press("Process"))).toEqual([]);
    expect(ids(press("x", { keyCode: 229 }))).toEqual([]);
  });

  it("does nothing when another handler already took the key", () => {
    expect(
      ids(press("Enter", { ctrlKey: true, defaultPrevented: true })),
    ).toEqual([]);
  });

  it("repeats a held view key, but never a key that writes", () => {
    expect(ids(press("h", { repeat: true }))).toEqual(["view.today"]);
    expect(ids(press("x", { repeat: true }))).toEqual([]);
    expect(ids(press(" ", { repeat: true }))).toEqual([]);
    expect(ids(press("Enter", { ctrlKey: true, repeat: true }))).toEqual([]);
  });

  it("switches the Fokus-Klang with M, once per press and only with single keys on", () => {
    expect(ids(press("m"))).toEqual(["focus.sound"]);
    expect(ids(press("m", { repeat: true }))).toEqual([]);
    expect(ids(press("m"), { singleKeys: false })).toEqual([]);
  });

  it("leaves Space to a focused control", () => {
    expect(ids(press(" "))).toEqual(["row.timer", "focus.timer"]);
    expect(ids(press(" "), { interactive: true })).toEqual([]);
    expect(ids(press("x"), { interactive: true })).toEqual(["row.done"]);
  });

  it("takes ? with or without Shift, as layouts need", () => {
    expect(ids(press("?", { shiftKey: true }))).toEqual(["overview.open"]);
    expect(ids(press("?"))).toEqual(["overview.open"]);
  });

  it("turns single keys off with the switch; modifiers and Esc stay", () => {
    const off = { singleKeys: false };
    expect(ids(press("h"), off)).toEqual([]);
    expect(ids(press("x"), off)).toEqual([]);
    expect(ids(press(" "), off)).toEqual([]);
    expect(ids(press("?", { shiftKey: true }), off)).toEqual([]);
    expect(ids(press("k", { ctrlKey: true }), off)).toEqual(["menu.open"]);
    expect(ids(press("Enter", { ctrlKey: true }), off)).toEqual(["focus.done"]);
    expect(ids(press("Escape"), off)).toEqual(["focus.leave"]);
  });
});

describe("where the focus is", () => {
  afterEach(() => (document.body.innerHTML = ""));
  const html = (markup: string) => {
    document.body.innerHTML = markup;
    return document.body.firstElementChild!;
  };

  it("counts fields, selects and editors as typing", () => {
    expect(isTypingTarget(html('<input type="text">'))).toBe(true);
    expect(isTypingTarget(html('<input type="date">'))).toBe(true);
    expect(isTypingTarget(html("<textarea></textarea>"))).toBe(true);
    expect(isTypingTarget(html("<select></select>"))).toBe(true);
    expect(
      isTypingTarget(
        html('<div contenteditable="true"><p>Notiz</p></div>')
          .firstElementChild,
      ),
    ).toBe(true);
    expect(isTypingTarget(html('<input type="checkbox">'))).toBe(false);
    expect(isTypingTarget(html("<button>OK</button>"))).toBe(false);
    expect(isTypingTarget(html("<main></main>"))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it("counts buttons, links and form controls as interactive for Space", () => {
    expect(
      isInteractiveTarget(
        html("<button><span>Los</span></button>").firstElementChild,
      ),
    ).toBe(true);
    expect(isInteractiveTarget(html('<a href="#/heute">Heute</a>'))).toBe(true);
    expect(isInteractiveTarget(html('<input type="checkbox">'))).toBe(true);
    expect(isInteractiveTarget(html('<div role="switch"></div>'))).toBe(true);
    expect(isInteractiveTarget(html('<main tabindex="-1"></main>'))).toBe(
      false,
    );
    expect(isInteractiveTarget(html("<article><h3>Quest</h3></article>"))).toBe(
      false,
    );
  });
});

describe("how keys are written", () => {
  it("shows Strg on Windows and Linux, ⌘ on a Mac", () => {
    expect(keyCaps(shortcutById("menu.open"), false)).toEqual(["Strg", "K"]);
    expect(keyCaps(shortcutById("menu.open"), true)).toEqual(["⌘", "K"]);
    expect(keyCaps(shortcutById("focus.done"), false)).toEqual([
      "Strg",
      "Enter",
    ]);
    expect(keyCaps(shortcutById("row.timer"), false)).toEqual(["Leertaste"]);
    expect(keyCaps(shortcutById("focus.leave"), false)).toEqual(["Esc"]);
    expect(keyCaps(shortcutById("overview.open"), false)).toEqual(["?"]);
  });

  it("names the keys for aria-keyshortcuts", () => {
    expect(ariaKeys(shortcutById("menu.open"), false)).toBe("Control+K");
    expect(ariaKeys(shortcutById("menu.open"), true)).toBe("Meta+K");
    expect(ariaKeys(shortcutById("row.timer"), false)).toBe("Space");
    expect(ariaKeys(shortcutById("view.today"), false)).toBe("H");
  });
});
