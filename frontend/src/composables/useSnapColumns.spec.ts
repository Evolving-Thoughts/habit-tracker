import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, ref } from "vue";
import { EDGE_DWELL_MS, EDGE_PX, useSnapColumns } from "./useSnapColumns";

/** A board of three columns; `carried` puts Sortable's floating copy in it. */
function mountBoard(active = true) {
  const scrollTo = vi.fn();
  const Board = defineComponent({
    setup(_, { expose }) {
      const board = ref<HTMLElement | null>(null);
      const snap = useSnapColumns(board, {
        active: ref(active),
        count: () => 3,
      });
      expose(snap);
      return () =>
        h("div", { ref: board }, [h("section"), h("section"), h("section")]);
    },
  });
  const wrapper = mount(Board, { attachTo: document.body });
  wrapper.element.scrollTo = scrollTo as never;
  const carry = () => {
    const copy = document.createElement("div");
    copy.className = "sortable-fallback";
    wrapper.element.append(copy);
  };
  return { wrapper, scrollTo, carry };
}
const move = (clientX: number) =>
  document.dispatchEvent(new MouseEvent("pointermove", { clientX }));

describe("useSnapColumns", () => {
  const RIGHT = () => window.innerWidth - EDGE_PX + 1;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("brings the next column once when a carried card reaches the edge", () => {
    const { wrapper, scrollTo, carry } = mountBoard();
    carry();
    move(RIGHT());
    move(RIGHT() + 2);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect((wrapper.vm as unknown as { current: number }).current).toBe(1);
    wrapper.unmount();
  });

  it("turns again after the card left the edge, or stayed there long enough", () => {
    const { wrapper, scrollTo, carry } = mountBoard();
    carry();
    move(RIGHT());
    move(200);
    move(RIGHT());
    expect(scrollTo).toHaveBeenCalledTimes(2);
    // The last column: nothing further to the right.
    vi.advanceTimersByTime(EDGE_DWELL_MS);
    move(RIGHT());
    expect(scrollTo).toHaveBeenCalledTimes(2);
    // Held at the left edge, it steps back one column per dwell.
    move(EDGE_PX - 1);
    move(EDGE_PX - 2);
    expect(scrollTo).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(EDGE_DWELL_MS);
    move(EDGE_PX - 1);
    expect(scrollTo).toHaveBeenCalledTimes(4);
    wrapper.unmount();
  });

  it("stays put without a carried card, off a phone, and after unmount", () => {
    const idle = mountBoard();
    move(RIGHT());
    expect(idle.scrollTo).not.toHaveBeenCalled();
    idle.wrapper.unmount();

    const wide = mountBoard(false);
    wide.carry();
    move(RIGHT());
    expect(wide.scrollTo).not.toHaveBeenCalled();
    wide.wrapper.unmount();
    move(RIGHT());
    expect(wide.scrollTo).not.toHaveBeenCalled();
  });
});
