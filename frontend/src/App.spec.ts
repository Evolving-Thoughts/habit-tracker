vi.mock("./api/timers.api", async (original) => ({
  ...(await original<typeof import("./api/timers.api")>()),
  getCurrentTimer: vi.fn(async () => ({ serverNow: "", timer: null })),
}));
vi.mock("./api/auth.api", () => ({
  getMe: vi.fn(async () => ({ id: "user-a", email: "a@example.test" })),
  logout: vi.fn(async () => undefined),
}));
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { createMemoryHistory } from "vue-router";
import App from "./App.vue";
import { createAppRouter } from "./router";
import { getMe, logout } from "./api/auth.api";
import { getCurrentTimer } from "./api/timers.api";
import {
  reloadShortcutSettings,
  setSingleKeys,
} from "./composables/useShortcuts";
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
    // Nine view tabs (five of them for wide screens only), Mehr with
    // Suchen and the six views behind it on a phone, and the command button
    // and the gear of wide screens.
    expect(wrapper.findAll("nav a, nav button")).toHaveLength(19);
    expect(tab(wrapper, "Befehle").attributes("aria-keyshortcuts")).toBe(
      "Control+K",
    );
  });
  it("sends the old address of Kategorien to its section in Einstellungen", async () => {
    const router = createAppRouter(createMemoryHistory());
    await router.push("/kategorien");
    expect(router.currentRoute.value.fullPath).toBe(
      "/einstellungen?abschnitt=kategorien",
    );
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
    await flushPromises();
    const title = wrapper.get("#abschnitt-kategorien h2");
    expect(title.text()).toBe("Kategorien");
    expect(document.activeElement).toBe(title.element);
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
      // Its wide-screen tab and its entry behind Mehr; CSS shows one of them.
    ).toEqual(["Dailies", "Dailies"]);
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

describe("App keeps Heute alive", () => {
  it("puts Heute back instead of building it again; the Fokus-Modus and the rest unmount", async () => {
    const built = { today: 0, focus: 0, calendar: 0 };
    const counted = (name: string, key: keyof typeof built) =>
      defineComponent({
        name,
        setup() {
          built[key] += 1;
          return () => h("main", { "data-view": key });
        },
      });
    const router = createAppRouter(createMemoryHistory());
    const wrapper = mount(App, {
      global: {
        plugins: [router],
        stubs: {
          TodayView: counted("TodayView", "today"),
          FocusView: counted("FocusView", "focus"),
          CalendarView: counted("CalendarView", "calendar"),
        },
      },
    });
    await flushPromises();
    const visits = ["focus", "today", "calendar", "today", "focus", "today"];
    for (const name of visits) {
      await router.push({ name });
      await flushPromises();
    }
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
    expect(wrapper.find('[data-view="focus"]').exists()).toBe(false);
    expect(built).toEqual({ today: 1, focus: 2, calendar: 1 });
  });
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

describe("App shortcuts", () => {
  const press = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    document.body.dispatchEvent(event);
    return event;
  };
  beforeEach(() => {
    localStorage.clear();
    reloadShortcutSettings();
    vi.mocked(getCurrentTimer).mockResolvedValue({
      serverNow: "",
      timer: null,
    });
  });

  it("opens the views with their letters and the Fokus-Modus with F", async () => {
    const wrapper = mountApp();
    await flushPromises();
    press("q");
    await flushPromises();
    expect(wrapper.find('[data-view="dump"]').exists()).toBe(true);
    press("k");
    await flushPromises();
    expect(wrapper.find('[data-view="calendar"]').exists()).toBe(true);
    press("a");
    await flushPromises();
    expect(wrapper.find('[data-view="habits"]').exists()).toBe(true);
    press(",");
    await flushPromises();
    expect(wrapper.find('[data-view="settings"]').exists()).toBe(true);
    press("f");
    await flushPromises();
    expect(wrapper.find('[data-view="focus"]').exists()).toBe(true);
  });

  it("takes N to Heute where a view has no quest dialog of its own", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await open(wrapper, "Dailies");
    press("n");
    await flushPromises();
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
  });

  it("opens the command menu with Ctrl+K and runs a view from it", async () => {
    const wrapper = mount(App, {
      attachTo: document.body,
      global: {
        plugins: [createAppRouter(createMemoryHistory())],
        stubs: {
          TodayView: { template: '<main data-view="today">Today</main>' },
          WeekReviewView: {
            template: '<main data-view="review">Review</main>',
          },
        },
      },
    });
    await flushPromises();
    expect(press("k", { ctrlKey: true }).defaultPrevented).toBe(true);
    await flushPromises();
    const input = wrapper.get<HTMLInputElement>('input[role="combobox"]');
    await input.setValue("ruckblick");
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(wrapper.find('input[role="combobox"]').exists()).toBe(false);
    expect(wrapper.find('[data-view="review"]').exists()).toBe(true);
  });

  it("lists the views in the command menu in the order of the navigation", async () => {
    const wrapper = mountApp();
    await flushPromises();
    press("k", { ctrlKey: true });
    await flushPromises();
    const views = wrapper.get('[role="group"][aria-label="Ansichten"]');
    expect(
      views.findAll(".command-menu__label").map((label) => label.text()),
    ).toEqual([
      "Heute",
      "Fokus",
      "Kalender",
      "Plan",
      "Questlog",
      "Kampagnen",
      "Dailies",
      "Wochenrückblick",
      "Das Beste",
      "Einstellungen",
      "Kategorien",
    ]);
    // Kategorien opens its section in Einstellungen.
    await views.findAll('[role="option"]').at(-1)!.trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-view="settings"]').exists()).toBe(true);
  });

  it("offers to pause the running stopwatch in the command menu", async () => {
    vi.mocked(getCurrentTimer).mockResolvedValue({
      serverNow: "2026-10-02T06:00:00Z",
      timer: {
        id: "t",
        kind: "todo",
        targetId: 1,
        title: "Lesen",
        state: "running",
        elapsedMilliseconds: 0,
        targetMinutes: null,
        targetReachedAt: null,
      },
    });
    const wrapper = mountApp();
    await flushPromises();
    press("k", { ctrlKey: true });
    await flushPromises();
    expect(
      wrapper.findAll('[role="option"]').map((option) => option.text()),
    ).toContain("Stoppuhr pausieren: Lesen");
  });

  it("opens the overview with ?, but not once single keys are off", async () => {
    const wrapper = mountApp();
    await flushPromises();
    press("?", { shiftKey: true });
    await flushPromises();
    expect(wrapper.get("dialog").attributes("aria-label")).toBe("Tastenkürzel");
    await wrapper.get("dialog").trigger("cancel");
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);

    setSingleKeys(false);
    press("?", { shiftKey: true });
    await flushPromises();
    expect(wrapper.find("dialog").exists()).toBe(false);
    setSingleKeys(true);
  });

  it("handles no shortcut before signing in", async () => {
    vi.mocked(getMe).mockResolvedValueOnce(null);
    const wrapper = mountApp();
    await flushPromises();
    expect(press("q").defaultPrevented).toBe(false);
    expect(press("k", { ctrlKey: true }).defaultPrevented).toBe(false);
    expect(wrapper.find('input[role="combobox"]').exists()).toBe(false);
  });
});
