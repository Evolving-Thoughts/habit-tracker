import { ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWrites } from "./useWrites";

function harness() {
  const steps: string[] = [];
  const errorMessage = ref<string | null>("alt");
  const reload = vi.fn(async () => {
    steps.push("reload");
  });
  const onChange = () => steps.push("notify");
  window.addEventListener("timer-data-changed", onChange);
  const stop = () => window.removeEventListener("timer-data-changed", onChange);
  return { steps, errorMessage, reload, stop, ...useWrites(reload, errorMessage) };
}

describe("useWrites", () => {
  let cleanup = () => {};
  afterEach(() => cleanup());

  it("writes, announces and reloads in that order", async () => {
    const { steps, errorMessage, write, stop } = harness();
    cleanup = stop;
    const done = await write(
      async () => {
        steps.push("write");
      },
      { fallbackError: "kaputt" },
    );
    expect(done).toBe(true);
    expect(steps).toEqual(["write", "notify", "reload"]);
    expect(errorMessage.value).toBeNull();
  });

  it("reports a failure without reloading", async () => {
    const { errorMessage, reload, write, busy, stop } = harness();
    cleanup = stop;
    const done = await write(() => Promise.reject("nope"), {
      fallbackError: "kaputt",
    });
    expect(done).toBe(false);
    expect(errorMessage.value).toBe("kaputt");
    expect(reload).not.toHaveBeenCalled();
    expect(busy.value).toBe(false);
  });

  it("runs the same key once and other keys side by side", async () => {
    const { write, isWriting, busy, stop } = harness();
    cleanup = stop;
    let finish!: () => void;
    const held = new Promise<void>((resolve) => (finish = resolve));
    const first = write(() => held, { fallbackError: "x", key: "a" });
    expect(isWriting("a")).toBe(true);
    expect(busy.value).toBe(true);
    expect(await write(vi.fn(), { fallbackError: "x", key: "a" })).toBe(false);
    expect(
      await write(() => Promise.resolve(), { fallbackError: "x", key: "b" }),
    ).toBe(true);
    finish();
    expect(await first).toBe(true);
    expect(busy.value).toBe(false);
  });

  it("leaves the announcement out when the action made it", async () => {
    const { steps, write, stop } = harness();
    cleanup = stop;
    await write(() => Promise.resolve(), { fallbackError: "x", notify: null });
    expect(steps).toEqual(["reload"]);
  });

  it("reads another source beside the reload when asked", async () => {
    const { steps, write, stop } = harness();
    cleanup = stop;
    await write(() => Promise.resolve(), {
      fallbackError: "x",
      alongside: async () => {
        steps.push("alongside");
      },
    });
    expect(steps).toEqual(["notify", "reload", "alongside"]);
  });

  it("shows a write at once and keeps it when it went through", async () => {
    const { steps, writeShown, stop } = harness();
    cleanup = stop;
    const takeBack = vi.fn();
    const done = await writeShown(
      () => {
        steps.push("show");
        return takeBack;
      },
      async () => {
        steps.push("write");
      },
      { fallbackError: "x" },
    );
    expect(done).toBe(true);
    expect(steps).toEqual(["show", "write", "notify", "reload"]);
    expect(takeBack).not.toHaveBeenCalled();
  });

  it("takes a shown write back and reloads quietly when it failed", async () => {
    const { reload, errorMessage, writeShown, stop } = harness();
    cleanup = stop;
    const takeBack = vi.fn();
    const done = await writeShown(
      () => takeBack,
      () => Promise.reject(new Error("weg")),
      { fallbackError: "x" },
    );
    expect(done).toBe(false);
    expect(takeBack).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledWith(false);
    expect(errorMessage.value).toBe("weg");
  });

  it("takes back a single-step write without a reload when asked", async () => {
    const { reload, writeShown, stop } = harness();
    cleanup = stop;
    const takeBack = vi.fn();
    await writeShown(
      () => takeBack,
      () => Promise.reject(new Error("weg")),
      {
        fallbackError: "x",
        reloadOnFailure: false,
      },
    );
    expect(takeBack).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
  });
});
