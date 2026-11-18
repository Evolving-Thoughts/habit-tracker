import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import ShortcutOverview from "./ShortcutOverview.vue";
import {
  reloadShortcutSettings,
  setSingleKeys,
} from "../composables/useShortcuts";
import { SHORTCUTS } from "../utils/shortcuts";

enableAutoUnmount(afterEach);
beforeEach(() => {
  localStorage.clear();
  reloadShortcutSettings();
});

describe("ShortcutOverview", () => {
  it("lists every shortcut of the registry in its group, with key caps", () => {
    const wrapper = mount(ShortcutOverview, { attachTo: document.body });
    expect(wrapper.get("dialog").attributes("aria-label")).toBe("Tastenkürzel");
    expect(wrapper.findAll("h3").map((heading) => heading.text())).toEqual([
      "Ansichten",
      "Quests",
      "Fokus-Modus",
      "Allgemein",
    ]);
    expect(wrapper.findAll("dt")).toHaveLength(SHORTCUTS.length);
    const row = (label: string) =>
      wrapper
        .findAll(".shortcut-list__item")
        .find((item) => item.get("dt").text() === label)!;
    expect(
      row("Heute")
        .findAll("kbd")
        .map((key) => key.text()),
    ).toEqual(["H"]);
    expect(
      row("Befehle öffnen")
        .findAll("kbd")
        .map((key) => key.text()),
    ).toEqual(["Strg", "K"]);
    expect(row("Auf morgen verschieben").find("kbd").text()).toBe("D");
    expect(wrapper.text()).toContain(
      "Außer N gelten sie für die Zeile unter dem Mauszeiger oder mit dem Fokus",
    );
  });

  it("marks single keys as switched off and says what still works", async () => {
    const wrapper = mount(ShortcutOverview, { attachTo: document.body });
    setSingleKeys(false);
    await nextTick();
    expect(wrapper.text()).toContain("Einzelne Tasten sind ausgeschaltet");
    expect(wrapper.findAll(".shortcut-list__item--off")).toHaveLength(
      SHORTCUTS.filter((s) => !s.modifier && s.key.length === 1).length,
    );
    expect(wrapper.get(".shortcut-list__item--off dt").text()).toContain(
      "(ausgeschaltet)",
    );
  });

  it("links to the settings and closes with Escape", async () => {
    const wrapper = mount(ShortcutOverview, { attachTo: document.body });
    expect(wrapper.get("a").attributes("href")).toBe("#/einstellungen");
    await wrapper.get("dialog").trigger("cancel");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
});
