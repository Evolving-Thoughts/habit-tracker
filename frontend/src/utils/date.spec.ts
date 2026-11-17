import { describe, expect, it } from "vitest";
import {
  fromLocalInput,
  toLocalInput,
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

describe("Berlin wall-clock input", () => {
  it.each([
    ["2026-10-02T10:00", "2026-10-02T08:00:00.000Z"],
    ["2026-01-15T10:00", "2026-01-15T09:00:00.000Z"],
    // Ambiguous fall-back hour resolves to standard time.
    ["2026-10-25T02:30", "2026-10-25T01:30:00.000Z"],
  ])("reads %s as Berlin time", (input, iso) => {
    expect(fromLocalInput(input)).toBe(iso);
    expect(toLocalInput(iso)).toBe(input);
  });
  it("moves a non-existent spring-forward time to after the gap", () => {
    // 02:00–03:00 does not exist on 29 March 2026 in Berlin.
    expect(fromLocalInput("2026-03-29T02:30")).toBe("2026-03-29T01:30:00.000Z");
    expect(toLocalInput("2026-03-29T01:30:00.000Z")).toBe("2026-03-29T03:30");
  });
  it.each(["", "2026-02-30T10:00", "02.10.2026 10:00"])(
    "rejects %s",
    (input) => expect(fromLocalInput(input)).toBeNull(),
  );
});
