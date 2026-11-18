import type { CampaignColor } from "../types/campaign";
import { isCampaignColor, markToken } from "./campaign-style";

/**
 * Categories have no stored colour, so each name maps to one of a few quiet
 * marks. The same name always gets the same mark; none of them is the action
 * colour, so orange still means "tap here".
 */
const MARKS: CampaignColor[] = [
  "moss",
  "slate",
  "heather",
  "ochre",
  "sage",
  "walnut",
];

export function categoryMark(name: string): string {
  // FNV-1a: a multiplier of 31 is 1 modulo 6, which made the mark depend on
  // the plain sum of the characters and let common names collide.
  let hash = 2166136261;
  for (const character of name)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return markToken(MARKS[hash % MARKS.length]!);
}

/**
 * The colour of a campaign, wherever one is drawn: the stored colour, else
 * one from the title like a category's; null without a campaign.
 */
export function campaignMark(
  campaign: { title: string; color?: string | null } | null,
): string | null {
  if (!campaign) return null;
  return isCampaignColor(campaign.color)
    ? markToken(campaign.color)
    : categoryMark(campaign.title);
}
