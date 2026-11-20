/**
 * The address of every view. Kept apart from the router so that a view can
 * link to another one without importing the router, which imports the views.
 */
export const PATHS = {
  today: "/heute",
  focus: "/fokus",
  calendar: "/kalender",
  plan: "/plan",
  questlog: "/questlog",
  campaigns: "/kampagnen",
  dailies: "/dailies",
  review: "/rueckblick",
  settings: "/einstellungen",
} as const;

export type ViewName = keyof typeof PATHS;

/** What an `<a href>` needs to open a view; the app routes by fragment. */
export function hrefOf(view: ViewName): string {
  return `#${PATHS[view]}`;
}

/**
 * A section inside a view, opened with `?abschnitt=<name>`: the router
 * scrolls to the element with `sectionId(name)` and the view focuses it.
 */
export const SECTION_QUERY = "abschnitt";

export function sectionId(name: string): string {
  return `abschnitt-${name}`;
}

/** `#/kalender?tag=YYYY-MM-DD` opens the Kalender on that day. */
export const DAY_QUERY = "tag";
