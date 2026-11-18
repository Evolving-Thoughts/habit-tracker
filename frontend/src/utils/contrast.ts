/**
 * WCAG contrast for the colour tokens in style.css: parses the token blocks,
 * flattens translucent colours onto what they lie on, and measures ratios.
 * Pure functions, so a spec can check both themes without a browser.
 */

/** sRGB channels 0–255 and alpha 0–1. */
export type Rgba = { r: number; g: number; b: number; a: number };

/** "#abc", "#aabbcc", "#aabbccdd", "rgb(1 2 3)" or "rgb(1 2 3 / 40%)". */
export function parseColor(value: string): Rgba {
  const text = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(text)?.[1];
  if (hex && [3, 6, 8].includes(hex.length)) {
    const full =
      hex.length === 3
        ? [...hex].map((digit) => digit + digit).join("")
        : hex;
    const channel = (index: number) =>
      parseInt(full.slice(index * 2, index * 2 + 2), 16);
    return {
      r: channel(0),
      g: channel(1),
      b: channel(2),
      a: full.length === 8 ? channel(3) / 255 : 1,
    };
  }
  const rgb =
    /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[/,]\s*([\d.]+)(%?))?\s*\)$/.exec(
      text,
    );
  if (rgb) {
    const alpha =
      rgb[4] === undefined
        ? 1
        : Number(rgb[4]) / (rgb[5] === "%" ? 100 : 1);
    return {
      r: Number(rgb[1]),
      g: Number(rgb[2]),
      b: Number(rgb[3]),
      a: alpha,
    };
  }
  throw new Error(`Not a colour: ${value}`);
}

/** A translucent colour as it shows on an opaque one. */
export function flatten(top: Rgba, below: Rgba): Rgba {
  const mix = (front: number, back: number) =>
    front * top.a + back * (1 - top.a);
  return {
    r: mix(top.r, below.r),
    g: mix(top.g, below.g),
    b: mix(top.b, below.b),
    a: 1,
  };
}

/** WCAG 2 relative luminance of an opaque colour. */
export function luminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Contrast ratio 1–21 of two opaque colours. */
export function contrastRatio(first: Rgba, second: Rgba): number {
  const [light, dark] = [luminance(first), luminance(second)].sort(
    (x, y) => y - x,
  );
  return (light! + 0.05) / (dark! + 0.05);
}

/** Custom properties declared directly in one CSS block, by name without "--". */
export type Tokens = Record<string, string>;

function declarations(block: string): Tokens {
  const tokens: Tokens = {};
  const body = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of body.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g))
    tokens[match[1]!] = match[2]!.trim().replace(/\s+/g, " ");
  return tokens;
}

/** The body of the first rule whose selector is exactly `selector`. */
export function ruleBody(css: string, selector: string): string {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let from = 0;
  for (;;) {
    const open = source.indexOf("{", from);
    if (open === -1) throw new Error(`No rule for ${selector}`);
    const start = Math.max(
      source.lastIndexOf("}", open),
      source.lastIndexOf(";", open),
    );
    const found = source.slice(start + 1, open).trim();
    let depth = 1;
    let close = open + 1;
    while (depth && close < source.length) {
      if (source[close] === "{") depth += 1;
      if (source[close] === "}") depth -= 1;
      close += 1;
    }
    if (found === selector) return source.slice(open + 1, close - 1);
    from = open + 1;
  }
}

/** The custom properties a rule declares itself, e.g. the dark block. */
export function blockTokens(css: string, selector: string): Tokens {
  return declarations(ruleBody(css, selector));
}

/**
 * The light tokens (`:root`) and the dark ones (the dark block over them),
 * each a complete set with every name resolved to its own value.
 */
export function themeTokens(
  css: string,
  darkSelector = ':root[data-theme="dark"]',
): { light: Tokens; dark: Tokens } {
  const light = blockTokens(css, ":root");
  const dark = { ...light, ...blockTokens(css, darkSelector) };
  return { light, dark };
}

/** Resolves `var(--name)` chains to a literal colour. */
export function tokenColor(tokens: Tokens, name: string): string {
  let value = tokens[name];
  for (let depth = 0; value && depth < 10; depth += 1) {
    const reference = /^var\(--([\w-]+)\)$/.exec(value)?.[1];
    if (!reference) return value;
    value = tokens[reference];
  }
  throw new Error(`No colour for --${name}`);
}

/**
 * The ratio of a foreground token on a background token. A translucent
 * background lies on `base` (a token, normally the ground); a translucent
 * foreground lies on the flattened background.
 */
export function tokenContrast(
  tokens: Tokens,
  foreground: string,
  background: string,
  base = "color-ground",
): number {
  const ground = parseColor(tokenColor(tokens, base));
  const back = flatten(parseColor(tokenColor(tokens, background)), ground);
  const front = flatten(parseColor(tokenColor(tokens, foreground)), back);
  return contrastRatio(front, back);
}
