export type CategoryResponse = {
  id: number;
  name: string;
  weeklyTarget?: number | null;
  /**
   * A key from `campaign.ts`: the colour the category shows, chosen or
   * resolved by the server so that no two look alike while one is free.
   */
  color?: string | null;
  /** False while no colour is stored ("Automatisch" in the settings). */
  colorChosen?: boolean;
};
