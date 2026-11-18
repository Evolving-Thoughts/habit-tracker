import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";
import ThemeSetting from "./ThemeSetting.vue";
import {
  reloadThemeChoice,
  setThemeChoice,
  startTheme,
} from "../composables/useTheme";

enableAutoUnmount(afterEach);

// A light device.
window.matchMedia = ((query: string) => ({
  matches: !query.includes("prefers-color-scheme: dark"),
  addEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

beforeEach(() => {
  localStorage.clear();
  reloadThemeChoice();
  startTheme();
});

function mountSetting() {
  return mount(ThemeSetting, { attachTo: document.body });
}

describe("ThemeSetting", () => {
  it("is a radio group of three looks, the device's own chosen", () => {
    const wrapper = mountSetting();
    const group = wrapper.get('[role="radiogroup"]');
    expect(group.attributes("aria-labelledby")).toBe("settings-theme");
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]');
    expect(radios.map((radio) => radio.element.parentElement!.textContent!.trim())).toEqual([
      "Wie das Gerät",
      "Hell",
      "Dunkel",
    ]);
    // One name: arrow keys move between them, as with any radios.
    expect(new Set(radios.map((radio) => radio.attributes("name")))).toEqual(
      new Set(["theme"]),
    );
    expect(radios.map((radio) => radio.element.checked)).toEqual([
      true,
      false,
      false,
    ]);
    expect(wrapper.text()).toContain("Gerade hell, wie dein Gerät.");
  });

  it("switches the theme and stores it on this device", async () => {
    const wrapper = mountSetting();
    await wrapper.findAll('input[type="radio"]')[2]!.setValue(true);
    await nextTick();
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(wrapper.text()).not.toContain("wie dein Gerät");

    await wrapper.findAll('input[type="radio"]')[0]!.setValue(true);
    await nextTick();
    expect(localStorage.getItem("theme")).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("shows a choice made elsewhere, e.g. in the command menu", async () => {
    const wrapper = mountSetting();
    setThemeChoice("light");
    await nextTick();
    const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]');
    expect(radios.map((radio) => radio.element.checked)).toEqual([
      false,
      true,
      false,
    ]);
  });
});
