export type CategoryResponse = {
  id: number;
  name: string;
  weeklyTarget?: number | null;
  /** A key from `campaign.ts`; null while the name picks the colour. */
  color?: string | null;
};
