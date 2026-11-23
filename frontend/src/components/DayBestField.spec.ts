import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { saveDayBest } from "../api/day-bests.api";
import DayBestField from "./DayBestField.vue";

vi.mock("../api/day-bests.api", () => ({ saveDayBest: vi.fn() }));
enableAutoUnmount(afterEach);

function render(text = "") {
  return mount(DayBestField, {
    props: { date: "2026-11-23", text, label: "Das Beste von heute" },
    attachTo: document.body,
  });
}
const area = (wrapper: ReturnType<typeof render>) =>
  wrapper.get("textarea").element as HTMLTextAreaElement;

describe("DayBestField", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveDayBest).mockImplementation(async (date, text) => ({
      date,
      text: text.replace(/\s+/g, " ").trim(),
    }));
  });

  it("saves the line on Enter instead of breaking it, and says so politely", async () => {
    const wrapper = render();
    await wrapper.get("textarea").setValue("  Schnee im Garten ");
    await wrapper.get("textarea").trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(saveDayBest).toHaveBeenCalledWith(
      "2026-11-23",
      "  Schnee im Garten ",
    );
    expect(area(wrapper).value).toBe("Schnee im Garten");
    expect(wrapper.get('[role="status"]').text()).toBe("Gespeichert");
    expect(wrapper.emitted("saved")).toEqual([
      [{ date: "2026-11-23", text: "Schnee im Garten" }],
    ]);
  });

  it("saves when the field is left, but only what changed", async () => {
    const wrapper = render("Alt");
    await wrapper.get("textarea").trigger("blur");
    expect(saveDayBest).not.toHaveBeenCalled();
    await wrapper.get("textarea").setValue("Alt ");
    await wrapper.get("textarea").trigger("blur");
    expect(saveDayBest).not.toHaveBeenCalled();
    await wrapper.get("textarea").setValue("Neu");
    await wrapper.get("textarea").trigger("blur");
    await flushPromises();
    expect(saveDayBest).toHaveBeenCalledTimes(1);
  });

  it("gives up what was typed on Escape", async () => {
    const wrapper = render("Alt");
    await wrapper.get("textarea").setValue("Neu");
    await wrapper.get("textarea").trigger("keydown", { key: "Escape" });
    expect(area(wrapper).value).toBe("Alt");
    expect(wrapper.emitted("cancel")).toHaveLength(1);
    await wrapper.get("textarea").trigger("blur");
    expect(saveDayBest).not.toHaveBeenCalled();
  });

  it("shows a counter only near the 280-character limit", async () => {
    const wrapper = render();
    expect(area(wrapper).maxLength).toBe(280);
    await wrapper.get("textarea").setValue("x".repeat(239));
    expect(wrapper.find(".day-best-field__count").exists()).toBe(false);
    expect(wrapper.get("textarea").attributes("aria-describedby")).toBe(
      undefined,
    );
    await wrapper.get("textarea").setValue("x".repeat(250));
    const counter = wrapper.get(".day-best-field__count");
    expect(counter.text()).toContain("250 / 280");
    expect(counter.text()).toContain("Noch 30 von 280 Zeichen frei.");
    expect(wrapper.get("textarea").attributes("aria-describedby")).toBe(
      counter.attributes("id"),
    );
  });

  it("keeps the line when saving fails and offers to try again", async () => {
    vi.mocked(saveDayBest).mockRejectedValueOnce(new TypeError("offline"));
    const wrapper = render();
    await wrapper.get("textarea").setValue("Abendrot");
    await wrapper.get("textarea").trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Keine Verbindung zum Server. Deine Zeile bleibt hier stehen.",
    );
    expect(area(wrapper).value).toBe("Abendrot");
    await wrapper.get(".day-best-field__retry").trigger("click");
    await flushPromises();
    expect(saveDayBest).toHaveBeenCalledTimes(2);
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
