import { describe, expect, it } from "vitest";
import indexHtml from "../index.html?raw";
import manifestText from "../public/manifest.webmanifest?raw";
import css from "./style.css?raw";
import { THEME_COLORS } from "./composables/useTheme";
import { CAMPAIGN_COLORS } from "./types/campaign";
import {
  blockTokens,
  layeredContrast,
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
  // Chart bars and the review's meters: on cards, the lifted card and tracks.
  pair("bar", "surface", NON_TEXT, "chart bar on a card"),
  pair("bar", "surface-raised", NON_TEXT, "goal meter on the lifted card"),
  pair("bar", "ground-deep", NON_TEXT, "meter fill on its track"),
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
  // The one lifted card of a view: focus card, quota, quest hours, sign-in.
  ...["ink", "ink-muted", "ink-soft", "action", "action-strong"].map((ink) =>
    pair(ink, "surface-raised", TEXT, "text on the lifted card"),
  ),
  pair("action", "surface-raised", NON_TEXT, "Erledigt on the focus card"),
  pair("line-strong", "surface-raised", NON_TEXT, "field on the sign-in card"),
  pair("ink", "logo-disc", NON_TEXT, "logo on its disc, sign-in card"),
  // Placeholders (ink-soft) on the field itself: fields are surface.
  pair("ink-soft", "surface", TEXT, "placeholder in a field"),
];

/**
 * Text on stacked translucent surfaces, bottom first. The Plan's quick add
 * is a field in surface-quiet on a day column in surface-faint.
 */
const LAYERED: { foreground: string; layers: string[]; use: string }[] = [
  {
    foreground: "ink-soft",
    layers: ["ground", "surface-faint", "surface-quiet"],
    use: "placeholder of the Plan's quick add",
  },
  {
    foreground: "ink",
    layers: ["ground", "surface-faint", "surface-quiet"],
    use: "typing in the Plan's quick add",
  },
];

const themes = themeTokens(css);

function failures(tokens: Tokens): string[] {
  const flat = PAIRS.flatMap(({ foreground, background, min, use }) => {
    const ratio = tokenContrast(
      tokens,
      `color-${foreground}`,
      `color-${background}`,
    );
    return ratio + 1e-9 < min
      ? [
          `${foreground} on ${background}: ${ratio.toFixed(2)} < ${min} (${use})`,
        ]
      : [];
  });
  const stacked = LAYERED.flatMap(({ foreground, layers, use }) => {
    const ratio = layeredContrast(
      tokens,
      `color-${foreground}`,
      layers.map((layer) => `color-${layer}`),
    );
    return ratio + 1e-9 < TEXT
      ? [`${foreground} on ${layers.join(" + ")}: ${ratio.toFixed(2)} (${use})`]
      : [];
  });
  return [...flat, ...stacked];
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

  it("lifts the one raised card a step above the rows at night only", () => {
    // By day the card shadow does it; the colour stays the rows' white.
    expect(tokenColor(themes.light, "color-surface-raised")).toBe(
      tokenColor(themes.light, "color-surface"),
    );
    const step = tokenContrast(
      themes.dark,
      "color-surface-raised",
      "color-surface",
    );
    expect(step).toBeGreaterThan(1.1);
  });

  it("keeps the logo disc visible on the dark sign-in card", () => {
    // By day the warm tint on white is enough; at night it must stand out.
    expect(
      tokenContrast(themes.dark, "color-logo-disc", "color-surface-raised"),
    ).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it("keeps the chart bars calmer than the text at night", () => {
    // By day they are ink; at night a step below it, so text leads.
    expect(tokenColor(themes.light, "color-bar")).toBe(
      tokenColor(themes.light, "color-ink"),
    );
    expect(
      tokenContrast(themes.dark, "color-bar", "color-surface"),
    ).toBeLessThan(tokenContrast(themes.dark, "color-ink", "color-surface"));
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
