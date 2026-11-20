import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setQuestTarget } from "../api/quest-hours.api";
import { questHours } from "../test/week-review-fixtures";
import ReviewFigures from "./ReviewFigures.vue";

vi.mock("../api/quest-hours.api", () => ({ setQuestTarget: vi.fn() }));
enableAutoUnmount(afterEach);

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

  it("adds the Dailies due this week and the perfect week, compactly", () => {
    const wrapper = mount(ReviewFigures, {
      props: {
        hours: questHours(),
        dailies: {
          quota: { completed: 5, total: 8, percentage: 63 },
          perfectWeek: {
            perfect: false,
            categories: [
              { id: 1, name: "Sport", color: "teal", target: 3, completed: 3, reached: true },
              { id: 2, name: "Lesen", color: null, target: 3, completed: 2, reached: false },
            ],
          },
        },
      },
    });
    const dailies = wrapper.get(".figures__item--dailies");
    expect(dailies.get("dt").text()).toBe("Dailies im Wochensoll");
    expect(dailies.get(".figures__value").text()).toBe("5 von 8");
    expect(dailies.get(".figures__note").text()).toBe(
      "fälligen Ausführungen erledigt",
    );
    // A reached target is a check, named for screen readers; a missed one a number.
    expect(dailies.get(".figures__perfect").text()).toBe(
      "Perfekte Woche: Sport erreicht, Lesen 2 von 3",
    );
    expect(dailies.html()).not.toMatch(/danger|warn/);
  });

  it("dashes the Dailies when none were due", () => {
    const wrapper = mount(ReviewFigures, {
      props: {
        hours: questHours(),
        dailies: {
          quota: { completed: 0, total: 0, percentage: 0 },
          perfectWeek: null,
        },
      },
    });
    const dailies = wrapper.get(".figures__item--dailies");
    expect(dailies.get(".figures__value").text()).toBe("–");
    expect(dailies.find(".figures__perfect").exists()).toBe(false);
  });

  describe("the weekly goal", () => {
    it("is only shown, never offered for change, unless editable", () => {
      const wrapper = mount(ReviewFigures, {
        props: { hours: questHours({ weeklyTargetMinutes: 600 }) },
      });
      expect(wrapper.find(".figures__edit").exists()).toBe(false);
    });

    it("offers to set a goal where there is none", () => {
      const wrapper = mount(ReviewFigures, {
        props: { hours: questHours(), editable: true },
      });
      expect(wrapper.get(".figures__item--hours").text()).toContain(
        "Kein Wochenziel",
      );
      expect(
        wrapper.find('button[aria-label="Wochenziel setzen"]').exists(),
      ).toBe(true);
    });

    it("opens in place, saves for this week on and hands the goal up", async () => {
      vi.mocked(setQuestTarget).mockResolvedValue({ weeklyTargetMinutes: 90 });
      const wrapper = mount(ReviewFigures, {
        props: { hours: questHours({ weeklyTargetMinutes: 600 }), editable: true },
        attachTo: document.body,
      });
      await wrapper
        .get('button[aria-label="Wochenziel ändern"]')
        .trigger("click");
      expect(wrapper.find('[role="progressbar"]').exists()).toBe(false);
      expect(wrapper.text()).toContain("Gilt ab dieser Woche");
      await wrapper.get('input[name="weeklyQuestTargetHours"]').setValue("1");
      await wrapper.get('input[name="weeklyQuestTargetMinutes"]').setValue("30");
      await wrapper.get("form").trigger("submit");
      await flushPromises();
      expect(setQuestTarget).toHaveBeenCalledWith(90);
      expect(wrapper.emitted("target-saved")).toEqual([[90]]);
      expect(wrapper.find("form").exists()).toBe(false);
    });

    it("closes on Abbrechen without saving and gives the focus back", async () => {
      vi.mocked(setQuestTarget).mockClear();
      const wrapper = mount(ReviewFigures, {
        props: { hours: questHours({ weeklyTargetMinutes: 600 }), editable: true },
        attachTo: document.body,
      });
      await wrapper
        .get('button[aria-label="Wochenziel ändern"]')
        .trigger("click");
      await wrapper
        .findAll("button")
        .find((button) => button.text() === "Abbrechen")!
        .trigger("click");
      await flushPromises();
      expect(setQuestTarget).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(
        wrapper.get('button[aria-label="Wochenziel ändern"]').element,
      );
      expect(wrapper.get(".figures__note").text()).toBe("von 10 Std. Wochenziel");
    });
  });
});
