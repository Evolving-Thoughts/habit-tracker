import { describe, expect, it } from "vitest";
import { firstThatFits } from "./fit-text";

describe("firstThatFits", () => {
  // Eight pixels a character, like a monospaced font.
  const measure = (text: string) => text.length * 8;
  const options = ["Quest hinzufügen …", "Hinzufügen …"];

  it("takes the full text where it fits", () => {
    expect(firstThatFits(options, 200, measure)).toBe("Quest hinzufügen …");
  });

  it("takes the shorter text instead of one cut in the middle of a word", () => {
    expect(firstThatFits(options, 120, measure)).toBe("Hinzufügen …");
  });

  it("keeps the shortest when none fits", () => {
    expect(firstThatFits(options, 40, measure)).toBe("Hinzufügen …");
    expect(firstThatFits([], 40, measure)).toBe("");
  });
});
