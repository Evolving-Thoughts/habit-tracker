import { describe, expect, it } from "vitest";
import { formatStopwatch } from "./stopwatch";

describe("formatStopwatch", () => {
  it("counts whole seconds that have passed", () => {
    expect(formatStopwatch(0)).toBe("00:00");
    expect(formatStopwatch(999)).toBe("00:00");
    expect(formatStopwatch(1000)).toBe("00:01");
    expect(formatStopwatch(725_400)).toBe("12:05");
  });
  it("adds hours only once there are any", () => {
    expect(formatStopwatch(3_599_999)).toBe("59:59");
    expect(formatStopwatch(3_725_000)).toBe("1:02:05");
    expect(formatStopwatch(36_000_000)).toBe("10:00:00");
  });
  it("never shows a negative time", () => {
    expect(formatStopwatch(-5000)).toBe("00:00");
  });
});
