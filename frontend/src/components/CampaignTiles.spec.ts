import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { TODO_FIELDS } from "../types/fixtures";
import type { CampaignTile } from "../utils/quest-hours";
import CampaignTiles from "./CampaignTiles.vue";

enableAutoUnmount(afterEach);

const STARTS = ["2026-11-09", "2026-11-16"];
const tile = (
  id: number,
  changes: Partial<CampaignTile> = {},
  completed = false,
): CampaignTile => ({
  todo: {
    ...TODO_FIELDS,
    id,
    parentId: null,
    title: `Kampagne ${id}`,
    completed,
    completedAt: null,
    scheduledDate: null,
    timeOfDay: null,
    plannedDurationMinutes: null,
    timerEligible: true,
    progress: {
      mode: "count",
      completed: 0,
      total: 1,
      percentage: 0,
      knownDurationMinutes: 0,
      todoCount: 1,
    },
  },
  color: null,
  icon: null,
  minutes: 0,
  weeklyTargetMinutes: null,
  weeks: [0, 0],
  totalMinutes: 0,
  ...changes,
});

describe("CampaignTiles", () => {
  it("shows the week against the goal with a bar, without warning colour", () => {
    const wrapper = mount(CampaignTiles, {
      props: {
        tiles: [
          tile(1, {
            color: "slate",
            icon: "code",
            minutes: 420,
            weeklyTargetMinutes: 360,
            weeks: [60, 420],
            totalMinutes: 480,
          }),
        ],
        starts: STARTS,
        counted: true,
      },
    });
    const card = wrapper.get("[data-campaign-tile]");
    expect(card.text()).toContain("7 Std. von 6 Std. diese Woche");
    expect(card.text()).toContain("Insgesamt 8 Std.");
    // More than the goal fills the bar, nothing else changes.
    expect(
      card.get(".campaign-tile__bar > span").attributes("style"),
    ).toContain("width: 100%");
    expect(card.attributes("style")).toContain("var(--color-mark-slate)");
  });

  it("opens a campaign from its title button", async () => {
    const wrapper = mount(CampaignTiles, {
      props: { tiles: [tile(4)], starts: STARTS, counted: true },
    });
    await wrapper.get(".campaign-tile__open").trigger("click");
    expect(wrapper.emitted("open")).toEqual([[4]]);
    expect(wrapper.get("h3 button").text()).toBe("Kampagne 4");
  });

  it("switches between active and completed campaigns", async () => {
    const wrapper = mount(CampaignTiles, {
      props: {
        tiles: [tile(1), tile(2, {}, true)],
        starts: STARTS,
        counted: true,
      },
    });
    const ids = () =>
      wrapper
        .findAll("[data-campaign-tile]")
        .map((card) => card.attributes("data-campaign-tile"));
    expect(ids()).toEqual(["1"]);
    const [active, done] = wrapper.findAll(".segmented button");
    expect(active!.attributes("aria-pressed")).toBe("true");
    await done!.trigger("click");
    expect(ids()).toEqual(["2"]);
    expect(done!.attributes("aria-pressed")).toBe("true");
  });

  it("says when a tab has no campaign", async () => {
    const wrapper = mount(CampaignTiles, {
      props: { tiles: [tile(1)], starts: STARTS, counted: true },
    });
    await wrapper.findAll(".segmented button")[1]!.trigger("click");
    expect(wrapper.text()).toContain("Noch keine Kampagne abgeschlossen.");
  });

  it("leaves the numbers out while they are not loaded", () => {
    const wrapper = mount(CampaignTiles, {
      props: { tiles: [tile(1)], starts: STARTS, counted: false },
    });
    expect(wrapper.text()).not.toContain("diese Woche");
    expect(wrapper.find("svg[role=img]").exists()).toBe(false);
  });
});
