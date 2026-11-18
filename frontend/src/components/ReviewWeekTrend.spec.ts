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
    expect(wrapper.get("h2").text()).toBe("Quest-Stunden · letzte Wochen");
    const bars = wrapper.findAll(".week-trend__bar");
    expect(bars).toHaveLength(8);
    expect(bars[7]!.classes()).toContain("week-trend__bar--shown");
    expect(bars[7]!.attributes("style")).toContain("height: 100%");
    // The average of the weeks before sits top right with its value.
    expect(wrapper.get(".week-trend__average-note").text()).toBe(
      "Schnitt der 7 Wochen davor 1 Std. 34 Min.",
    );
    expect(wrapper.get(".week-trend__average").attributes("style")).toContain(
      `bottom: ${(94 / 300) * 100}%`,
    );
    const labels = wrapper.findAll(".week-trend__label");
    expect(labels[0]!.text()).toBe("1:0028.09.");
    // The running week is marked as what it is so far.
    expect(labels.at(-1)!.text()).toBe("5:0016.11.bisher");
    expect(labels.at(-1)!.classes()).toContain("week-trend__label--shown");
  });

  it("says the weeks and the average in words", () => {
    const wrapper = mount(ReviewWeekTrend, { props: { hours } });
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toMatch(
      /^Quest-Stunden der letzten 8 Wochen\. .*Woche ab 16\. Nov\.: 5 Std\. bisher; Schnitt der Wochen davor: 1 Std\. 34 Min\.$/,
    );
  });

  it("drops the \"bisher\" once the week is over", () => {
    const wrapper = mount(ReviewWeekTrend, {
      props: { hours: { ...hours, today: "2026-12-01" } },
    });
    expect(wrapper.find(".week-trend__running").exists()).toBe(false);
    expect(wrapper.findAll(".week-trend__label").at(-1)!.text()).toBe(
      "5:0016.11.",
    );
  });
});
