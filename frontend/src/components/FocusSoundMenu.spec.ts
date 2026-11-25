import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { computed, ref } from "vue";
import type { FocusSound } from "../composables/useFocusSound";
import FocusSoundMenu from "./FocusSoundMenu.vue";

function fakeSound(): FocusSound {
  const soundId = ref<string | null>(null);
  return {
    state: computed(() => "off"),
    sound: computed(() => null),
    music: computed(() => [
      { id: "lofi-warm", title: "Lo-Fi warm", kind: "music", version: "1" },
    ]),
    ambience: computed(() => [
      { id: "rain", title: "Regen", kind: "ambience", version: "1" },
    ]),
    note: computed(() => null),
    loadFailed: computed(() => false),
    volume: computed(() => 0.6),
    soundId,
    choose: vi.fn((id: string | null) => (soundId.value = id)),
    toggle: vi.fn(),
    setVolume: vi.fn(),
    gesture: vi.fn(),
  } as unknown as FocusSound;
}

/** The view around it is focusable, like the Fokus-Modus' main element. */
function mountInView(sound: FocusSound) {
  const view = document.createElement("main");
  view.tabIndex = -1;
  document.body.append(view);
  const wrapper = mount(FocusSoundMenu, {
    props: { sound },
    attachTo: view,
  });
  return { wrapper, view };
}

describe("FocusSoundMenu", () => {
  it("stays open when a tap on a line's words drops the focus to the view around it", async () => {
    const sound = fakeSound();
    const { wrapper, view } = mountInView(sound);
    await wrapper.get(".focus-sound__trigger").trigger("click");
    const input = wrapper.get(".focus-sound__panel input:checked");
    await input.trigger("focusout", { relatedTarget: view });
    expect(wrapper.find(".focus-sound__panel").exists()).toBe(true);

    const line = wrapper
      .findAll(".sound-choices__option")
      .find((option) => option.text() === "Regen")!;
    await line.trigger("click");
    expect(sound.choose).toHaveBeenCalledWith("rain");
    wrapper.unmount();
    view.remove();
  });

  it("closes when the focus really leaves for something beside it", async () => {
    const { wrapper, view } = mountInView(fakeSound());
    const outside = document.createElement("button");
    document.body.append(outside);
    await wrapper.get(".focus-sound__trigger").trigger("click");
    await wrapper
      .get(".focus-sound__panel input:checked")
      .trigger("focusout", { relatedTarget: outside });
    expect(wrapper.find(".focus-sound__panel").exists()).toBe(false);
    wrapper.unmount();
    view.remove();
    outside.remove();
  });
});
