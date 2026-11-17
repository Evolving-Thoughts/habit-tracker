import type { Editor } from "@tiptap/vue-3";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { NotesDocument } from "../api/todo-notes.api";
import RichTextEditor from "./RichTextEditor.vue";

enableAutoUnmount(afterEach);

// jsdom has no layout; the editor only asks for it to scroll the cursor into view.
beforeAll(() => {
  const noRects = () => [] as unknown as DOMRectList;
  Range.prototype.getClientRects = noRects;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
  Element.prototype.scrollIntoView = () => undefined;
  document.elementFromPoint = () => null;
});

const paragraph = (text: string) => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});
const doc = (...content: object[]) =>
  ({ type: "doc", content }) as NotesDocument;
/** The editor keeps an empty line after a list, heading or quote at the end. */
const emptyLine = { type: "paragraph" };

/** The toolbar reads the editor's state two frames after a change. */
const frames = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

async function mountEditor(modelValue: NotesDocument | null = null) {
  const wrapper = mount(RichTextEditor, {
    props: { modelValue, label: "Notizen zur Quest", placeholder: "Los" },
    attachTo: document.body,
  });
  await flushPromises();
  const editor = wrapper
    .findComponent({ name: "EditorContent" })
    .props("editor") as Editor;
  const emitted = () =>
    (wrapper.emitted("update:modelValue") ?? []).map(
      ([value]) => value as NotesDocument | null,
    );
  const tool = (name: string) => wrapper.get(`[data-tool="${name}"]`);
  return { wrapper, editor, emitted, tool };
}

describe("RichTextEditor", () => {
  it("shows the document it is given, named for screen readers, and reports nothing", async () => {
    const { wrapper, emitted } = await mountEditor(doc(paragraph("Schon da")));
    const field = wrapper.get('[role="textbox"]');
    expect(field.text()).toBe("Schon da");
    expect(field.attributes("aria-label")).toBe("Notizen zur Quest");
    expect(emitted()).toEqual([]);
  });

  it("reports what is written, and null once it is empty again", async () => {
    const { editor, emitted } = await mountEditor();
    editor.commands.insertContent("Hallo");
    expect(emitted().at(-1)).toEqual(doc(paragraph("Hallo")));
    editor.commands.clearContent(true);
    expect(emitted().at(-1)).toBeNull();
  });

  it("formats the selection from the toolbar and shows what is active", async () => {
    const { editor, emitted, tool } = await mountEditor(doc(paragraph("Wichtig")));
    editor.commands.selectAll();
    expect(tool("bold").attributes("aria-pressed")).toBe("false");
    await tool("bold").trigger("click");
    expect(emitted().at(-1)).toEqual(
      doc({
        type: "paragraph",
        content: [{ type: "text", text: "Wichtig", marks: [{ type: "bold" }] }],
      }),
    );
    await frames();
    expect(tool("bold").attributes("aria-pressed")).toBe("true");
    expect(tool("italic").attributes("aria-pressed")).toBe("false");
  });

  it("turns the paragraph into a check list", async () => {
    const { emitted, tool } = await mountEditor(doc(paragraph("Gliederung")));
    await tool("taskList").trigger("click");
    expect(emitted().at(-1)).toEqual(
      doc(
        {
          type: "taskList",
          content: [
            {
              type: "taskItem",
              attrs: { checked: false },
              content: [paragraph("Gliederung")],
            },
          ],
        },
        emptyLine,
      ),
    );
  });

  it("changes the block type and shows the type under the cursor", async () => {
    const { wrapper, emitted } = await mountEditor(doc(paragraph("Plan")));
    const select = wrapper.get<HTMLSelectElement>("select");
    expect(select.element.value).toBe("text");

    await select.setValue("h2");
    expect(emitted().at(-1)).toEqual(
      doc(
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Plan" }],
        },
        emptyLine,
      ),
    );
    await select.setValue("quote");
    expect(emitted().at(-1)).toEqual(
      doc({ type: "blockquote", content: [paragraph("Plan")] }, emptyLine),
    );
    await frames();
    expect(select.element.value).toBe("quote");
    await select.setValue("text");
    expect(emitted().at(-1)).toEqual(doc(paragraph("Plan"), emptyLine));
  });

  it("takes a list item out of its list to make it a heading", async () => {
    const { wrapper, emitted, tool } = await mountEditor(doc(paragraph("Punkt")));
    await tool("bulletList").trigger("click");
    const select = wrapper.get<HTMLSelectElement>("select");
    await select.setValue("h1");
    expect(select.element.value).toBe("h1");
    expect(emitted().at(-1)?.content?.[0]).toEqual({
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Punkt" }],
    });
  });

  it("links an address typed without a scheme", async () => {
    const { wrapper, emitted, tool } = await mountEditor();
    await tool("link").trigger("click");
    await wrapper.get('input[type="url"]').setValue("example.org/buch");
    await wrapper.get('input[type="url"]').trigger("keydown", { key: "Enter" });
    expect(emitted().at(-1)).toEqual(
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "example.org/buch",
            marks: [
              {
                type: "link",
                attrs: expect.objectContaining({
                  href: "https://example.org/buch",
                }) as unknown,
              },
            ],
          },
        ],
      }),
    );
    expect(wrapper.find('input[type="url"]').exists()).toBe(false);
  });

  it("refuses a link that is not a web or mail address", async () => {
    const { wrapper, emitted, tool } = await mountEditor(doc(paragraph("Text")));
    await tool("link").trigger("click");
    await wrapper.get('input[type="url"]').setValue("javascript:alert(1)");
    await wrapper.get(".rich-text__link .btn").trigger("click");
    expect(wrapper.get('[role="alert"]').text()).toBe(
      "Erlaubt sind Webadressen und mailto-Links.",
    );
    expect(emitted()).toEqual([]);
  });

  it("changes and removes the link under the cursor", async () => {
    const linked = doc({
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Quelle",
          marks: [{ type: "link", attrs: { href: "https://alt.example" } }],
        },
      ],
    });
    const { wrapper, editor, emitted, tool } = await mountEditor(linked);
    editor.commands.setTextSelection(3);
    await frames();
    await tool("link").trigger("click");
    const input = wrapper.get<HTMLInputElement>('input[type="url"]');
    expect(input.element.value).toBe("https://alt.example");
    expect(wrapper.get(".rich-text__link a").attributes("href")).toBe(
      "https://alt.example",
    );

    await input.setValue("https://neu.example");
    await input.trigger("keydown", { key: "Enter" });
    expect(JSON.stringify(emitted().at(-1))).toContain("https://neu.example");

    await frames();
    await tool("link").trigger("click");
    const remove = wrapper
      .findAll(".rich-text__link button")
      .find((button) => button.text() === "Entfernen")!;
    await remove.trigger("click");
    expect(emitted().at(-1)).toEqual(doc(paragraph("Quelle")));
  });

  it("is one tab stop whose buttons the arrow keys reach", async () => {
    const { wrapper } = await mountEditor();
    const buttons = wrapper.findAll<HTMLButtonElement>(
      '[role="toolbar"] button',
    );
    const stops = () =>
      buttons.filter((button) => button.attributes("tabindex") === "0");
    expect(stops()).toHaveLength(1);

    buttons[0]!.element.focus();
    await buttons[0]!.trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[1]!.element);
    expect(stops().map((button) => button.attributes("data-tool"))).toEqual([
      "italic",
    ]);
    await buttons[1]!.trigger("keydown", { key: "End" });
    expect(document.activeElement).toBe(buttons.at(-1)!.element);
    await buttons.at(-1)!.trigger("keydown", { key: "ArrowRight" });
    expect(document.activeElement).toBe(buttons[0]!.element);
  });

  it("takes a new document from outside, but leaves its own text alone", async () => {
    const { wrapper, editor, emitted } = await mountEditor(doc(paragraph("Alt")));
    await wrapper.setProps({ modelValue: doc(paragraph("Von woanders")) });
    expect(wrapper.get('[role="textbox"]').text()).toBe("Von woanders");
    expect(emitted()).toEqual([]);

    editor.commands.insertContentAt(1, "Neu: ");
    const before = editor.state.doc;
    await wrapper.setProps({ modelValue: emitted().at(-1) });
    expect(editor.state.doc).toBe(before);
  });

  it("leaves Ctrl+Enter to the view and lets Escape leave the field", async () => {
    const { wrapper, editor, emitted } = await mountEditor(doc(paragraph("Text")));
    const field = wrapper.get<HTMLElement>('[role="textbox"]');
    editor.commands.focus("end");
    await frames();
    expect(document.activeElement).toBe(field.element);

    await field.trigger("keydown", { key: "Enter", ctrlKey: true });
    expect(emitted()).toEqual([]);
    await field.trigger("keydown", { key: "Escape" });
    expect(document.activeElement).not.toBe(field.element);
  });
});
