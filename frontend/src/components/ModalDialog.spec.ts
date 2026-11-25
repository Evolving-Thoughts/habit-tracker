import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import ModalDialog from "./ModalDialog.vue";
import { SHEET_CLOSE_DRAG_PX } from "../composables/useMediaQuery";

/** A window as narrow as a phone: dialogs are sheets. */
function phoneWidth(): void {
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        matches: query === "(max-width: 39.99rem)",
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

enableAutoUnmount(afterEach);
afterEach(() => {
  document.body.innerHTML = "";
  document.body.removeAttribute("style");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

  describe("as a sheet on a phone", () => {
    async function drag(
      wrapper: ReturnType<typeof mount>,
      distance: number,
      from = ".modal-dialog__header",
    ) {
      const handle = wrapper.get(from);
      await handle.trigger("pointerdown", { clientY: 100, pointerId: 1 });
      await handle.trigger("pointermove", {
        clientY: 100 + distance,
        pointerId: 1,
      });
      return handle;
    }

    it("has a grabber and closes when dragged down past the threshold", async () => {
      phoneWidth();
      const wrapper = mount(ModalDialog, {
        attachTo: document.body,
        props: { title: "Quest bearbeiten" },
      });
      await flushPromises();
      expect(wrapper.find(".modal-dialog__grabber").exists()).toBe(true);
      const handle = await drag(wrapper, SHEET_CLOSE_DRAG_PX + 20);
      // The sheet follows the finger while it moves.
      expect(wrapper.get("dialog").attributes("style")).toContain(
        `translateY(${SHEET_CLOSE_DRAG_PX + 20}px)`,
      );
      await handle.trigger("pointerup", { pointerId: 1 });
      expect(wrapper.emitted("close")).toHaveLength(1);
    });

    it("springs back from a shorter drag and stays open", async () => {
      phoneWidth();
      const wrapper = mount(ModalDialog, {
        attachTo: document.body,
        props: { title: "Quest bearbeiten" },
      });
      await flushPromises();
      const handle = await drag(wrapper, SHEET_CLOSE_DRAG_PX - 1);
      await handle.trigger("pointerup", { pointerId: 1 });
      expect(wrapper.emitted("close")).toBeUndefined();
      expect(wrapper.get("dialog").attributes("style") ?? "").not.toContain(
        "translateY",
      );
      // A drag upwards never moves it either.
      await drag(wrapper, -200);
      expect(wrapper.get("dialog").attributes("style") ?? "").not.toContain(
        "translateY",
      );
    });

    it("leaves the close button its own tap and never closes while busy", async () => {
      phoneWidth();
      const wrapper = mount(ModalDialog, {
        attachTo: document.body,
        props: { title: "Quest bearbeiten", busy: true },
      });
      await flushPromises();
      const handle = await drag(wrapper, 300);
      await handle.trigger("pointerup", { pointerId: 1 });
      expect(wrapper.emitted("close")).toBeUndefined();
      await wrapper.setProps({ busy: false });
      const close = await drag(wrapper, 300, ".modal-dialog__close");
      await close.trigger("pointerup", { pointerId: 1 });
      expect(wrapper.emitted("close")).toBeUndefined();
    });

    it("fits what an overlaying keyboard leaves visible, and keeps it after a drag", async () => {
      phoneWidth();
      vi.stubGlobal("visualViewport", {
        height: 420,
        offsetTop: 0,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      });
      vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
      const wrapper = mount(ModalDialog, {
        attachTo: document.body,
        props: { title: "Quest bearbeiten" },
      });
      await flushPromises();
      const style = () => (wrapper.get("dialog").element as HTMLElement).style;
      expect(style().getPropertyValue("--sheet-viewport-height")).toBe("420px");
      expect(style().getPropertyValue("--sheet-keyboard")).toBe("380px");
      const handle = await drag(wrapper, 20);
      await handle.trigger("pointerup", { pointerId: 1 });
      expect(style().getPropertyValue("--sheet-keyboard")).toBe("380px");
    });

    it("is no sheet from 40rem: a drag on the title does nothing", async () => {
      const wrapper = mount(ModalDialog, {
        attachTo: document.body,
        props: { title: "Quest bearbeiten" },
      });
      await flushPromises();
      const handle = await drag(wrapper, 300);
      await handle.trigger("pointerup", { pointerId: 1 });
      expect(wrapper.emitted("close")).toBeUndefined();
    });
  });

  it("skips the keyboard on a touch screen unless the person asked to type", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query === "(pointer: coarse)",
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const quiet = mount(ModalDialog, {
      attachTo: document.body,
      props: { title: "Bearbeiten" },
      slots: { default: '<input name="title" />' },
    });
    await flushPromises();
    expect(document.activeElement?.tagName).toBe("DIALOG");
    quiet.unmount();
    const asked = mount(ModalDialog, {
      attachTo: document.body,
      props: { title: "Befehle", openKeyboard: true },
      slots: { default: '<input name="title" />' },
    });
    await flushPromises();
    expect(document.activeElement).toBe(asked.get("input").element);
  });
});
