import { describe, expect, it } from "vitest";
import { eventStaysLine, runWindowLine } from "./day-drop";

describe("what a day pill says when it does not take a card", () => {
  it("names a Google event's own place", () => {
    expect(eventStaysLine("Zahnarzt")).toBe(
      "„Zahnarzt“ kommt aus Google Kalender und bleibt an seinem Tag. Verschieben lässt er sich nur dort.",
    );
  });

  it("names the end of a run's window", () => {
    expect(runWindowLine("Lesen", "2026-11-26", "2026-11-26")).toBe(
      "„Lesen“ lässt sich nur bis heute verschieben.",
    );
    expect(runWindowLine("Lesen", "2026-11-28", "2026-11-26")).toMatch(
      /^„Lesen“ lässt sich nur bis Samstag, 28\. Nov\. verschieben\.$/,
    );
    expect(runWindowLine("Lesen", null, "2026-11-26")).toBe(
      "„Lesen“ lässt sich nicht verschieben.",
    );
  });
});
