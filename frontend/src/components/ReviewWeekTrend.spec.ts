import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewWeekTrend from "./ReviewWeekTrend.vue";

const MINUTES = [60, 120, 0, 180, 120, 60, 120, 300];
const OTHER = [30, 0, 0, 0, 0, 0, 0, 100];

describe("ReviewWeekTrend", () => {
  const hours = questHours({
    weeks: questHours().weeks.map((week, index) => ({
      ...week,
      questMinutes: MINUTES[index]!,
      otherMinutes: OTHER[index]!,
    })),
  });
  hours.weeks[7]!.startDate = hours.startDate;

  it("stacks eight weeks of quest and other time, with the average as a line", () => {
    const wrapper = mount(ReviewWeekTrend, { props: { hours } });
    expect(wrapper.get("h2").text()).toBe("Kampagnen-Stunden · letzte Wochen");
    const slots = wrapper.findAll(".week-trend__slot");
    expect(slots).toHaveLength(8);
    expect(slots[7]!.classes()).toContain("week-trend__slot--shown");
    // The tallest stack is 400 minutes: three quarters quest time.
    expect(
      slots[7]!.get(".week-trend__part--quest").attributes("style"),
    ).toContain("height: 75%");
    expect(
      slots[7]!.get(".week-trend__part--other").attributes("style"),
    ).toContain("height: calc(25% - 2px)");
    // Sonstiges is hatched in the columns and in its key, never colour alone.
    expect(slots[7]!.get(".week-trend__part--other").classes()).toContain(
      "series-other",
    );
    expect(
      wrapper.get(".week-trend__legend .week-trend__part--other").classes(),
    ).toContain("series-other");
    // A week without time draws nothing; one without other time no top part.
    expect(slots[2]!.findAll(".week-trend__part")).toHaveLength(0);
    expect(slots[1]!.find(".week-trend__part--other").exists()).toBe(false);
    // The tooltip names both parts.
    expect(slots[0]!.attributes("title")).toBe(
      "Woche ab 28. Sept.: 1 Std. Kampagnen-Arbeit, 30 Min. Sonstiges",
    );
    // The legend matches the split card; the average sits with its value.
    expect(wrapper.get(".week-trend__legend").text()).toBe(
      "Kampagnen-Arbeit SonstigesSchnitt der 7 Wochen davor 1 Std. 34 Min.",
    );
    expect(wrapper.get(".week-trend__average").attributes("style")).toContain(
      `bottom: ${(94 / 400) * 100}%`,
    );
    const labels = wrapper.findAll(".week-trend__label");
    expect(labels[0]!.text()).toBe("1:00+0:3028.09.");
    // The running week is marked as what it is so far.
    expect(labels.at(-1)!.text()).toBe("5:00+1:4016.11.bisher");
    expect(labels.at(-1)!.classes()).toContain("week-trend__label--shown");
  });

  it("says the weeks and the average in words", () => {
    const wrapper = mount(ReviewWeekTrend, { props: { hours } });
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toMatch(
      /^Kampagnen-Stunden der letzten 8 Wochen, gestapelt aus Kampagnen-Arbeit und Sonstigem\. .*Woche ab 16\. Nov\.: 5 Std\. Kampagnen-Arbeit, 1 Std\. 40 Min\. Sonstiges bisher; Schnitt der Kampagnen-Arbeit in den Wochen davor: 1 Std\. 34 Min\.$/,
    );
  });

  it("drops the \"bisher\" once the week is over", () => {
    const wrapper = mount(ReviewWeekTrend, {
      props: { hours: { ...hours, today: "2026-12-01" } },
    });
    expect(wrapper.find(".week-trend__running").exists()).toBe(false);
    expect(wrapper.findAll(".week-trend__label").at(-1)!.text()).toBe(
      "5:00+1:4016.11.",
    );
  });
});
