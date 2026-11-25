import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { createWebHashHistory, type Router } from "vue-router";
import { createAppRouter } from "../router";
import { backStep, runBackStep, useBackButton } from "./useBackButton";
import { pushOverlay } from "./useOverlayStack";

enableAutoUnmount(afterEach);

async function routerAt(path: string): Promise<Router> {
  window.history.replaceState(null, "", `/#${path}`);
  const router = createAppRouter(createWebHashHistory());
  await router.push(path);
  await router.isReady();
  return router;
}

/** Waits for router.back(), which goes through popstate. */
async function settle(router: Router, name: string): Promise<void> {
  for (let i = 0; i < 50 && router.currentRoute.value.name !== name; i++)
    await new Promise((resolve) => setTimeout(resolve, 5));
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("backStep", () => {
  it("leaves the app on Heute with nothing open and nowhere to go back", async () => {
    const router = await routerAt("/heute");
    expect(router.currentRoute.value.name).toBe("today");
    expect(backStep(router)).toBe("leave");
    expect(runBackStep(router, "leave")).toBe(false);
  });

  it("closes what is open first", async () => {
    const router = await routerAt("/heute");
    const close = vi.fn();
    const remove = pushOverlay(close);
    expect(backStep(router)).toBe("overlay");
    expect(runBackStep(router, "overlay")).toBe(true);
    expect(close).toHaveBeenCalledOnce();
    remove();
  });

  it("goes back one view after a navigation", async () => {
    const router = await routerAt("/heute");
    await router.push({ name: "calendar" });
    expect(backStep(router)).toBe("history");
    runBackStep(router, "history");
    await settle(router, "today");
    expect(router.currentRoute.value.name).toBe("today");
    expect(backStep(router)).toBe("leave");
  });

  it("goes to Heute from a view the app opened on", async () => {
    const router = await routerAt("/einstellungen");
    expect(router.currentRoute.value.name).toBe("settings");
    expect(backStep(router)).toBe("today");
    runBackStep(router, "today");
    await flushPromises();
    expect(router.currentRoute.value.name).toBe("today");
    expect(backStep(router)).toBe("leave");
  });
});

describe("useBackButton", () => {
  function androidWithPlugin() {
    let onBack: ((data: unknown) => void) | null = null;
    const nativePromise = vi.fn(() => Promise.resolve());
    vi.stubGlobal("Capacitor", {
      getPlatform: () => "android",
      PluginHeaders: [{ name: "BackButton" }],
      nativePromise,
      nativeCallback: (
        _plugin: string,
        _method: string,
        _options: object,
        callback: (data: unknown) => void,
      ) => {
        onBack = callback;
        return "cb-1";
      },
    });
    return { press: (id: number) => onBack?.({ id }), nativePromise };
  }

  function host(router: Router) {
    return defineComponent({
      setup() {
        useBackButton(router);
        return () => h("div");
      },
    });
  }

  it("answers handled when it closes an overlay, and stays", async () => {
    const native = androidWithPlugin();
    const router = await routerAt("/heute");
    mount(host(router));
    const close = vi.fn();
    const remove = pushOverlay(close);
    native.press(4);
    expect(native.nativePromise).toHaveBeenCalledWith("BackButton", "answer", {
      id: 4,
      handled: true,
    });
    expect(close).toHaveBeenCalledOnce();
    remove();
  });

  it("answers not handled on Heute, so Android leaves the app", async () => {
    const native = androidWithPlugin();
    const router = await routerAt("/heute");
    mount(host(router));
    native.press(5);
    expect(native.nativePromise).toHaveBeenCalledWith("BackButton", "answer", {
      id: 5,
      handled: false,
    });
  });

  it("stops listening when the app goes away", async () => {
    const native = androidWithPlugin();
    const router = await routerAt("/heute");
    mount(host(router)).unmount();
    expect(native.nativePromise).toHaveBeenCalledWith(
      "BackButton",
      "removeListener",
      { eventName: "back", callbackId: "cb-1" },
    );
  });

  it("does nothing in a browser", async () => {
    const router = await routerAt("/heute");
    expect(() => mount(host(router))).not.toThrow();
  });
});
