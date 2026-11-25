import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import type { Sound } from "../types/sound";
import SoundChoices from "./SoundChoices.vue";

const sound = (id: string, kind: Sound["kind"], title: string): Sound => ({
  id,
  title,
  kind,
  version: "1",
});

const mountChoices = () =>
  mount(SoundChoices, {
    attachTo: document.body,
    props: {
      label: "Klang",
      music: [sound("lofi-warm", "music", "Lo-Fi warm")],
      ambience: [sound("rain", "ambience", "Regen")],
      modelValue: null,
    },
  });

const line = (wrapper: ReturnType<typeof mountChoices>, text: string) =>
  wrapper
    .findAll(".sound-choices__option")
    .find((option) => option.text() === text)!;

describe("SoundChoices", () => {
  it("chooses a sound when its words are tapped, not only its circle", async () => {
    const wrapper = mountChoices();
    await line(wrapper, "Regen").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([["rain"]]);
    expect(document.activeElement).toBe(
      line(wrapper, "Regen").get("input").element,
    );
    wrapper.unmount();
  });

  it("chooses Aus from its words too", async () => {
    const wrapper = mountChoices();
    await wrapper.setProps({ modelValue: "rain" });
    await line(wrapper, "Aus").trigger("click");
    expect(wrapper.emitted("update:modelValue")).toEqual([[null]]);
    wrapper.unmount();
  });

  it("chooses once when the circle itself is tapped", async () => {
    const wrapper = mountChoices();
    await line(wrapper, "Lo-Fi warm").get("input").setValue(true);
    expect(wrapper.emitted("update:modelValue")).toEqual([["lofi-warm"]]);
    wrapper.unmount();
  });
});
