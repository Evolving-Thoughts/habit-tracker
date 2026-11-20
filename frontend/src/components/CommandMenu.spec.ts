import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import CommandMenu from "./CommandMenu.vue";
import { search } from "../api/search.api";
import { setSingleKeys } from "../composables/useShortcuts";
import type { SearchResponse } from "../types/search";
import type { Command } from "../utils/command-filter";

vi.mock("../api/search.api", () => ({ search: vi.fn() }));

enableAutoUnmount(afterEach);

const NOTHING: SearchResponse = { query: "", titles: [], texts: [] };
beforeEach(() => {
  vi.mocked(search).mockReset();
  vi.mocked(search).mockImplementation(async (query) => ({
    ...NOTHING,
    query,
  }));
});
afterEach(() => vi.useRealTimers());

/** Waits out the pause before the menu asks the server, and its answer. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(250);
  await flushPromises();
}

const FOUND: SearchResponse = {
  query: "kapitel",
  titles: [
    {
      kind: "quest",
      id: 7,
      title: "Kapitel 2 überarbeiten",
      highlight: { start: 0, end: 7 },
      done: false,
      scheduledDate: null,
      campaign: { id: 3, title: "Buch", color: "navy", icon: "book" },
    },
    {
      kind: "daily",
      id: 4,
      title: "Ein Kapitel lesen",
      highlight: { start: 4, end: 11 },
      done: false,
      scheduledDate: null,
      campaign: null,
    },
  ],
  texts: [
    {
      kind: "reflection",
      id: 1,
      label: "Reflexion vom 18. Nov.",
      snippet: "… dann das Kapitel <b>fertig</b> …",
      highlight: { start: 11, end: 18 },
      date: "2026-11-18",
      habitId: null,
    },
  ],
};

// A desktop with mouse and keyboard, where the menu shows the keys.
window.matchMedia = ((query: string) => ({
  matches: !query.includes("coarse"),
  addEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

const COMMANDS: Command[] = [
  {
    id: "view.today",
    label: "Heute",
    group: "Ansichten",
    shortcut: "view.today",
    run: vi.fn(),
  },
  {
    id: "view.plan",
    label: "Plan",
    group: "Ansichten",
    shortcut: "view.plan",
    run: vi.fn(),
  },
  {
    id: "view.review",
    label: "Wochenrückblick",
    group: "Ansichten",
    run: vi.fn(),
  },
  {
    id: "quest.new",
    label: "Neue Quest",
    group: "Aktionen",
    shortcut: "quest.new",
    run: vi.fn(),
  },
  {
    id: "menu.keys",
    label: "Tastenkürzel anzeigen",
    group: "Aktionen",
    run: vi.fn(),
  },
];

async function mountMenu() {
  const wrapper = mount(CommandMenu, {
    props: { commands: COMMANDS },
    attachTo: document.body,
  });
  await flushPromises();
  const input = wrapper.get<HTMLInputElement>('input[role="combobox"]');
  const options = () => wrapper.findAll('[role="option"]');
  const activeLabel = () => {
    const id = input.attributes("aria-activedescendant");
    return id ? wrapper.get(`#${id} .command-menu__label`).text() : null;
  };
  return { wrapper, input, options, activeLabel };
}

describe("CommandMenu", () => {
  it("is a combobox that controls a listbox of every command, in groups", async () => {
    const { wrapper, input, options } = await mountMenu();
    expect(wrapper.get("dialog").attributes("aria-label")).toBe("Befehle");
    expect(input.attributes("aria-controls")).toBe("command-menu-list");
    expect(input.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get("#command-menu-list").attributes("role")).toBe(
      "listbox",
    );
    expect(
      wrapper
        .findAll('[role="group"]')
        .map((group) => group.attributes("aria-label")),
    ).toEqual(["Ansichten", "Aktionen"]);
    expect(options()).toHaveLength(5);
    expect(document.activeElement).toBe(input.element);
  });

  it("moves with the arrow keys, Home and End, and wraps around", async () => {
    const { input, activeLabel, options } = await mountMenu();
    expect(activeLabel()).toBe("Heute");
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(activeLabel()).toBe("Plan");
    expect(options()[1]!.attributes("aria-selected")).toBe("true");
    expect(options()[0]!.attributes("aria-selected")).toBe("false");
    await input.trigger("keydown", { key: "End" });
    expect(activeLabel()).toBe("Tastenkürzel anzeigen");
    await input.trigger("keydown", { key: "ArrowDown" });
    expect(activeLabel()).toBe("Heute");
    await input.trigger("keydown", { key: "ArrowUp" });
    expect(activeLabel()).toBe("Tastenkürzel anzeigen");
    await input.trigger("keydown", { key: "Home" });
    expect(activeLabel()).toBe("Heute");
  });

  it("filters while typing, ignoring case and accents, and runs with Enter", async () => {
    const { wrapper, input, options, activeLabel } = await mountMenu();
    await input.setValue("RUCKBLICK");
    expect(
      options().map((option) => option.get(".command-menu__label").text()),
    ).toEqual(["Wochenrückblick"]);
    // A search is one flat list, best matches first.
    expect(wrapper.findAll('[role="group"]')).toHaveLength(0);
    expect(activeLabel()).toBe("Wochenrückblick");
    expect(wrapper.get('[role="status"]').text()).toBe("1 Treffer");
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("run")).toEqual([[COMMANDS[2]]]);
  });

  it("says in words when nothing matches, and what it searches", async () => {
    vi.useFakeTimers();
    const { wrapper, input, options } = await mountMenu();
    expect(wrapper.get("#command-menu-scope").text()).toBe(
      "Sucht in Ansichten, Befehlen, Titeln und Notizen.",
    );
    await input.setValue("xyz");
    await settle();
    expect(options()).toHaveLength(0);
    expect(input.attributes("aria-expanded")).toBe("false");
    expect(input.attributes("aria-activedescendant")).toBeUndefined();
    expect(wrapper.get(".command-menu__empty p").text()).toBe(
      "Nichts gefunden für „xyz“.",
    );
    expect(wrapper.get(".command-menu__empty").text()).toContain(
      "Sucht in Ansichten, Befehlen, Titeln und Notizen.",
    );
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Nichts gefunden für „xyz“.",
    );
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("run")).toBeUndefined();
  });

  it("shows the shortcut of each entry that has one, only while it works", async () => {
    const { options } = await mountMenu();
    const keys = () =>
      options().map((option) =>
        option
          .findAll("kbd")
          .map((key) => key.text())
          .join("+"),
      );
    expect(keys()).toEqual(["H", "P", "", "N", ""]);
    setSingleKeys(false);
    await nextTick();
    expect(keys()).toEqual(["", "", "", "", ""]);
    setSingleKeys(true);
  });

  it("runs a command on click", async () => {
    const { wrapper, options } = await mountMenu();
    await options()[3]!.trigger("click");
    expect(wrapper.emitted("run")).toEqual([[COMMANDS[3]]]);
  });

  it("closes with Ctrl+K and with Escape", async () => {
    const { wrapper, input } = await mountMenu();
    await input.trigger("keydown", { key: "k", ctrlKey: true });
    expect(wrapper.emitted("close")).toHaveLength(1);
    await wrapper.get("dialog").trigger("cancel");
    expect(wrapper.emitted("close")).toHaveLength(2);
  });

  describe("search in titles and texts", () => {
    beforeEach(() => vi.useFakeTimers());

    it("asks the server only from two characters on, after a pause", async () => {
      const { input } = await mountMenu();
      await input.setValue("k");
      await settle();
      expect(search).not.toHaveBeenCalled();
      await input.setValue("ka");
      await input.setValue("kap");
      expect(search).not.toHaveBeenCalled();
      await settle();
      expect(search).toHaveBeenCalledOnce();
      expect(vi.mocked(search).mock.calls[0]![0]).toBe("kap");
    });

    it("lists found titles and texts below the commands, the match marked as text", async () => {
      vi.mocked(search).mockResolvedValue(FOUND);
      const { wrapper, input } = await mountMenu();
      await input.setValue("Kapitel");
      await settle();
      expect(
        wrapper
          .findAll('[role="group"]')
          .map((group) => group.attributes("aria-label")),
      ).toEqual(["Kampagnen, Quests und Dailies", "In Notizen und Texten"]);
      const marks = wrapper.findAll("mark").map((mark) => mark.text());
      expect(marks).toEqual(["Kapitel", "Kapitel", "Kapitel"]);
      // A snippet is the user's own text: markup in it stays visible text.
      const snippet = wrapper.get(".command-menu__snippet");
      expect(snippet.text()).toBe("… dann das Kapitel <b>fertig</b> …");
      expect(snippet.find("b").exists()).toBe(false);
      expect(wrapper.text()).toContain("Quest");
      expect(wrapper.get(".campaign-chip").text()).toContain("Buch");
      expect(wrapper.get('[role="status"]').text()).toBe("5 Treffer");
    });

    it("opens a quest with Enter and offers its stopwatch and campaign as further options", async () => {
      vi.mocked(search).mockResolvedValue(FOUND);
      const { wrapper, input, activeLabel } = await mountMenu();
      await input.setValue("Kapitel");
      await settle();
      expect(activeLabel()).toBe("Kapitel 2 überarbeiten");
      await input.trigger("keydown", { key: "Enter" });
      expect(wrapper.emitted("open")).toEqual([
        [{ type: "edit-todo", id: 7 }],
      ]);

      await input.trigger("keydown", { key: "ArrowDown" });
      const side = () =>
        wrapper.get(`#${input.attributes("aria-activedescendant")}`);
      expect(side().attributes("aria-label")).toBe(
        "Stoppuhr starten für „Kapitel 2 überarbeiten“",
      );
      await input.trigger("keydown", { key: "Enter" });
      await input.trigger("keydown", { key: "ArrowDown" });
      expect(side().attributes("aria-label")).toBe("Zur Kampagne „Buch“");
      await side().trigger("click");
      await input.trigger("keydown", { key: "ArrowDown" });
      await input.trigger("keydown", { key: "Enter" });
      await input.trigger("keydown", { key: "ArrowDown" });
      await input.trigger("keydown", { key: "Enter" });
      expect(wrapper.emitted("open")!.slice(1)).toEqual([
        [{ type: "timer", id: 7, title: "Kapitel 2 überarbeiten" }],
        [{ type: "campaign", id: 3 }],
        [{ type: "edit-habit", id: 4 }],
        [{ type: "day", date: "2026-11-18" }],
      ]);
    });

    it("keeps the commands usable when the server cannot be asked", async () => {
      vi.mocked(search).mockRejectedValue(new TypeError("offline"));
      const { wrapper, input, options } = await mountMenu();
      await input.setValue("heute");
      await settle();
      expect(options()).toHaveLength(1);
      expect(wrapper.text()).toContain(
        "Titel und Notizen lassen sich gerade nicht durchsuchen.",
      );
    });
  });
});
