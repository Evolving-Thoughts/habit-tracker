import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import {
  campaignRow,
  standing,
} from "../test/week-review-fixtures";
import ReviewCampaignProgress from "./ReviewCampaignProgress.vue";

describe("ReviewCampaignProgress", () => {
  it("names done against total and the week's change, and links to the campaign", () => {
    const wrapper = mount(ReviewCampaignProgress, {
      props: {
        campaigns: [
          campaignRow({
            start: { ...standing(5, 8, "snapshot"), percentage: 62 },
            end: { ...standing(9, 12), percentage: 75 },
          }),
        ],
      },
    });
    const link = wrapper.get("a");
    expect(link.attributes("href")).toBe("#/kampagnen?kampagne=5");
    expect(link.get(".campaign-progress__title").text()).toBe("Buch");
    expect(link.get(".campaign-progress__count").text()).toBe(
      "9 von 12 Quests · 75 %",
    );
    expect(link.get(".campaign-progress__change").text()).toBe(
      "+4 Quests, 62 % → 75 %",
    );
    expect(link.attributes("style")).toContain("var(--color-mark-berry)");
    const track = link.get('[role="img"]');
    expect(track.attributes("aria-label")).toBe(
      "75 % erledigt, davon 4 Quests in dieser Woche",
    );
    // 5 of 12 before, 4 of 12 added.
    expect(
      track.get(".campaign-progress__before").attributes("style"),
    ).toContain(`width: ${(5 / 12) * 100}%`);
    expect(
      track.get(".campaign-progress__added").attributes("style"),
    ).toContain(`width: ${(4 / 12) * 100}%`);
    expect(wrapper.find(".campaign-progress__note").exists()).toBe(false);
  });

  it("adds the runs of a daily goal and says when a start was read back", () => {
    const wrapper = mount(ReviewCampaignProgress, {
      props: {
        campaigns: [
          campaignRow({
            start: standing(0, 0, "reconstructed"),
            end: standing(0, 1),
            dailyGoals: [
              {
                todoId: 5,
                habitId: 4,
                habitTitle: "Laufen",
                target: 20,
                before: 9,
                after: 12,
              },
            ],
          }),
        ],
      },
    });
    expect(wrapper.get(".campaign-progress__goal").text()).toBe(
      "Laufen: 12 von 20 Ausführungen, +3 diese Woche",
    );
    expect(wrapper.get(".campaign-progress__note").text()).toContain(
      "zurückgerechnet",
    );
  });

  it("counts a single quest in the singular", () => {
    const wrapper = mount(ReviewCampaignProgress, {
      props: {
        campaigns: [
          campaignRow({ start: standing(0, 1), end: standing(0, 1) }),
        ],
      },
    });
    expect(wrapper.get(".campaign-progress__count").text()).toBe(
      "0 von 1 Quest · 0 %",
    );
  });

  it("shows nothing without active campaigns", () => {
    const wrapper = mount(ReviewCampaignProgress, { props: { campaigns: [] } });
    expect(wrapper.find("section").exists()).toBe(false);
  });
});
