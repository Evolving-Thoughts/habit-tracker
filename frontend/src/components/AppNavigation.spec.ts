import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import AppNavigation from "./AppNavigation.vue";
import { overlay } from "../composables/useShortcuts";
import { VIEWS } from "../router";

enableAutoUnmount(afterEach);

async function mountNavigation(path = "/heute") {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: VIEWS.map(({ name, path: viewPath }) => ({
      name,
      path: viewPath,
      component: { render: () => null },
    })),
  });
  await router.push(path);
  const wrapper = mount(AppNavigation, {
    attachTo: document.body,
    global: { plugins: [router] },
  });
  await flushPromises();
  const more = wrapper.get<HTMLButtonElement>(".tab-bar__more");
  const menu = wrapper.get("#more-views");
  return { wrapper, router, more, menu };
}

describe("AppNavigation: Mehr", () => {
  it("is a labelled disclosure button that controls the list of views", async () => {
    const { more, menu } = await mountNavigation();
    expect(more.text()).toContain("Mehr");
    expect(more.attributes("aria-controls")).toBe("more-views");
    expect(more.attributes("aria-expanded")).toBe("false");
    expect(menu.attributes("data-open")).toBeUndefined();
    // Labelled links with icon and name, in the order of the navigation;
    // Kategorien is a section of Einstellungen, not a view of its own.
    expect(menu.findAll("a").map((link) => link.text())).toEqual([
      "Fokus",
      "Plan",
      "Dailies",
      "Wochenrückblick",
      "Das Beste",
      "Einstellungen",
    ]);
    expect(menu.findAll("a svg")).toHaveLength(6);
  });

  it("opens and closes on click", async () => {
    const { more, menu } = await mountNavigation();
    await more.trigger("click");
    expect(more.attributes("aria-expanded")).toBe("true");
    expect(menu.attributes("data-open")).toBeDefined();
    await more.trigger("click");
    expect(more.attributes("aria-expanded")).toBe("false");
  });

  it("closes with Escape and gives the focus back to the button", async () => {
    const { wrapper, more } = await mountNavigation();
    await more.trigger("click");
    wrapper.get<HTMLAnchorElement>("#more-views a").element.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flushPromises();
    expect(more.attributes("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(more.element);
  });

  it("closes on a click outside, but not on a click inside", async () => {
    const { wrapper, more } = await mountNavigation();
    await more.trigger("click");
    wrapper
      .get("#more-views")
      .element.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(more.attributes("aria-expanded")).toBe("true");
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await flushPromises();
    expect(more.attributes("aria-expanded")).toBe("false");
  });

  it("closes when Tab leaves it", async () => {
    const { wrapper, more } = await mountNavigation();
    await more.trigger("click");
    const command = wrapper.get(".tab-bar__command");
    await wrapper.get(".tab-bar__more-group").trigger("focusout", {
      relatedTarget: command.element,
    });
    expect(more.attributes("aria-expanded")).toBe("false");
  });

  it("stays open while the focus walks through its links", async () => {
    const { wrapper, more } = await mountNavigation();
    await more.trigger("click");
    await wrapper.get(".tab-bar__more-group").trigger("focusout", {
      relatedTarget: wrapper.get("#more-views a").element,
    });
    expect(more.attributes("aria-expanded")).toBe("true");
  });

  it("closes on navigation and marks itself current for its views", async () => {
    const { wrapper, router, more } = await mountNavigation();
    await more.trigger("click");
    await wrapper.findAll("#more-views a")[5]!.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("settings");
    expect(more.attributes("aria-expanded")).toBe("false");
    expect(more.attributes("data-active")).toBeDefined();
  });

  it("is not current for a view with its own tab on the phone", async () => {
    const { more } = await mountNavigation("/kalender");
    expect(more.attributes("data-active")).toBeUndefined();
  });
});

describe("AppNavigation: command button", () => {
  it("opens the command menu and names its shortcut", async () => {
    const { wrapper } = await mountNavigation();
    const button = wrapper.get(".tab-bar__command");
    expect(button.text()).toContain("Befehle");
    expect(button.attributes("aria-keyshortcuts")).toBe("Control+K");
    await button.trigger("click");
    expect(overlay.value).toBe("menu");
    overlay.value = null;
  });
});

describe("AppNavigation: top bar", () => {
  it("lists the views in groups by intent, Einstellungen apart", async () => {
    const { wrapper } = await mountNavigation();
    const tabs = wrapper.findAll(".tab-bar__inner > a.tab-bar__view");
    expect(tabs.map((tab) => tab.text())).toEqual([
      "Heute",
      "Fokus",
      "Kalender",
      "Plan",
      "Questlog",
      "Kampagnen",
      "Dailies",
      "Wochenrückblick",
      "Das Beste",
    ]);
    // Each group after the first starts with a little more space.
    expect(
      tabs
        .filter((tab) => tab.classes("tab-bar__view--group"))
        .map((tab) => tab.text()),
    ).toEqual(["Kalender", "Kampagnen", "Wochenrückblick"]);
    // The phone keeps four of them as tabs; the rest sit behind Mehr there.
    expect(
      tabs
        .filter((tab) => !tab.classes("tab-bar__view--secondary"))
        .map((tab) => tab.text()),
    ).toEqual(["Heute", "Kalender", "Questlog", "Kampagnen"]);
  });

  it("ends with Einstellungen as a gear after the command button", async () => {
    const { wrapper, router } = await mountNavigation();
    const items = wrapper.findAll(".tab-bar__inner > *");
    const gear = wrapper.get(".tab-bar__settings");
    expect(items.at(-2)!.classes()).toContain("tab-bar__command");
    expect(items.at(-1)!.element).toBe(gear.element);
    expect(gear.text()).toBe("Einstellungen");
    expect(gear.get("span").classes()).toContain("visually-hidden");
    expect(gear.attributes("title")).toBe("Einstellungen (,)");
    expect(gear.attributes("aria-keyshortcuts")).toBe(",");
    await gear.trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("settings");
    expect(gear.attributes("aria-current")).toBe("page");
  });
});
