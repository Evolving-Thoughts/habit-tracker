import { afterEach, describe, expect, it, vi } from "vitest";
import { durationLabel, parseQuest, type QuestParseKind } from "./quest-parse";

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

describe("campaigns and categories", () => {
  const campaigns = [
    { id: 1, title: "Buch schreiben", icon: "book" },
    { id: 2, title: "Buch", icon: null },
    { id: 3, title: "Garten & Haus" },
    { id: 4, title: "Größe", icon: null },
    { id: 5, title: "Uni" },
  ];
  const categories = [
    { id: 10, name: "Sport", mark: "var(--color-mark-pine)" },
    { id: 11, name: "Schreiben" },
    { id: 12, name: "Haushalt & Garten" },
    { id: 13, name: "Ämter" },
  ];
  const named = (text: string, ignore?: QuestParseKind[]) =>
    parseQuest(text, { today, ignore, campaigns, categories });

  it("reads the full example with day and duration", () => {
    const text =
      "Kapitel 4 gliedern morgen 30 Minuten Kampagne Buch schreiben Kategorie Schreiben";
    const result = named(text);
    expect(result).toMatchObject({
      title: "Kapitel 4 gliedern",
      scheduledDate: "2026-11-25",
      plannedDurationMinutes: 30,
      campaignId: 1,
      categoryId: 11,
    });
    expect(
      result.matches.map((match) => [match.kind, match.label, match.text]),
    ).toEqual([
      ["date", "morgen", "morgen"],
      ["duration", "30 Min.", "30 Minuten"],
      ["campaign", "Buch schreiben", "Kampagne Buch schreiben"],
      ["category", "Schreiben", "Kategorie Schreiben"],
    ]);
    expect(result.matches[2]).toMatchObject({ id: 1, icon: "book" });
  });

  it.each([
    ["Kapitel gliedern Kampagne Buch schreiben", "Kampagne Buch schreiben"],
    [
      "Kapitel gliedern zur Kampagne Buch schreiben",
      "zur Kampagne Buch schreiben",
    ],
    [
      "Kapitel gliedern für die Kampagne Buch schreiben",
      "für die Kampagne Buch schreiben",
    ],
    [
      "Kapitel gliedern für Kampagne Buch schreiben",
      "für Kampagne Buch schreiben",
    ],
    ["Kampagne Buch schreiben: Kapitel gliedern", "Kampagne Buch schreiben"],
    [
      "Kapitel gliedern, Kampagne „Buch schreiben“",
      "Kampagne „Buch schreiben“",
    ],
  ])("finds the campaign after its keyword: %s", (text, words) => {
    const result = named(text);
    expect(result.campaignId).toBe(1);
    expect(result.title).toBe("Kapitel gliedern");
    expect(result.matches[0]).toMatchObject({ kind: "campaign", text: words });
  });

  it.each([
    ["Laufen Kategorie Sport", "Kategorie Sport"],
    ["Laufen in der Kategorie Sport", "in der Kategorie Sport"],
    ["Laufen in Kategorie Sport", "in Kategorie Sport"],
    ["Laufen, Kategorie Sport.", "Kategorie Sport"],
  ])("finds the category after its keyword: %s", (text, words) => {
    const result = parseQuest(text, { today, categories });
    expect(result.categoryId).toBe(10);
    expect(result.title).toBe("Laufen");
    expect(result.matches[0]).toMatchObject({
      kind: "category",
      id: 10,
      label: "Sport",
      text: words,
      mark: "var(--color-mark-pine)",
    });
  });

  it("matches without case, umlauts, ß and punctuation", () => {
    expect(named("Antrag kategorie aemter").categoryId).toBe(13);
    expect(named("Antrag KATEGORIE ÄMTER").categoryId).toBe(13);
    expect(named("Messen Kampagne groesse").campaignId).toBe(4);
    expect(named("Messen Kampagne Grösse").campaignId).toBe(4);
    expect(named("Kapitel Kampagne buch-schreiben").campaignId).toBe(1);
    expect(named("Kapitel Kampagne Buch schreiben.").title).toBe("Kapitel");
  });

  it("hears „und“ for „&“", () => {
    expect(named("Hecke Kampagne Garten und Haus")).toMatchObject({
      campaignId: 3,
      title: "Hecke",
    });
    expect(named("Fenster Kategorie Haushalt und Garten").categoryId).toBe(12);
  });

  it("forgives one recognition error in names of five letters or more", () => {
    // A letter missing, a word split or joined, a letter off.
    expect(named("Kapitel Kampagne Buch schreibn").campaignId).toBe(1);
    expect(named("Kapitel Kampagne Buchschreiben").campaignId).toBe(1);
    expect(named("Kapitel Kampagne Buch schreiben").campaignId).toBe(1);
    expect(named("Laufen Kategorie Spord").categoryId).toBe(10);
    expect(named("Laufen Kategorie Sports").title).toBe("Laufen");
    // The keyword too: a plural or one letter off.
    expect(named("Laufen Kathegorie Sport").categoryId).toBe(10);
    expect(named("Kapitel Kampagnen Buch schreiben").campaignId).toBe(1);
  });

  it("asks short names to be exact", () => {
    expect(named("Lernen Kampagne Uni").campaignId).toBe(5);
    expect(named("Lernen Kampagne Umi").campaignId).toBeUndefined();
    expect(named("Lernen Kampagne Bich").campaignId).toBeUndefined();
    expect(named("Laufen Kategorie Sportverein").categoryId).toBeUndefined();
  });

  it("takes the longest name, but an exact one over a near one", () => {
    expect(named("Kapitel Kampagne Buch schreiben").campaignId).toBe(1);
    expect(named("Lesen Kampagne Buch").campaignId).toBe(2);
    expect(named("Lesen Kampagne Buch lesen")).toMatchObject({
      campaignId: 2,
      title: "Lesen lesen",
    });
    expect(
      parseQuest("Lesen Kampagne Buch", {
        today,
        campaigns: [
          { id: 2, title: "Buch" },
          { id: 6, title: "Buche" },
        ],
      }).campaignId,
    ).toBe(2);
  });

  it("takes a campaign after „für“ only when spelt exactly", () => {
    const result = named("Kapitel 4 gliedern für Buch schreiben");
    expect(result).toMatchObject({ campaignId: 1, title: "Kapitel 4 gliedern" });
    expect(result.matches[0].text).toBe("für Buch schreiben");
    // "Buch schreibn" is not exact; "Buch" alone is.
    expect(named("Kapitel für Buch schreibn")).toMatchObject({
      campaignId: 2,
      title: "Kapitel schreibn",
    });
    expect(named("Recherche für Buchschreiben").campaignId).toBeUndefined();
    // Never a category after "für" alone.
    expect(named("Schuhe für Sport kaufen").categoryId).toBeUndefined();
  });

  it("never takes a bare name", () => {
    expect(named("Buch schreiben morgen")).toMatchObject({
      title: "Buch schreiben",
      matches: [expect.objectContaining({ kind: "date" })],
    });
    expect(named("Sport machen").matches).toEqual([]);
    expect(named("Schreiben üben").matches).toEqual([]);
  });

  it("leaves an unknown name in the title", () => {
    expect(named("Laufen Kategorie Fitness")).toEqual({
      title: "Laufen Kategorie Fitness",
      matches: [],
    });
  });

  it("names only what it was given", () => {
    expect(parse("Laufen Kategorie Sport")).toEqual({
      title: "Laufen Kategorie Sport",
      matches: [],
    });
    expect(
      parseQuest("Kapitel Kampagne Buch schreiben", { today, campaigns: [] })
        .campaignId,
    ).toBeUndefined();
  });

  it("counts the first campaign and the first category", () => {
    const result = named("Laufen Kategorie Sport Kategorie Schreiben");
    expect(result.categoryId).toBe(10);
    expect(result.title).toBe("Laufen Kategorie Schreiben");
  });

  it("leaves a discarded kind in the title", () => {
    expect(
      named("Kapitel Kampagne Buch schreiben Kategorie Sport", ["campaign"]),
    ).toMatchObject({
      title: "Kapitel Kampagne Buch schreiben",
      categoryId: 10,
    });
    expect(
      named("Kapitel Kampagne Buch schreiben Kategorie Sport", ["category"]),
    ).toMatchObject({ title: "Kapitel Kategorie Sport", campaignId: 1 });
  });

  it("drops an „und“ between two names and never leaves the title empty", () => {
    expect(
      named("Kapitel Kampagne Buch schreiben und Kategorie Schreiben").title,
    ).toBe("Kapitel");
    // Only names: the text stays the title, the names still count.
    expect(named("Kampagne Buch schreiben")).toMatchObject({
      title: "Kampagne Buch schreiben",
      campaignId: 1,
    });
    expect(named("Morgen Kampagne Buch schreiben Kapitel 4").title).toBe(
      "Kapitel 4",
    );
  });

  it("reads a day in a campaign's name as part of the name", () => {
    const result = parseQuest("Laufen Kampagne Sport am Montag morgen", {
      today,
      campaigns: [{ id: 9, title: "Sport am Montag" }],
    });
    expect(result).toMatchObject({
      title: "Laufen",
      campaignId: 9,
      scheduledDate: "2026-11-25",
    });
  });

  it("gives ranges that cut exactly the recognised words", () => {
    const text = "Kapitel, für die Kampagne Buch schreiben, Kategorie Sport";
    const result = named(text);
    expect(result.matches.map((m) => text.slice(m.start, m.end))).toEqual([
      "für die Kampagne Buch schreiben",
      "Kategorie Sport",
    ]);
    expect(result.title).toBe("Kapitel");
  });
});
