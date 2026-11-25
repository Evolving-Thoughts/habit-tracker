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
      total: 0,
      percentage: 0,
      knownDurationMinutes: 0,
      todoCount: 0,
      doneCount: 0,
    },
  },
  color: null,
  icon: null,
  minutes: 0,
  weeklyTargetMinutes: null,
  weeks: [0, 0],
  totalMinutes: 0,
  next: null,
  ...changes,
});
/** Progress as the server sends it: `done` of `all` quests below. */
const progress = (done: number, all: number) => ({
  mode: "count" as const,
  completed: done,
  total: all,
  percentage: all ? (done / all) * 100 : 0,
  knownDurationMinutes: 0,
  todoCount: all,
  doneCount: done,
});
const withProgress = (id: number, done: number, all: number, completed = false) => {
  const made = tile(id, {}, completed);
  return { ...made, todo: { ...made.todo, progress: progress(done, all) } };
};
const quest = (id: number, scheduledDate: string | null, timerEligible = true) => ({
  ...tile(id).todo,
  parentId: 1,
  title: `Quest ${id}`,
  scheduledDate,
  timerEligible,
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

  it("completes or reopens a campaign from its tile, and offers a new one", async () => {
    const wrapper = mount(CampaignTiles, {
      props: {
        tiles: [withProgress(1, 2, 2), tile(2, {}, true)],
        starts: STARTS,
        counted: true,
      },
    });
    await wrapper.get('[aria-label="Kampagne 1 abschließen"]').trigger("click");
    expect(wrapper.emitted("complete")![0]![0]).toMatchObject({
      todo: { id: 1 },
    });
    expect(wrapper.emitted("open")).toBeUndefined();
    const create = wrapper.get(".campaign-tile__create");
    expect(create.text()).toBe("Neue Kampagne");
    await create.trigger("click");
    expect(wrapper.emitted("create")).toHaveLength(1);

    await wrapper.findAll(".segmented button")[1]!.trigger("click");
    await wrapper.get('[aria-label="Kampagne 2 wieder öffnen"]').trigger("click");
    expect(wrapper.emitted("complete")![1]![0]).toMatchObject({
      todo: { id: 2 },
    });
    // A new campaign is something active.
    expect(wrapper.find(".campaign-tile__create").exists()).toBe(false);
  });

  it("shows how many of its quests are done with a flat ink bar", () => {
    const wrapper = mount(CampaignTiles, {
      props: { tiles: [withProgress(1, 4, 8)], starts: STARTS, counted: true },
    });
    const card = wrapper.get("[data-campaign-tile]");
    expect(card.get(".campaign-tile__progress").text()).toBe(
      "4 von 8 Quests erledigt",
    );
    expect(card.findAll(".campaign-tile__bar > span")[0]!.attributes("style")).toContain(
      "width: 50%",
    );
  });

  it("leaves the quest line out while a campaign has no quests", () => {
    const wrapper = mount(CampaignTiles, {
      props: { tiles: [tile(1)], starts: STARTS, counted: true },
    });
    expect(wrapper.find(".campaign-tile__progress").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Als Nächstes");
  });

  it("names the next quest with its day and a ▶ for the stopwatch", () => {
    const wrapper = mount(CampaignTiles, {
      props: {
        tiles: [
          { ...withProgress(1, 1, 3), next: quest(7, "2026-11-25") },
          { ...withProgress(2, 0, 2), next: quest(8, "2026-11-26") },
          { ...withProgress(3, 0, 2), next: quest(9, "2026-12-03", false) },
          { ...withProgress(4, 0, 2), next: quest(10, null) },
        ],
        starts: STARTS,
        counted: true,
        today: "2026-11-25",
      },
    });
    const texts = wrapper
      .findAll(".campaign-tile__next")
      .map((line) =>
        line.get(".campaign-tile__next-text").text().replace(/ /g, " "),
      );
    expect(texts).toEqual([
      "Als Nächstes: Quest 7 · heute",
      "Als Nächstes: Quest 8 · morgen",
      "Als Nächstes: Quest 9 · 03.12.",
      "Als Nächstes: Quest 10",
    ]);
    const play = wrapper.get('[aria-label="Stoppuhr für Quest 7 starten"]');
    expect(play.attributes("disabled")).toBeUndefined();
    // The stopwatch rules hold: no ▶ start where the quest cannot be timed.
    expect(
      wrapper
        .get('[aria-label="Stoppuhr für Quest 9: keine offene fällige Ausführung"]')
        .attributes("disabled"),
    ).toBeDefined();
  });

  it("puts Abschließen on the tile only once every quest is done", async () => {
    const wrapper = mount(CampaignTiles, {
      props: {
        tiles: [
          { ...withProgress(1, 1, 3), next: quest(7, null) },
          withProgress(2, 2, 2),
        ],
        starts: STARTS,
        counted: true,
      },
      attachTo: document.body,
    });
    const [open, finished] = wrapper.findAll("[data-campaign-tile]");
    expect(open!.find(".campaign-tile__complete").exists()).toBe(false);
    expect(finished!.text()).toContain("Alle Quests erledigt.");
    expect(finished!.text()).not.toContain("Als Nächstes");
    expect(finished!.get(".campaign-tile__complete").text()).toBe("Abschließen");

    // The open one keeps it in its "…", next to "Bearbeiten".
    await open!.get('[aria-label="Aktionen für Kampagne 1"]').trigger("click");
    const entries = [...document.querySelectorAll("[role=menuitem]")];
    expect(entries.map((entry) => entry.textContent?.trim())).toEqual([
      "Bearbeiten",
      "Kampagne abschließen",
    ]);
    (entries[1] as HTMLElement).click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted("complete")![0]![0]).toMatchObject({ todo: { id: 1 } });
  });

  it("treats a running daily goal as open: no Abschließen on the tile", async () => {
    const goal = (reached: boolean, periodEnd: string | null) => {
      const made = withProgress(1, 2, 2);
      return {
        ...made,
        todo: {
          ...made.todo,
          periodEnd,
          habitGoal: {
            habitId: 3,
            habitTitle: "Laufen gehen",
            target: 24,
            completed: reached ? 24 : 9,
            reached,
          },
        },
      };
    };
    const wrapper = mount(CampaignTiles, {
      props: {
        tiles: [
          goal(false, "2027-01-20"),
          { ...goal(true, "2027-01-20"), todo: { ...goal(true, "2027-01-20").todo, id: 2 } },
          { ...goal(false, "2026-11-20"), todo: { ...goal(false, "2026-11-20").todo, id: 3 } },
        ],
        starts: STARTS,
        counted: true,
        today: "2026-11-25",
      },
      attachTo: document.body,
    });
    const [running, reached, over] = wrapper.findAll("[data-campaign-tile]");
    expect(running!.text()).toContain("Noch offen: Laufen gehen 9 von 24");
    expect(running!.text()).not.toContain("Alle Quests erledigt.");
    expect(running!.find(".campaign-tile__complete").exists()).toBe(false);
    // A reached goal, or one whose period is over, no longer holds it open.
    for (const tile of [reached!, over!]) {
      expect(tile.text()).toContain("Alle Quests erledigt.");
      expect(tile.get(".campaign-tile__complete").text()).toBe("Abschließen");
    }
    await running!.get('[aria-label="Aktionen für Kampagne 1"]').trigger("click");
    const entries = [...document.querySelectorAll("[role=menuitem]")];
    expect(entries.map((entry) => entry.textContent?.trim())).toContain(
      "Kampagne abschließen",
    );
  });

  it("names its trend with a short label and in words", () => {
    const wrapper = mount(CampaignTiles, {
      props: { tiles: [tile(1, { weeks: [60, 120] })], starts: STARTS, counted: true },
    });
    expect(wrapper.get(".campaign-tile__trend-label").text()).toBe("2 Wochen");
    expect(wrapper.get("svg[role=img]").attributes("aria-label")).toMatch(
      /^Letzte 2 Wochen: ab 09.11. 1 Std., /,
    );
  });

  it("leaves the numbers out while they are not loaded", () => {
    const wrapper = mount(CampaignTiles, {
      props: { tiles: [tile(1)], starts: STARTS, counted: false },
    });
    expect(wrapper.text()).not.toContain("diese Woche");
    expect(wrapper.find("svg[role=img]").exists()).toBe(false);
  });
});
