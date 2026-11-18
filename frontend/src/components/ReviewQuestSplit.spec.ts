import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewQuestSplit from "./ReviewQuestSplit.vue";

describe("ReviewQuestSplit", () => {
  it("splits the measured time into both times; the share is the figure above", () => {
    const wrapper = mount(ReviewQuestSplit, {
      props: { hours: questHours({ questMinutes: 270, otherMinutes: 90 }) },
    });
    const rows = wrapper.findAll(".quest-split__legend li");
    // "Quest-Arbeit 75 %" is the key figure; the legend does not say it twice.
    expect(rows.map((row) => row.text())).toEqual([
      "Quest-Arbeit4 Std. 30 Min.",
      "Sonstiges1 Std. 30 Min.",
    ]);
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe(
      "Quest-Arbeit 4 Std. 30 Min., 75 %; Sonstiges 1 Std. 30 Min., 25 %",
    );
    const parts = wrapper.findAll(".quest-split__bar span");
    expect(parts[0]!.attributes("style")).toContain("flex-grow: 270");
    expect(parts[1]!.attributes("style")).toContain("flex-grow: 90");
  });

  it("shows nothing without measured time", () => {
    const wrapper = mount(ReviewQuestSplit, { props: { hours: questHours() } });
    expect(wrapper.find("section").exists()).toBe(false);
  });
});
