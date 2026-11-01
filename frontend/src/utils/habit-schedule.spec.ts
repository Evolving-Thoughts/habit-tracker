import { describe, expect, it } from "vitest";
import {
  emptyScheduleDraft,
  positiveInteger,
  scheduleDraftOf,
  scheduleRuleOf,
} from "./habit-schedule";

describe("habit schedule drafts", () => {
  it("builds an interval rule", () => {
    expect(
      scheduleRuleOf({ ...emptyScheduleDraft(), intervalDays: "2" }),
    ).toEqual({
      type: "interval",
      intervalDays: 2,
      missedOccurrencePolicy: "carry_over",
    });
  });

  it.each([
    [{ intervalDays: 0 }, "Das Intervall"],
    [{ type: "fixed_weekdays" as const }, "mindestens einen Wochentag"],
    [{ type: "weekly_target" as const, weeklyTarget: 8 }, "Das Wochenziel"],
  ])("refuses %o", (change, message) => {
    expect(() =>
      scheduleRuleOf({ ...emptyScheduleDraft(), ...change }),
    ).toThrow(message);
  });

  it("orders weekdays from Monday whatever was clicked first", () => {
    const rule = scheduleRuleOf({
      ...emptyScheduleDraft(),
      type: "fixed_weekdays",
      weekdays: ["friday", "monday"],
    });
    expect(rule).toMatchObject({ weekdays: ["monday", "friday"] });
  });

  it("round-trips a stored rule", () => {
    const rule = {
      type: "weekly_target",
      weeklyTarget: 4,
    } as const;
    expect(scheduleRuleOf(scheduleDraftOf(rule))).toEqual(rule);
  });

  it("checks whole numbers within the limit", () => {
    expect(positiveInteger("3", "x", 5)).toBe(3);
    expect(() => positiveInteger("1.5", "x")).toThrow("x");
    expect(() => positiveInteger(6, "x", 5)).toThrow("x");
  });
});
