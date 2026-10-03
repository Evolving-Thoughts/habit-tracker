import { describe, expect, it } from "vitest";
import {
  formatDateForGermanDisplay,
  getCurrentDateInTimeZone,
  isValidIsoDate,
} from "./date";

describe("calendar dates", () => {
  it.each([
    ["2026-10-01T22:30:00Z", "2026-10-02"],
    ["2026-01-01T23:30:00Z", "2026-01-02"],
    ["2026-03-29T00:30:00Z", "2026-03-29"],
    ["2026-03-29T22:30:00Z", "2026-03-30"],
    ["2026-10-25T23:30:00Z", "2026-10-26"],
  ])("computes Berlin's calendar day for %s", (instant, expected) => {
    expect(getCurrentDateInTimeZone("Europe/Berlin", new Date(instant))).toBe(
      expected,
    );
  });
  it.each([
    "2026-02-30",
    "2026-02-29",
    "02.10.2026",
    "2026-1-02",
    "",
    "2026-10-02T00:00:00Z",
  ])("rejects invalid date %s", (date) => {
    expect(isValidIsoDate(date)).toBe(false);
  });
  it.each(["2024-02-29", "2026-10-02"])("accepts date %s", (date) => {
    expect(isValidIsoDate(date)).toBe(true);
  });
  it("displays dates without a time zone shift", () => {
    expect(formatDateForGermanDisplay("2026-10-02")).toBe("02.10.2026");
  });
});
