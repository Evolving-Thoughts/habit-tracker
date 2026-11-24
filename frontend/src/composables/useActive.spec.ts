import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, KeepAlive, type PropType } from "vue";
import { onShownAgain, whileActive } from "./useActive";
import { notifyDataChanged, onDataChanged } from "./data-sync";
import { runShortcut, useShortcutHandlers } from "./useShortcuts";

enableAutoUnmount(afterEach);

const Other = defineComponent({
  name: "OtherView",
  render: () => h("main", "Anderswo"),
});

/** A view kept alive behind another one, as App.vue keeps Heute. */
function host(View: ReturnType<typeof defineComponent>) {
  return defineComponent({
    props: { shown: { type: Boolean as PropType<boolean>, default: true } },
    setup(props) {
      return () =>
        h(KeepAlive, { include: ["Kept"] }, [props.shown ? h(View) : h(Other)]);
    },
  });
}

function kept(setup: () => void) {
  return defineComponent({
    name: "Kept",
    setup() {
      setup();
      return () => h("main", "Heute");
    },
  });
}

describe("whileActive", () => {
  it("starts on mount, rests while hidden, starts again when shown and stops once on unmount", async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const wrapper = mount(host(kept(() => whileActive(start, stop))));
    await flushPromises();
    expect([start.mock.calls.length, stop.mock.calls.length]).toEqual([1, 0]);

    await wrapper.setProps({ shown: false });
    await flushPromises();
    expect([start.mock.calls.length, stop.mock.calls.length]).toEqual([1, 1]);

    await wrapper.setProps({ shown: true });
    await flushPromises();
    expect([start.mock.calls.length, stop.mock.calls.length]).toEqual([2, 1]);

    wrapper.unmount();
    await flushPromises();
    expect([start.mock.calls.length, stop.mock.calls.length]).toEqual([2, 2]);
  });

  it("runs from mount to unmount in a component that is not kept alive", async () => {
    const start = vi.fn();
    const stop = vi.fn();
    const wrapper = mount(kept(() => whileActive(start, stop)));
    expect(start).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("starts before the first render with immediate", () => {
    const order: string[] = [];
    mount(
      defineComponent({
        setup() {
          whileActive(
            () => order.push("start"),
            () => undefined,
            { immediate: true },
          );
          return () => {
            order.push("render");
            return h("p");
          };
        },
      }),
    );
    expect(order).toEqual(["start", "render"]);
  });
});

describe("onShownAgain", () => {
  it("runs each time a kept view comes back, never when it first appears", async () => {
    const shown = vi.fn();
    const wrapper = mount(host(kept(() => onShownAgain(shown))));
    await flushPromises();
    expect(shown).not.toHaveBeenCalled();
    for (const expected of [1, 2]) {
      await wrapper.setProps({ shown: false });
      await flushPromises();
      await wrapper.setProps({ shown: true });
      await flushPromises();
      expect(shown).toHaveBeenCalledTimes(expected);
    }
  });
});

describe("a kept view while hidden", () => {
  it("hears no data changes and handles no keys", async () => {
    const changed = vi.fn();
    const key = vi.fn();
    const wrapper = mount(
      host(
        kept(() => {
          onDataChanged(changed);
          useShortcutHandlers({ "quest.new": key });
        }),
      ),
    );
    await flushPromises();
    await wrapper.setProps({ shown: false });
    await flushPromises();
    notifyDataChanged();
    expect(runShortcut("quest.new")).toBe(false);
    expect(changed).not.toHaveBeenCalled();
    expect(key).not.toHaveBeenCalled();

    await wrapper.setProps({ shown: true });
    await flushPromises();
    notifyDataChanged();
    expect(runShortcut("quest.new")).toBe(true);
    expect(changed).toHaveBeenCalledTimes(1);
    expect(key).toHaveBeenCalledTimes(1);
  });
});
