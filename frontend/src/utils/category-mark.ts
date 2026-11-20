import { CORE_COLORS } from "../types/campaign";
import { isCampaignColor, markToken } from "./campaign-style";

/**
 * The colour a name picks while none is chosen: one of the core marks, so
 * a picked colour stays apart for colour-blind eyes too. The same name
 * always gets the same mark; none of them is the action colour, so orange
 * still means "tap here".
 */
function markOfName(name: string): string {
  // FNV-1a: a multiplier of 31 is 1 modulo 6, which made the mark depend on
  // the plain sum of the characters and let common names collide.
  let hash = 2166136261;
  for (const character of name)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return markToken(CORE_COLORS[hash % CORE_COLORS.length]!);
}

/** The colour of a category: the chosen one, else the one its name picks. */
export function categoryMark(name: string, color?: string | null): string {
  return isCampaignColor(color) ? markToken(color) : markOfName(name);
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
