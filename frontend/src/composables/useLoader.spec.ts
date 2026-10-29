import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { notifyDataChanged } from "./data-sync";
import { useLoader } from "./useLoader";

function harness(load: () => Promise<string>, busy = ref(false)) {
  let api!: ReturnType<typeof useLoader<string>>;
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useLoader(load, {
          initial: "",
          fallbackError: "kaputt",
          refreshOnChange: () => !busy.value,
        });
        return () => h("p", api.data.value);
      },
    }),
  );
  return { wrapper, api: () => api };
}

describe("useLoader", () => {
  it("loads on mount and exposes the result", async () => {
    const { wrapper, api } = harness(() => Promise.resolve("A"));
    expect(api().isLoading.value).toBe(true);
    await flushPromises();
    expect(wrapper.text()).toBe("A");
    expect(api().hasLoaded.value).toBe(true);
    expect(api().isLoading.value).toBe(false);
  });

  it("ignores an older response that settles after a newer one", async () => {
    let finishOld!: (value: string) => void;
    const load = vi
      .fn<() => Promise<string>>()
      .mockReturnValueOnce(new Promise((resolve) => (finishOld = resolve)))
      .mockResolvedValueOnce("neu");
    const { wrapper, api } = harness(load);
    await api().reload(false);
    finishOld("alt");
    await flushPromises();
    expect(wrapper.text()).toBe("neu");
  });

  it("reports errors with a fallback message", async () => {
    const { api } = harness(() => Promise.reject("nope"));
    await flushPromises();
    expect(api().errorMessage.value).toBe("kaputt");
  });

  it("refreshes after data changes unless the view is busy", async () => {
    const busy = ref(false);
    const load = vi.fn(() => Promise.resolve("x"));
    harness(load, busy);
    await flushPromises();
    notifyDataChanged();
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
    busy.value = true;
    notifyDataChanged();
    await flushPromises();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
