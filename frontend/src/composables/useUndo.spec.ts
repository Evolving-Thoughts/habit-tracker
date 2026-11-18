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

  it("runs a held step once when the offer runs out", () => {
    const { api } = setup();
    const commit = vi.fn();
    api.offer("a", "Abschnitt gelöscht", commit);
    vi.advanceTimersByTime(4999);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it("never runs a held step that was taken back", () => {
    const { api, wrapper } = setup();
    const commit = vi.fn();
    api.offer("a", "A", commit);
    expect(api.take()).toBe("a");
    vi.advanceTimersByTime(5000);
    wrapper.unmount();
    expect(commit).not.toHaveBeenCalled();
  });

  it("runs a held step when a new offer replaces it, on flush and on unmount", () => {
    const { api, wrapper } = setup();
    const first = vi.fn();
    const second = vi.fn();
    const third = vi.fn();
    api.offer("a", "A", first);
    api.offer("b", "B", second);
    expect(first).toHaveBeenCalledTimes(1);
    api.flush();
    expect(second).toHaveBeenCalledTimes(1);
    expect(api.undo.value).toBeNull();
    api.offer("c", "C", third);
    wrapper.unmount();
    expect(third).toHaveBeenCalledTimes(1);
  });
});
