import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { changeHabitSchedule, updateHabit } from "./day-planner.api";
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("habit API contracts", () => {
  it("patches only habit metadata", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 10 }), { status: 200 }),
    );
    await updateHabit(10, { title: "Joggen", isActive: false });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/habits\/10$/);
    expect(init?.method).toBe("PATCH");
    expect(JSON.parse(String(init?.body))).toEqual({
      title: "Joggen",
      isActive: false,
    });
  });
  it("posts a typed schedule change with an effective date", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 10 }), { status: 200 }),
    );
    const input = {
      effectiveFrom: "2026-10-10",
      schedule: { type: "weekly_target" as const, weeklyTarget: 3 },
    };
    await changeHabitSchedule(10, input);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/habits\/10\/schedule-changes$/);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });
  it("can leave the effective date to the backend's today default", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
    await changeHabitSchedule(10, {
      schedule: { type: "weekly_target", weeklyTarget: 2 },
    });
    expect(
      JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)),
    ).not.toHaveProperty("effectiveFrom");
  });
  it.each([
    [409, { message: "Schedule conflict" }, "Schedule conflict"],
    [
      400,
      { message: ["Invalid date", "Invalid schedule"] },
      "Invalid date · Invalid schedule",
    ],
  ])(
    "surfaces actionable %s backend messages",
    async (status, body, message) => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(body), { status }),
      );
      await expect(updateHabit(10, { title: "Joggen" })).rejects.toThrow(
        message,
      );
    },
  );
  it("falls back to the status for a non-JSON error", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Bad gateway", { status: 502 }),
    );
    await expect(updateHabit(10, { title: "Joggen" })).rejects.toThrow(
      "Request failed with status 502",
    );
  });
});
