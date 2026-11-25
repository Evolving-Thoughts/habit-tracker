import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiBaseUrl, CLIENT_ID } from "../api/http";
import { listenDataChanged } from "./data-sync";
import { LIVE_DEBOUNCE_MS, startLiveSync } from "./live-sync";

/** A stand-in for the browser's EventSource that the test drives. */
class FakeSource {
  static all: FakeSource[] = [];
  readonly listeners = new Map<string, ((event: MessageEvent) => void)[]>();
  closed = false;
  readonly url: string;
  readonly init?: EventSourceInit;
  constructor(url: string, init?: EventSourceInit) {
    this.url = url;
    this.init = init;
    FakeSource.all.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, data?: unknown) {
    const event = new MessageEvent(type, {
      data: data === undefined ? undefined : JSON.stringify(data),
    });
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  close() {
    this.closed = true;
  }
}

let visibility: DocumentVisibilityState = "visible";
const setVisibility = (state: DocumentVisibilityState) => {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
};

describe("startLiveSync", () => {
  let reloads: number;
  let stopListening: () => void;
  let stop: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    FakeSource.all = [];
    vi.stubGlobal("EventSource", FakeSource);
    vi.spyOn(document, "visibilityState", "get").mockImplementation(
      () => visibility,
    );
    visibility = "visible";
    reloads = 0;
    stopListening = listenDataChanged(() => (reloads += 1));
    stop = startLiveSync();
  });
  afterEach(() => {
    stop();
    stopListening();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const source = () => FakeSource.all.at(-1)!;

  it("listens with the session and reloads once for a burst of changes", () => {
    expect(source().url).toBe(`${apiBaseUrl}/live`);
    expect(source().init).toEqual({ withCredentials: true });
    source().emit("changed", { origin: "other-app" });
    source().emit("changed", { origin: null });
    expect(reloads).toBe(0);
    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    expect(reloads).toBe(1);
  });

  it("skips a change this app made itself", () => {
    source().emit("changed", { origin: CLIENT_ID });
    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    expect(reloads).toBe(0);
  });

  it("closes while hidden and catches up when shown again", () => {
    const first = source();
    first.emit("open");
    setVisibility("hidden");
    expect(first.closed).toBe(true);
    setVisibility("visible");
    const second = source();
    expect(second).not.toBe(first);
    second.emit("open");
    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    expect(reloads).toBe(1);
  });

  it("catches up after the line broke and came back", () => {
    source().emit("open");
    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    expect(reloads).toBe(0);
    source().emit("error");
    source().emit("open");
    vi.advanceTimersByTime(LIVE_DEBOUNCE_MS);
    expect(reloads).toBe(1);
  });

  it("stops listening when stopped", () => {
    stop();
    expect(source().closed).toBe(true);
    setVisibility("hidden");
    setVisibility("visible");
    expect(FakeSource.all).toHaveLength(1);
  });
});
