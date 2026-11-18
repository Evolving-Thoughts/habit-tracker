import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import ShortcutSettings from "./ShortcutSettings.vue";
import {
  reloadShortcutSettings,
  singleKeys,
} from "../composables/useShortcuts";

enableAutoUnmount(afterEach);
beforeEach(() => {
  localStorage.clear();
  reloadShortcutSettings();
});

describe("ShortcutSettings", () => {
  it("is on by default and switches single keys off on this device", async () => {
    const wrapper = mount(ShortcutSettings);
    const toggle = wrapper.get('[role="switch"]');
    expect(toggle.attributes("aria-checked")).toBe("true");
    expect(wrapper.get(`#${toggle.attributes("aria-labelledby")}`).text()).toBe(
      "Tastenkürzel",
    );

    await toggle.trigger("click");
    expect(toggle.attributes("aria-checked")).toBe("false");
    expect(singleKeys.value).toBe(false);
    expect(localStorage.getItem("shortcuts:single-keys")).toBe("off");
    expect(wrapper.get('[role="status"]').text()).toBe(
      "Einzelne Tasten sind ausgeschaltet.",
    );

    await toggle.trigger("click");
    expect(localStorage.getItem("shortcuts:single-keys")).toBeNull();
  });

  it("reads the stored choice", () => {
    localStorage.setItem("shortcuts:single-keys", "off");
    reloadShortcutSettings();
    const wrapper = mount(ShortcutSettings);
    expect(wrapper.get('[role="switch"]').attributes("aria-checked")).toBe(
      "false",
    );
  });

  it("explains that modifier shortcuts stay and lists every shortcut", () => {
    const wrapper = mount(ShortcutSettings);
    expect(wrapper.text()).toContain("Strg+K und Strg+Enter wirken immer.");
    expect(wrapper.findAll("h3")).toHaveLength(4);
    expect(wrapper.text()).toContain("Neue Quest");
  });
});
