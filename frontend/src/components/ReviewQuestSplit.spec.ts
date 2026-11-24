import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewQuestSplit from "./ReviewQuestSplit.vue";

describe("ReviewQuestSplit", () => {
  it("splits the measured time into both times; the share is the figure above", () => {
    const wrapper = mount(ReviewQuestSplit, {
      props: { hours: questHours({ questMinutes: 270, otherMinutes: 90 }) },
    });
    const rows = wrapper.findAll(".quest-split__labels li");
    // "Kampagnen-Arbeit 75 %" is the key figure; the labels do not say it twice.
    expect(rows.map((row) => row.text())).toEqual([
      "Kampagnen-Arbeit4 Std. 30 Min.",
      "Sonstiges1 Std. 30 Min.",
    ]);
    // Sonstiges is hatched in the bar and in its key, never told by colour alone.
    expect(wrapper.get(".quest-split__part--other").classes()).toContain(
      "series-other",
    );
    expect(rows[1]!.get(".quest-split__key").classes()).toContain("series-other");
    expect(rows[1]!.classes()).toContain("quest-split__label--other");
    expect(wrapper.get('[role="img"]').attributes("aria-label")).toBe(
      "Kampagnen-Arbeit 4 Std. 30 Min., 75 %; Sonstiges 1 Std. 30 Min., 25 %",
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
