import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import CommandMenu from "./CommandMenu.vue";
import { setSingleKeys } from "../composables/useShortcuts";
import type { Command } from "../utils/command-filter";

enableAutoUnmount(afterEach);

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

  it("says in words when nothing matches", async () => {
    const { wrapper, input, options } = await mountMenu();
    await input.setValue("xyz");
    expect(options()).toHaveLength(0);
    expect(input.attributes("aria-expanded")).toBe("false");
    expect(input.attributes("aria-activedescendant")).toBeUndefined();
    expect(wrapper.get(".command-menu__empty").text()).toBe(
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
});
