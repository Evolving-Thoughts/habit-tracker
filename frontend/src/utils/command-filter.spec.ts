import { describe, expect, it } from "vitest";
import { filterCommands, normalize, type Command } from "./command-filter";

const command = (label: string, extra: Partial<Command> = {}): Command => ({
  id: label,
  label,
  group: "Ansichten",
  run: () => undefined,
  ...extra,
});
const COMMANDS = [
  command("Heute"),
  command("Plan"),
  command("Wochenrückblick"),
  command("Questlog"),
  command("Kampagnen"),
  command("Neue Quest", { group: "Aktionen" }),
  command("Stoppuhr pausieren: Lesen", {
    group: "Aktionen",
    keywords: ["Timer"],
  }),
  command("Offenes auf morgen verschieben", { group: "Aktionen" }),
  command("Logbuch", { group: "Aktionen" }),
];
const labels = (query: string) =>
  filterCommands(COMMANDS, query).map(({ label }) => label);

describe("filterCommands", () => {
  it("keeps every command in order while nothing is typed", () => {
    expect(labels("")).toEqual(COMMANDS.map(({ label }) => label));
    expect(labels("   ")).toHaveLength(COMMANDS.length);
  });

  it("ignores case and accents", () => {
    expect(labels("WOCHENRUCK")).toEqual(["Wochenrückblick"]);
    expect(labels("rückblick")).toEqual(["Wochenrückblick"]);
    expect(normalize("Straße Über")).toBe("strasse uber");
  });

  it("lists matches at the start of a word before matches inside one", () => {
    // Both start a word with it, so they keep the menu's order.
    expect(labels("quest")).toEqual(["Questlog", "Neue Quest"]);
    // "Logbuch" starts with it and comes first, though it is listed last.
    expect(labels("log")).toEqual(["Logbuch", "Questlog"]);
  });

  it("needs every typed word, in any order, and finds keywords", () => {
    expect(labels("morgen offen")).toEqual(["Offenes auf morgen verschieben"]);
    expect(labels("timer")).toEqual(["Stoppuhr pausieren: Lesen"]);
    expect(labels("neue log")).toEqual([]);
  });

  it("finds nothing for a word no command has", () => {
    expect(labels("xyz")).toEqual([]);
  });
});
