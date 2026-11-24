import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSoundLoop, type LoopElement } from "./sound-loop";

/** An audio element whose playhead the test moves by hand. */
class FakeAudio implements LoopElement {
  src = "";
  volume = 1;
  currentTime = 0;
  duration = 30;
  preload = "";
  paused = true;
  plays = 0;
  error: unknown = null;
  refuse: Error | null = null;
  private listeners = new Map<string, (() => void)[]>();
  play(): Promise<void> {
    this.plays++;
    if (this.refuse) return Promise.reject(this.refuse);
    this.paused = false;
    return Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
  addEventListener(type: string, listener: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string): void {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }
}

function setup(options: Parameters<typeof createSoundLoop>[0] = {}) {
  const elements: FakeAudio[] = [];
  const onError = vi.fn();
  const loop = createSoundLoop({
    createElement: () => {
      const element = new FakeAudio();
      elements.push(element);
      return element;
    },
    onError,
    ...options,
  });
  const [a, b] = elements as [FakeAudio, FakeAudio];
  return { loop, a, b, onError };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("the cross-fading loop", () => {
  it("plays on one element and takes volume changes live", () => {
    const { loop, a, b } = setup();
    loop.play("/api/sounds/rain?v=1", 0.6);
    expect(a.src).toBe("/api/sounds/rain?v=1");
    expect(b.src).toBe("/api/sounds/rain?v=1");
    expect(a.paused).toBe(false);
    expect(b.paused).toBe(true);
    expect(a.volume).toBe(0.6);
    expect(loop.playing).toBe(true);

    loop.setVolume(0.2);
    expect(a.volume).toBe(0.2);
    // The same sound again restarts nothing.
    loop.play("/api/sounds/rain?v=1", 0.4);
    expect(a.plays).toBe(1);
    expect(a.volume).toBe(0.4);
    loop.setVolume(3);
    expect(a.volume).toBe(1);
  });

  it("starts the other element two seconds before the end and fades across", () => {
    const { loop, a, b } = setup();
    loop.play("rain", 0.8);
    a.currentTime = 20;
    vi.advanceTimersByTime(500);
    expect(b.paused).toBe(true);

    a.currentTime = 28;
    vi.advanceTimersByTime(100);
    expect(b.paused).toBe(false);
    expect(b.currentTime).toBe(0);
    expect(b.volume).toBe(0);

    vi.advanceTimersByTime(1000);
    expect(a.volume).toBeCloseTo(0.4);
    expect(b.volume).toBeCloseTo(0.4);

    vi.advanceTimersByTime(1000);
    expect(a.paused).toBe(true);
    expect(a.currentTime).toBe(0);
    expect(b.volume).toBeCloseTo(0.8);

    // And back again at the end of the other one.
    b.currentTime = 28.5;
    vi.advanceTimersByTime(100);
    expect(a.paused).toBe(false);
    vi.advanceTimersByTime(1600);
    expect(b.paused).toBe(true);
    expect(a.volume).toBeCloseTo(0.8);
  });

  it("turns a very short file over at its middle", () => {
    const { loop, a, b } = setup();
    loop.play("chirp", 1);
    a.duration = 1;
    a.currentTime = 0.4;
    vi.advanceTimersByTime(100);
    expect(b.paused).toBe(true);
    a.currentTime = 0.5;
    vi.advanceTimersByTime(100);
    expect(b.paused).toBe(false);
  });

  it("starts over when a file ends without a turn (no duration known)", () => {
    const { loop, a } = setup();
    loop.play("stream", 1);
    a.duration = Number.NaN;
    a.currentTime = 12;
    vi.advanceTimersByTime(1000);
    a.emit("ended");
    expect(a.currentTime).toBe(0);
    expect(a.plays).toBe(2);
  });

  it("fades out briefly on stop, then pauses, and carries on where it stopped", () => {
    const { loop, a, b } = setup();
    loop.play("rain", 0.6);
    a.currentTime = 7;
    loop.stop();
    expect(loop.playing).toBe(false);
    vi.advanceTimersByTime(200);
    expect(a.volume).toBeLessThan(0.6);
    expect(a.volume).toBeGreaterThan(0);
    expect(a.paused).toBe(false);
    vi.advanceTimersByTime(400);
    expect(a.paused).toBe(true);
    expect(b.paused).toBe(true);

    loop.play("rain", 0.6);
    expect(a.currentTime).toBe(7);
    expect(a.paused).toBe(false);
    expect(a.volume).toBe(0.6);
  });

  it("switches to another sound from its start", () => {
    const { loop, a, b } = setup();
    loop.play("rain", 0.6);
    a.currentTime = 9;
    loop.play("cafe", 0.6);
    expect(a.src).toBe("cafe");
    expect(b.src).toBe("cafe");
    expect(a.currentTime).toBe(0);
    expect(a.paused).toBe(false);
  });

  it("reports a file that cannot load and falls silent", () => {
    const { loop, a, onError } = setup();
    loop.play("missing", 0.6);
    a.error = { code: 4 };
    a.emit("error");
    expect(onError).toHaveBeenCalledWith({ code: 4 });
    expect(loop.playing).toBe(false);
    expect(a.paused).toBe(true);
  });

  it("tolerates a refused play() but reports a broken one", async () => {
    const refused = setup();
    refused.a.refuse = Object.assign(new Error("no gesture"), {
      name: "NotAllowedError",
    });
    refused.loop.play("rain", 0.6);
    await Promise.resolve();
    expect(refused.onError).not.toHaveBeenCalled();
    expect(refused.loop.playing).toBe(true);

    const broken = setup();
    broken.a.refuse = Object.assign(new Error("no source"), {
      name: "NotSupportedError",
    });
    broken.loop.play("rain", 0.6);
    await Promise.resolve();
    expect(broken.onError).toHaveBeenCalled();
    expect(broken.loop.playing).toBe(false);
  });
});
