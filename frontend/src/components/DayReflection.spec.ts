import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getReflection, saveReflection } from "../api/reflections.api";
import DayReflection from "./DayReflection.vue";

vi.mock("../api/reflections.api", () => ({
  getReflection: vi.fn(),
  saveReflection: vi.fn(),
}));
enableAutoUnmount(afterEach);

async function render() {
  const wrapper = mount(DayReflection, { props: { date: "2026-10-30" } });
  await flushPromises();
  return wrapper;
}

describe("DayReflection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getReflection).mockResolvedValue({
      date: "2026-10-30",
      text: "Alt",
    });
    vi.mocked(saveReflection).mockImplementation(async (date, text) => ({
      date,
      text: text.trim(),
    }));
  });

  it("loads the day and saves a change", async () => {
    const wrapper = await render();
    const area = wrapper.find("textarea");
    expect((area.element as HTMLTextAreaElement).value).toBe("Alt");
    expect(wrapper.find("button").attributes("disabled")).toBeDefined();

    await area.setValue("Neu");
    await wrapper.find("form").trigger("submit");
    await flushPromises();

    expect(saveReflection).toHaveBeenCalledWith("2026-10-30", "Neu");
    expect(wrapper.find('[role="status"]').text()).toBe("Gespeichert");
  });

  it("reloads when the day changes", async () => {
    const wrapper = await render();
    vi.mocked(getReflection).mockResolvedValue({
      date: "2026-10-29",
      text: "Gestern",
    });
    await wrapper.setProps({ date: "2026-10-29" });
    await flushPromises();
    expect(
      (wrapper.find("textarea").element as HTMLTextAreaElement).value,
    ).toBe("Gestern");
  });

  it("keeps the text and shows the error when saving fails", async () => {
    vi.mocked(saveReflection).mockRejectedValueOnce(new Error("Offline"));
    const wrapper = await render();
    await wrapper.find("textarea").setValue("Wichtig");
    await wrapper.find("form").trigger("submit");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe("Offline");
    expect(
      (wrapper.find("textarea").element as HTMLTextAreaElement).value,
    ).toBe("Wichtig");
  });
});
