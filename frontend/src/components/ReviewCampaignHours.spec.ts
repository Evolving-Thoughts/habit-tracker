import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { questHours } from "../test/week-review-fixtures";
import ReviewCampaignHours from "./ReviewCampaignHours.vue";

const row = (
  id: number,
  title: string,
  minutes: number,
  weeklyTargetMinutes: number | null,
  color: string | null = null,
) => ({
  campaign: { id, title, color, icon: null },
  minutes,
  weeklyTargetMinutes,
  weeks: [],
  totalMinutes: minutes,
});

describe("ReviewCampaignHours", () => {
  it("lists each campaign in its colour, against its goal where it has one", () => {
    const wrapper = mount(ReviewCampaignHours, {
      props: {
        hours: questHours({
          campaigns: [
            row(1, "Buch", 210, 360, "berry"),
            row(2, "Garten", 90, null, "moss"),
            row(3, "Alt", 0, null),
          ],
        }),
      },
    });
    const rows = wrapper.findAll(".campaign-hours__row");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.text()).toContain("Buch");
    expect(rows[0]!.get(".campaign-hours__time").text()).toBe(
      "3 Std. 30 Min. von 6 Std.",
    );
    expect(rows[0]!.attributes("style")).toContain("var(--color-mark-berry)");
    expect(rows[0]!.get(".campaign-hours__goal").attributes("style")).toContain(
      "left: 100%",
    );
    expect(rows[1]!.get(".campaign-hours__time").text()).toBe("1 Std. 30 Min.");
    expect(rows[1]!.find(".campaign-hours__goal").exists()).toBe(false);
    expect(wrapper.text()).toContain("Strich: Wochenziel der Kampagne");
  });

  it("shows nothing without campaign time or goals", () => {
    const wrapper = mount(ReviewCampaignHours, {
      props: { hours: questHours({ campaigns: [row(3, "Alt", 0, null)] }) },
    });
    expect(wrapper.find("section").exists()).toBe(false);
  });
});
