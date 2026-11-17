import { describe, expect, it } from "vitest";
import { buildTodoInput } from "./todo-input";

const base = { title: "Task", date: "", time: "", duration: "" };

describe("buildTodoInput", () => {
  it("trims and converts all fields of an appointment", () =>
    expect(
      buildTodoInput({
        title: "  Task ",
        date: "2026-10-02",
        time: "10:00",
        duration: "15",
      }),
    ).toEqual({
      title: "Task",
      scheduledDate: "2026-10-02",
      timeOfDay: "10:00",
      plannedDurationMinutes: 15,
    }));
  it("plans a quest for a day without a time", () =>
    expect(buildTodoInput({ ...base, date: "2026-10-02" })).toMatchObject({
      scheduledDate: "2026-10-02",
      timeOfDay: null,
    }));
  it("leaves a quest without a day in the Questlog", () =>
    expect(buildTodoInput(base)).toEqual({
      title: "Task",
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
    }));
  it("drops the seconds some browsers add to a time", () =>
    expect(
      buildTodoInput({ ...base, date: "2026-10-02", time: "10:00:00" })
        .timeOfDay,
    ).toBe("10:00"));
  it.each([
    [{ ...base, title: " " }, "Bitte gib einen Titel ein."],
    [{ ...base, title: "x".repeat(201) }, "höchstens 200 Zeichen"],
    [{ ...base, date: "02.10.2026" }, "gültigen Tag"],
    [{ ...base, date: "2026-10-02", time: "25:00" }, "gültige Uhrzeit"],
    [{ ...base, time: "10:00" }, "braucht einen Tag"],
    [{ ...base, duration: "1.5" }, "ganze Zahl"],
    [{ ...base, duration: 0 }, "ganze Zahl"],
  ])("rejects invalid input %#", (values, message) =>
    expect(() => buildTodoInput(values)).toThrow(message),
  );
});
