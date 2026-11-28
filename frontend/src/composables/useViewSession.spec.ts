import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref, type Ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { notifyDataChanged, notifyViewsChanged } from "./data-sync";
import { useParentSession, useViewSession } from "./useViewSession";

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

  describe("a component inside the view", () => {
    /* A view with one resource and a child that writes, holds or reads. */
    function nested(child: () => void, shown = ref(true)) {
      const load = vi.fn(() => Promise.resolve("a"));
      const Child = defineComponent({
        setup() {
          child();
          return () => h("i");
        },
      });
      mount(
        defineComponent({
          setup() {
            useViewSession().resource(load, {
              initial: "",
              fallbackError: "x",
            });
            return () => h("div", shown.value ? [h(Child)] : []);
          },
        }),
      );
      return load;
    }

    it("reloads the view once per write, reporting into its own error", async () => {
      const error = ref<string | null>(null);
      let writes!: ReturnType<
        ReturnType<typeof useParentSession>["childWrites"]
      >;
      const load = nested(() => {
        writes = useParentSession().childWrites(error);
      });
      await flushPromises();
      expect(load).toHaveBeenCalledTimes(1);
      expect(
        await writes.write(() => Promise.resolve(), {
          fallbackError: "x",
          notify: notifyViewsChanged,
        }),
      ).toBe(true);
      await flushPromises();
      expect(load).toHaveBeenCalledTimes(2);
      await writes.write(() => Promise.reject("nope"), {
        fallbackError: "kaputt",
      });
      expect(error.value).toBe("kaputt");
    });

    it("holds the view's refresh while asked and while gone loads once", async () => {
      const held = ref(true);
      const shown = ref(true);
      const load = nested(
        () => useParentSession().holdWhile(() => held.value),
        shown,
      );
      await flushPromises();
      notifyDataChanged();
      notifyDataChanged();
      await flushPromises();
      expect(load).toHaveBeenCalledTimes(1);
      held.value = false;
      await flushPromises();
      expect(load).toHaveBeenCalledTimes(2);
      // Leaving the page ends a hold as well.
      held.value = true;
      notifyDataChanged();
      await flushPromises();
      shown.value = false;
      await flushPromises();
      expect(load).toHaveBeenCalledTimes(3);
    });

    it("drops a child's resource from the view's reload when it leaves", async () => {
      const shown = ref(true);
      const childLoad = vi.fn(() => Promise.resolve("c"));
      let session!: ReturnType<typeof useParentSession>;
      nested(() => {
        session = useParentSession();
        session.resource(childLoad, { initial: "", fallbackError: "x" });
      }, shown);
      await flushPromises();
      expect(childLoad).toHaveBeenCalledTimes(1);
      shown.value = false;
      await flushPromises();
      await session.write(() => Promise.resolve(), { fallbackError: "x" });
      expect(childLoad).toHaveBeenCalledTimes(1);
    });

    it("throws outside a view", () => {
      const Lone = defineComponent({
        setup() {
          useParentSession();
          return () => h("i");
        },
      });
      expect(() => mount(Lone)).toThrow(/no view session/);
    });
  });
});
