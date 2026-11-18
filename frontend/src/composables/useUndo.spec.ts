import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { useUndo } from "./useUndo";

function setup() {
  let api!: ReturnType<typeof useUndo<string>>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useUndo<string>(5000);
        return () => h("div");
      },
    }),
  );
  return { wrapper, api };
}

describe("useUndo", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("offers the last tick for five seconds", () => {
    const { api } = setup();
    api.offer("a", "„A“ erledigt");
    expect(api.undo.value).toEqual({ target: "a", label: "„A“ erledigt" });
    vi.advanceTimersByTime(4999);
    expect(api.undo.value).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(api.undo.value).toBeNull();
  });

  it("replaces an older offer and hands over what to take back once", () => {
    const { api } = setup();
    api.offer("a", "A");
    api.offer("b", "B");
    expect(api.take()).toBe("b");
    expect(api.take()).toBeNull();
    expect(api.undo.value).toBeNull();
  });
});
