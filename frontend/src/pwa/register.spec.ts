import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker } from "./register";
describe("PWA registration", () => {
  const register = vi.fn().mockResolvedValue({});
  const original = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");
  const secure = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  beforeEach(() => {
    register.mockClear();
    vi.stubEnv("PROD", true);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { register },
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (original) Object.defineProperty(navigator, "serviceWorker", original);
    else Reflect.deleteProperty(navigator, "serviceWorker");
    if (secure) Object.defineProperty(window, "isSecureContext", secure);
    else Reflect.deleteProperty(window, "isSecureContext");
  });
  it("registers the network-only worker at the root without HTTP cache", async () => {
    await registerServiceWorker();
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });
  it("does not register in development", async () => {
    vi.stubEnv("PROD", false);
    await registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });
  it("does not register on an insecure origin", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    await registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });
  it("works when service workers are unsupported", async () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    await registerServiceWorker();
    expect(register).not.toHaveBeenCalled();
  });
  it("does not prevent app use after a registration failure", async () => {
    register.mockRejectedValueOnce(new Error("unsupported"));
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(registerServiceWorker()).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledOnce();
  });
});
