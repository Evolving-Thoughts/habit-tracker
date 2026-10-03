// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { bindIfEnabled, readPreference, writePreference } from "./preferences";
beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
describe("Device opt-in metadata", () => {
  it("automatic binding never enables an opted-out device", async () => {
    expect(await bindIfEnabled("new-id")).toBe(false);
    await writePreference({ enabled: false, subscriptionId: "cleanup-id" });
    expect(await bindIfEnabled("new-id")).toBe(false);
    expect(await readPreference()).toEqual({
      enabled: false,
      subscriptionId: "cleanup-id",
    });
  });
  it("automatically binds an enabled device without changing its opt-in state", async () => {
    await writePreference({ enabled: true, subscriptionId: "old-id" });
    expect(await bindIfEnabled("new-id")).toBe(true);
    expect(await readPreference()).toEqual({
      enabled: true,
      subscriptionId: "new-id",
    });
  });
  it("starts disabled with no browser prompt or user content", async () => {
    expect(await readPreference()).toEqual({
      enabled: false,
      subscriptionId: null,
    });
  });
  it("persists only enabled state and the opaque binding id", async () => {
    await writePreference({ enabled: true, subscriptionId: "opaque-test-id" });
    expect(await readPreference()).toEqual({
      enabled: true,
      subscriptionId: "opaque-test-id",
    });
  });
  it("preserves explicit opt-out and an id for deferred server cleanup", async () => {
    await writePreference({
      enabled: false,
      subscriptionId: "pending-cleanup",
    });
    expect((await readPreference()).enabled).toBe(false);
    await writePreference({ enabled: false, subscriptionId: null });
    expect(await readPreference()).toEqual({
      enabled: false,
      subscriptionId: null,
    });
  });
});
