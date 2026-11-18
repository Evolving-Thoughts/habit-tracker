import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import manifestText from "../public/manifest.webmanifest?raw";
import css from "./style.css?raw";
import { THEME_COLORS } from "./composables/useTheme";
import { CAMPAIGN_COLORS } from "./types/campaign";
import {
  blockTokens,
  themeTokens,
  tokenColor,
  tokenContrast,
  type Tokens,
} from "./utils/contrast";

/**
 * WCAG contrast of the token pairs the app really draws, in both themes.
 * Text needs 4.5:1; marks, rings, icons, field edges and the focus ring
 * are non-text and need 3:1. A failing pair means: fix the token.
 */
const TEXT = 4.5;
const NON_TEXT = 3;

type Pair = {
  foreground: string;
  background: string;
  min: number;
  /** Where the pair shows up, for the failure message. */
  use: string;
};

const pair = (
  foreground: string,
  background: string,
  min: number,
  use: string,
): Pair => ({ foreground, background, min, use });

const MARKS = [...CAMPAIGN_COLORS.map((color) => `mark-${color}`)];

const PAIRS: Pair[] = [
  ...["ink", "ink-muted", "ink-soft"].flatMap((ink) =>
    ["ground", "ground-deep", "surface", "surface-flat", "surface-faint"].map(
      (background) => pair(ink, background, TEXT, "text"),
    ),
  ),
  pair("action", "surface", TEXT, "active tab label"),
  pair("action", "action-tint", TEXT, "orange on a tinted button"),
  // No text sits in action orange on the ground; the plus button does.
  pair("action", "ground", NON_TEXT, "plus button, check ring"),
  pair("action-strong", "action-tint", TEXT, "tinted button label"),
  pair("action-strong", "action-tint-hover", TEXT, "tinted button hover"),
  pair("action-strong", "surface", TEXT, "links, buttons on white"),
  pair("action-strong", "ground", TEXT, "links on the ground"),
  pair("action-strong", "ground-deep", TEXT, "Nachholen on its panel"),
  pair("on-action", "action", TEXT, "primary button label"),
  pair("on-action", "action-strong", TEXT, "primary button hover"),
  pair("success", "surface", TEXT, "calendar connected"),
  pair("danger", "surface", TEXT, "form error"),
  pair("danger", "danger-tint", TEXT, "final delete button"),
  pair("ink", "danger-tint", TEXT, "alert text"),
  pair("surface", "ink", TEXT, "undo toast text"),
  pair("ink-muted", "action-tint", TEXT, "editor code block"),
  pair("surface", "ink-muted", NON_TEXT, "check in a history dot"),
  pair("ink", "ground-deep", NON_TEXT, "progress fill on its track"),
  pair("ink-soft", "surface", NON_TEXT, "switch off, skipped ring"),
  pair("line-strong", "surface", NON_TEXT, "field edge on a card"),
  pair("line-strong", "ground", NON_TEXT, "field edge on the ground"),
  pair("action-strong", "surface", NON_TEXT, "focus ring on a card"),
  pair("action-strong", "ground", NON_TEXT, "focus ring on the ground"),
  ...MARKS.flatMap((mark) => [
    pair(mark, "surface", NON_TEXT, "mark on a card"),
    pair(mark, "ground", NON_TEXT, "mark on the ground"),
    pair("on-action", mark, NON_TEXT, "icon on a campaign badge"),
  ]),
  // Logbook stripes and the split bar without a campaign lie on cards.
  pair("mark-none", "surface", NON_TEXT, "time without a campaign"),
];

const themes = themeTokens(css);

function failures(tokens: Tokens): string[] {
  return PAIRS.flatMap(({ foreground, background, min, use }) => {
    const ratio = tokenContrast(
      tokens,
      `color-${foreground}`,
      `color-${background}`,
    );
    return ratio + 1e-9 < min
      ? [`${foreground} on ${background}: ${ratio.toFixed(2)} < ${min} (${use})`]
      : [];
  });
}

describe("theme tokens", () => {
  it("has a dark value for every colour and shadow token", () => {
    const names = (tokens: Tokens) =>
      Object.keys(tokens).filter(
        (name) => name.startsWith("color-") || name.startsWith("shadow-"),
      );
    const own = Object.keys(blockTokens(css, ':root[data-theme="dark"]'));
    expect(names(themes.light).filter((name) => !own.includes(name))).toEqual(
      [],
    );
  });

  it("sets color-scheme for each theme", () => {
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light;/);
    expect(css).toMatch(
      /:root\[data-theme="dark"\]\s*\{[^}]*color-scheme:\s*dark;/,
    );
  });

  for (const [name, tokens] of Object.entries(themes))
    it(`passes WCAG contrast in the ${name} theme`, () => {
      expect(failures(tokens)).toEqual([]);
    });

  it("tells the marks apart by lightness, not by hue alone", () => {
    for (const tokens of Object.values(themes)) {
      const ratios = MARKS.map((mark) =>
        tokenContrast(tokens, `color-${mark}`, "color-surface"),
      ).sort((a, b) => a - b);
      // The lightest and darkest mark differ clearly on the same card.
      expect(ratios.at(-1)! / ratios[0]!).toBeGreaterThan(1.5);
    }
  });
});

describe("theme colour outside the app", () => {
  it("gives the browser bar the ground of each theme", () => {
    expect(THEME_COLORS.light).toBe(tokenColor(themes.light, "color-ground"));
    expect(THEME_COLORS.dark).toBe(tokenColor(themes.dark, "color-ground"));
  });

  it("keeps index.html in step: meta default and the boot script", () => {
    expect(indexHtml).toContain(
      `<meta name="theme-color" content="${THEME_COLORS.light}" />`,
    );
    expect(indexHtml).toContain(
      `dark ? "${THEME_COLORS.dark}" : "${THEME_COLORS.light}"`,
    );
  });

  it("gives the installed app the light ground", () => {
    const manifest = JSON.parse(manifestText) as Record<string, string>;
    expect(manifest["theme_color"]).toBe(THEME_COLORS.light);
    expect(manifest["background_color"]).toBe(THEME_COLORS.light);
  });
});
