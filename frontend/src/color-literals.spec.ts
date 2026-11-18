import { describe, expect, it } from "vitest";
import css from "./style.css?raw";
import { ruleBody } from "./utils/contrast";

/**
 * Every colour comes from a token in style.css, so the dark theme reaches
 * every surface. A literal anywhere else would stay light at night.
 */
const LITERAL =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|\b(?:white|black)\b(?![-\w])/gi;

/*
 * Places that may keep a literal, with the reason. Keep it tiny; a token is
 * almost always the better answer.
 */
const ALLOWED: { file: string; literal: string; why: string }[] = [];

const vueFiles = import.meta.glob<string>("./**/*.vue", {
  query: "?raw",
  import: "default",
  eager: true,
});

/** Literals in the text, skipping comments and `white-space`. */
function literals(text: string): string[] {
  const code = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/white-space/g, "");
  return [...code.matchAll(LITERAL)].map((match) => match[0]);
}

function allowed(file: string, found: string[]): string[] {
  return found.filter(
    (literal) =>
      !ALLOWED.some(
        (entry) =>
          entry.file === file &&
          entry.literal.toLowerCase() === literal.toLowerCase(),
      ),
  );
}

describe("colour literals", () => {
  it("finds every .vue file", () => {
    expect(Object.keys(vueFiles).length).toBeGreaterThan(50);
  });

  it("finds none in the components and views", () => {
    const found = Object.entries(vueFiles).flatMap(([file, text]) =>
      allowed(file, literals(text)).map((literal) => `${file}: ${literal}`),
    );
    expect(found).toEqual([]);
  });

  it("finds none in style.css outside the two token blocks", () => {
    // ruleBody reads the CSS without comments; so does the rest.
    const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
    let rest = source;
    for (const selector of [":root", ':root[data-theme="dark"]'])
      rest = rest.replace(ruleBody(css, selector), "");
    expect(rest.length).toBeLessThan(source.length - 2000);
    expect(allowed("style.css", literals(rest))).toEqual([]);
  });

  it("catches the literals it is meant to catch", () => {
    expect(
      literals(
        "a { color: #fff; background: rgb(255 255 255 / 55%); fill: white; }",
      ),
    ).toEqual(["#fff", "rgb(", "white"]);
    expect(
      literals("a { white-space: nowrap; color: var(--color-ink); } /* #fff */"),
    ).toEqual([]);
  });
});
