import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import WeekQuota from "./WeekQuota.vue";

const perfectWeek = {
  perfect: false,
  categories: [
    { id: 1, name: "Sport", target: 3, completed: 3, reached: true },
    { id: 2, name: "Musik", target: 2, completed: 1, reached: false },
  ],
};

describe("WeekQuota", () => {
  it("shows the Dailies against what was due, with a bar, lifted by default", () => {
    const wrapper = mount(WeekQuota, {
      props: {
        quota: { completed: 5, total: 8, percentage: 63 },
        perfectWeek: null,
      },
    });
    const quota = wrapper.get(".quota");
    // Title, number, and a line that says what the number counts.
    expect(quota.text()).toBe(
      "Dailies im Wochensoll5 von 8fälligen Ausführungen erledigt",
    );
    expect(quota.classes()).toContain("quota--lifted");
    const bar = wrapper.get('[role="progressbar"]');
    expect(bar.attributes("aria-valuenow")).toBe("5");
    expect(bar.attributes("aria-valuemax")).toBe("8");
    expect(bar.attributes("aria-valuetext")).toBe(
      "5 von 8 fälligen Ausführungen erledigt",
    );
    expect(wrapper.find("h2").exists()).toBe(false);
  });

  it("stands as two flat titled cards side by side in the review", () => {
    const wrapper = mount(WeekQuota, {
      props: {
        quota: { completed: 0, total: 4, percentage: 0 },
        perfectWeek,
        dashboard: true,
      },
    });
    expect(wrapper.get(".week-quota").classes()).toContain(
      "week-quota--dashboard",
    );
    expect(wrapper.findAll("h2").map((heading) => heading.text())).toEqual([
      "Dailies im Wochensoll",
      "Perfekte Woche",
    ]);
    expect(wrapper.get(".quota").classes()).not.toContain("quota--lifted");
    expect(wrapper.get(".perfect-week").classes()).toContain("card");
  });

  it("lists each category and says which reached its target", () => {
    const wrapper = mount(WeekQuota, {
      props: { quota: null, perfectWeek },
    });
    expect(wrapper.find(".quota").exists()).toBe(false);
    expect(wrapper.get(".perfect-week h2").text()).toBe("Perfekte Woche");
    const rows = wrapper.findAll(".row");
    expect(rows.map((row) => row.get(".count").text())).toEqual([
      "3 von 3",
      "1 von 2",
    ]);
    expect(rows[0]!.text()).toContain("erreicht");
    expect(rows[1]!.text()).not.toContain("erreicht");
  });

  it("shows nothing for a week without dailies and without targets", () => {
    const wrapper = mount(WeekQuota, {
      props: {
        quota: { completed: 0, total: 0, percentage: 0 },
        perfectWeek: { perfect: true, categories: [] },
        dashboard: true,
      },
    });
    expect(wrapper.text()).toBe("");
  });
});
