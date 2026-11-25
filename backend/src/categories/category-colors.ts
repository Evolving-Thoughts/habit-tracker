import { CAMPAIGN_COLORS, type CampaignColor } from '../todos/campaign-style';

/** The eight colours that stay apart under every kind of colour blindness. */
export const CORE_COLORS = CAMPAIGN_COLORS.slice(0, 8);

/**
 * The order in which categories without a chosen colour get a free core
 * colour. Each next pick stays as far as the core set allows from the ones
 * before it under protanopia and deuteranopia, with steps in lightness, so
 * the first four stay clearly apart (the frontend's palette.spec checks it
 * with the Machado simulation). Same list as `AUTO_COLOR_ORDER` in the
 * frontend's `utils/category-mark.ts`.
 */
export const AUTO_COLOR_ORDER: readonly CampaignColor[] = [
  'indigo',
  'ochre',
  'plum',
  'walnut',
  'navy',
  'berry',
  'pine',
  'teal',
];

/**
 * The colour a name picks while none is stored: the same FNV-1a hash as
 * `colorOfName` in the frontend's `utils/category-mark.ts` (the specs on
 * both sides check the same names), so a category keeps the colour it
 * showed before.
 */
export function colorOfName(name: string): CampaignColor {
  let hash = 2166136261;
  for (const character of name)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return CORE_COLORS[hash % CORE_COLORS.length];
}

type Colored = { id: number; name: string; color: CampaignColor | null };

/**
 * The colour every category shows, the one place that decides it: a stored
 * colour as it is; one without, in the order they were created, the colour
 * its name picks unless another category already shows it, then the first
 * free colour in `AUTO_COLOR_ORDER` (the name's colour again once all are
 * taken).
 */
export function shownCategoryColors(
  categories: Colored[],
): Map<number, CampaignColor> {
  const shown = new Map<number, CampaignColor>();
  const taken = new Set<CampaignColor>();
  for (const { id, color } of categories)
    if (color !== null) {
      shown.set(id, color);
      taken.add(color);
    }
  for (const { id, name, color } of [...categories].sort(
    (a, b) => a.id - b.id,
  )) {
    if (color !== null) continue;
    const own = colorOfName(name);
    const pick = taken.has(own)
      ? (AUTO_COLOR_ORDER.find((core) => !taken.has(core)) ?? own)
      : own;
    shown.set(id, pick);
    taken.add(pick);
  }
  return shown;
}

/** The categories with the colour they show in place of the stored one. */
export function withShownColors<T extends Colored>(
  categories: T[],
): (T & { color: CampaignColor })[] {
  const shown = shownCategoryColors(categories);
  return categories.map((category) => ({
    ...category,
    color: shown.get(category.id)!,
  }));
}

/**
 * The colour a new category gets when none is chosen: the first colour in
 * `AUTO_COLOR_ORDER` no category shows yet, so two never share one while one is free;
 * once all eight are used, the colour its name picks.
 */
export function colorForNewCategory(
  name: string,
  existing: Colored[],
): CampaignColor {
  const used = new Set(shownCategoryColors(existing).values());
  return AUTO_COLOR_ORDER.find((core) => !used.has(core)) ?? colorOfName(name);
}
