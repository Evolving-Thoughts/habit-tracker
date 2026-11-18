import { BadRequestException } from '@nestjs/common';

/**
 * The colours and icons a campaign can store, as keys. The frontend keeps
 * the same lists in `types/campaign.ts`; the contract check holds them in step.
 */
export const CAMPAIGN_COLORS = [
  'moss',
  'pine',
  'sage',
  'slate',
  'indigo',
  'heather',
  'plum',
  'berry',
  'walnut',
  'ochre',
] as const;

export const CAMPAIGN_ICONS = [
  'book',
  'code',
  'dumbbell',
  'heart',
  'home',
  'briefcase',
  'graduation',
  'music',
  'leaf',
  'money',
  'wrench',
  'pen',
  'camera',
  'globe',
  'star',
  'flag',
] as const;

export type CampaignColor = (typeof CAMPAIGN_COLORS)[number];
export type CampaignIcon = (typeof CAMPAIGN_ICONS)[number];

/** Up to 100 hours a week, in minutes. */
export const MAX_WEEKLY_TARGET_MINUTES = 6000;

/** What only a campaign (a todo without parent) may carry. */
export type CampaignFields = {
  weeklyTargetMinutes: number | null;
  color: CampaignColor | null;
  icon: CampaignIcon | null;
};

export const NO_CAMPAIGN_FIELDS: CampaignFields = {
  weeklyTargetMinutes: null,
  color: null,
  icon: null,
};

export const hasCampaignFields = (todo: CampaignFields): boolean =>
  todo.weeklyTargetMinutes !== null ||
  todo.color !== null ||
  todo.icon !== null;

/** A todo below another one is no campaign, so it carries none of these. */
export function assertCampaignFields(
  todo: CampaignFields & { parentId: number | null },
): void {
  if (todo.parentId !== null && hasCampaignFields(todo))
    throw new BadRequestException(
      'Wochenziel, Farbe und Symbol gibt es nur für eine Kampagne.',
    );
}
