import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import {
  SCROLL_DIRECTION_THRESHOLD_PX,
  SCROLL_DIRECTION_TOP_PX,
  useScrollDirection,
} from "./useScrollDirection";

let y = 0;
vi.spyOn(window, "scrollY", "get").mockImplementation(() => y);

function scrollTo(next: number): void {
  y = next;
  window.dispatchEvent(new Event("scroll"));
}

function mountProbe(start = 400) {
  y = start;
  let direction!: ReturnType<typeof useScrollDirection>;
  const wrapper = mount(
    defineComponent({
      setup() {
        direction = useScrollDirection();
        return () => h("div");
      },
    }),
  );
  return { wrapper, direction: () => direction.value };
}

afterEach(() => {
  document.body.removeAttribute("style");
});

describe("useScrollDirection", () => {
  it("starts as up, turns down when the page scrolls on and up again when it scrolls back", () => {
    const { direction } = mountProbe();
    expect(direction()).toBe("up");
    scrollTo(400 + SCROLL_DIRECTION_THRESHOLD_PX);
    expect(direction()).toBe("down");
    scrollTo(500);
    expect(direction()).toBe("down");
    scrollTo(500 - SCROLL_DIRECTION_THRESHOLD_PX);
    expect(direction()).toBe("up");
  });

  it("ignores jitters below the threshold but adds up a slow scroll", () => {
    const { direction } = mountProbe();
    scrollTo(404);
    expect(direction()).toBe("up");
    scrollTo(408);
    expect(direction()).toBe("up");
    scrollTo(412);
    expect(direction()).toBe("down");
    scrollTo(406);
    expect(direction()).toBe("down");
  });

  it("always reads up near the top of the page", () => {
    const { direction } = mountProbe();
    scrollTo(600);
    expect(direction()).toBe("down");
    scrollTo(SCROLL_DIRECTION_TOP_PX);
    expect(direction()).toBe("up");
  });

  it("ignores the jumps of a dialog's scroll lock", () => {
    const { direction } = mountProbe(800);
    // The lock pins the body and the page reads 0, then the offset returns.
    document.body.style.position = "fixed";
    scrollTo(0);
    expect(direction()).toBe("up");
    document.body.style.position = "";
    scrollTo(800);
    expect(direction()).toBe("up");
    scrollTo(800 + SCROLL_DIRECTION_THRESHOLD_PX);
    expect(direction()).toBe("down");
  });

  it("stops listening once unmounted", () => {
    const { wrapper, direction } = mountProbe();
    wrapper.unmount();
    scrollTo(900);
    expect(direction()).toBe("up");
  });
});
