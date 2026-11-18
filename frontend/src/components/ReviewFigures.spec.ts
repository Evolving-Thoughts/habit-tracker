import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewFigures from "./ReviewFigures.vue";

describe("ReviewFigures", () => {
  it("sets the week against the goal, per day so far and against all time", () => {
    const wrapper = mount(ReviewFigures, {
      props: {
        hours: questHours({
          weeklyTargetMinutes: 600,
          questMinutes: 450,
          otherMinutes: 150,
        }),
      },
    });
    expect(wrapper.get(".figures__value").text()).toBe("7 Std. 30 Min.");
    expect(wrapper.text()).toContain("von 10 Std. Wochenziel · 75 %");
    const bar = wrapper.get('[role="progressbar"]');
    expect(bar.attributes("aria-valuetext")).toBe("7 Std. 30 Min. von 10 Std.");
    expect(bar.get("span").attributes("style")).toContain("width: 75%");
    const stats = wrapper.findAll(".figures__stat");
    expect(stats[0]!.text()).toBe("Tagesschnitt2 Std. 30 Min.über 3 Tage bisher");
    expect(stats[1]!.text()).toBe(
      "Anteil Quest-Arbeit75 %von 10 Std. gemessen",
    );
  });

  it("shows a missed goal as a number, the bar just stopping short", () => {
    const wrapper = mount(ReviewFigures, {
      props: {
        hours: questHours({
          today: "2026-11-30",
          weeklyTargetMinutes: 1200,
          questMinutes: 60,
        }),
      },
    });
    expect(wrapper.text()).toContain("von 20 Std. Wochenziel · 5 %");
    expect(wrapper.text()).toContain("über alle 7 Tage");
    expect(wrapper.html()).not.toMatch(/danger|warn/);
  });

  it("names only the hours without a goal and dashes what cannot be known", () => {
    const wrapper = mount(ReviewFigures, {
      props: { hours: questHours({ today: "2026-11-15" }) },
    });
    expect(wrapper.text()).toContain("Ohne Wochenziel");
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    const numbers = wrapper.findAll(".figures__number").map((n) => n.text());
    expect(numbers).toEqual(["–", "–"]);
    expect(wrapper.text()).toContain("Noch nichts gemessen");
  });
});
