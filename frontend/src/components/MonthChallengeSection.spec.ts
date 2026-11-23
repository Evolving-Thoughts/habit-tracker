import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMonthChallenge,
  deleteMonthChallenge,
  endMonthChallenge,
  updateMonthChallenge,
} from "../api/month-challenges.api";
import MonthChallengeSection from "./MonthChallengeSection.vue";
import { HABIT_FIELDS } from "../types/fixtures";
import type { HabitResponse } from "../types/habit";
import type {
  MonthChallenge,
  MonthChallenges,
} from "../types/month-challenge";

vi.mock("../api/month-challenges.api", () => ({
  createMonthChallenge: vi.fn(),
  deleteMonthChallenge: vi.fn(),
  endMonthChallenge: vi.fn(),
  updateMonthChallenge: vi.fn(),
}));
vi.mock("vue-router", () => ({ useRoute: () => ({ query: {} }) }));
enableAutoUnmount(afterEach);

const challenge = (change: Partial<MonthChallenge> = {}): MonthChallenge => ({
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
  missed: 1,
  remaining: 18,
  total: 30,
  percent: 36,
  todayRun: "done",
  todayOccurrenceId: null,
  ...change,
});

const habit = (id: number, title: string, isActive = true): HabitResponse => ({
  ...HABIT_FIELDS,
  id,
  title,
  isActive,
  plannedDurationMinutes: null,
  timerOccurrenceId: null,
  timerDurationMinutes: null,
  currentSchedule: null,
  upcomingSchedule: null,
});

function render(overview: Partial<MonthChallenges> = {}) {
  return mount(MonthChallengeSection, {
    props: {
      overview: {
        today: "2026-11-12",
        current: null,
        next: null,
        past: [],
        ...overview,
      },
      habits: [habit(7, "Sport"), habit(8, "Lesen"), habit(9, "Pause", false)],
      busy: false,
    },
    attachTo: document.body,
  });
}

describe("MonthChallengeSection in the Dailies", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the running challenge and the earlier ones honestly", () => {
    const wrapper = render({
      current: challenge(),
      past: [
        challenge({
          id: 2,
          month: "2026-10",
          title: "Lesen",
          status: "succeeded",
          day: null,
          done: 31,
          missed: 0,
          remaining: 0,
          total: 31,
          percent: 100,
        }),
        challenge({
          id: 3,
          month: "2026-09",
          title: "Laufen",
          status: "finished",
          day: null,
          done: 27,
          missed: 3,
          remaining: 0,
          total: 30,
          percent: 90,
        }),
      ],
    });
    const current = wrapper.get('[data-challenge-month="2026-11"]');
    expect(current.get("h3").text()).toBe("Sport");
    expect(current.get(".challenge-item__status").text()).toBe(
      "Tag 12 · 11 von 12 geschafft · noch 18",
    );
    const rows = wrapper.findAll(".challenge-history__row");
    const cells = (row: (typeof rows)[number]) =>
      row
        .findAll(":scope > span")
        .map((cell) => cell.text().replace(/\s+/g, " "));
    expect(rows.map(cells)).toEqual([
      ["Oktober 2026", "Lesen", "Geschafft"],
      ["September 2026", "Laufen", "90 % (27 von 30)"],
    ]);
    // Before the 16th the next month waits.
    expect(wrapper.text()).not.toContain("festlegen");
  });

  it("offers next month from the 16th", () => {
    const wrapper = render({ today: "2026-11-16", current: challenge() });
    expect(wrapper.get(".challenge-section__prepare").text()).toBe(
      "Challenge für Dezember festlegen",
    );
  });

  it("starts a challenge on an existing Daily with the reminder at 19:00", async () => {
    vi.mocked(createMonthChallenge).mockResolvedValue(challenge());
    const wrapper = render();
    await wrapper.get(".challenge-section__empty button").trigger("click");
    expect(wrapper.text()).toContain("Gezählt wird ab heute, 12. Nov.: 19 Tage.");
    // Only active Dailies can carry it.
    const options = wrapper
      .findAll('select[name="challengeHabit"] option')
      .map((option) => option.text());
    expect(options).toEqual(["Sport", "Lesen"]);
    await wrapper.get('select[name="challengeHabit"]').setValue("8");
    await wrapper.get(".challenge-dialog__form").trigger("submit");
    await flushPromises();
    expect(createMonthChallenge).toHaveBeenCalledWith({
      habitId: 8,
      month: "2026-11",
      reminderTime: "19:00",
    });
    expect(wrapper.emitted("changed")).toEqual([
      ["Monats-Challenge mit „Lesen“ gestartet."],
    ]);
  });

  it("switches the reminder off and changes its time", async () => {
    vi.mocked(updateMonthChallenge).mockResolvedValue(challenge());
    const wrapper = render({ current: challenge() });
    await wrapper.get('[role="switch"]').trigger("click");
    await flushPromises();
    expect(updateMonthChallenge).toHaveBeenCalledWith(1, null);
    const time = wrapper.get('input[type="time"]');
    await time.setValue("07:30");
    await time.trigger("change");
    await flushPromises();
    expect(updateMonthChallenge).toHaveBeenLastCalledWith(1, "07:30");
  });

  it("ends and deletes only after asking", async () => {
    vi.mocked(endMonthChallenge).mockResolvedValue(challenge());
    vi.mocked(deleteMonthChallenge).mockResolvedValue(undefined);
    const wrapper = render({ current: challenge() });
    await wrapper.get('button[aria-label="Aktionen für Sport"]').trigger("click");
    await wrapper.get('[role="menuitem"]').trigger("click");
    expect(endMonthChallenge).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("„Sport“ endet heute");
    await wrapper.get("[data-primary]").trigger("click");
    await flushPromises();
    expect(endMonthChallenge).toHaveBeenCalledWith(1);

    await wrapper.get('button[aria-label="Aktionen für Sport"]').trigger("click");
    await wrapper
      .get('[role="menuitem"][aria-label="Challenge Sport löschen"]')
      .trigger("click");
    expect(deleteMonthChallenge).not.toHaveBeenCalled();
    await wrapper.get('[data-test="confirm-delete"]').trigger("click");
    await flushPromises();
    expect(deleteMonthChallenge).toHaveBeenCalledWith(1);
  });
});
