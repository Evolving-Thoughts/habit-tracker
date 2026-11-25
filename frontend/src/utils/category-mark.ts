import { CORE_COLORS, type CampaignColor } from "../types/campaign";
import { isCampaignColor, markToken } from "./campaign-style";

/**
 * The colour a name picks while none is chosen: one of the core marks, so
 * a picked colour stays apart for colour-blind eyes too. The same name
 * always gets the same mark; none of them is the action colour, so orange
 * still means "tap here". The backend keeps the same hash in
 * `categories/category-colors.ts` (both specs check the same names).
 */
export function colorOfName(name: string): CampaignColor {
  // FNV-1a: a multiplier of 31 is 1 modulo 6, which made the mark depend on
  // the plain sum of the characters and let common names collide.
  let hash = 2166136261;
  for (const character of name)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return CORE_COLORS[hash % CORE_COLORS.length]!;
}

const markOfName = (name: string): string => markToken(colorOfName(name));

/**
 * The colour of a category: the one the server says it shows (it resolves
 * categories without a stored colour so that two never look alike, see
 * `shownCategoryColors` in the backend), else the one its name picks.
 */
export function categoryMark(name: string, color?: string | null): string {
  return isCampaignColor(color) ? markToken(color) : markOfName(name);
}

/**
 * The order in which a category without a chosen colour gets a free core
 * colour: each next pick stays as far from the ones before as the core set
 * allows under protanopia and deuteranopia, with steps in lightness
 * (`palette.spec.ts` checks the first ones with the Machado simulation).
 * The server keeps the same list in `categories/category-colors.ts`.
 */
export const AUTO_COLOR_ORDER: readonly CampaignColor[] = [
  "indigo",
  "ochre",
  "plum",
  "walnut",
  "navy",
  "berry",
  "pine",
  "teal",
];

const firstFree = (used: Set<string>): CampaignColor | undefined =>
  AUTO_COLOR_ORDER.find((core) => !used.has(core));
const usedBy = (colors: (string | null | undefined)[]) =>
  new Set(colors.filter((color): color is string => Boolean(color)));

/**
 * The colour a new category will get without a chosen one, for the preview
 * before it is created: the first free colour in `AUTO_COLOR_ORDER`, else the
 * one its name picks. The server decides the same (`colorForNewCategory`).
 */
export function newCategoryColor(
  name: string,
  shown: (string | null | undefined)[],
): CampaignColor {
  return firstFree(usedBy(shown)) ?? colorOfName(name);
}

/**
 * The colour a category shows once set back to "Automatisch": the one its
 * name picks unless another category shows it, then the first free one in
 * `AUTO_COLOR_ORDER`. `others` are the colours the other categories show.
 */
export function automaticCategoryColor(
  name: string,
  others: (string | null | undefined)[],
): CampaignColor {
  const used = usedBy(others);
  const own = colorOfName(name);
  return used.has(own) ? (firstFree(used) ?? own) : own;
}

/**
 * The colour of a campaign, wherever one is drawn: the stored colour, else
 * one from the title like a category's; null without a campaign.
 */
export function campaignMark(
  campaign: { title: string; color?: string | null } | null,
): string | null {
  if (!campaign) return null;
  return categoryMark(campaign.title, campaign.color);
}
