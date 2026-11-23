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

/**
 * The width text gets inside `element`: its border box less borders and
 * padding. Not `clientWidth`, which for an `<input>` leaves the padding out
 * in newer Chromium (158) and keeps it in older ones.
 */
export function contentWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  return (
    element.offsetWidth -
    parseFloat(style.borderLeftWidth) -
    parseFloat(style.borderRightWidth) -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight)
  );
}
