import { describe, expect, it } from "vitest";
import { CAMPAIGN_COLORS } from "../types/campaign";
import { campaignMark, categoryMark } from "./category-mark";

describe("categoryMark", () => {
  it("always gives the same name the same mark", () => {
    expect(categoryMark("Sport")).toBe(categoryMark("Sport"));
  });

  it("spreads common category names over different marks", () => {
    const names = ["Sport", "Haushalt", "Lernen und Lesen", "Gesundheit"];
    expect(new Set(names.map(categoryMark)).size).toBe(names.length);
  });

  it("returns a mark token for every name", () => {
    for (const name of ["", "a", "Ärger", "x".repeat(200)])
      expect(categoryMark(name)).toMatch(/^var\(--color-mark-[a-z]+\)$/);
  });
});

describe("campaignMark", () => {
  it("gives a campaign without stored colour the mark of its title", () => {
    expect(campaignMark({ title: "Buch" })).toBe(categoryMark("Buch"));
    expect(campaignMark({ title: "Buch", color: null })).toBe(
      categoryMark("Buch"),
    );
    expect(campaignMark(null)).toBeNull();
  });

  it("uses the stored colour, whatever the title", () => {
    for (const color of CAMPAIGN_COLORS)
      expect(campaignMark({ title: "Buch", color })).toBe(
        `var(--color-mark-${color})`,
      );
  });

  it("falls back to the title for a key it does not know", () => {
    expect(campaignMark({ title: "Buch", color: "orange" })).toBe(
      categoryMark("Buch"),
    );
  });
});
