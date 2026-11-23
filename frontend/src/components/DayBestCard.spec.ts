import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getDayBest,
  getDayBestSettings,
  saveDayBest,
} from "../api/day-bests.api";
import DayBestCard from "./DayBestCard.vue";

vi.mock("../api/day-bests.api", () => ({
  getDayBest: vi.fn(),
  getDayBestSettings: vi.fn(),
  saveDayBest: vi.fn(),
}));
enableAutoUnmount(afterEach);

/** Sets the Berlin wall clock (November: UTC+1). */
function at(time: string): void {
  vi.setSystemTime(new Date(`2026-11-23T${time}:00+01:00`));
}

async function render() {
  const wrapper = mount(DayBestCard, {
    props: { date: "2026-11-23" },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

describe("DayBestCard in Heute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.mocked(getDayBestSettings).mockResolvedValue({
      cardTime: "20:00",
      reminderEnabled: true,
    });
    vi.mocked(getDayBest).mockResolvedValue({ date: "2026-11-23", text: "" });
    vi.mocked(saveDayBest).mockImplementation(async (date, text) => ({
      date,
      text: text.trim(),
    }));
  });
  afterEach(() => vi.useRealTimers());

  it("stays away before the card time and appears on time", async () => {
    at("19:58");
    const wrapper = await render();
    expect(wrapper.find(".day-best-card").exists()).toBe(false);
    expect(getDayBest).not.toHaveBeenCalled();

    // The clock wakes at 20:00 by itself, without polling.
    await vi.advanceTimersByTimeAsync(2 * 60_000 + 1000);
    await flushPromises();
    expect(wrapper.get("h2").text()).toBe("Das Beste des Tages?");
    expect(getDayBest).toHaveBeenCalledWith("2026-11-23");
    expect(wrapper.get("textarea").attributes("placeholder")).toContain(
      "Was war heute das Beste?",
    );
  });

  it("follows the card time of the settings", async () => {
    vi.mocked(getDayBestSettings).mockResolvedValue({
      cardTime: "21:30",
      reminderEnabled: true,
    });
    at("21:00");
    const early = await render();
    expect(early.find(".day-best-card").exists()).toBe(false);
    early.unmount();
    at("21:30");
    const due = await render();
    expect(due.find(".day-best-card").exists()).toBe(true);
  });

  it("shows a written line quietly, with a pencil to change it", async () => {
    vi.mocked(getDayBest).mockResolvedValue({
      date: "2026-11-23",
      text: "Abendessen mit Freunden",
    });
    at("22:00");
    const wrapper = await render();
    expect(wrapper.get("h2").text()).toBe("Das Beste des Tages");
    expect(wrapper.text()).toContain("Abendessen mit Freunden");
    expect(wrapper.find("textarea").exists()).toBe(false);
    await wrapper
      .get('button[aria-label="Das Beste des Tages bearbeiten"]')
      .trigger("click");
    expect(
      (wrapper.get("textarea").element as HTMLTextAreaElement).value,
    ).toBe("Abendessen mit Freunden");
  });

  it("turns into the quiet line after saving with Enter and keeps the focus in place", async () => {
    at("20:30");
    const wrapper = await render();
    const area = wrapper.get("textarea");
    (area.element as HTMLTextAreaElement).focus();
    await area.setValue("Sonnenuntergang");
    await area.trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(saveDayBest).toHaveBeenCalledWith("2026-11-23", "Sonnenuntergang");
    expect(wrapper.text()).toContain("Sonnenuntergang");
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Das Beste des Tages bearbeiten",
    );
    expect(wrapper.get(".visually-hidden[role=status]").text()).toBe(
      "Gespeichert.",
    );
  });

  it("stays away when its settings cannot be read", async () => {
    vi.mocked(getDayBestSettings).mockRejectedValue(new Error("weg"));
    at("21:00");
    const wrapper = await render();
    expect(wrapper.find(".day-best-card").exists()).toBe(false);
  });
});
