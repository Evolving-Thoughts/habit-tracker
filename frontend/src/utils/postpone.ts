import type { DayPlannerItem } from "../types/day-planner";

/**
 * "Auf morgen" in Heute's head: everything open moves to tomorrow, today's
 * entries in their order, then what is carried over from earlier; an
 * appointment keeps its time. What cannot move stays and is named with its
 * reason, so the count never surprises. Google events are not the app's to
 * move and are no part of it. See docs/day-order.md › Frontend.
 */
export type Staying = {
  item: DayPlannerItem;
  /** "window": a daily's run whose window ends before tomorrow. "timer": its stopwatch runs. */
  reason: "window" | "timer";
};

export type PostponePlan = { moving: DayPlannerItem[]; staying: Staying[] };

export function postponePlan(
  open: readonly DayPlannerItem[],
  tomorrow: string,
  timed: (item: DayPlannerItem) => boolean,
): PostponePlan {
  const moving: DayPlannerItem[] = [];
  const staying: Staying[] = [];
  for (const item of open) {
    if (item.status !== "pending") continue;
    if (timed(item)) staying.push({ item, reason: "timer" });
    else if (
      item.type === "habit" &&
      (item.moveUntil === null || item.moveUntil < tomorrow)
    )
      staying.push({ item, reason: "window" });
    else moving.push(item);
  }
  return { moving, staying };
}

/** "Lesen", "Lesen und Laufen", "Lesen, Laufen und Yoga". */
function titles(items: readonly Staying[]): string {
  const names = items.map(({ item }) => `„${item.title}“`);
  return names.length < 2
    ? (names[0] ?? "")
    : `${names.slice(0, -1).join(", ")} und ${names.at(-1)}`;
}

/** What stays and why, one sentence per reason; empty when all moves. */
export function stayingLines(staying: readonly Staying[]): string[] {
  const lines: string[] = [];
  const window = staying.filter(({ reason }) => reason === "window");
  const timer = staying.filter(({ reason }) => reason === "timer");
  if (window.length)
    lines.push(
      window.length === 1
        ? `${titles(window)} bleibt: Sein Zeitraum endet heute.`
        : `${titles(window)} bleiben: Ihr Zeitraum endet heute.`,
    );
  if (timer.length)
    lines.push(
      `${titles(timer)} ${timer.length === 1 ? "bleibt" : "bleiben"}: Die Stoppuhr läuft noch.`,
    );
  return lines;
}

/** The dialog's lead: how many move, and that appointments keep their time. */
export function movingLine(moving: readonly DayPlannerItem[]): string {
  const count =
    moving.length === 1
      ? "1 offener Eintrag wandert"
      : `${moving.length} offene Einträge wandern`;
  const appointments = moving.some(
    (item) => item.type === "todo" && item.timeOfDay !== null,
  );
  return `${count} auf morgen und ${moving.length === 1 ? "reiht sich" : "reihen sich"} dort hinten ein.${
    appointments ? " Termine behalten ihre Uhrzeit." : ""
  }`;
}
