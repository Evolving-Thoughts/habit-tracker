import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "./date";
import { buildTodoInput } from "./todo-input";

const base = { title: "Task", scheduledAt: "", duration: "", isFixed: false };

describe("Berlin wall-clock input", () => {
  it.each([
    ["2026-10-02T10:00", "2026-10-02T08:00:00.000Z"],
    ["2026-01-15T10:00", "2026-01-15T09:00:00.000Z"],
    // Ambiguous fall-back hour resolves to standard time.
    ["2026-10-25T02:30", "2026-10-25T01:30:00.000Z"],
  ])("reads %s as Berlin time", (input, iso) => {
    expect(fromLocalInput(input)).toBe(iso);
    expect(toLocalInput(iso)).toBe(input);
  });
  it.each(["", "2026-02-30T10:00", "02.10.2026 10:00"])(
    "rejects %s",
    (input) => expect(fromLocalInput(input)).toBeNull(),
  );
});

describe("buildTodoInput", () => {
  it("trims and converts all fields", () =>
    expect(
      buildTodoInput({
        title: "  Task ",
        scheduledAt: "2026-10-02T10:00",
        duration: "15",
        isFixed: true,
      }),
    ).toEqual({
      title: "Task",
      scheduledAt: "2026-10-02T08:00:00.000Z",
      plannedDurationMinutes: 15,
      isFixed: true,
    }));
  it("keeps an untouched instant exactly", () =>
    expect(
      buildTodoInput(
        { ...base, scheduledAt: "2026-10-02T10:00" },
        { localInput: "2026-10-02T10:00", iso: "2026-10-02T08:00:12.000Z" },
      ).scheduledAt,
    ).toBe("2026-10-02T08:00:12.000Z"));
  it.each([
    [{ ...base, title: " " }, "Bitte gib einen Titel ein."],
    [{ ...base, title: "x".repeat(201) }, "höchstens 200 Zeichen"],
    [{ ...base, scheduledAt: "kaputt" }, "gültigen Zeitpunkt"],
    [{ ...base, isFixed: true }, "fester Termin"],
    [{ ...base, duration: "1.5" }, "ganze Zahl"],
    [{ ...base, duration: 0 }, "ganze Zahl"],
  ])("rejects invalid input %#", (values, message) =>
    expect(() => buildTodoInput(values)).toThrow(message),
  );
});
