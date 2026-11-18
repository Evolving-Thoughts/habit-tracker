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
  it("shows the quota as a number with a bar, lifted by default", () => {
    const wrapper = mount(WeekQuota, {
      props: {
        quota: { completed: 5, total: 8, percentage: 63 },
        perfectWeek: null,
      },
    });
    expect(wrapper.get(".quota__value").text()).toBe("5 von 8");
    expect(wrapper.get(".quota").classes()).toContain("quota--lifted");
    const bar = wrapper.get('[role="progressbar"]');
    expect(bar.attributes("aria-valuenow")).toBe("5");
    expect(bar.attributes("aria-valuemax")).toBe("8");
    expect(wrapper.find("h2").exists()).toBe(false);
  });

  it("lies flat with its own title where the view asks for it", () => {
    const wrapper = mount(WeekQuota, {
      props: {
        quota: { completed: 0, total: 4, percentage: 0 },
        perfectWeek: null,
        lifted: false,
        titled: true,
      },
    });
    expect(wrapper.get("h2").text()).toBe("Wochenquote");
    expect(wrapper.get(".quota").classes()).not.toContain("quota--lifted");
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
        titled: true,
      },
    });
    expect(wrapper.text()).toBe("");
  });
});
