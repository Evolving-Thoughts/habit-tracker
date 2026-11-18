import { describe, expect, it, vi } from "vitest";
import { quickMoveEntries, quickMoves } from "./row-actions";

// 18 Nov 2026 is a Wednesday; next week's Monday is the 23rd.
const TODAY = "2026-11-18";

describe("quickMoves", () => {
  it("offers tomorrow and next week for an item of today", () => {
    expect(quickMoves(TODAY, { date: TODAY })).toEqual([
      { label: "Morgen", date: "2026-11-19", shortcut: "row.tomorrow" },
      { label: "Nächste Woche", date: "2026-11-23", shortcut: "row.nextWeek" },
    ]);
  });

  it("offers today as well for a quest without a day or from another day", () => {
    expect(quickMoves(TODAY, { date: null }).map((m) => m.label)).toEqual([
      "Heute",
      "Morgen",
      "Nächste Woche",
    ]);
    expect(
      quickMoves(TODAY, { date: "2026-11-16" }).map((m) => m.label),
    ).toEqual(["Heute", "Morgen", "Nächste Woche"]);
    expect(
      quickMoves(TODAY, { date: "2026-11-19" }).map((m) => m.label),
    ).toEqual(["Heute", "Nächste Woche"]);
  });

  it("gives appointments none: they move only where it is confirmed", () => {
    expect(quickMoves(TODAY, { date: TODAY, timeOfDay: "09:00" })).toEqual([]);
  });

  it("keeps a daily run within the last day it may move to", () => {
    expect(
      quickMoves(TODAY, { date: TODAY, moveUntil: "2026-11-20" }).map(
        (m) => m.label,
      ),
    ).toEqual(["Morgen"]);
    expect(quickMoves(TODAY, { date: TODAY, moveUntil: null })).toEqual([]);
  });
});

describe("quickMoveEntries", () => {
  it("names each entry after its item and runs the move", () => {
    const run = vi.fn();
    const [entry] = quickMoveEntries(
      "Lesen",
      quickMoves(TODAY, { date: TODAY }),
      run,
    );
    expect(entry).toMatchObject({
      label: "Morgen",
      icon: "tomorrow",
      ariaLabel: "Lesen auf morgen",
      shortcut: "row.tomorrow",
    });
    entry!.run();
    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-11-19" }),
    );
  });

  it("says planning for a quest without a day", () => {
    const entries = quickMoveEntries(
      "Lesen",
      quickMoves(TODAY, { date: null }),
      () => {},
      { plan: true },
    );
    expect(entries.map((entry) => entry.ariaLabel)).toEqual([
      "Lesen einplanen für heute",
      "Lesen einplanen für morgen",
      "Lesen einplanen für nächste Woche",
    ]);
  });
});
