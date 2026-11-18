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
  it("disables a future Daily", () => {
    const c = createTimerController();
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
    expect(w.get("button").attributes("aria-label")).toBe(
      "Timer für Daily: keine offene fällige Ausführung",
    );
    c.dispose();
  });
  it("shows its own running stopwatch and pauses or resumes it instead of starting again", async () => {
    const c = createTimerController();
    const start = vi.spyOn(c, "start").mockResolvedValue();
    const action = vi.spyOn(c, "action").mockResolvedValue(true as never);
    c.timer.value = {
      id: "a",
      kind: "occurrence",
      targetId: 1,
      title: "Daily",
      state: "running",
      elapsedMilliseconds: 1,
      targetMinutes: 5,
      targetReachedAt: null,
    };
    const w = mount(ItemPlayButton, {
      props: {
        kind: "occurrence",
        targetId: 1,
        title: "Daily",
        eligible: true,
      },
      global: { provide: { [timerKey as symbol]: c } },
    });
    const button = w.get("button");
    expect(button.attributes("aria-label")).toBe(
      "Stoppuhr für Daily läuft, pausieren",
    );
    expect(button.classes()).toContain("timer-icon--active");
    await button.trigger("click");
    expect(action).toHaveBeenCalledWith("pause");

    c.timer.value = { ...c.timer.value, state: "paused" };
    await w.vm.$nextTick();
    expect(button.attributes("aria-label")).toBe(
      "Stoppuhr für Daily fortsetzen",
    );
    await button.trigger("click");
    expect(action).toHaveBeenLastCalledWith("resume");
    expect(start).not.toHaveBeenCalled();
    c.dispose();
  });
});
