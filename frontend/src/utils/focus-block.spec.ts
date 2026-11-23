import { describe, expect, it } from "vitest";
import {
  blockApplies,
  blockStatusLine,
  remainingMinutes,
} from "./focus-block";

const NOW = Date.parse("2026-11-23T10:00:00.000Z");
const inMinutes = (minutes: number) =>
  new Date(NOW + minutes * 60_000).toISOString();

describe("blockApplies", () => {
  const on = { enabled: true, thresholdMinutes: 15 };

  it("follows Einstellungen from the threshold on, never without a Soll", () => {
    expect(blockApplies(on, "default", 15)).toBe(true);
    expect(blockApplies(on, undefined, 30)).toBe(true);
    expect(blockApplies(on, "default", 10)).toBe(false);
    expect(blockApplies(on, "default", null)).toBe(false);
    expect(blockApplies({ ...on, enabled: false }, "default", 30)).toBe(false);
  });

  it("lets Immer and Nie decide", () => {
    expect(blockApplies({ ...on, enabled: false }, "always", null)).toBe(true);
    expect(blockApplies(on, "never", 60)).toBe(false);
  });
});

describe("block status", () => {
  it("counts whole minutes up to the end", () => {
    expect(remainingMinutes(inMinutes(12), NOW)).toBe(12);
    expect(remainingMinutes(inMinutes(11.2), NOW)).toBe(12);
    expect(remainingMinutes(inMinutes(-1), NOW)).toBe(0);
  });

  it("reads Soft and Hardcore in one line", () => {
    expect(blockStatusLine({ mode: "soft", endsAt: null }, NOW)).toBe(
      "Sperre aktiv · Soft",
    );
    expect(
      blockStatusLine({ mode: "hardcore", endsAt: inMinutes(12) }, NOW),
    ).toBe("Sperre aktiv · Hardcore · noch 12 Min.");
    expect(
      blockStatusLine({ mode: "hardcore", endsAt: inMinutes(75) }, NOW),
    ).toBe("Sperre aktiv · Hardcore · noch 1 Std. 15 Min.");
    expect(
      blockStatusLine({ mode: "hardcore", endsAt: inMinutes(0) }, NOW),
    ).toBe("Sperre aktiv · Hardcore · noch unter 1 Min.");
  });
});
