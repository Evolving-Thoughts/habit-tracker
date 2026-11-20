import { describe, expect, it } from "vitest";
import { HABIT_FIELDS } from "../types/fixtures";
import type { HabitResponse } from "../types/habit";
import {
  dailyCampaigns,
  dailyFilterFromQuery,
  dailyFilterQuery,
  dailyGroups,
  passesFilter,
} from "./daily-groups";

const habit = (
  id: number,
  changes: Partial<HabitResponse> = {},
): HabitResponse => ({
  ...HABIT_FIELDS,
  id,
  title: `Daily ${id}`,
  isActive: true,
  plannedDurationMinutes: null,
  timerOccurrenceId: null,
  timerDurationMinutes: null,
  currentSchedule: null,
  upcomingSchedule: null,
  ...changes,
});
const campaign = (id: number, title: string) => ({
  id,
  title,
  color: null,
  icon: null,
});
const CATEGORIES = [
  { id: 2, name: "Sport", color: "pine" },
  { id: 1, name: "Lernen", color: null },
];

describe("dailyGroups", () => {
  it("groups active Dailies by category in their order, then without, then paused", () => {
    const groups = dailyGroups(
      [
        habit(1, { categoryId: 1 }),
        habit(2),
        habit(3, { categoryId: 2 }),
        habit(4, { categoryId: 2, isActive: false }),
        habit(5, { categoryId: 99 }),
      ],
      CATEGORIES,
    );
    expect(
      groups.map((group) => [group.title, group.habits.map(({ id }) => id)]),
    ).toEqual([
      ["Sport", [3]],
      ["Lernen", [1]],
      ["Ohne Kategorie", [2, 5]],
      ["Pausiert", [4]],
    ]);
    expect(groups[0]!.mark).toBe("var(--color-mark-pine)");
    expect(groups[2]!.mark).toBeNull();
  });

  it("leaves empty groups out", () => {
    expect(
      dailyGroups([habit(1, { categoryId: 1 })], CATEGORIES).map(
        ({ key }) => key,
      ),
    ).toEqual(["category-1"]);
  });
});

describe("the filter", () => {
  it("reads the address and writes only what narrows", () => {
    expect(dailyFilterFromQuery({ kategorie: "3", kampagne: "ohne" })).toEqual({
      category: 3,
      campaign: "ohne",
    });
    expect(dailyFilterFromQuery({ kategorie: "x", kampagne: ["1"] })).toEqual({
      category: null,
      campaign: null,
    });
    expect(dailyFilterQuery({ category: 3, campaign: null })).toEqual({
      kategorie: "3",
    });
    expect(dailyFilterQuery({ category: null, campaign: null })).toEqual({});
  });

  it("passes a Daily by its category and the campaign its chip names", () => {
    const daily = habit(1, { categoryId: 2, campaign: campaign(7, "Buch") });
    expect(passesFilter(daily, { category: 2, campaign: 7 })).toBe(true);
    expect(passesFilter(daily, { category: 1, campaign: null })).toBe(false);
    expect(passesFilter(daily, { category: null, campaign: "ohne" })).toBe(
      false,
    );
    expect(passesFilter(habit(2), { category: "ohne", campaign: "ohne" })).toBe(
      true,
    );
  });

  it("offers the campaigns the Dailies belong to, by title", () => {
    expect(
      dailyCampaigns([
        habit(1, { campaign: campaign(7, "Marathon") }),
        habit(2, { campaign: campaign(3, "Buch") }),
        habit(3, { campaign: campaign(7, "Marathon") }),
        habit(4),
      ]),
    ).toEqual([
      { id: 3, title: "Buch" },
      { id: 7, title: "Marathon" },
    ]);
  });
});
