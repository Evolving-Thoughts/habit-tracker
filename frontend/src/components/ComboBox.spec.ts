import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import ComboBox, { type ComboOption } from "./ComboBox.vue";

enableAutoUnmount(afterEach);

const OPTIONS: ComboOption[] = [
  { value: "none", label: "Keine" },
  { value: "4", label: "Buch", mark: "var(--color-mark-berry)", icon: "book" },
  { value: "5", label: "Kapitel 2", lead: "Buch ›" },
];

describe("ComboBox", () => {
  it("is a combobox that names its listbox and shows the choice in words", () => {
    const wrapper = mount(ComboBox, {
      props: { id: "box", options: OPTIONS, modelValue: "5" },
    });
    const input = wrapper.get<HTMLInputElement>('[role="combobox"]');
    expect(input.element.value).toBe("Buch › Kapitel 2");
    expect(input.attributes("aria-expanded")).toBe("false");
    const list = wrapper.get('[role="listbox"]');
    expect(input.attributes("aria-controls")).toBe(list.attributes("id"));
  });

  it("filters while typing and picks the active option with Enter", async () => {
    const wrapper = mount(ComboBox, {
      props: { id: "box", options: OPTIONS, modelValue: "none" },
    });
    const input = wrapper.get('[role="combobox"]');
    await input.setValue("kap");
    expect(input.attributes("aria-expanded")).toBe("true");
    const options = wrapper.findAll('[role="option"]');
    expect(options.map((option) => option.text())).toEqual(["Buch › Kapitel 2"]);
    expect(input.attributes("aria-activedescendant")).toBe(
      options[0]!.attributes("id"),
    );
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("update:modelValue")).toEqual([["5"]]);
    expect(input.attributes("aria-expanded")).toBe("false");
  });

  it("walks the list with the arrows and closes on Escape without choosing", async () => {
    const wrapper = mount(ComboBox, {
      props: { id: "box", options: OPTIONS, modelValue: "none" },
    });
    const input = wrapper.get('[role="combobox"]');
    await input.trigger("keydown", { key: "ArrowDown" });
    await input.trigger("keydown", { key: "ArrowDown" });
    const active = wrapper.get(".combo__option--active");
    expect(active.text()).toBe("Buch");
    await input.trigger("keydown", { key: "Escape" });
    expect(input.attributes("aria-expanded")).toBe("false");
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("offers to create what was typed when no option has that name", async () => {
    const wrapper = mount(ComboBox, {
      props: {
        id: "box",
        options: OPTIONS,
        modelValue: "none",
        createLabel: (text: string) => `Neue Kampagne „${text}“ anlegen`,
      },
    });
    const input = wrapper.get('[role="combobox"]');
    await input.setValue("buch");
    expect(wrapper.text()).not.toContain("anlegen");
    await input.setValue("Garten");
    expect(wrapper.get(".combo__option--create").text()).toBe(
      "Neue Kampagne „Garten“ anlegen",
    );
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("create")).toEqual([["Garten"]]);
    expect(wrapper.emitted("update:modelValue")).toBeUndefined();
  });

  it("keeps a chosen campaign's badge beside its name, never instead of it", () => {
    const wrapper = mount(ComboBox, {
      props: { id: "box", options: OPTIONS, modelValue: "4" },
    });
    expect(wrapper.get(".combo > .combo__mark").attributes("style")).toContain(
      "--color-mark-berry",
    );
    expect(wrapper.get<HTMLInputElement>("input").element.value).toBe("Buch");
  });
});
