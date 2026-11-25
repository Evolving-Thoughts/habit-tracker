import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, KeepAlive, type Ref } from "vue";
import { useDayClock } from "./useDayClock";

enableAutoUnmount(afterEach);

describe("useDayClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 08:00 in Berlin.
    vi.setSystemTime(new Date("2026-10-02T06:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("wakes at the minute asked for", async () => {
    let now!: Ref<number>;
    mount(
      defineComponent({
        setup() {
          now = useDayClock((minutes) => minutes + 1);
          return () => h("p");
        },
      }),
    );
    expect(now.value).toBe(8 * 60);
    await vi.advanceTimersByTimeAsync(60_100);
    expect(now.value).toBe(8 * 60 + 1);
  });

  it("rests while its kept-alive view is hidden and catches up when shown", async () => {
    let now!: Ref<number>;
    const Kept = defineComponent({
      name: "Kept",
      setup() {
        now = useDayClock((minutes) => minutes + 1);
        return () => h("main");
      },
    });
    const Host = defineComponent({
      props: { shown: { type: Boolean, default: true } },
      setup(props) {
        return () =>
          h(KeepAlive, { include: ["Kept"] }, [
            props.shown ? h(Kept) : h("main", "Anderswo"),
          ]);
      },
    });
    const wrapper = mount(Host);
    await flushPromises();
    expect(vi.getTimerCount()).toBe(1);

    await wrapper.setProps({ shown: false });
    await flushPromises();
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(now.value).toBe(8 * 60);

    await wrapper.setProps({ shown: true });
    await flushPromises();
    expect(now.value).toBe(8 * 60 + 3);
    expect(vi.getTimerCount()).toBe(1);
  });
});
