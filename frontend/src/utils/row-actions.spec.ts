import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { TimerController } from "../composables/useTimer";
import {
  quickMoveEntries,
  quickMoves,
  rowMenu,
  timerStep,
} from "./row-actions";

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

describe("rowMenu", () => {
  const run = () => {};
  it("puts every step in the one order, Löschen last and set apart", () => {
    const entries = rowMenu("Lesen", {
      remove: { run },
      down: run,
      up: run,
      challenge: run,
      reparent: run,
      child: run,
      timer: { run, label: "Stoppuhr starten", disabled: false },
      focusMode: run,
      edit: run,
      skip: run,
      otherDay: { run },
      quickMoves: quickMoveEntries("Lesen", quickMoves(TODAY, { date: TODAY }), run),
    });
    expect(entries.map((entry) => entry.label)).toEqual([
      "Morgen",
      "Nächste Woche",
      "Anderer Tag …",
      "Überspringen",
      "Bearbeiten",
      "Fokus-Modus",
      "Stoppuhr starten",
      "Unter-Quest hinzufügen",
      "In Kampagne verschieben …",
      "Zur Monats-Challenge",
      "Nach oben",
      "Nach unten",
      "Löschen",
    ]);
    expect(entries.filter((entry) => entry.last).map((e) => e.label)).toEqual([
      "Löschen",
    ]);
  });

  it("names the pick-a-day step for appointments and quests without a day", () => {
    const label = (steps: Parameters<typeof rowMenu>[1]) =>
      rowMenu("Zahnarzt", steps).map((entry) => [entry.label, entry.ariaLabel]);
    expect(label({ otherDay: { run, appointment: true } })).toEqual([
      ["Termin verschieben …", "Zahnarzt verschieben"],
    ]);
    expect(label({ otherDay: { run, plan: true } })).toEqual([
      ["Anderer Tag …", "Tag für Zahnarzt wählen"],
    ]);
  });

  it("holds every step while the row is busy", () => {
    const entries = rowMenu("Lesen", { edit: run, remove: { run } }, true);
    expect(entries.every((entry) => entry.disabled)).toBe(true);
  });
});

describe("timerStep", () => {
  const controller = (timer: unknown, busy = false) =>
    ({
      timer: ref(timer),
      busy: ref(busy),
      start: vi.fn(),
      action: vi.fn(),
    }) as unknown as TimerController;
  const target = { kind: "todo" as const, targetId: 3, title: "Lesen" };

  it("starts the stopwatch like ▶ where measuring is allowed", () => {
    const own = controller(null);
    const step = timerStep(own, target, true);
    expect(step).toMatchObject({ label: "Stoppuhr starten", disabled: false });
    step.run();
    expect(own.start).toHaveBeenCalledWith(target);
    expect(timerStep(own, target, false).disabled).toBe(true);
    expect(timerStep(null, target, true).disabled).toBe(true);
  });

  it("pauses the stopwatch already running on this card", () => {
    const own = controller({ kind: "todo", targetId: 3, state: "running" });
    const step = timerStep(own, target, false);
    expect(step).toMatchObject({ label: "Stoppuhr pausieren", disabled: false });
    step.run();
    expect(own.action).toHaveBeenCalledWith("pause");
  });
});
