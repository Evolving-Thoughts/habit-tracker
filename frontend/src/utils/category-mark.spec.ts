import { describe, expect, it } from "vitest";
import { CAMPAIGN_COLORS, CORE_COLORS } from "../types/campaign";
import {
  AUTO_COLOR_ORDER,
  automaticCategoryColor,
  campaignMark,
  categoryMark,
  colorOfName,
  newCategoryColor,
} from "./category-mark";

describe("categoryMark", () => {
  it("always gives the same name the same mark", () => {
    expect(categoryMark("Sport")).toBe(categoryMark("Sport"));
  });

  it("spreads common category names over different marks", () => {
    const names = ["Sport", "Haushalt", "Lernen und Lesen", "Gesundheit"];
    expect(new Set(names.map((name) => categoryMark(name))).size).toBe(names.length);
  });

  it("returns a mark token for every name", () => {
    for (const name of ["", "a", "Ärger", "x".repeat(200)])
      expect(categoryMark(name)).toMatch(/^var\(--color-mark-[a-z]+\)$/);
  });
});

describe("colorOfName", () => {
  // The same names and colours as category-colors.spec.ts in the backend.
  it.each([
    ["Haushalt", "pine"],
    ["Kreativ", "pine"],
    ["Sport", "teal"],
    ["Gesundheit", "ochre"],
  ])("gives %p the colour %p, as the server does", (name, color) => {
    expect(colorOfName(name)).toBe(color);
  });
});

describe("newCategoryColor", () => {
  it("takes the first core colour no category shows", () => {
    expect(newCategoryColor("Kreativ", [])).toBe("indigo");
    expect(newCategoryColor("Kreativ", ["pine", "indigo", null])).toBe("ochre");
  });

  it("picks in the server's order, every core colour once", () => {
    // The same list as AUTO_COLOR_ORDER in the backend's category-colors.ts.
    expect(AUTO_COLOR_ORDER).toEqual([
      "indigo",
      "ochre",
      "plum",
      "walnut",
      "navy",
      "berry",
      "pine",
      "teal",
    ]);
    expect([...AUTO_COLOR_ORDER].sort()).toEqual([...CORE_COLORS].sort());
  });

  it("takes the colour of the name once all core colours are used", () => {
    expect(newCategoryColor("Sport", [...CORE_COLORS])).toBe("teal");
  });
});

describe("automaticCategoryColor", () => {
  it("keeps the colour of the name while no other category shows it", () => {
    expect(automaticCategoryColor("Sport", ["indigo"])).toBe("teal");
  });

  it("gives way to another category with the same colour", () => {
    expect(automaticCategoryColor("Kreativ", ["pine", "indigo"])).toBe("ochre");
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
