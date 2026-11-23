import { describe, expect, it } from "vitest";
import { contentWidth, firstThatFits } from "./fit-text";

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

describe("contentWidth", () => {
  it("is the border box less borders and padding, whatever clientWidth says", () => {
    const input = document.createElement("input");
    input.style.cssText = "border: 1px solid; padding: 0 12px";
    document.body.append(input);
    // Layout as Chromium 158 reports it: clientWidth already without padding.
    Object.defineProperty(input, "offsetWidth", { value: 135 });
    Object.defineProperty(input, "clientWidth", { value: 109 });
    expect(contentWidth(input)).toBe(109);
    input.remove();
  });
});
