import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DayEndSetting from "./DayEndSetting.vue";
import { getReplan, setDayEnd } from "../api/replan.api";

vi.mock("../api/replan.api", () => ({
  getReplan: vi.fn(),
  setDayEnd: vi.fn(),
}));

describe("DayEndSetting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReplan).mockResolvedValue({
      confirmationToken: "token",
      dayEnd: "22:00",
      changes: [],
    });
  });

  it("shows the stored day end and saves a change", async () => {
    const wrapper = mount(DayEndSetting);
    await flushPromises();
    const input = wrapper.get("input");
    expect(input.element.value).toBe("22:00");
    await input.setValue("20:30");
    await input.trigger("change");
    await flushPromises();
    expect(setDayEnd).toHaveBeenCalledWith("20:30");
  });

  it("reports a failed save", async () => {
    vi.mocked(setDayEnd).mockRejectedValue(new Error("Nicht gespeichert"));
    const wrapper = mount(DayEndSetting);
    await flushPromises();
    await wrapper.get("input").trigger("change");
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Nicht gespeichert");
  });
});
