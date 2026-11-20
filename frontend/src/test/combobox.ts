import {
  flushPromises,
  type DOMWrapper,
  type VueWrapper,
} from "@vue/test-utils";

/**
 * Picks an option of a ComboBox the way a keyboard does: type part of its
 * name, then Enter on the first match (or on "… anlegen" when nothing
 * matches the typed words).
 */
export async function choose(
  wrapper: VueWrapper | DOMWrapper<Element>,
  selector: string,
  text: string,
): Promise<void> {
  const field = wrapper.get(selector);
  await field.trigger("focus");
  await field.setValue(text);
  await field.trigger("keydown", { key: "Enter" });
  await flushPromises();
}
