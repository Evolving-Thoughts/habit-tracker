import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuestTrend from "./QuestTrend.vue";

const STARTS = ["2026-11-02", "2026-11-09", "2026-11-16"];

describe("QuestTrend", () => {
  it("draws the weeks as a line, highest at the top", () => {
    const wrapper = mount(QuestTrend, {
      props: { weeks: [0, 120, 60], starts: STARTS, mark: "red" },
    });
    const points = wrapper
      .get("polyline")
      .attributes("points")!
      .split(" ")
      .map((point) => point.split(",").map(Number));
    expect(points).toHaveLength(3);
    const [first, top, last] = points.map(([, y]) => y!);
    expect(top).toBeLessThan(last!);
    expect(last).toBeLessThan(first!);
  });

  afterEach(() => vi.useRealTimers());

  it("says every week in words, the running one as this week", () => {
    vi.useFakeTimers({ now: new Date("2026-11-18T12:00:00Z") });
    const wrapper = mount(QuestTrend, {
      props: { weeks: [0, 120, 60], starts: STARTS, mark: "red" },
    });
    const svg = wrapper.get("svg");
    expect(svg.attributes("role")).toBe("img");
    expect(svg.attributes("aria-label")).toBe(
      "Letzte 3 Wochen: ab 02.11. 0 Min., ab 09.11. 2 Std., diese Woche 1 Std.",
    );
  });

  it("keeps a week without time on the ground line", () => {
    const wrapper = mount(QuestTrend, {
      props: { weeks: [0, 0], starts: STARTS.slice(0, 2), mark: "red" },
    });
    const ys = wrapper
      .get("polyline")
      .attributes("points")!
      .split(" ")
      .map((point) => Number(point.split(",")[1]));
    expect(new Set(ys).size).toBe(1);
    expect(ys[0]).toBe(Number(wrapper.get("line").attributes("y1")));
  });
});
