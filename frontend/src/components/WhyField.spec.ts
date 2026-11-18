import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent, nextTick, ref } from "vue";
import WhyField from "./WhyField.vue";

enableAutoUnmount(afterEach);

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
    { attachTo: document.body },
  );
  const writeOwn = () => wrapper.get('[data-test="why-write-own"]');
  const takeOver = () => wrapper.get('[data-test="why-take-over"]');
  return { wrapper, own, source, writeOwn, takeOver };
}

describe("WhyField", () => {
  it("quotes the inherited reason instead of offering it as text to edit", () => {
    const { wrapper, own, writeOwn } = mountField();
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(wrapper.get(".why-field__from").text()).toBe(
      "Übernommen von „Fit“:",
    );
    expect(wrapper.get("blockquote p").text()).toBe("Gesund bleiben");
    expect(writeOwn().text()).toBe("Eigenes Warum schreiben");
    expect(own.value).toBe("");
    expect(wrapper.get('[role="group"]').attributes("aria-labelledby")).toBe(
      "why-label",
    );
  });

  it("opens an empty own field with the focus in it, and keeps the quote as context", async () => {
    const { wrapper, own, writeOwn } = mountField();
    await writeOwn().trigger("click");
    const area = wrapper.get<HTMLTextAreaElement>("textarea");
    expect(area.element.value).toBe("");
    expect(document.activeElement).toBe(area.element);
    expect(wrapper.get(`label[for="why"]`).text()).toBe("Eigenes Warum");
    expect(wrapper.get("blockquote").text()).toContain(
      "Ersetzt das Warum von „Fit“",
    );
    expect(area.attributes("aria-describedby")).toBe("why-inherited why-hint");
    // Nothing typed yet: still inheriting.
    expect(own.value).toBe("");
    await area.setValue("  Marathon laufen ");
    expect(own.value).toBe("Marathon laufen");
  });

  it("keeps inheriting when the own text is left empty or repeats the inherited one", async () => {
    const { wrapper, own, writeOwn } = mountField();
    await writeOwn().trigger("click");
    const area = wrapper.get("textarea");
    await area.setValue("Gesund bleiben");
    expect(own.value).toBe("");
    await area.setValue("");
    expect(own.value).toBe("");
  });

  it("takes the inherited reason over again and returns the focus", async () => {
    const { wrapper, own, takeOver } = mountField("Eigenes");
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe(
      "Eigenes",
    );
    await takeOver().trigger("click");
    expect(own.value).toBe("");
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(document.activeElement).toBe(
      wrapper.get('[data-test="why-write-own"]').element,
    );
  });

  it("follows a reset form and a reason that loads later", async () => {
    const { own, source, wrapper, writeOwn } = mountField("Eigenes", null);
    expect(wrapper.find("blockquote").exists()).toBe(false);
    own.value = "";
    await nextTick();
    expect(wrapper.get<HTMLTextAreaElement>("textarea").element.value).toBe("");
    source.value = inherited;
    await nextTick();
    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(writeOwn().text()).toBe("Eigenes Warum schreiben");
    // A form reset while writing shows the quote again.
    await writeOwn().trigger("click");
    await wrapper.get("textarea").setValue("Neu");
    own.value = "";
    await nextTick();
    expect(wrapper.find("textarea").exists()).toBe(false);
  });

  it("is a plain optional field when there is nothing to inherit", async () => {
    const { wrapper, own } = mountField("", null);
    const area = wrapper.get("textarea");
    expect(area.attributes("aria-describedby")).toBeUndefined();
    await area.setValue("  Kopf frei ");
    expect(own.value).toBe("Kopf frei");
    expect(wrapper.get("label").text()).toBe("Warum · optional");
  });
});
