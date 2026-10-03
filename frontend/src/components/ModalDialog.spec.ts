import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import ModalDialog from "./ModalDialog.vue";

enableAutoUnmount(afterEach);
afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
});
describe("ModalDialog", () => {
  it("opens modally, focuses the form and restores focus without scrolling", async () => {
    const button = document.createElement("button");
    document.body.append(button);
    button.focus();
    const scroll = vi.spyOn(window, "scrollTo");
    vi.spyOn(window, "scrollY", "get").mockReturnValue(620);
    document.body.style.paddingRight = "8px";
    const wrapper = mount(ModalDialog, {
      attachTo: document.body,
      props: { title: "Bearbeiten" },
      slots: { default: '<input name="title" />' },
    });
    await flushPromises();
    expect(wrapper.get("dialog").attributes("open")).toBeDefined();
    expect(document.activeElement).toBe(wrapper.get("input").element);
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-620px");
    wrapper.unmount();
    expect(document.body.style.position).toBe("");
    expect(document.body.style.paddingRight).toBe("8px");
    expect(scroll).toHaveBeenCalledWith({
      left: 0,
      top: 620,
      behavior: "instant",
    });
    expect(document.activeElement).toBe(button);
  });
  it("focuses an asynchronously loaded form without stealing subsequent focus", async () => {
    const loaded = ref(false);
    const Host = defineComponent({
      components: { ModalDialog },
      setup: () => ({ loaded }),
      template:
        '<ModalDialog title="Bearbeiten"><input v-if="loaded" name="title" /><button id="other">Other</button></ModalDialog>',
    });
    const wrapper = mount(Host, { attachTo: document.body });
    await flushPromises();
    expect(document.activeElement?.tagName).toBe("DIALOG");
    loaded.value = true;
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get("input").element);
    (wrapper.get("#other").element as HTMLElement).focus();
    await wrapper.get("input").setValue("Changed");
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get("#other").element);
  });
  it("waits for the disabled fieldset to become enabled before focusing", async () => {
    const wrapper = mount(ModalDialog, {
      attachTo: document.body,
      props: { title: "Bearbeiten", busy: true },
      slots: { default: '<input name="title" />' },
    });
    await flushPromises();
    expect(document.activeElement?.tagName).toBe("DIALOG");
    await wrapper.setProps({ busy: false });
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get("input").element);
  });
  it("blocks Escape, close and duplicate submissions while busy", async () => {
    const submit = vi.fn();
    const wrapper = mount(ModalDialog, {
      props: { title: "Bearbeiten", busy: true },
      slots: {
        default: defineComponent({
          setup: () => ({ submit }),
          template:
            '<form @submit.prevent="submit"><button>Save</button></form>',
        }),
      },
    });
    await wrapper.get("dialog").trigger("cancel");
    await wrapper.get(".modal-dialog__close").trigger("click");
    await wrapper.get("form").trigger("submit");
    expect(wrapper.emitted("close")).toBeUndefined();
    expect(submit).not.toHaveBeenCalled();
    await wrapper.setProps({ busy: false });
    await wrapper.get("dialog").trigger("cancel");
    expect(wrapper.emitted("close")).toHaveLength(1);
  });
  it("restores focus to a freshly resolved replacement button", async () => {
    const original = document.createElement("button");
    document.body.append(original);
    original.focus();
    const replacement = document.createElement("button");
    const wrapper = mount(ModalDialog, {
      attachTo: document.body,
      props: { title: "Bearbeiten", returnFocus: () => replacement },
    });
    await flushPromises();
    original.remove();
    document.body.append(replacement);
    wrapper.unmount();
    expect(document.activeElement).toBe(replacement);
  });
});
