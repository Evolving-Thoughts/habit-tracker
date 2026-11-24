import { afterEach, describe, expect, it, vi } from "vitest";
import { durationLabel, parseQuest } from "./quest-parse";

// A Tuesday.
const today = "2026-11-24";
const parse = (text: string, ignore?: ("date" | "duration")[]) =>
  parseQuest(text, { today, ignore });

afterEach(() => vi.useRealTimers());

describe("quest text: day and duration", () => {
  it("reads the example from the plan", () => {
    expect(parse("Steuererklärung morgen, 30 Minuten")).toEqual({
      title: "Steuererklärung",
      scheduledDate: "2026-11-25",
      plannedDurationMinutes: 30,
      matches: [
        {
          kind: "date",
          date: "2026-11-25",
          label: "morgen",
          start: 16,
          end: 22,
          text: "morgen",
        },
        {
          kind: "duration",
          minutes: 30,
          label: "30 Min.",
          start: 24,
          end: 34,
          text: "30 Minuten",
        },
      ],
    });
  });

  it("changes nothing when nothing is recognised", () => {
    expect(parse("Mama anrufen")).toEqual({
      title: "Mama anrufen",
      matches: [],
    });
    expect(parse("  Mama anrufen.  ").title).toBe("Mama anrufen.");
    expect(parse("Montags joggen").matches).toEqual([]);
    expect(parse("Hunde füttern").matches).toEqual([]);
    expect(parse("keine Stunde verlieren").matches).toEqual([]);
  });
});

describe("days", () => {
  it.each([
    ["heute Wäsche", "Wäsche", "2026-11-24", "heute"],
    ["Wäsche heute", "Wäsche", "2026-11-24", "heute"],
    ["morgen Zahnarzt anrufen", "Zahnarzt anrufen", "2026-11-25", "morgen"],
    ["Übermorgen Bad putzen", "Bad putzen", "2026-11-26", "übermorgen"],
    ["Bad putzen bis übermorgen", "Bad putzen", "2026-11-26", "übermorgen"],
  ])("%s", (text, title, date, label) => {
    const result = parse(text);
    expect(result.title).toBe(title);
    expect(result.scheduledDate).toBe(date);
    expect(result.matches[0].label).toBe(label);
  });

  it("keeps the capital of the sentence start", () => {
    expect(parse("Morgen einkaufen gehen").title).toBe("Einkaufen gehen");
    expect(parse("morgen einkaufen gehen").title).toBe("einkaufen gehen");
  });

  it.each([
    ["Zahnarzt am Freitag", "2026-11-27", "Fr., 27.11.", "am Freitag"],
    ["Zahnarzt Mittwoch", "2026-11-25", "Mi., 25.11.", "Mittwoch"],
    // The weekday of today means the next one.
    ["Zahnarzt Dienstag", "2026-12-01", "Di., 1.12.", "Dienstag"],
    ["Zahnarzt Montag", "2026-11-30", "Mo., 30.11.", "Montag"],
    ["Zahnarzt Sonntag", "2026-11-29", "So., 29.11.", "Sonntag"],
    [
      "Zahnarzt diesen Dienstag",
      "2026-11-24",
      "Di., 24.11.",
      "diesen Dienstag",
    ],
    // "nächsten" is the day in next week.
    [
      "Zahnarzt nächsten Freitag",
      "2026-12-04",
      "Fr., 4.12.",
      "nächsten Freitag",
    ],
    [
      "Zahnarzt am nächsten Montag",
      "2026-11-30",
      "Mo., 30.11.",
      "am nächsten Montag",
    ],
    [
      "Zahnarzt kommenden Mittwoch",
      "2026-12-02",
      "Mi., 2.12.",
      "kommenden Mittwoch",
    ],
  ])("%s", (text, date, label, words) => {
    const result = parse(text);
    expect(result.title).toBe("Zahnarzt");
    expect(result.scheduledDate).toBe(date);
    expect(result.matches[0]).toMatchObject({ label, text: words });
  });

  it("reads next week's day from a Sunday as well", () => {
    expect(
      parseQuest("nächsten Montag Sport", { today: "2026-11-29" })
        .scheduledDate,
    ).toBe("2026-11-30");
    expect(
      parseQuest("Montag Sport", { today: "2026-11-29" }).scheduledDate,
    ).toBe("2026-11-30");
  });

  it.each([
    ["am 3.12. Geschenk kaufen", "Geschenk kaufen", "2026-12-03", "Do., 3.12."],
    ["Geschenk kaufen am 3.12", "Geschenk kaufen", "2026-12-03", "Do., 3.12."],
    ["Termin 3.12.2027", "Termin", "2027-12-03", "Fr., 3.12.2027"],
    ["Termin 03.12.27", "Termin", "2027-12-03", "Fr., 3.12.2027"],
    ["Feier am 3. Dezember", "Feier", "2026-12-03", "Do., 3.12."],
    ["Feier am 3 dezember", "Feier", "2026-12-03", "Do., 3.12."],
    ["Feier 24. Nov. 2028", "Feier", "2028-11-24", "Fr., 24.11.2028"],
    ["Feier 5. März", "Feier", "2027-03-05", "Fr., 5.3.2027"],
  ])("%s", (text, title, date, label) => {
    const result = parse(text);
    expect(result.title).toBe(title);
    expect(result.scheduledDate).toBe(date);
    expect(result.matches[0].label).toBe(label);
  });

  it("puts a past day without a year into next year; today stays today", () => {
    expect(parse("Rechnung 1.11.").scheduledDate).toBe("2027-11-01");
    expect(parse("Geburtstag 2. Januar").scheduledDate).toBe("2027-01-02");
    expect(parse("Rechnung 24.11.").scheduledDate).toBe("2026-11-24");
  });

  it("ignores days that do not exist", () => {
    expect(parse("Termin 31.11.").matches).toEqual([]);
    expect(parse("Termin 30. Februar").matches).toEqual([]);
    expect(parse("Termin 3.13.").matches).toEqual([]);
    expect(parse("Termin 31.11.").title).toBe("Termin 31.11.");
  });

  it("counts the Berlin day by default", () => {
    vi.useFakeTimers();
    // 00:30 in Berlin on Wednesday.
    vi.setSystemTime(new Date("2026-11-24T23:30:00Z"));
    expect(parseQuest("morgen Sport").scheduledDate).toBe("2026-11-26");
  });
});

describe("durations", () => {
  it.each([
    ["30 Minuten", 30],
    ["30 minuten", 30],
    ["30 min", 30],
    ["30min", 30],
    ["30 Min.", 30],
    ["1 Minute", 1],
    ["1 Stunde", 60],
    ["eine Stunde", 60],
    ["2 Std.", 120],
    ["2 std", 120],
    ["2h", 120],
    ["anderthalb Stunden", 90],
    ["eineinhalb Stunden", 90],
    ["zweieinhalb Stunden", 150],
    ["1,5 h", 90],
    ["1.5 h", 90],
    ["0,25 Stunden", 15],
    ["eine halbe Stunde", 30],
    ["halbe Stunde", 30],
    ["eine Viertelstunde", 15],
    ["eine Dreiviertelstunde", 45],
    ["zwanzig Minuten", 20],
    ["fünfundvierzig Minuten", 45],
    ["einundzwanzig Minuten", 21],
    ["dreißig Minuten", 30],
    ["sechzig Minuten", 60],
    ["zwölf Minuten", 12],
    ["zwei Stunden", 120],
    ["1 Stunde und 30 Minuten", 90],
    ["2 h 15 min", 135],
  ])("Lesen %s", (words, minutes) => {
    const result = parse(`Lesen ${words}`);
    expect(result.title).toBe("Lesen");
    expect(result.plannedDurationMinutes).toBe(minutes);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]).toMatchObject({ kind: "duration", text: words });
  });

  it("takes connecting words into the range", () => {
    const result = parse("Joggen für ca. 20 Minuten");
    expect(result.title).toBe("Joggen");
    expect(result.matches[0]).toMatchObject({ text: "für ca. 20 Minuten" });
    expect(parse("Joggen etwa 20 min").matches[0].text).toBe("etwa 20 min");
  });

  it("never reads a decimal duration as a day", () => {
    expect(parse("Lesen 1.5 h", ["duration"])).toEqual({
      title: "Lesen 1.5 h",
      matches: [],
    });
  });

  it("skips durations longer than a day", () => {
    expect(parse("Wandern 25 Stunden").matches).toEqual([]);
    expect(parse("Wandern 0 Minuten").matches).toEqual([]);
  });

  it.each([
    [5, "5 Min."],
    [60, "1 Std."],
    [90, "1 Std. 30 Min."],
    [120, "2 Std."],
  ])("labels %i minutes as %s", (minutes, label) => {
    expect(durationLabel(minutes)).toBe(label);
  });
});

describe("title", () => {
  it.each([
    ["Kapitel lesen 45 min morgen", "Kapitel lesen"],
    ["Einkaufen, morgen, 20 min, Milch holen", "Einkaufen, Milch holen"],
    ["Steuer morgen und 30 Minuten", "Steuer"],
    ["Steuer morgen, 30 Minuten.", "Steuer"],
    ["Mama morgen anrufen.", "Mama anrufen."],
    ["Am Freitag für 30 Minuten aufräumen", "Aufräumen"],
    ["Morgen 1 Stunde Steuer machen", "Steuer machen"],
  ])("%s → %s", (text, title) => {
    expect(parse(text).title).toBe(title);
  });

  it("keeps the whole text when everything was recognised", () => {
    const result = parse("morgen 30 Minuten");
    expect(result.title).toBe("morgen 30 Minuten");
    expect(result.scheduledDate).toBe("2026-11-25");
    expect(result.plannedDurationMinutes).toBe(30);
  });

  it("counts only the first day and the first duration", () => {
    const result = parse("Sport morgen oder übermorgen, 30 min oder 1 h");
    expect(result.scheduledDate).toBe("2026-11-25");
    expect(result.plannedDurationMinutes).toBe(30);
    expect(result.title).toBe("Sport oder übermorgen, oder 1 h");
  });

  it("leaves a discarded kind in the title", () => {
    expect(parse("Zahnarzt morgen, 30 min", ["date"])).toMatchObject({
      title: "Zahnarzt morgen",
      plannedDurationMinutes: 30,
    });
    expect(parse("Zahnarzt morgen, 30 min", ["date"]).scheduledDate).toBe(
      undefined,
    );
    expect(parse("Zahnarzt morgen, 30 min", ["duration"])).toMatchObject({
      title: "Zahnarzt, 30 min",
      scheduledDate: "2026-11-25",
    });
  });

  it("gives ranges that cut exactly the recognised words", () => {
    const text = "Zahnarzt am Freitag, eine halbe Stunde";
    const result = parse(text);
    expect(result.matches.map((m) => text.slice(m.start, m.end))).toEqual([
      "am Freitag",
      "eine halbe Stunde",
    ]);
  });
});
