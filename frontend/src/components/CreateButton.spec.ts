import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import CreateButton from "./CreateButton.vue";
import css from "../style.css?raw";
import buttonSource from "./CreateButton.vue?raw";
import todaySource from "../views/TodayView.vue?raw";
import { ruleBody } from "../utils/contrast";
describe("CreateButton", () => {
  it("uses a symmetric vector plus and an accessible button label", () => {
    const wrapper = mount(CreateButton, {
      props: { label: "Daily erstellen" },
    });
    expect(wrapper.get("button").attributes("aria-label")).toBe(
      "Daily erstellen",
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
  it("leaves room below the last row: the button's own size and offset, and air", () => {
    // A row scrolled to the end stays clear of the button, ▶ and … included.
    expect(css).toContain(
      "--fab-clearance: calc(var(--fab-size) + var(--fab-offset) + var(--space-5));",
    );
    expect(buttonSource).toContain("width: var(--fab-size);");
    expect(buttonSource).toContain("var(--tab-bar-height) + var(--fab-offset)");
    expect(ruleBody(css, ".page")).toContain(
      "padding: var(--space-5) 0 var(--fab-clearance);",
    );
    const todayStyle = todaySource.split("<style scoped>")[1]!;
    expect(ruleBody(todayStyle, ".today-view")).toContain(
      "padding: var(--space-5) 0 var(--fab-clearance);",
    );
  });
});
