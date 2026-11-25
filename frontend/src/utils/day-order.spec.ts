import { describe, expect, it } from "vitest";
import { anchoredOrder, clockBoundIndex, withAnchors } from "./day-order";

const entry = (title: string, timeOfDay: string | null = null) => ({
  title,
  timeOfDay,
});
const titles = (items: { title: string }[]) => items.map(({ title }) => title);

describe("anchoredOrder", () => {
  it("clamps a moved appointment without moving unrelated flexible cards", () => {
    const ten = entry("Transporter", "10:00");
    const later = entry("Teammeeting", "14:30");
    expect(clockBoundIndex([entry("A"), later, entry("B")], ten, 3)).toBe(1);
    expect(clockBoundIndex([entry("A"), ten, entry("B")], later, 0)).toBe(2);
  });
  it("keeps the given order when the appointments follow the clock", () => {
    const day = [
      entry("A"),
      entry("Standup", "09:30"),
      entry("B"),
      entry("Zahnarzt", "14:00"),
      entry("C"),
    ];
    expect(titles(anchoredOrder(day))).toEqual(titles(day));
  });

  it("moves an appointment placed before an earlier one down to it", () => {
    expect(
      titles(
        anchoredOrder([
          entry("Zahnarzt", "14:00"),
          entry("A"),
          entry("Standup", "09:30"),
          entry("B"),
        ]),
      ),
    ).toEqual(["A", "Standup", "Zahnarzt", "B"]);
  });

  it("lets an open item stand between two appointments", () => {
    expect(
      titles(
        anchoredOrder([
          entry("Standup", "09:30"),
          entry("Neu"),
          entry("Zahnarzt", "14:00"),
        ]),
      ),
    ).toEqual(["Standup", "Neu", "Zahnarzt"]);
  });
});

describe("withAnchors", () => {
  const row = (title: string, dayPosition: number | null, timeOfDay: string | null = null) => ({
    title,
    timeOfDay,
    dayPosition,
  });

  it("puts a never sorted event right after the appointment before it", () => {
    const rows = [row("A", 0), row("Standup", 1, "09:00"), row("B", 2), row("Arzt", 3, "15:00")];
    expect(titles(withAnchors(rows, [row("Termin", null, "11:00")]))).toEqual([
      "A", "Standup", "Termin", "B", "Arzt",
    ]);
    expect(titles(withAnchors([row("A", 0)], [row("Termin", null, "11:00")]))).toEqual(["Termin", "A"]);
  });

  it("keeps a sorted event at its place, but on the clock", () => {
    const rows = [row("A", 0), row("B", 2), row("C", 3)];
    expect(titles(withAnchors(rows, [row("Termin", 1, "11:00")]))).toEqual(["A", "Termin", "B", "C"]);
    expect(titles(withAnchors(rows, [row("Termin", 9, "11:00")]))).toEqual(["A", "B", "C", "Termin"]);
    // Stored before an earlier appointment, it still waits for it.
    const timed = [row("Standup", 1, "09:00"), row("B", 2)];
    expect(titles(withAnchors(timed, [row("Termin", 0, "11:00")]))).toEqual(["Standup", "Termin", "B"]);
  });
});
