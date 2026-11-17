import { mount } from "@vue/test-utils";
import { describe, it, expect, vi } from "vitest";
import ItemPlayButton from "./ItemPlayButton.vue";
import { createTimerController, timerKey } from "../composables/useTimer";
describe("Item timer play", () => {
  it("uses a round SVG button and starts the stopwatch at once, with or without a planned duration", async () => {
    const c = createTimerController();
    const start = vi.spyOn(c, "start").mockResolvedValue();
    const w = mount(ItemPlayButton, {
      props: { kind: "todo", targetId: 1, title: "Quest", eligible: true },
      global: { provide: { [timerKey as symbol]: c } },
    });
    await w.get("button").trigger("click");
    expect(start).toHaveBeenCalledWith({
      kind: "todo",
      targetId: 1,
      title: "Quest",
    });
    expect(w.get("svg").attributes("aria-hidden")).toBe("true");
    expect(w.get("button").attributes("aria-label")).toBe(
      "Timer für Quest starten",
    );
    c.dispose();
  });
  it("disables a future Daily and prevents duplicate starts of own active timer", async () => {
    const c = createTimerController();
    c.timer.value = {
      id: "a",
      kind: "occurrence",
      targetId: 1,
      title: "Daily",
      state: "paused",
      elapsedMilliseconds: 1,
      targetMinutes: 5,
      targetReachedAt: null,
    };
    const w = mount(ItemPlayButton, {
      props: {
        kind: "occurrence",
        targetId: null,
        title: "Daily",
        eligible: false,
      },
      global: { provide: { [timerKey as symbol]: c } },
    });
    expect(w.get("button").attributes("disabled")).toBeDefined();
    await w.setProps({ targetId: 1, eligible: true });
    expect(w.get("button").attributes("disabled")).toBeDefined();
    expect(w.get("button").attributes("aria-label")).toContain("bereits aktiv");
    c.dispose();
  });
});
