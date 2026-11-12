vi.mock("./api/auth.api", () => ({
  getMe: vi.fn(async () => ({ id: "user-a", email: "a@example.test" })),
  logout: vi.fn(async () => undefined),
}));
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.vue";
import { getMe, logout } from "./api/auth.api";
beforeEach(() => {
  vi.mocked(getMe).mockResolvedValue({ id: "user-a", email: "a@example.test" });
  vi.mocked(logout).mockResolvedValue();
});
enableAutoUnmount(afterEach);
function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        TodayView: { template: '<main data-view="today">Today</main>' },
        TodoDumpView: { template: '<main data-view="dump">Dump</main>' },
        HistoryView: { template: '<main data-view="history">History</main>' },
        TodoHierarchyView: {
          template: '<main data-view="hierarchy">Tree</main>',
        },
        HabitsView: { template: '<main data-view="habits">Habits</main>' },
        SettingsView: {
          emits: ["signOut"],
          template:
            '<main data-view="settings"><button data-test="sign-out" @click="$emit(\'signOut\')">Abmelden</button></main>',
        },
      },
    },
  });
}
function tab(wrapper: ReturnType<typeof mountApp>, name: string) {
  return wrapper
    .findAll("nav button")
    .find(
      (button) =>
        (button.attributes("aria-label") ?? button.text().trim()) === name,
    )!;
}
describe("App navigation", () => {
  it("starts with Today and offers five views", async () => {
    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
    // Four tabs, Mehr, and four views behind it.
    expect(wrapper.findAll("nav button")).toHaveLength(9);
  });
  it("opens the habit overview and marks only that navigation button active", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await tab(wrapper, "Habits").trigger("click");
    expect(wrapper.find('[data-view="habits"]').exists()).toBe(true);
    expect(wrapper.find('[data-view="today"]').exists()).toBe(false);
    expect(
      wrapper
        .findAll("nav button")
        .slice(0, 4)
        .map((button) => button.attributes("aria-current")),
    ).toEqual([undefined, undefined, "page", undefined]);
  });
  it("opens the settings from the navigation", async () => {
    const wrapper = mountApp();
    await flushPromises();
    const button = tab(wrapper, "Einstellungen");
    await button.trigger("click");
    expect(wrapper.find('[data-view="settings"]').exists()).toBe(true);
    expect(button.attributes("aria-current")).toBe("page");
    expect(
      wrapper.get(".tab-bar__more").attributes("data-active"),
    ).toBeDefined();
  });
  it("returns from Google into the settings and cleans the address", async () => {
    history.replaceState(null, "", "/?calendar=connected");
    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.find('[data-view="settings"]').exists()).toBe(true);
    expect(window.location.search).toBe("");
  });
  it("can move from Habits to Todo-Dump and back to Today", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await tab(wrapper, "Habits").trigger("click");
    await tab(wrapper, "Todo-Dump").trigger("click");
    expect(wrapper.find('[data-view="dump"]').exists()).toBe(true);
    await tab(wrapper, "Heute").trigger("click");
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
  });
});

it("opens the task hierarchy", async () => {
  const wrapper = mountApp();
  await flushPromises();
  const button = tab(wrapper, "Aufgabenbaum");
  await button.trigger("click");
  expect(wrapper.find('[data-view="hierarchy"]').exists()).toBe(true);
  expect(button.attributes("aria-current")).toBe("page");
});

describe("History navigation", () => {
  it("opens history and marks it active", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await tab(wrapper, "Verlauf").trigger("click");
    expect(wrapper.find('[data-view="history"]').exists()).toBe(true);
    expect(tab(wrapper, "Verlauf").attributes("aria-current")).toBe("page");
  });

  it("opens and closes the Mehr menu", async () => {
    const wrapper = mountApp();
    await flushPromises();
    const more = wrapper.get(".tab-bar__more");
    expect(more.attributes("aria-expanded")).toBe("false");
    await more.trigger("click");
    expect(more.attributes("aria-expanded")).toBe("true");
    await tab(wrapper, "Verlauf").trigger("click");
    expect(more.attributes("aria-expanded")).toBe("false");
  });
});

describe("App authentication boundary", () => {
  it("does not mount private views for an anonymous user", async () => {
    vi.mocked(getMe).mockResolvedValueOnce(null);
    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.find("nav").exists()).toBe(false);
    expect(wrapper.find("[data-view]").exists()).toBe(false);
    expect(wrapper.text()).toContain("Willkommen zurück");
  });
  it("unmounts private data when the session expires", async () => {
    const wrapper = mountApp();
    await flushPromises();
    window.dispatchEvent(new Event("auth-expired"));
    await flushPromises();
    expect(wrapper.find("[data-view]").exists()).toBe(false);
    expect(wrapper.find("nav").exists()).toBe(false);
  });
  it("logs out without retaining the previous view", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await tab(wrapper, "Einstellungen").trigger("click");
    await wrapper.get('[data-test="sign-out"]').trigger("click");
    await flushPromises();
    expect(logout).toHaveBeenCalled();
    expect(wrapper.find("[data-view]").exists()).toBe(false);
  });
});
