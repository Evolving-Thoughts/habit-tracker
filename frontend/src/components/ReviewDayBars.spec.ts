import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewDayBars from "./ReviewDayBars.vue";

describe("ReviewDayBars", () => {
  const hours = questHours({
    days: questHours().days.map((day, index) => ({
      ...day,
      questMinutes: [90, 0, 45, 0, 0, 0, 0][index]!,
    })),
  });

  it("draws seven days with their value written out, today marked", () => {
    const wrapper = mount(ReviewDayBars, { props: { hours } });
    const days = wrapper.findAll(".day-bars__day");
    expect(days).toHaveLength(7);
    expect(days.map((day) => day.get(".day-bars__value").text())).toEqual([
      "1:30",
      "0:00",
      "0:45",
      "–",
      "–",
      "–",
      "–",
    ]);
    expect(days.map((day) => day.get(".day-bars__weekday").text())).toEqual([
      "Mo",
      "Di",
      "Heute",
      "Do",
      "Fr",
      "Sa",
      "So",
    ]);
    expect(days[2]!.classes()).toContain("day-bars__day--today");
    expect(days[0]!.get(".day-bars__bar").attributes("style")).toContain(
      "height: 100%",
    );
    expect(days[2]!.get(".day-bars__bar").attributes("style")).toContain(
      "height: 50%",
    );
  });

  it("says every day in words for screen readers", () => {
    const wrapper = mount(ReviewDayBars, { props: { hours } });
    const chart = wrapper.get('[role="img"]');
    expect(chart.attributes("aria-label")).toMatch(
      /^Quest-Stunden je Tag\. Montag, 16\. Nov\.: 1 Std\. 30 Min\., Dienstag, 17\. Nov\.: 0 Min\., Mittwoch, 18\. Nov\.: 45 Min\., Donnerstag, 19\. Nov\.: noch offen/,
    );
  });
});
