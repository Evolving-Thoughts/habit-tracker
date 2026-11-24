import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import AppShortcuts from "./AppShortcuts.vue";
import CommandMenu from "./CommandMenu.vue";
import { search } from "../api/search.api";
import { overlay } from "../composables/useShortcuts";
import {
  reloadThemeChoice,
  startTheme,
  themeChoice,
} from "../composables/useTheme";
import { VIEWS } from "../router";

vi.mock("../api/search.api", () => ({ search: vi.fn() }));
vi.mock("../api/day-planner.api", () => ({
  createHabit: vi.fn(),
  createTodo: vi.fn(),
}));
vi.mock("../api/categories.api", () => ({
  getCategories: vi.fn(async () => []),
  createCategory: vi.fn(),
}));
vi.mock("../api/todo-hierarchy.api", () => ({
  getTodoHierarchy: vi.fn(async () => []),
}));

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
  router.addRoute({ path: "/:rest(.*)*", component: { render: () => null } });
  const wrapper = mount(AppShortcuts, {
    attachTo: document.body,
    global: { plugins: [router] },
  });
  overlay.value = "menu";
  await flushPromises();
  const labels = () =>
    wrapper.findAll(".command-menu__label").map((label) => label.text());
  return { wrapper, labels, router };
}

describe("AppShortcuts: Suchen", () => {
  it("opens the same command menu, asking for the keyboard", async () => {
    const { wrapper } = await openMenu();
    expect(wrapper.getComponent(CommandMenu).props("openKeyboard")).toBe(false);
    overlay.value = "search";
    await flushPromises();
    expect(wrapper.getComponent(CommandMenu).props("openKeyboard")).toBe(true);
    expect(document.activeElement).toBe(
      wrapper.get(".command-menu__search").element,
    );
  });
});

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

describe("AppShortcuts: search results and new entries", () => {
  afterEach(() => vi.useRealTimers());

  async function pick(text: string, query?: string) {
    vi.useFakeTimers();
    const menu = await openMenu();
    if (query) {
      await menu.wrapper.get('input[role="combobox"]').setValue(query);
      await vi.advanceTimersByTimeAsync(250);
      await flushPromises();
    }
    const option = menu.wrapper
      .findAll('[role="option"]')
      .find((entry) => entry.text().includes(text))!;
    await option.trigger("click");
    await flushPromises();
    vi.useRealTimers();
    return menu;
  }

  it("leads a found campaign, reflection, day best and weekly review to their view", async () => {
    vi.mocked(search).mockResolvedValue({
      query: "buch",
      titles: [
        {
          kind: "campaign",
          id: 3,
          title: "Buch schreiben",
          highlight: { start: 0, end: 4 },
          done: false,
          scheduledDate: null,
          campaign: { id: 3, title: "Buch schreiben", color: null, icon: null },
        },
      ],
      texts: [
        {
          kind: "reflection",
          id: 1,
          label: "Reflexion vom 18. Nov.",
          snippet: "Buch gelesen",
          highlight: { start: 0, end: 4 },
          date: "2026-11-18",
          habitId: null,
        },
        {
          kind: "day-best",
          id: 4,
          label: "Das Beste vom 19. Nov.",
          snippet: "Ein Buch geschenkt bekommen",
          highlight: { start: 4, end: 8 },
          date: "2026-11-19",
          habitId: null,
        },
        {
          kind: "week-review",
          id: 2,
          label: "Wochenrückblick 16.–22. Nov. · Was lief gut?",
          snippet: "Buch begonnen",
          highlight: { start: 0, end: 4 },
          date: "2026-11-16",
          habitId: null,
        },
      ],
    });
    const path = async (text: string) =>
      (await pick(text, "buch")).router.currentRoute.value.fullPath;
    expect(await path("Buch schreiben")).toBe("/kampagnen?kampagne=3");
    expect(overlay.value).toBeNull();
    expect(await path("Reflexion vom 18. Nov.")).toBe(
      "/kalender?tag=2026-11-18",
    );
    expect(await path("Das Beste vom 19. Nov.")).toBe(
      "/das-beste?tag=2026-11-19",
    );
    expect(await path("Wochenrückblick")).toBe("/rueckblick?woche=2026-11-16");
  });

  it("opens Neue Kampagne and Neues Daily over the view", async () => {
    await pick("Neue Kampagne");
    expect(
      document.querySelector('dialog[aria-label="Neue Kampagne"]'),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Kampagne erstellen");
  });

  it("opens Neues Daily with the daily form", async () => {
    await pick("Neues Daily");
    expect(
      document.querySelector('dialog[aria-label="Neues Daily"]'),
    ).not.toBeNull();
  });
});

