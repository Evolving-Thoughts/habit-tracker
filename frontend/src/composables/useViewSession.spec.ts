import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref, type Ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { notifyDataChanged } from "./data-sync";
import { useViewSession } from "./useViewSession";

function harness(holding = ref(false), writeError?: Ref<string | null>) {
  const loadA = vi.fn(() => Promise.resolve("a"));
  const loadB = vi.fn(() => Promise.resolve("b"));
  let session!: ReturnType<typeof useViewSession>;
  let a!: { errorMessage: Ref<string | null> };
  mount(
    defineComponent({
      setup() {
        session = useViewSession({ holding: () => holding.value, writeError });
        a = session.resource(loadA, { initial: "", fallbackError: "A kaputt" });
        session.resource(loadB, { initial: "", fallbackError: "B kaputt" });
        return () => h("p");
      },
    }),
  );
  return { loadA, loadB, session: () => session, errorA: () => a.errorMessage };
}

describe("useViewSession", () => {
  it("reloads every resource exactly once after a write", async () => {
    const { loadA, loadB, session } = harness();
    await flushPromises();
    expect([loadA.mock.calls.length, loadB.mock.calls.length]).toEqual([1, 1]);
    let finish!: () => void;
    const writing = session().write(
      () => new Promise<void>((resolve) => (finish = resolve)),
      { fallbackError: "x" },
    );
    // A change from elsewhere during the write loads nothing of its own.
    notifyDataChanged();
    await flushPromises();
    expect([loadA.mock.calls.length, loadB.mock.calls.length]).toEqual([1, 1]);
    finish();
    expect(await writing).toBe(true);
    await flushPromises();
    expect([loadA.mock.calls.length, loadB.mock.calls.length]).toEqual([2, 2]);
  });

  it("refreshes every resource on a change while free", async () => {
    const { loadA, loadB } = harness();
    await flushPromises();
    notifyDataChanged();
    await flushPromises();
    expect([loadA.mock.calls.length, loadB.mock.calls.length]).toEqual([2, 2]);
  });

  it("keeps a change heard while holding and loads it once the hold ends", async () => {
    const holding = ref(false);
    const { loadA, loadB } = harness(holding);
    await flushPromises();
    holding.value = true;
    notifyDataChanged();
    notifyDataChanged();
    await flushPromises();
    expect([loadA.mock.calls.length, loadB.mock.calls.length]).toEqual([1, 1]);
    holding.value = false;
    await flushPromises();
    expect([loadA.mock.calls.length, loadB.mock.calls.length]).toEqual([2, 2]);
    // Nothing missed since: holding again and letting go loads nothing.
    holding.value = true;
    holding.value = false;
    await flushPromises();
    expect([loadA.mock.calls.length, loadB.mock.calls.length]).toEqual([2, 2]);
  });

  it("reports a failed write in the first resource's error", async () => {
    const { session, errorA } = harness();
    await flushPromises();
    await session().write(() => Promise.reject("nope"), { fallbackError: "x" });
    expect(errorA().value).toBe("x");
  });

  it("reports a failed write in its own error when given one", async () => {
    const writeError = ref<string | null>(null);
    const { session, errorA } = harness(ref(false), writeError);
    await flushPromises();
    await session().write(() => Promise.reject("nope"), { fallbackError: "x" });
    expect(writeError.value).toBe("x");
    expect(errorA().value).toBeNull();
  });
});
