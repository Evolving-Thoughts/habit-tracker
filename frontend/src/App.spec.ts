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
        PushSettings: { template: "<button>Benachrichtigungen</button>" },
        TodayView: { template: '<main data-view="today">Today</main>' },
        TodoDumpView: { template: '<main data-view="dump">Dump</main>' },
        HabitsView: { template: '<main data-view="habits">Habits</main>' },
      },
    },
  });
}
describe("App navigation", () => {
  it("starts with Today and offers three views", async () => {
    const wrapper = mountApp();
    await flushPromises();
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
    expect(wrapper.findAll("nav button")).toHaveLength(5);
  });
  it("opens the habit overview and marks only that navigation button active", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await wrapper.findAll("nav button")[2]!.trigger("click");
    expect(wrapper.find('[data-view="habits"]').exists()).toBe(true);
    expect(wrapper.find('[data-view="today"]').exists()).toBe(false);
    expect(
      wrapper
        .findAll("nav button")
        .slice(0, 3)
        .map((button) => button.attributes("aria-pressed")),
    ).toEqual(["false", "false", "true"]);
  });
  it("can move from Habits to Todo-Dump and back to Today", async () => {
    const wrapper = mountApp();
    await flushPromises();
    await wrapper.findAll("nav button")[2]!.trigger("click");
    await wrapper.findAll("nav button")[1]!.trigger("click");
    expect(wrapper.find('[data-view="dump"]').exists()).toBe(true);
    await wrapper.findAll("nav button")[0]!.trigger("click");
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
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
    await wrapper.findAll("nav button")[2]!.trigger("click");
    await wrapper.findAll("nav button")[3]!.trigger("click");
    await flushPromises();
    expect(logout).toHaveBeenCalled();
    expect(wrapper.find("[data-view]").exists()).toBe(false);
  });
});
