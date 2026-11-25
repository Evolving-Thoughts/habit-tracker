import { describe, expect, it } from "vitest";
import type { FocusBlockState } from "../types/focus-block";
import {
  blockApplies,
  blockStatusLine,
  focusSetupIssues,
  remainingMinutes,
} from "./focus-block";

const NOW = Date.parse("2026-11-23T10:00:00.000Z");
const inMinutes = (minutes: number) =>
  new Date(NOW + minutes * 60_000).toISOString();

describe("blockApplies", () => {
  const on = { enabled: true, trigger: "threshold", thresholdMinutes: 15 } as const;

  it("blocks whenever the stopwatch runs with the stopwatch trigger", () => {
    const running = { ...on, trigger: "stopwatch" } as const;
    expect(blockApplies(running, "default", null)).toBe(true);
    expect(blockApplies(running, undefined, 5)).toBe(true);
    expect(blockApplies(running, "never", 60)).toBe(false);
    expect(blockApplies({ ...running, enabled: false }, "default", 60)).toBe(
      false,
    );
  });

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
    expect(blockStatusLine({ mode: "hardcore", endsAt: null }, NOW)).toBe(
      "Sperre aktiv · Hardcore",
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

describe("focusSetupIssues", () => {
  const base = (
    listMode: "blocklist" | "allowlist",
    kinds: ("app" | "domain")[],
  ): Pick<FocusBlockState, "settings" | "block" | "lists"> => ({
    settings: {
      enabled: true,
      trigger: "stopwatch",
      thresholdMinutes: 15,
      mode: "soft",
      listMode,
    },
    block: null,
    lists: {
      block: kinds.map((kind, id) => ({
        id,
        kind,
        value: kind === "app" ? "com.example" : "example.com",
        label: null,
      })),
      allow: [],
    },
  });
  const off = { accessibilityEnabled: false, vpnPrepared: false };
  const on = { accessibilityEnabled: true, vpnPrepared: true };

  it("names an empty Sperrliste on every device", () => {
    expect(focusSetupIssues(base("blocklist", []), null)).toEqual(["empty"]);
    expect(focusSetupIssues(base("allowlist", []), null)).toEqual([]);
  });

  it("asks only for the permission the lists need, once the phone's stand is known", () => {
    expect(focusSetupIssues(base("blocklist", ["app"]), off)).toEqual([
      "accessibility",
    ]);
    expect(focusSetupIssues(base("blocklist", ["domain"]), off)).toEqual([
      "vpn",
    ]);
    expect(focusSetupIssues(base("allowlist", []), off)).toEqual([
      "accessibility",
      "vpn",
    ]);
    expect(focusSetupIssues(base("blocklist", ["app", "domain"]), on)).toEqual(
      [],
    );
    expect(focusSetupIssues(base("blocklist", ["app"]), null)).toEqual([]);
    expect(focusSetupIssues(null, off)).toEqual([]);
  });
});
