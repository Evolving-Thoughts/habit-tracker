import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQuestTarget, setQuestTarget } from "../api/quest-hours.api";
import QuestTargetSetting from "./QuestTargetSetting.vue";

vi.mock("../api/quest-hours.api", () => ({
  getQuestTarget: vi.fn(),
  setQuestTarget: vi.fn(),
}));
enableAutoUnmount(afterEach);

const input = (wrapper: ReturnType<typeof mount>) =>
  wrapper.get<HTMLInputElement>('input[name="weeklyQuestTarget"]');

describe("QuestTargetSetting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getQuestTarget).mockResolvedValue({ weeklyTargetMinutes: 1200 });
    vi.mocked(setQuestTarget).mockImplementation((weeklyTargetMinutes) =>
      Promise.resolve({ weeklyTargetMinutes }),
    );
  });

  it("shows the stored goal in hours", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    expect(input(wrapper).element.value).toBe("20");
  });

  it("saves hours as minutes and says so quietly", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    await input(wrapper).setValue("12.5");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(setQuestTarget).toHaveBeenCalledWith(750);
    expect(wrapper.get('[role="status"]').text()).toBe("Gespeichert.");
  });

  it("removes the goal when the field is empty", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    await input(wrapper).setValue("");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(setQuestTarget).toHaveBeenCalledWith(null);
    expect(wrapper.get('[role="status"]').text()).toBe("Kein Wochenziel.");
  });

  it("rejects a goal that is not in half hours", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    await input(wrapper).setValue("7.2");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(setQuestTarget).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("halben Stunden");
  });

  it("offers to try again when the goal cannot be read", async () => {
    vi.mocked(getQuestTarget).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
    expect(input(wrapper).element.disabled).toBe(true);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Erneut versuchen")!
      .trigger("click");
    await flushPromises();
    expect(input(wrapper).element.value).toBe("20");
  });
});
