import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App.vue";
enableAutoUnmount(afterEach);
function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        TodayView: { template: '<main data-view="today">Today</main>' },
        TodoDumpView: { template: '<main data-view="dump">Dump</main>' },
        HabitsView: { template: '<main data-view="habits">Habits</main>' },
      },
    },
  });
}
describe("App navigation", () => {
  it("starts with Today and offers three views", () => {
    const wrapper = mountApp();
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
    expect(wrapper.findAll("nav button")).toHaveLength(3);
  });
  it("opens the habit overview and marks only that navigation button active", async () => {
    const wrapper = mountApp();
    await wrapper.findAll("nav button")[2]!.trigger("click");
    expect(wrapper.find('[data-view="habits"]').exists()).toBe(true);
    expect(wrapper.find('[data-view="today"]').exists()).toBe(false);
    expect(
      wrapper
        .findAll("nav button")
        .map((button) => button.attributes("aria-pressed")),
    ).toEqual(["false", "false", "true"]);
  });
  it("can move from Habits to Todo-Dump and back to Today", async () => {
    const wrapper = mountApp();
    await wrapper.findAll("nav button")[2]!.trigger("click");
    await wrapper.findAll("nav button")[1]!.trigger("click");
    expect(wrapper.find('[data-view="dump"]').exists()).toBe(true);
    await wrapper.findAll("nav button")[0]!.trigger("click");
    expect(wrapper.find('[data-view="today"]').exists()).toBe(true);
  });
});
