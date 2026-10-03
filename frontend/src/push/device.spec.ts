import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../api/http", () => ({ request: vi.fn() }));
vi.mock("./preferences", () => ({
  readPreference: vi.fn(),
  writePreference: vi.fn(),
  bindIfEnabled: vi.fn(),
}));
import { request } from "../api/http";
import { bindIfEnabled, readPreference, writePreference } from "./preferences";
import { disablePush, enablePush, restorePush } from "./device";
const config = { configured: true, publicKey: btoa("public-test-key") };
const unsubscribe = vi.fn().mockResolvedValue(true);
const subscription = {
  options: {},
  unsubscribe,
  toJSON: () => ({
    endpoint: "https://fcm.googleapis.com/wp/test-device",
    keys: { p256dh: "public", auth: "secret-test" },
  }),
};
const subscribe = vi.fn().mockResolvedValue(subscription);
const getSubscription = vi.fn().mockResolvedValue(subscription);
const requestPermission = vi.fn().mockResolvedValue("granted");
const reg = {
  pushManager: { subscribe, getSubscription },
  update: vi.fn().mockResolvedValue(undefined),
  waiting: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("indexedDB", {});
  vi.stubGlobal("PushManager", class {});
  vi.stubGlobal("Notification", { permission: "granted", requestPermission });
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve(reg),
      getRegistration: vi.fn().mockResolvedValue(reg),
    },
  });
  vi.mocked(readPreference).mockResolvedValue({
    enabled: false,
    subscriptionId: null,
  });
  vi.mocked(writePreference).mockResolvedValue();
  vi.mocked(bindIfEnabled).mockResolvedValue(true);
  vi.mocked(request).mockResolvedValue({ id: "device-id" });
  getSubscription.mockResolvedValue(subscription);
  subscribe.mockResolvedValue(subscription);
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serviceWorker");
});
describe("Push opt-in and session rebinding", () => {
  it("never asks for permission or subscribes on the first login", async () => {
    await restorePush(config);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(request).not.toHaveBeenCalled();
  });
  it("explicit activation asks when permission is default", async () => {
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    await enablePush(config, true);
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(writePreference).toHaveBeenCalledWith({
      enabled: true,
      subscriptionId: "device-id",
    });
  });
  it("rebinds opted-in browsers after login without another permission prompt", async () => {
    vi.mocked(readPreference).mockResolvedValue({
      enabled: true,
      subscriptionId: "old-id",
    });
    await restorePush(config);
    expect(requestPermission).not.toHaveBeenCalled();
    expect(request).toHaveBeenCalledWith(
      "/push/subscription",
      expect.objectContaining({ method: "POST" }),
    );
  });
  it("cannot undo an opt-out that happened during automatic login binding", async () => {
    vi.mocked(readPreference).mockResolvedValue({
      enabled: true,
      subscriptionId: "old-id",
    });
    vi.mocked(bindIfEnabled).mockResolvedValue(false);
    await restorePush(config);
    expect(request).toHaveBeenLastCalledWith(
      "/push/subscription",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(writePreference).not.toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });
  it("never silently requests default permission", async () => {
    vi.stubGlobal("Notification", { permission: "default", requestPermission });
    await expect(enablePush(config, false)).rejects.toThrow();
    expect(requestPermission).not.toHaveBeenCalled();
  });
  it("persists disable before touching the network, and does not re-enable on login", async () => {
    vi.mocked(readPreference).mockResolvedValue({
      enabled: false,
      subscriptionId: "device-id",
    });
    await restorePush(config);
    expect(writePreference).toHaveBeenNthCalledWith(1, {
      enabled: false,
      subscriptionId: "device-id",
    });
    expect(request).toHaveBeenCalledWith(
      "/push/subscription",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(subscribe).not.toHaveBeenCalled();
  });
  it("keeps offline opt-out and the binding id to retry cleanup later", async () => {
    vi.mocked(readPreference).mockResolvedValue({
      enabled: true,
      subscriptionId: "device-id",
    });
    vi.mocked(request).mockRejectedValueOnce(new Error("offline"));
    await expect(disablePush()).rejects.toThrow("offline");
    expect(writePreference).toHaveBeenCalledWith({
      enabled: false,
      subscriptionId: "device-id",
    });
  });
  it("cleans up a revoked permission without requesting it again", async () => {
    vi.stubGlobal("Notification", { permission: "denied", requestPermission });
    vi.mocked(readPreference).mockResolvedValue({
      enabled: true,
      subscriptionId: "device-id",
    });
    await restorePush(config);
    expect(unsubscribe).toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });
});
