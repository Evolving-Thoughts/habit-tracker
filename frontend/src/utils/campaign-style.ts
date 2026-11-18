import {
  CAMPAIGN_COLORS,
  CAMPAIGN_ICONS,
  type CampaignColor,
  type CampaignIcon,
} from "../types/campaign";

/** Spoken names of the colours, for the picker and for screen readers. */
export const COLOR_NAMES: Record<CampaignColor, string> = {
  moss: "Moos",
  pine: "Tanne",
  sage: "Salbei",
  slate: "Schiefer",
  indigo: "Indigo",
  heather: "Heide",
  plum: "Pflaume",
  berry: "Beere",
  walnut: "Walnuss",
  ochre: "Ocker",
};

export const ICON_NAMES: Record<CampaignIcon, string> = {
  book: "Buch",
  code: "Code",
  dumbbell: "Hantel",
  heart: "Herz",
  home: "Zuhause",
  briefcase: "Aktentasche",
  graduation: "Doktorhut",
  music: "Musik",
  leaf: "Blatt",
  money: "Geld",
  wrench: "Werkzeug",
  pen: "Füller",
  camera: "Kamera",
  globe: "Globus",
  star: "Stern",
  flag: "Fahne",
};

/* Responses carry the keys as plain strings; these narrow them. */
export const isCampaignColor = (value: unknown): value is CampaignColor =>
  (CAMPAIGN_COLORS as readonly unknown[]).includes(value);

export const isCampaignIcon = (value: unknown): value is CampaignIcon =>
  (CAMPAIGN_ICONS as readonly unknown[]).includes(value);

/** The colour token of a key, from style.css. */
export const markToken = (color: CampaignColor): string =>
  `var(--color-mark-${color})`;
