import { describe, expect, it } from "vitest";
import { anchoredOrder } from "./day-order";

const entry = (title: string, timeOfDay: string | null = null) => ({
  title,
  timeOfDay,
});
const titles = (items: { title: string }[]) => items.map(({ title }) => title);

describe("anchoredOrder", () => {
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
