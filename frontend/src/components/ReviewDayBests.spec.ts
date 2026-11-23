import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDayBests } from "../api/day-bests.api";
import ReviewDayBests from "./ReviewDayBests.vue";

vi.mock("../api/day-bests.api", () => ({ getDayBests: vi.fn() }));
enableAutoUnmount(afterEach);

describe("ReviewDayBests in the Wochenrückblick", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lists the week's lines from Monday on, counting the days so far", async () => {
    vi.mocked(getDayBests).mockResolvedValue({
      entries: [
        { date: "2026-11-20", text: "Freitagabend am Fluss" },
        { date: "2026-11-17", text: "Brief von Oma" },
      ],
    });
    const wrapper = mount(ReviewDayBests, {
      props: { week: "2026-11-16", today: "2026-11-20" },
    });
    await flushPromises();
    expect(getDayBests).toHaveBeenCalledWith(
      "2026-11-16",
      "2026-11-22",
      expect.anything(),
    );
    expect(wrapper.get("h2").text()).toBe(
      "Das Beste der Woche · 2 von 5 Tagen",
    );
    const days = wrapper.findAll(".review-day-bests__day");
    expect(days.map((day) => day.text())).toEqual([
      "Dienstag, 17. Nov.",
      "Freitag, 20. Nov.",
    ]);
    expect(days[0]!.attributes("href")).toBe("#/das-beste?tag=2026-11-17");
  });

  it("shows no card for a week without lines", async () => {
    vi.mocked(getDayBests).mockResolvedValue({ entries: [] });
    const wrapper = mount(ReviewDayBests, {
      props: { week: "2026-11-09", today: "2026-11-20" },
    });
    await flushPromises();
    expect(wrapper.find("section").exists()).toBe(false);
  });
});
