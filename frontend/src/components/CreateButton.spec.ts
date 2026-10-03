import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CreateButton from "./CreateButton.vue";
describe("CreateButton", () => {
  it("uses a symmetric vector plus and an accessible button label", () => {
    const wrapper = mount(CreateButton, {
      props: { label: "Habit erstellen" },
    });
    expect(wrapper.get("button").attributes("aria-label")).toBe(
      "Habit erstellen",
    );
    expect(wrapper.get("svg").attributes("viewBox")).toBe("0 0 24 24");
    expect(wrapper.get("svg").attributes("aria-hidden")).toBe("true");
    expect(wrapper.get("path").attributes("d")).toBe("M12 5v14M5 12h14");
  });
  it("emits a click and respects the disabled state", async () => {
    const wrapper = mount(CreateButton, { props: { label: "Erstellen" } });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
    await wrapper.setProps({ disabled: true });
    await wrapper.get("button").trigger("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });
});
