import { describe, expect, it } from "vitest";
import type { SearchTextHit, SearchTitleHit } from "../types/search";
import { highlightParts, textRows, titleRows } from "./search-entries";

const quest: SearchTitleHit = {
  kind: "quest",
  id: 7,
  title: "Kapitel 2",
  highlight: null,
  done: false,
  scheduledDate: "2026-11-18",
  campaign: { id: 3, title: "Buch", color: null, icon: null },
};

describe("search entries", () => {
  it("cuts a text at the match and marks nothing for a broken range", () => {
    expect(highlightParts("Ein Kapitel", { start: 4, end: 11 })).toEqual({
      before: "Ein ",
      match: "Kapitel",
      after: "",
    });
    for (const range of [null, { start: 3, end: 2 }, { start: 0, end: 99 }])
      expect(highlightParts("Text", range)).toEqual({
        before: "Text",
        match: "",
        after: "",
      });
  });

  it("gives an open quest its stopwatch and campaign as side actions", () => {
    const [row] = titleRows([quest]);
    expect(row!.group === "titles" && row!.meta).toBe("Quest · 18. Nov.");
    expect(row!.options.map((option) => option.action)).toEqual([
      { type: "edit-todo", id: 7 },
      { type: "timer", id: 7, title: "Kapitel 2" },
      { type: "campaign", id: 3 },
    ]);
    const [done] = titleRows([
      { ...quest, done: true, campaign: null, scheduledDate: null },
    ]);
    expect(done!.group === "titles" && done!.meta).toBe("Quest · erledigt");
    expect(done!.options).toHaveLength(1);
  });

  it("opens campaigns and dailies by their own place", () => {
    const rows = titleRows([
      { ...quest, kind: "campaign", id: 3, done: true, scheduledDate: null },
      { ...quest, kind: "daily", id: 4, scheduledDate: null },
    ]);
    expect(rows.map((row) => row.options.map((o) => o.action))).toEqual([
      [{ type: "campaign", id: 3 }],
      [{ type: "edit-habit", id: 4 }],
    ]);
    expect(rows[0]!.group === "titles" && rows[0]!.meta).toBe(
      "Kampagne · abgeschlossen",
    );
  });

  it("leads each text to where it was written", () => {
    const text = (hit: Partial<SearchTextHit>): SearchTextHit => ({
      kind: "quest-notes",
      id: 1,
      label: "",
      snippet: "",
      highlight: null,
      date: null,
      habitId: null,
      ...hit,
    });
    const rows = textRows([
      text({ kind: "quest-notes", id: 7 }),
      text({ kind: "run-notes", id: 9, habitId: 4, date: "2026-11-18" }),
      text({ kind: "reflection", date: "2026-11-18" }),
      text({ kind: "week-review", date: "2026-11-16" }),
    ]);
    expect(rows.map((row) => row.options[0]!.action)).toEqual([
      { type: "edit-todo", id: 7, notes: true },
      { type: "edit-habit", id: 4, occurrenceId: 9 },
      { type: "day", date: "2026-11-18" },
      { type: "week", date: "2026-11-16" },
    ]);
  });
});
