import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
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

  it("says every week in words", () => {
    const wrapper = mount(QuestTrend, {
      props: { weeks: [0, 120, 60], starts: STARTS, mark: "red" },
    });
    const svg = wrapper.get("svg");
    expect(svg.attributes("role")).toBe("img");
    expect(svg.attributes("aria-label")).toBe(
      "Kampagnen-Stunden der letzten 3 Wochen. Woche ab 02.11.: 0 Min., Woche ab 09.11.: 2 Std., Woche ab 16.11.: 1 Std.",
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
