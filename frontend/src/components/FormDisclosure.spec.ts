import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import FormDisclosure from "./FormDisclosure.vue";

enableAutoUnmount(afterEach);

function mountDisclosure(props: Record<string, unknown> = {}) {
  return mount(FormDisclosure, {
    props: { label: "Kategorie", ...props },
    slots: {
      default:
        '<label>Kategorie<select name="category" disabled></select></label><label>Notiz<input name="note" /></label>',
    },
    attachTo: document.body,
  });
}

describe("FormDisclosure", () => {
  it("ties the button to its panel and reflects the state in aria-expanded", async () => {
    const wrapper = mountDisclosure();
    const toggle = wrapper.get("button");
    const panel = wrapper.get(`#${toggle.attributes("aria-controls")}`);
    expect(toggle.attributes("aria-expanded")).toBe("false");
    expect(panel.isVisible()).toBe(false);
    expect(panel.attributes("role")).toBe("group");
    expect(panel.attributes("aria-labelledby")).toBe(toggle.attributes("id"));
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(panel.isVisible()).toBe(true);
  });

  it("moves the focus to the first field it can take, and keeps it on the button when closing", async () => {
    const wrapper = mountDisclosure();
    const toggle = wrapper.get("button");
    await toggle.trigger("click");
    expect(document.activeElement).toBe(wrapper.get('[name="note"]').element);
    (toggle.element as HTMLButtonElement).focus();
    await toggle.trigger("click");
    expect(document.activeElement).toBe(toggle.element);
  });

  it("names what is set while closed and can start open", () => {
    const closed = mountDisclosure({ summary: "Sport", detail: "optional" });
    expect(closed.get("button").text()).toBe("Kategorie (optional) Sport");
    const open = mountDisclosure({ summary: "Sport", startOpen: true });
    expect(open.get("button").attributes("aria-expanded")).toBe("true");
    // Open, the field itself shows the value.
    expect(open.get("button").text()).toBe("Kategorie");
  });
});
