import { describe, expect, it } from "vitest";
import { insertText } from "./insert-text";

describe("insertText", () => {
  it("appends after a space and starts an empty field plainly", () => {
    expect(insertText("Lief gut", "danke")).toEqual({
      value: "Lief gut danke",
      caret: 14,
      truncated: false,
    });
    expect(insertText("", "Hallo").value).toBe("Hallo");
    expect(insertText("Ende ", "neu").value).toBe("Ende neu");
  });

  it("goes in at the cursor or over the selection, spaced from both sides", () => {
    expect(insertText("ErstDann", "mitte", { start: 4 })).toEqual({
      value: "Erst mitte Dann",
      caret: 11,
      truncated: false,
    });
    expect(insertText("a XXX b", "y", { start: 2, end: 5 }).value).toBe("a y b");
  });

  it("cuts the dictated part to the limit", () => {
    const result = insertText("12345", "abc def", { max: 10 });
    expect(result).toEqual({ value: "12345 abc", caret: 9, truncated: true });
    expect(insertText("1234567890", "x", { max: 10 }).value).toBe("1234567890");
  });
});
