import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  flatten,
  parseColor,
  ruleBody,
  themeTokens,
  tokenColor,
  tokenContrast,
} from "./contrast";

describe("parseColor", () => {
  it("reads hex in three, six and eight digits", () => {
    expect(parseColor("#fff")).toEqual({ r: 255, g: 255, b: 255, a: 1 });
    expect(parseColor("#2B1D16")).toEqual({ r: 43, g: 29, b: 22, a: 1 });
    expect(parseColor("#00000080").a).toBeCloseTo(0.502, 3);
  });
  it("reads rgb() with and without alpha", () => {
    expect(parseColor("rgb(43 29 22 / 40%)")).toEqual({
      r: 43,
      g: 29,
      b: 22,
      a: 0.4,
    });
    expect(parseColor("rgb(1, 2, 3)")).toEqual({ r: 1, g: 2, b: 3, a: 1 });
    expect(parseColor("rgba(1, 2, 3, 0.5)").a).toBe(0.5);
  });
  it("refuses anything else", () => {
    expect(() => parseColor("var(--color-ink)")).toThrow();
    expect(() => parseColor("#12345")).toThrow();
  });
});

describe("contrast", () => {
  it("matches the WCAG reference values", () => {
    const white = parseColor("#ffffff");
    expect(contrastRatio(white, parseColor("#000000"))).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBe(1);
    // #767676 is the classic lightest grey that passes 4.5:1 on white.
    expect(contrastRatio(white, parseColor("#767676"))).toBeCloseTo(4.54, 2);
  });
  it("flattens a translucent colour onto what lies below", () => {
    const half = flatten(parseColor("rgb(255 255 255 / 50%)"), {
      r: 0,
      g: 0,
      b: 0,
      a: 1,
    });
    expect(half).toEqual({ r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });
});

describe("token blocks", () => {
  const css = `
    :root { --color-ground: #ffffff; --color-ink: #000000; /* --x: #f00; */
      --color-veil: rgb(0 0 0 / 50%); --color-link: var(--color-ink); }
    .card { color: red; }
    :root[data-theme="dark"] { --color-ground: #000000; --color-ink: #ffffff; }
  `;
  it("finds a rule by its exact selector, skipping comments", () => {
    expect(ruleBody(css, ".card").trim()).toBe("color: red;");
    expect(() => ruleBody(css, ".missing")).toThrow();
  });
  it("gives each theme a complete set, dark over light", () => {
    const { light, dark } = themeTokens(css);
    expect(light["x"]).toBeUndefined();
    expect(dark["color-veil"]).toBe("rgb(0 0 0 / 50%)");
    expect(tokenColor(light, "color-link")).toBe("#000000");
    expect(tokenColor(dark, "color-link")).toBe("#ffffff");
  });
  it("measures a translucent background on the ground", () => {
    const { light } = themeTokens(css);
    expect(tokenContrast(light, "color-ink", "color-ground")).toBeCloseTo(21);
    expect(tokenContrast(light, "color-ink", "color-veil")).toBeLessThan(6);
  });
});
