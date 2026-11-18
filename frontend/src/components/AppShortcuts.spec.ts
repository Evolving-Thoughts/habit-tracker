import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import AppShortcuts from "./AppShortcuts.vue";
import { overlay } from "../composables/useShortcuts";
import {
  reloadThemeChoice,
  startTheme,
  themeChoice,
} from "../composables/useTheme";
import { VIEWS } from "../router";

enableAutoUnmount(afterEach);

// A light desktop with mouse and keyboard.
window.matchMedia = ((query: string) => ({
  matches: !query.includes("coarse") && !query.includes("color-scheme: dark"),
  addEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

beforeEach(() => {
  localStorage.clear();
  reloadThemeChoice();
  startTheme();
});

afterEach(() => {
  overlay.value = null;
});

async function openMenu() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: VIEWS.map(({ name, path }) => ({
      name,
      path,
      component: { render: () => null },
    })),
  });
  await router.push("/heute");
  const wrapper = mount(AppShortcuts, {
    attachTo: document.body,
    global: { plugins: [router] },
  });
  overlay.value = "menu";
  await flushPromises();
  const labels = () =>
    wrapper.findAll(".command-menu__label").map((label) => label.text());
  return { wrapper, labels };
}

describe("AppShortcuts: Darstellung in the command menu", () => {
  it("offers the two other looks as actions", async () => {
    const { labels } = await openMenu();
    expect(labels()).toContain("Darstellung: Hell");
    expect(labels()).toContain("Darstellung: Dunkel");
    expect(labels()).not.toContain("Darstellung: Wie das Gerät");
  });

  it("is found by the words people use", async () => {
    const { wrapper, labels } = await openMenu();
    const search = wrapper.get('input[role="combobox"]');
    for (const query of ["dunkel", "dark mode", "nachtmodus", "design"]) {
      await search.setValue(query);
      expect(labels()).toContain("Darstellung: Dunkel");
    }
  });

  it("switches the theme and closes the menu", async () => {
    const { wrapper } = await openMenu();
    const option = wrapper
      .findAll('[role="option"]')
      .find((entry) => entry.text().includes("Darstellung: Dunkel"))!;
    await option.trigger("click");
    await flushPromises();
    await nextTick();
    expect(overlay.value).toBeNull();
    expect(themeChoice.value).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    overlay.value = "menu";
    await flushPromises();
    const labels = wrapper
      .findAll(".command-menu__label")
      .map((label) => label.text());
    expect(labels).toContain("Darstellung: Wie das Gerät");
    expect(labels).toContain("Darstellung: Hell");
    expect(labels).not.toContain("Darstellung: Dunkel");
  });
});
