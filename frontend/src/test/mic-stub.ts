import type { VueWrapper } from "@vue/test-utils";
import { vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";

/**
 * MicButton for component specs: renders a plain marker, records `start`
 * calls and lets a spec hand in a recognised text (`dictate`). The real
 * button and its engines have their own specs.
 */
export const micStart = vi.fn();

export const MicStub = defineComponent({
  name: "MicButton",
  props: {
    mode: { type: String, default: "short" },
    label: { type: String, default: "Diktieren" },
    placement: { type: String, default: "inline" },
  },
  emits: ["result", "partial", "state"],
  setup(props, { expose }) {
    expose({ start: micStart, stop: vi.fn(), cancel: vi.fn(), available: true });
    return () =>
      h("span", {
        class: "mic",
        "data-mode": props.mode,
        "data-label": props.label,
      });
  },
});

/** Sends `text` as the result of the `index`th microphone in `wrapper`. */
export async function dictate(
  wrapper: VueWrapper,
  text: string,
  index = 0,
): Promise<void> {
  const mic = wrapper.findAllComponents(MicStub)[index];
  if (!mic) throw new Error(`no microphone #${index}`);
  mic.vm.$emit("result", text);
  // The handlers wait a tick before they place the cursor.
  await nextTick();
  await nextTick();
}
