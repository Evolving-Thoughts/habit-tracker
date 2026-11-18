import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import {
  focusWhenReady,
  reloadShortcutSettings,
  runShortcut,
  setSingleKeys,
  singleKeys,
  targetRow,
  useShortcutHandlers,
  type ShortcutHandler,
} from "./useShortcuts";
import type { ShortcutId } from "../utils/shortcuts";

enableAutoUnmount(afterEach);

/** A component that handles some shortcuts while it is mounted. */
function handle(
  handlers: Partial<Record<ShortcutId, ShortcutHandler>>,
  options: { fallback?: boolean } = {},
) {
  return mount(
    defineComponent({
      setup() {
        useShortcutHandlers(handlers, options);
        return () => h("div");
      },
    }),
    { attachTo: document.body },
  );
}

function press(
  key: string,
  init: KeyboardEventInit = {},
  target: EventTarget = document.body,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

beforeEach(() => {
  localStorage.clear();
  reloadShortcutSettings();
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("useShortcutHandlers", () => {
  it("runs the handler and takes the key from the page", () => {
    const today = vi.fn();
    handle({ "view.today": today });
    const event = press("h");
    expect(today).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("stops listening once the component is gone", () => {
    const today = vi.fn();
    const wrapper = handle({ "view.today": today });
    wrapper.unmount();
    press("h");
    expect(today).not.toHaveBeenCalled();
  });

  it("asks the view first and the app-wide default last, whatever mounted first", () => {
    const calls: string[] = [];
    handle({ "quest.new": () => void calls.push("view") });
    handle({ "quest.new": () => void calls.push("app") }, { fallback: true });
    press("n");
    expect(calls).toEqual(["view"]);
  });

  it("hands a key the view declines on to the default below", () => {
    const calls: string[] = [];
    handle({ "quest.new": () => void calls.push("app") }, { fallback: true });
    handle({ "quest.new": () => false });
    const event = press("n");
    expect(calls).toEqual(["app"]);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves a key nobody handles to the browser", () => {
    handle({ "row.done": () => false });
    const event = press(" ");
    expect(event.defaultPrevented).toBe(false);
  });

  it("never fires single keys while typing in a field or the notes editor", () => {
    const done = vi.fn();
    handle({ "view.today": done, "row.done": done });
    document.body.innerHTML =
      '<input name="quickTitle"><textarea></textarea><select><option>a</option></select><div contenteditable="true"><p>Notiz</p></div>';
    for (const field of document.body.querySelectorAll(
      "input, textarea, select, p",
    ))
      expect(press("h", {}, field).defaultPrevented).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });

  it("opens the menu with Ctrl+K even from a field", () => {
    const menu = vi.fn();
    handle({ "menu.open": menu });
    document.body.innerHTML = '<input name="quickTitle">';
    const event = press(
      "k",
      { ctrlKey: true },
      document.querySelector("input")!,
    );
    expect(menu).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it("does not take Ctrl+K from the browser when nobody opens a menu", () => {
    handle({});
    expect(press("k", { ctrlKey: true }).defaultPrevented).toBe(false);
  });

  it("never fires with Ctrl, Alt or Cmd held", () => {
    const today = vi.fn();
    handle({ "view.today": today });
    press("h", { ctrlKey: true });
    press("h", { altKey: true });
    press("h", { metaKey: true });
    expect(today).not.toHaveBeenCalled();
  });

  it("does nothing while a modal dialog is open", () => {
    const today = vi.fn();
    const menu = vi.fn();
    handle({ "view.today": today, "menu.open": menu });
    document.body.innerHTML = "<dialog open><p>Bearbeiten</p></dialog>";
    press("h");
    press("k", { ctrlKey: true });
    expect(today).not.toHaveBeenCalled();
    expect(menu).not.toHaveBeenCalled();
  });

  it("does nothing during IME composition", () => {
    const done = vi.fn();
    handle({ "view.today": done });
    press("h", { isComposing: true });
    expect(done).not.toHaveBeenCalled();
  });

  it("repeats nothing that writes while a key is held", () => {
    const done = vi.fn();
    const today = vi.fn();
    handle({ "row.done": done, "view.today": today });
    document.body.innerHTML =
      '<article data-focus-key="todo-1"><button data-edit-button>A</button></article>';
    document.querySelector("button")!.focus();
    press("x", { repeat: true });
    press("h", { repeat: true });
    expect(done).not.toHaveBeenCalled();
    expect(today).toHaveBeenCalled();
  });

  it("acts with Space on the hovered row, unless a control has the focus", () => {
    const timer = vi.fn();
    handle({ "row.timer": timer });
    document.body.innerHTML =
      '<button id="elsewhere">Woanders</button><article data-focus-key="todo-7"><h3>Lesen</h3></article>';
    const row = document.querySelector("article")!;
    row
      .querySelector("h3")!
      .dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    const onRow = press(" ");
    expect(timer).toHaveBeenCalledWith({ row, key: "todo-7" });
    expect(onRow.defaultPrevented).toBe(true);

    timer.mockClear();
    const button = document.querySelector<HTMLButtonElement>("#elsewhere")!;
    button.focus();
    const onButton = press(" ", {}, button);
    expect(timer).not.toHaveBeenCalled();
    expect(onButton.defaultPrevented).toBe(false);
  });

  it("acts on nothing when no row is hovered or focused", () => {
    const done = vi.fn();
    handle({ "row.done": done });
    document.body.innerHTML = '<article data-focus-key="todo-1"></article>';
    expect(press("x").defaultPrevented).toBe(false);
    expect(done).not.toHaveBeenCalled();
  });

  it("turns single keys off per device, and the choice survives a reload", () => {
    const today = vi.fn();
    const menu = vi.fn();
    handle({ "view.today": today, "menu.open": menu });
    setSingleKeys(false);
    expect(localStorage.getItem("shortcuts:single-keys")).toBe("off");
    press("h");
    press("k", { ctrlKey: true });
    expect(today).not.toHaveBeenCalled();
    expect(menu).toHaveBeenCalled();

    reloadShortcutSettings();
    expect(singleKeys.value).toBe(false);
    setSingleKeys(true);
    reloadShortcutSettings();
    expect(singleKeys.value).toBe(true);
    press("h");
    expect(today).toHaveBeenCalled();
  });

  it("runs a shortcut for the command menu as if its key was pressed", () => {
    const create = vi.fn();
    handle({ "quest.new": create });
    expect(runShortcut("quest.new")).toBe(true);
    expect(create).toHaveBeenCalled();
    expect(runShortcut("focus.done")).toBe(false);
  });
});

describe("targetRow", () => {
  it("prefers the row the focus moved into after the pointer last moved", () => {
    handle({});
    document.body.innerHTML =
      '<article data-focus-key="a"><button>A</button></article><article data-focus-key="b"><button>B</button></article>';
    const [first, second] = document.querySelectorAll("article");
    second!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(targetRow()).toBe(second);
    first!.querySelector("button")!.focus();
    expect(targetRow()).toBe(first);
    second!.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    expect(targetRow()).toBe(second);
  });

  it("forgets the hovered row when the pointer leaves the window", () => {
    handle({});
    document.body.innerHTML = '<article data-focus-key="a"></article>';
    const row = document.querySelector("article")!;
    row.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    row.dispatchEvent(
      new MouseEvent("mouseout", { bubbles: true, relatedTarget: null }),
    );
    expect(targetRow()).toBeNull();
  });
});

describe("useKeyboardLikely", () => {
  it("follows a fine pointer that hovers", async () => {
    vi.resetModules();
    const matchMedia = vi.fn((query: string) => ({
      matches: query === "(hover: hover) and (pointer: fine)",
      addEventListener: () => undefined,
    }));
    vi.stubGlobal("matchMedia", matchMedia);
    const fresh = await import("./useShortcuts");
    expect(fresh.useKeyboardLikely().value).toBe(true);
    vi.unstubAllGlobals();
  });

  it("is off on a touch screen until a key reaches a shortcut", async () => {
    vi.resetModules();
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      addEventListener: () => undefined,
    }));
    const fresh = await import("./useShortcuts");
    const likely = fresh.useKeyboardLikely();
    expect(likely.value).toBe(false);
    mount(
      defineComponent({
        setup() {
          fresh.useShortcutHandlers({ "view.today": () => undefined });
          return () => h("div");
        },
      }),
      { attachTo: document.body },
    );
    press("h");
    expect(likely.value).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe("focusWhenReady", () => {
  it("focuses an element once it appears", async () => {
    const found = focusWhenReady(
      () => document.querySelector<HTMLElement>("input"),
      1000,
    );
    document.body.append(document.createElement("input"));
    expect(await found).toBe(true);
    expect(document.activeElement?.tagName).toBe("INPUT");
  });

  it("gives up quietly when it never comes", async () => {
    vi.useFakeTimers();
    const found = focusWhenReady(() => null, 100);
    vi.advanceTimersByTime(100);
    expect(await found).toBe(false);
    vi.useRealTimers();
  });
});
