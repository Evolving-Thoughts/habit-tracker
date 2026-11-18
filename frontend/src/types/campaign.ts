/**
 * What a campaign can store as colour and icon. The backend keeps the same
 * keys in `todos/campaign-style.ts`; the contract check holds them in step.
 * Responses carry them as plain strings, since the types here import nothing.
 */
export const CAMPAIGN_COLORS = [
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
] as const;

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
] as const;

export type CampaignColor = (typeof CAMPAIGN_COLORS)[number];
export type CampaignIcon = (typeof CAMPAIGN_ICONS)[number];
