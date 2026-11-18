import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewWeekTrend from "./ReviewWeekTrend.vue";

const MINUTES = [60, 120, 0, 180, 120, 60, 120, 300];

describe("ReviewWeekTrend", () => {
  const hours = questHours({
    weeks: questHours().weeks.map((week, index) => ({
      ...week,
      questMinutes: MINUTES[index]!,
    })),
  });
  hours.weeks[7]!.startDate = hours.startDate;

  it("draws eight weeks, the shown one in ink, with the average as a line", () => {
    const wrapper = mount(ReviewWeekTrend, { props: { hours } });
    const bars = wrapper.findAll(".week-trend__bar");
    expect(bars).toHaveLength(8);
    expect(bars[7]!.classes()).toContain("week-trend__bar--shown");
    expect(bars[7]!.attributes("style")).toContain("height: 100%");
    expect(
      wrapper.findAll(".week-trend__summary > span").map((part) => part.text()),
    ).toEqual(["Diese Woche 5 Std.", "Schnitt der Wochen davor 1 Std. 34 Min."]);
    expect(wrapper.get(".week-trend__average").attributes("style")).toContain(
      `bottom: ${(94 / 300) * 100}%`,
    );
    expect(wrapper.findAll(".week-trend__labels span").at(-1)!.text()).toBe(
      "16.11.",
    );
  });

  it("says the weeks and the average in words", () => {
    const wrapper = mount(ReviewWeekTrend, { props: { hours } });
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toMatch(
      /^Quest-Stunden der letzten 8 Wochen\. .*Woche ab 16\. Nov\.: 5 Std\.; Schnitt der Wochen davor: 1 Std\. 34 Min\.$/,
    );
  });

  it("names a past week by its start", () => {
    const wrapper = mount(ReviewWeekTrend, {
      props: { hours: { ...hours, today: "2026-12-01" } },
    });
    expect(wrapper.get(".week-trend__summary").text()).toMatch(
      /^Woche ab 16\. Nov\. 5 Std\./,
    );
  });
});
