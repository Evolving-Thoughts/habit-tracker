vi.mock("./api/auth.api", () => ({
  getMe: vi.fn(async () => ({ id: "user-a", email: "a@example.test" })),
  logout: vi.fn(async () => undefined),
}));
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory } from "vue-router";
import App from "./App.vue";
import { createAppRouter } from "./router";
import { getMe, logout } from "./api/auth.api";
beforeEach(() => {
  vi.mocked(getMe).mockResolvedValue({ id: "user-a", email: "a@example.test" });
  vi.mocked(logout).mockResolvedValue();
});
enableAutoUnmount(afterEach);
function mountApp() {
  return mount(App, {
    global: {
      plugins: [createAppRouter(createMemoryHistory())],
      stubs: {
        TodayView: { template: '<main data-view="today">Today</main>' },
        QuestlogView: { template: '<main data-view="dump">Dump</main>' },
        FocusView: { template: '<main data-view="focus">Focus</main>' },
        CalendarView: {
          template: '<main data-view="calendar">Calendar</main>',
        },
        CampaignsView: {
          template: '<main data-view="hierarchy">Tree</main>',
        },
        HabitsView: { template: '<main data-view="habits">Dailies</main>' },
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
    .findAll("nav a, nav button")
    .find(
      (button) =>
        (button.attributes("aria-label") ?? button.text().trim()) === name,
    )!;
}
/** Follows a navigation link and waits for the view to change. */
async function open(wrapper: ReturnType<typeof mountApp>, name: string) {
  await tab(wrapper, name).trigger("click");
  await flushPromises();
}
describe("App navigation", () => {
  it("starts with Today and offers the views", async () => {
    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
    // Four tabs and Plan for wide screens, Mehr, and five views behind it.
    expect(wrapper.findAll("nav a, nav button")).toHaveLength(11);
  });
  it("puts Plan after Heute on wide screens and first behind Mehr", async () => {
    const wrapper = mountApp();
    await flushPromises();
    const labels = (selector: string) =>
      wrapper.findAll(selector).map((link) => link.text());
    expect(labels(".tab-bar__inner > a")).toEqual([
      "Heute",
      "Plan",
      "Questlog",
      "Kampagnen",
      "Kalender",
    ]);
    expect(wrapper.get(".tab-bar__inner > a:nth-child(2)").classes()).toContain(
      "tab-bar__tab--wide",
    );
    expect(labels(".tab-bar__secondary a")[0]).toBe("Plan");
    expect(wrapper.get(".tab-bar__secondary a").classes()).toContain(
      "tab-bar__tab--narrow",
    );
  });
  it("opens the dailies and marks only that navigation link current", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await open(wrapper, "Dailies");
    expect(wrapper.find('[data-view="habits"]').exists()).toBe(true);
    expect(wrapper.find('[data-view="today"]').exists()).toBe(false);
    expect(
      wrapper
        .findAll("nav a")
        .filter((link) => link.attributes("aria-current") === "page")
        .map((link) => link.text()),
    ).toEqual(["Dailies"]);
  });
  it("shows the focus view alone, without the navigation around it", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await open(wrapper, "Fokus");
    expect(wrapper.find('[data-view="focus"]').exists()).toBe(true);
    expect(wrapper.find("nav").exists()).toBe(false);
  });
  it("sets the browser title and moves focus into the opened view", async () => {
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [createAppRouter(createMemoryHistory())] },
    });
    await flushPromises();
    await open(wrapper, "Einstellungen");
    expect(document.title).toBe("Einstellungen · Habit Tracker");
    expect(document.activeElement?.tagName).toBe("MAIN");
  });
  it("takes the token of an email link and drops it from the address", async () => {
    vi.mocked(getMe).mockResolvedValueOnce(null);
    const router = createAppRouter(createMemoryHistory());
    await router.push("/reset=abc_DEF-123");
    const wrapper = mount(App, { global: { plugins: [router] } });
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("today");
    expect(wrapper.text()).toContain("Neues Passwort");
  });
  it("opens the settings from the navigation", async () => {
    const wrapper = mountApp();
    await flushPromises();
    const button = tab(wrapper, "Einstellungen");
    await button.trigger("click");
  await flushPromises();
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
  it("can move from Dailies to Questlog and back to Today", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await open(wrapper, "Dailies");
    await open(wrapper, "Questlog");
    expect(wrapper.find('[data-view="dump"]').exists()).toBe(true);
    await open(wrapper, "Heute");
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
  });
});

it("opens the task hierarchy", async () => {
  const wrapper = mountApp();
  await flushPromises();
  const button = tab(wrapper, "Kampagnen");
  await button.trigger("click");
  await flushPromises();
  expect(wrapper.find('[data-view="hierarchy"]').exists()).toBe(true);
  expect(button.attributes("aria-current")).toBe("page");
});

describe("Calendar navigation", () => {
  it("opens the calendar as a main tab, without a separate Verlauf", async () => {
    const wrapper = mountApp();
    await flushPromises();
    expect(tab(wrapper, "Verlauf")).toBeUndefined();
    await open(wrapper, "Kalender");
    expect(wrapper.find('[data-view="calendar"]').exists()).toBe(true);
    expect(tab(wrapper, "Kalender").attributes("aria-current")).toBe("page");
  });

  it("opens and closes the Mehr menu", async () => {
    const wrapper = mountApp();
    await flushPromises();
    const more = wrapper.get(".tab-bar__more");
    expect(more.attributes("aria-expanded")).toBe("false");
    await more.trigger("click");
    expect(more.attributes("aria-expanded")).toBe("true");
    await open(wrapper, "Kampagnen");
    expect(more.attributes("aria-expanded")).toBe("false");
  });
});

describe("App boot error", () => {
  it("explains a lost connection calmly and retries", async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const wrapper = mountApp();
    await flushPromises();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("Keine Verbindung zum Server");
    expect(alert.text()).toContain("Deine Daten sind sicher.");
    expect(alert.text()).not.toContain("Failed to fetch");
    await alert.get("button.btn--primary").trigger("click");
    await flushPromises();
    expect(wrapper.find(".boot-error").exists()).toBe(false);
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
  });

  it("shows the message of other failures under the title", async () => {
    vi.mocked(getMe).mockRejectedValueOnce(new Error("Wartungsarbeiten"));
    const wrapper = mountApp();
    await flushPromises();
    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toContain("Keine Verbindung zum Server");
    expect(alert.text()).toContain("Wartungsarbeiten");
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
    await open(wrapper, "Einstellungen");
    await wrapper.get('[data-test="sign-out"]').trigger("click");
    await flushPromises();
    expect(logout).toHaveBeenCalled();
    expect(wrapper.find("[data-view]").exists()).toBe(false);
  });
});
