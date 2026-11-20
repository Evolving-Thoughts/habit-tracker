import { describe, expect, it } from "vitest";
import css from "./style.css?raw";
import { CAMPAIGN_COLORS, CORE_COLORS } from "./types/campaign";
import {
  layeredContrast,
  parseColor,
  themeTokens,
  tokenColor,
  type Tokens,
} from "./utils/contrast";

/**
 * The marks of campaigns and categories, checked the way colour-blind eyes
 * see them. Dichromacy is simulated with Machado, Oliveira & Fernandes
 * (2009) at full severity on linear sRGB; distance is Euclidean in OKLab
 * ×100 (about 1 is the smallest visible step, 8 an easy tell at a glance).
 *
 * The core set stays apart for everyone in both themes; the extra marks
 * only need to stay apart for full colour vision, which is why every use
 * names its campaign or category in text as well (never colour alone).
 */
const CORE_MIN = 9;
const ALL_MIN = 8;
const NON_TEXT = 3;

type Vision = "normal" | "protan" | "deutan" | "tritan";
type Matrix = [number, number, number][];

const MACHADO: Record<Exclude<Vision, "normal">, Matrix> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

type Vector = [number, number, number];

function linear(hex: string): Vector {
  const { r, g, b } = parseColor(hex);
  return [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }) as Vector;
}

function seen(rgb: Vector, vision: Vision): Vector {
  if (vision === "normal") return rgb;
  return MACHADO[vision].map((row) =>
    Math.min(1, Math.max(0, row[0] * rgb[0] + row[1] * rgb[1] + row[2] * rgb[2])),
  ) as Vector;
}

function oklab([r, g, b]: Vector): Vector {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab distance ×100 of two colours as one kind of eye sees them. */
function distance(first: string, second: string, vision: Vision): number {
  const [a, b] = [first, second].map((hex) => oklab(seen(linear(hex), vision)));
  return 100 * Math.hypot(a![0] - b![0], a![1] - b![1], a![2] - b![2]);
}

/** The closest pair of `marks` for one kind of eye, as "a/b: 9.6". */
function closest(tokens: Tokens, marks: readonly string[], vision: Vision) {
  let best = { pair: "", value: Infinity };
  for (const [index, first] of marks.entries())
    for (const second of marks.slice(index + 1)) {
      const value = distance(
        tokenColor(tokens, `color-mark-${first}`),
        tokenColor(tokens, `color-mark-${second}`),
        vision,
      );
      if (value < best.value) best = { pair: `${first}/${second}`, value };
    }
  return best;
}

const themes = themeTokens(css);
const VISIONS: Vision[] = ["normal", "protan", "deutan", "tritan"];

describe("mark palette", () => {
  it("puts the core set first, then the extra marks", () => {
    expect(CAMPAIGN_COLORS.slice(0, CORE_COLORS.length)).toEqual([
      ...CORE_COLORS,
    ]);
    expect(CAMPAIGN_COLORS).toHaveLength(16);
    expect(new Set(CAMPAIGN_COLORS).size).toBe(CAMPAIGN_COLORS.length);
  });

  it("keeps every colour stored before the larger palette", () => {
    for (const old of [
      "moss",
      "pine",
      "sage",
      "slate",
      "indigo",
      "heather",
      "plum",
      "berry",
      "walnut",
      "ochre",
    ])
      expect(CAMPAIGN_COLORS).toContain(old);
  });

  for (const [theme, tokens] of Object.entries(themes)) {
    for (const vision of VISIONS)
      it(`keeps the core set apart for ${vision} vision in the ${theme} theme`, () => {
        const { pair, value } = closest(tokens, CORE_COLORS, vision);
        expect(value, pair).toBeGreaterThanOrEqual(CORE_MIN);
      });

    it(`keeps all marks apart for full colour vision in the ${theme} theme`, () => {
      const { pair, value } = closest(tokens, CAMPAIGN_COLORS, "normal");
      expect(value, pair).toBeGreaterThanOrEqual(ALL_MIN);
    });

    it(`gives every mark 3:1 on what it sits on in the ${theme} theme`, () => {
      const backgrounds = [
        ["color-surface"],
        ["color-ground"],
        // A daily in the Plan: flat on a day column on the ground.
        ["color-ground", "color-surface-faint", "color-surface-flat"],
      ];
      const low = CAMPAIGN_COLORS.flatMap((color) =>
        backgrounds.flatMap((layers) => {
          const ratio = layeredContrast(tokens, `color-mark-${color}`, layers);
          return ratio + 1e-9 < NON_TEXT
            ? [`${color} on ${layers.at(-1)}: ${ratio.toFixed(2)}`]
            : [];
        }),
      );
      expect(low).toEqual([]);
    });
  }
});
