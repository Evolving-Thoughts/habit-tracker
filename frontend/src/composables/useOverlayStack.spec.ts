import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import ActionMenu from "../components/ActionMenu.vue";
import ModalDialog from "../components/ModalDialog.vue";
import {
  closeTopOverlay,
  hasOpenOverlay,
  pushOverlay,
  useOverlay,
} from "./useOverlayStack";

enableAutoUnmount(afterEach);
afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

function touchScreen(): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query === "(pointer: coarse)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

class FakeWatcher {
  static all: FakeWatcher[] = [];
  onclose: (() => void) | null = null;
  destroyed = false;
  constructor() {
    FakeWatcher.all.push(this);
  }
  destroy(): void {
    this.destroyed = true;
  }
}

describe("overlay stack", () => {
  it("closes only the overlay on top, newest first", () => {
    const first = vi.fn();
    const second = vi.fn();
    const removeFirst = pushOverlay(first);
    const removeSecond = pushOverlay(second);
    expect(closeTopOverlay()).toBe(true);
    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    removeSecond();
    closeTopOverlay();
    expect(first).toHaveBeenCalledOnce();
    removeFirst();
    expect(hasOpenOverlay()).toBe(false);
    expect(closeTopOverlay()).toBe(false);
  });

  it("follows a component's open state and leaves with the component", async () => {
    const open = ref(false);
    const close = vi.fn(() => (open.value = false));
    const wrapper = mount(
      defineComponent({
        setup() {
          useOverlay(open, close);
          return () => h("div");
        },
      }),
    );
    expect(hasOpenOverlay()).toBe(false);
    open.value = true;
    expect(hasOpenOverlay()).toBe(true);
    closeTopOverlay();
    expect(close).toHaveBeenCalledOnce();
    expect(hasOpenOverlay()).toBe(false);
    open.value = true;
    wrapper.unmount();
    expect(hasOpenOverlay()).toBe(false);
  });

  it("gives a browser on a touch screen a CloseWatcher, but not for a dialog", () => {
    touchScreen();
    FakeWatcher.all = [];
    vi.stubGlobal("CloseWatcher", FakeWatcher);
    const close = vi.fn();
    const remove = pushOverlay(close);
    const removeDialog = pushOverlay(vi.fn(), { dialog: true });
    expect(FakeWatcher.all).toHaveLength(1);
    FakeWatcher.all[0].onclose?.();
    expect(close).toHaveBeenCalledOnce();
    remove();
    expect(FakeWatcher.all[0].destroyed).toBe(true);
    removeDialog();
  });

  it("leaves CloseWatcher out in the Android app, where the plugin takes Back", () => {
    touchScreen();
    FakeWatcher.all = [];
    vi.stubGlobal("CloseWatcher", FakeWatcher);
    vi.stubGlobal("Capacitor", { getPlatform: () => "android" });
    const remove = pushOverlay(vi.fn());
    expect(FakeWatcher.all).toHaveLength(0);
    remove();
  });

  it("closes a dialog as its close button does, and not while it is busy", async () => {
    const wrapper = mount(ModalDialog, {
      attachTo: document.body,
      props: { title: "Bearbeiten", busy: true },
    });
    closeTopOverlay();
    expect(wrapper.emitted("close")).toBeUndefined();
    await wrapper.setProps({ busy: false });
    closeTopOverlay();
    expect(wrapper.emitted("close")).toHaveLength(1);
    wrapper.unmount();
    expect(hasOpenOverlay()).toBe(false);
  });

  it("closes an open action menu", async () => {
    const wrapper = mount(ActionMenu, {
      attachTo: document.body,
      props: {
        title: "Lesen",
        entries: [
          { id: "edit", label: "Bearbeiten", icon: "edit", run: vi.fn() },
        ],
      },
    });
    await wrapper.get("button").trigger("click");
    await nextTick();
    expect(document.querySelector(".action-menu")).not.toBeNull();
    expect(closeTopOverlay()).toBe(true);
    await nextTick();
    expect(document.querySelector(".action-menu")).toBeNull();
    expect(hasOpenOverlay()).toBe(false);
  });
});
