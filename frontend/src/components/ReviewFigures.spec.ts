import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewFigures from "./ReviewFigures.vue";

const items = (wrapper: ReturnType<typeof mount>) =>
  wrapper.findAll(".figures__item");

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
    const [hours, average, share] = items(wrapper);
    expect(hours!.get("dt").text()).toBe("Kampagnen-Stunden");
    // The number leads, the unit sits beside it in its own span.
    expect(hours!.get(".figures__value").text()).toBe("7 Std. 30 Min.");
    expect(
      hours!.findAll(".figures__unit").map((unit) => unit.text()),
    ).toEqual(["Std.", "Min."]);
    expect(hours!.get(".figures__note").text()).toBe("von 10 Std. Wochenziel");
    expect(hours!.get(".figures__percent").text()).toBe("75 % vom Ziel");
    const bar = hours!.get('[role="progressbar"]');
    expect(bar.attributes("aria-valuetext")).toBe("7 Std. 30 Min. von 10 Std.");
    expect(bar.get("span").attributes("style")).toContain("width: 75%");
    expect(average!.text()).toBe("Tagesschnitt2 Std. 30 Min.über 3 Tage bisher");
    expect(share!.text()).toBe("Kampagnen-Arbeit75 %von 10 Std. gemessen");
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
    expect(wrapper.get(".figures__note").text()).toBe("von 20 Std. Wochenziel");
    expect(wrapper.get(".figures__percent").text()).toBe("5 % vom Ziel");
    expect(wrapper.text()).toContain("über alle 7 Tage");
    expect(wrapper.html()).not.toMatch(/danger|warn/);
  });

  it("names only the hours without a goal and dashes what cannot be known", () => {
    const wrapper = mount(ReviewFigures, {
      props: { hours: questHours({ today: "2026-11-15" }) },
    });
    const [hours, average, share] = items(wrapper);
    expect(hours!.text()).toBe("Kampagnen-Stunden0 Min.");
    expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
    expect(average!.get(".figures__value").text()).toBe("–");
    expect(share!.get(".figures__value").text()).toBe("–");
    expect(wrapper.text()).toContain("Noch nichts gemessen");
  });
});
