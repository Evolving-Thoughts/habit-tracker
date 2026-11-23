import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import MonthChallengeCard from "./MonthChallengeCard.vue";
import { PLANNER_HABIT_FIELDS } from "../types/fixtures";
import type { DayPlannerHabitItem } from "../types/day-planner";
import type { MonthChallenge } from "../types/month-challenge";

enableAutoUnmount(afterEach);

const challenge: MonthChallenge = {
  id: 1,
  month: "2026-11",
  startDate: "2026-11-01",
  endDate: "2026-11-30",
  habitId: 7,
  title: "Sport",
  reminderTime: "19:00",
  status: "running",
  endedAt: null,
  day: 12,
  days: 30,
  done: 11,
  missed: 0,
  remaining: 19,
  total: 30,
  percent: 36,
  todayRun: "open",
  todayOccurrenceId: 70,
};

const run = (status: "pending" | "completed"): DayPlannerHabitItem => ({
  ...PLANNER_HABIT_FIELDS,
  type: "habit",
  occurrenceId: 70,
  habitId: 7,
  title: "Sport",
  status,
  scheduledDate: "2026-11-12",
  moveUntil: null,
  scheduleType: "interval",
  isOverdue: false,
  timerEligible: status === "pending",
  plannedDurationMinutes: null,
  monthChallenge: true,
});

function render(item: DayPlannerHabitItem | null, change = {}) {
  return mount(MonthChallengeCard, {
    props: { challenge: { ...challenge, ...change }, run: item, busy: false },
  });
}

describe("MonthChallengeCard in Heute", () => {
  it("names the challenge, its progress and a calm bar", () => {
    const wrapper = render(null, { todayRun: "none" });
    expect(wrapper.get("h2").text()).toBe("Sport");
    expect(wrapper.text()).toContain("Monats-Challenge");
    expect(wrapper.get(".challenge-card__progress").text()).toBe(
      "Tag 12 · 11 von 11 geschafft · noch 19",
    );
    const bar = wrapper.get("[role=progressbar]");
    expect(bar.attributes("aria-valuetext")).toBe(
      "11 von 30 Läufen geschafft",
    );
    expect(bar.attributes("aria-valuemax")).toBe("30");
    expect(wrapper.get("a").attributes("href")).toBe(
      "#/dailies?abschnitt=challenge",
    );
    // Nothing to tick today: no ring, no ▶.
    expect(wrapper.find(".check-ring").exists()).toBe(false);
  });

  it("ticks today's open run like its row, with its ▶ beside", async () => {
    const item = run("pending");
    const wrapper = render(item);
    const ring = wrapper.get(".check-ring");
    expect(ring.attributes("aria-label")).toBe("Sport heute erledigen");
    expect(
      wrapper.find('button[aria-label="Stoppuhr für Sport starten"]').exists(),
    ).toBe(true);
    await ring.trigger("click");
    expect(wrapper.emitted("toggle")).toEqual([[item]]);
  });

  it("offers to reopen a run done today, without ▶", () => {
    const wrapper = render(run("completed"), {
      todayRun: "done",
      todayOccurrenceId: null,
    });
    expect(wrapper.get(".check-ring").attributes("aria-label")).toBe(
      "Sport heute wieder öffnen",
    );
    expect(wrapper.find('button[aria-label^="Stoppuhr"]').exists()).toBe(false);
  });
});
