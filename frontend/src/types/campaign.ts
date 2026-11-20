/**
 * What a campaign can store as colour and icon; categories pick from the
 * same colours. The backend keeps the same keys in
 * `todos/campaign-style.ts`; the contract check holds them in step.
 * Responses carry them as plain strings, since the types here import nothing.
 *
 * The core colours stay apart under protanopia, deuteranopia and tritanopia
 * as well as for full colour vision (`palette.spec.ts` checks it); the
 * extra ones widen the choice and may collide for some kinds of colour
 * blindness. Every key stored before the larger palette is still a member.
 */
export const CORE_COLORS = [
  "indigo",
  "navy",
  "ochre",
  "pine",
  "berry",
  "plum",
  "teal",
  "walnut",
] as const;

export const EXTRA_COLORS = [
  "moss",
  "sage",
  "sky",
  "slate",
  "heather",
  "wine",
  "olive",
  "lilac",
] as const;

export const CAMPAIGN_COLORS = [...CORE_COLORS, ...EXTRA_COLORS] as const;

export const CAMPAIGN_ICONS = [
  "book",
  "code",
  "dumbbell",
  "heart",
  "home",
  "briefcase",
  "graduation",
  "music",
  "leaf",
  "money",
  "wrench",
  "pen",
  "camera",
  "globe",
  "star",
  "flag",
  "bike",
  "coffee",
  "plane",
  "palette",
  "mountain",
  "moon",
  "people",
  "chat",
  "bulb",
  "trophy",
  "pot",
  "gamepad",
  "paw",
  "laptop",
  "map",
  "drop",
] as const;

export type CampaignColor = (typeof CAMPAIGN_COLORS)[number];
export type CampaignIcon = (typeof CAMPAIGN_ICONS)[number];
