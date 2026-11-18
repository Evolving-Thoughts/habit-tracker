import { describe, expect, it } from "vitest";
import { campaignMark, categoryMark } from "./category-mark";

describe("categoryMark", () => {
  it("always gives the same name the same mark", () => {
    expect(categoryMark("Sport")).toBe(categoryMark("Sport"));
  });

  it("spreads common category names over different marks", () => {
    const names = ["Sport", "Haushalt", "Lernen und Lesen", "Gesundheit"];
    expect(new Set(names.map(categoryMark)).size).toBe(names.length);
  });

  it("returns a mark for every name", () => {
    for (const name of ["", "a", "Ärger", "x".repeat(200)])
      expect(categoryMark(name)).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("campaignMark", () => {
  it("gives a campaign the mark of its title and nothing without one", () => {
    expect(campaignMark({ title: "Buch" })).toBe(categoryMark("Buch"));
    expect(campaignMark(null)).toBeNull();
  });
});
