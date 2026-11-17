import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, ref } from "vue";
import WhyField from "./WhyField.vue";

const inherited = { text: "Gesund bleiben", fromId: 1, fromTitle: "Fit" };

function mountField(initial = "", from: typeof inherited | null = inherited) {
  const own = ref(initial);
  const source = ref(from);
  const wrapper = mount(
    defineComponent({
      components: { WhyField },
      setup: () => ({ own, source }),
      template: '<WhyField id="why" v-model="own" :inherited="source" />',
    }),
  );
  return { wrapper, own, source, area: wrapper.get("textarea") };
}

describe("WhyField", () => {
  it("starts with the inherited reason without storing a copy", () => {
    const { wrapper, own, area } = mountField();
    expect(area.element.value).toBe("Gesund bleiben");
    expect(own.value).toBe("");
    expect(wrapper.text()).toContain("Übernommen von „Fit“");
  });

  it("turns a changed text into an own reason", async () => {
    const { wrapper, own, area } = mountField();
    await area.setValue("Marathon laufen");
    expect(own.value).toBe("Marathon laufen");
    expect(wrapper.text()).toContain("Eigenes Warum.");
  });

  it("inherits again when the text matches or the field is emptied", async () => {
    const { own, area } = mountField("Marathon laufen");
    await area.setValue("  Gesund bleiben ");
    expect(own.value).toBe("");
    await area.setValue("Anderes");
    await area.setValue("");
    expect(own.value).toBe("");
    // While typing the field may stay empty; leaving it shows what applies.
    expect(area.element.value).toBe("");
    await area.trigger("blur");
    expect(area.element.value).toBe("Gesund bleiben");
  });

  it("offers to take the inherited reason over again", async () => {
    const { wrapper, own, area } = mountField("Eigenes");
    expect(area.element.value).toBe("Eigenes");
    await wrapper.get("button").trigger("click");
    expect(own.value).toBe("");
    expect(area.element.value).toBe("Gesund bleiben");
  });

  it("follows a reset form and a reason that loads later", async () => {
    const { own, source, area, wrapper } = mountField("Eigenes", null);
    expect(wrapper.find("p").exists()).toBe(false);
    own.value = "";
    await wrapper.vm.$nextTick();
    expect(area.element.value).toBe("");
    source.value = inherited;
    await wrapper.vm.$nextTick();
    expect(area.element.value).toBe("Gesund bleiben");
    expect(own.value).toBe("");
  });

  it("is a plain optional field when there is nothing to inherit", async () => {
    const { wrapper, own, area } = mountField("", null);
    expect(area.attributes("aria-describedby")).toBeUndefined();
    await area.setValue("  Kopf frei ");
    expect(own.value).toBe("Kopf frei");
    expect(wrapper.get("label").text()).toBe("Warum · optional");
  });
});
