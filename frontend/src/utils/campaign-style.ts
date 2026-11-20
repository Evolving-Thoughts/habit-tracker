import {
  CAMPAIGN_COLORS,
  CAMPAIGN_ICONS,
  type CampaignColor,
  type CampaignIcon,
} from "../types/campaign";

/** Spoken names of the colours, for the picker and for screen readers. */
export const COLOR_NAMES: Record<CampaignColor, string> = {
  indigo: "Indigo",
  navy: "Nachtblau",
  ochre: "Ocker",
  pine: "Tanne",
  berry: "Beere",
  plum: "Pflaume",
  teal: "Petrol",
  walnut: "Walnuss",
  moss: "Moos",
  sage: "Salbei",
  sky: "Himmel",
  slate: "Schiefer",
  heather: "Heide",
  wine: "Weinrot",
  olive: "Oliv",
  lilac: "Flieder",
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
  bike: "Fahrrad",
  coffee: "Tasse",
  plane: "Papierflieger",
  palette: "Farbpalette",
  mountain: "Berg",
  moon: "Mond",
  people: "Menschen",
  chat: "Sprechblase",
  bulb: "Glühbirne",
  trophy: "Pokal",
  pot: "Kochtopf",
  gamepad: "Controller",
  paw: "Pfote",
  laptop: "Laptop",
  map: "Karte",
  drop: "Tropfen",
};

/* Responses carry the keys as plain strings; these narrow them. */
export const isCampaignColor = (value: unknown): value is CampaignColor =>
  (CAMPAIGN_COLORS as readonly unknown[]).includes(value);

export const isCampaignIcon = (value: unknown): value is CampaignIcon =>
  (CAMPAIGN_ICONS as readonly unknown[]).includes(value);

/**
 * "Beere · Buch · 6 Std. pro Woche": what a campaign's look and goal are set
 * to, in words, for a closed disclosure; empty while nothing is chosen.
 */
export function campaignChoices(
  color: CampaignColor | null,
  icon: CampaignIcon | null,
  targetHours: string | number,
): string {
  const hours = String(targetHours).trim();
  return [
    color ? COLOR_NAMES[color] : "",
    icon ? ICON_NAMES[icon] : "",
    hours ? `${hours.replace(".", ",")} Std. pro Woche` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The colour token of a key, from style.css. */
export const markToken = (color: CampaignColor): string =>
  `var(--color-mark-${color})`;
