import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { holdScroll, releaseScroll } from "./scroll-hold";

/* jsdom lays nothing out; a stand-in observer lets the test grow the page. */
let grow: (() => void) | null = null;
class FakeResizeObserver {
  private readonly callback: () => void;
  constructor(callback: () => void) {
    this.callback = callback;
  }
  observe(): void {
    grow = this.callback;
  }
  disconnect(): void {
    grow = null;
  }
}

describe("holdScroll", () => {
  let scrollTo: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 5000,
    });
    // The page has drifted down, as scroll anchoring does.
    vi.spyOn(window, "scrollY", "get").mockReturnValue(60);
  });
  afterEach(() => {
    releaseScroll();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("turns scroll anchoring off and puts the page back when it grows", () => {
    holdScroll(() => 0);
    expect(document.documentElement.dataset.scrollHold).toBe("");
    grow!();
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });
  });

  it("reads the place again, so a section further down stays in view", () => {
    let top = 300;
    holdScroll(() => top);
    grow!();
    top = 420;
    grow!();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 420, behavior: "instant" });
  });

  it("ends when the person scrolls", () => {
    holdScroll(() => 0);
    window.dispatchEvent(new Event("wheel"));
    expect(document.documentElement.dataset.scrollHold).toBeUndefined();
    expect(grow).toBeNull();
  });

  it("ends with a scrolling key, but not with a letter", () => {
    holdScroll(() => 0);
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k" }));
    expect(grow).not.toBeNull();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "PageDown" }));
    expect(grow).toBeNull();
  });

  it("ends once the page has been still for a moment", () => {
    holdScroll(() => 0);
    vi.advanceTimersByTime(900);
    grow!();
    vi.advanceTimersByTime(900);
    expect(grow).not.toBeNull();
    vi.advanceTimersByTime(100);
    expect(grow).toBeNull();
    expect(document.documentElement.dataset.scrollHold).toBeUndefined();
  });

  it("lets a new navigation take over from the last one", () => {
    holdScroll(() => 100);
    holdScroll(() => 0);
    grow!();
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, behavior: "instant" });
  });
});
