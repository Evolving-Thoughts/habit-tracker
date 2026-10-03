import { mount } from "@vue/test-utils";
import { describe, it, expect, vi } from "vitest";
import ItemPlayButton from "./ItemPlayButton.vue";
import { createTimerController, timerKey } from "../composables/useTimer";
describe("Item timer play", () => {
  it("shows no play without duration", () => {
    const w = mount(ItemPlayButton, {
      props: {
        kind: "todo",
        targetId: 1,
        title: "Todo",
        duration: null,
        eligible: true,
      },
    });
    expect(w.find("button").exists()).toBe(false);
  });
  it("uses a round SVG button and starts immediately with saved duration", async () => {
    const c = createTimerController();
    const start = vi.spyOn(c, "start").mockResolvedValue();
    const w = mount(ItemPlayButton, {
      props: {
        kind: "todo",
        targetId: 1,
        title: "Todo",
        duration: 5,
        eligible: true,
      },
      global: { provide: { [timerKey as symbol]: c } },
    });
    await w.get("button").trigger("click");
    expect(start).toHaveBeenCalledWith({
      kind: "todo",
      targetId: 1,
      title: "Todo",
      durationMinutes: 5,
    });
    expect(w.get("svg").attributes("aria-hidden")).toBe("true");
    expect(w.get("button").attributes("aria-label")).toBe(
      "Timer für Todo starten",
    );
    c.dispose();
  });
  it("disables a future Habit and prevents duplicate starts of own active timer", async () => {
    const c = createTimerController();
    c.timer.value = {
      id: "a",
      kind: "occurrence",
      targetId: 1,
      title: "Habit",
      state: "paused",
      durationMinutes: 5,
      remainingMilliseconds: 1,
      endsAt: null,
      finishedAt: null,
    };
    const w = mount(ItemPlayButton, {
      props: {
        kind: "occurrence",
        targetId: null,
        title: "Habit",
        duration: 5,
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
