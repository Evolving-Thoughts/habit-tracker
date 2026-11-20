import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getQuestTarget, setQuestTarget } from "../api/quest-hours.api";
import QuestTargetSetting from "./QuestTargetSetting.vue";

vi.mock("../api/quest-hours.api", () => ({
  getQuestTarget: vi.fn(),
  setQuestTarget: vi.fn(),
}));
enableAutoUnmount(afterEach);

const hours = (wrapper: ReturnType<typeof mount>) =>
  wrapper.get<HTMLInputElement>('input[name="weeklyQuestTargetHours"]');
const minutes = (wrapper: ReturnType<typeof mount>) =>
  wrapper.get<HTMLInputElement>('input[name="weeklyQuestTargetMinutes"]');

describe("QuestTargetSetting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getQuestTarget).mockResolvedValue({ weeklyTargetMinutes: 1220 });
    vi.mocked(setQuestTarget).mockImplementation((weeklyTargetMinutes) =>
      Promise.resolve({ weeklyTargetMinutes }),
    );
  });

  it("shows the goal of this week in hours and minutes", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    expect(hours(wrapper).element.value).toBe("20");
    expect(minutes(wrapper).element.value).toBe("20");
    expect(wrapper.text()).toContain("Gilt ab dieser Woche");
  });

  it("saves hours and minutes as minutes and says so quietly", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    await hours(wrapper).setValue("12");
    await minutes(wrapper).setValue("30");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(setQuestTarget).toHaveBeenCalledWith(750);
    expect(wrapper.get('[role="status"]').text()).toBe("Gespeichert.");
  });

  it("removes the goal when both fields are empty", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    await hours(wrapper).setValue("");
    await minutes(wrapper).setValue("");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(setQuestTarget).toHaveBeenCalledWith(null);
    expect(wrapper.get('[role="status"]').text()).toBe("Kein Wochenziel.");
  });

  it("rejects minutes beyond the hour", async () => {
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    await minutes(wrapper).setValue("75");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(setQuestTarget).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain("0 bis 59 Minuten");
  });

  it("offers to try again when the goal cannot be read", async () => {
    vi.mocked(getQuestTarget).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = mount(QuestTargetSetting);
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Offline");
    expect(hours(wrapper).element.disabled).toBe(true);
    await wrapper
      .findAll("button")
      .find((button) => button.text() === "Erneut versuchen")!
      .trigger("click");
    await flushPromises();
    expect(hours(wrapper).element.value).toBe("20");
  });
});
