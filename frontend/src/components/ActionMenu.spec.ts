import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ActionMenu from "./ActionMenu.vue";
import type { MenuEntry } from "../utils/row-actions";

enableAutoUnmount(afterEach);
afterEach(() => {
  document.body.innerHTML = "";
});

const entries = (run = vi.fn()): MenuEntry[] => [
  { id: "a", label: "Morgen", icon: "tomorrow", run, shortcut: "row.tomorrow" },
  { id: "b", label: "Gesperrt", icon: "calendar", run, disabled: true },
  {
    id: "c",
    label: "Löschen",
    icon: "trash",
    ariaLabel: "Lesen löschen",
    run,
    last: true,
  },
];

function mountMenu(list = entries()) {
  return mount(ActionMenu, {
    props: { title: "Lesen", entries: list, triggerKey: 7 },
    attachTo: document.body,
  });
}

describe("ActionMenu", () => {
  it("is one button named after its item that opens a labelled menu", async () => {
    const wrapper = mountMenu();
    const trigger = wrapper.get("button");
    expect(trigger.attributes("aria-label")).toBe("Aktionen für Lesen");
    expect(trigger.attributes("aria-haspopup")).toBe("menu");
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("data-menu-trigger")).toBe("7");

    await trigger.trigger("click");
    await flushPromises();
    expect(trigger.attributes("aria-expanded")).toBe("true");
    const menu = wrapper.get(`#${trigger.attributes("aria-controls")}`);
    expect(menu.attributes("role")).toBe("menu");
    expect(wrapper.get(`#${menu.attributes("aria-labelledby")}`).text()).toBe(
      "Lesen",
    );
    // The first entry takes the focus; the last stands apart, still in ink.
    expect(document.activeElement?.textContent).toContain("Morgen");
    expect(wrapper.get('[data-entry="c"]').classes()).toContain(
      "action-menu__item--last",
    );
    expect(wrapper.get('[data-entry="c"]').attributes("aria-label")).toBe(
      "Lesen löschen",
    );
  });

  it("walks the enabled entries with the arrow keys, Home and End", async () => {
    const wrapper = mountMenu();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    const menu = wrapper.get("[role=menu]");
    await menu.trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Löschen");
    await menu.trigger("keydown", { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toContain("Morgen");
    await menu.trigger("keydown", { key: "End" });
    expect(document.activeElement?.textContent).toContain("Löschen");
    await menu.trigger("keydown", { key: "Home" });
    expect(document.activeElement?.textContent).toContain("Morgen");
  });

  it("runs an entry after handing the focus back to its button", async () => {
    const run = vi.fn(() => document.activeElement);
    const wrapper = mountMenu(entries(run));
    const trigger = wrapper.get("button");
    await trigger.trigger("click");
    await flushPromises();
    await wrapper.get('[data-entry="a"]').trigger("click");
    expect(run).toHaveBeenCalledOnce();
    expect(run.mock.results[0]!.value).toBe(trigger.element);
    expect(wrapper.find("[role=menu]").exists()).toBe(false);
  });

  it("closes with Escape and with a tap beside it", async () => {
    const wrapper = mountMenu();
    const trigger = wrapper.get("button");
    await trigger.trigger("click");
    await flushPromises();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(wrapper.find("[role=menu]").exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);

    await trigger.trigger("click");
    await flushPromises();
    await wrapper.get(".action-menu__scrim").trigger("click");
    expect(wrapper.find("[role=menu]").exists()).toBe(false);
  });

  it("names the key that does the same, and closes when its row gets busy", async () => {
    const wrapper = mountMenu();
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(
      wrapper.get('[data-entry="a"]').attributes("aria-keyshortcuts"),
    ).toBe("D");
    expect(
      wrapper.get('[data-entry="b"]').attributes("aria-keyshortcuts"),
    ).toBeUndefined();
    await wrapper.setProps({ disabled: true });
    expect(wrapper.find("[role=menu]").exists()).toBe(false);
    expect(wrapper.get("button").attributes("disabled")).toBeDefined();
  });

  it("takes another spoken name for its button where the title is taken", () => {
    const wrapper = mount(ActionMenu, {
      props: {
        title: "Lesen",
        entries: entries(),
        label: "Weitere Aktionen der Stoppuhr",
      },
    });
    expect(wrapper.get("button").attributes("aria-label")).toBe(
      "Weitere Aktionen der Stoppuhr",
    );
  });
});
