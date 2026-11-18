/**
 * The first of `options` (longest first) whose width fits `available`, so a
 * label never ends cut in the middle of a word; the last one when none fits.
 */
export function firstThatFits(
  options: readonly string[],
  available: number,
  measure: (text: string) => number,
): string {
  return options.find((text) => measure(text) <= available) ?? options.at(-1) ?? "";
}
