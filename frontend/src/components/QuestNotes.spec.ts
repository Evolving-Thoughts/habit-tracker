import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { getNotes, setNotes } from "../api/todo-notes.api";
import QuestNotes from "./QuestNotes.vue";

vi.mock("../api/todo-notes.api", () => ({
  getNotes: vi.fn(),
  setNotes: vi.fn(),
}));
// The editor has its own spec; here it only passes text on.
vi.mock("./RichTextEditor.vue", () => ({
  // Marks the mock as a module, so the lazy import unwraps its default.
  __esModule: true,
  default: defineComponent({
    name: "RichTextEditor",
    props: { modelValue: { type: Object, default: null } },
    emits: ["update:modelValue"],
    setup: (props) => () =>
      h("div", { "data-editor": "" }, JSON.stringify(props.modelValue)),
  }),
}));

enableAutoUnmount(afterEach);

const TARGET = { kind: "todo" as const, id: 7 };

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function mountNotes() {
  const wrapper = mount(QuestNotes, { props: { target: TARGET } });
  await flushPromises();
  await vi.dynamicImportSettled();
  await flushPromises();
  const type = (text: string | null) =>
    wrapper
      .getComponent({ name: "RichTextEditor" })
      .vm.$emit("update:modelValue", text === null ? null : doc(text));
  const status = () => wrapper.get(".quest-notes__status").text();
  return { wrapper, type, status };
}

describe("QuestNotes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.mocked(getNotes).mockResolvedValue(doc("Schon da"));
    vi.mocked(setNotes).mockImplementation((_id, notes) =>
      Promise.resolve(notes),
    );
  });
  afterEach(() => vi.useRealTimers());

  it("loads the notes of its quest into the editor", async () => {
    const { wrapper, status } = await mountNotes();
    expect(getNotes).toHaveBeenCalledWith(TARGET, expect.anything());
    expect(wrapper.get("[data-editor]").text()).toContain("Schon da");
    expect(status()).toBe("");
  });

  it("saves a moment after the last keystroke, once", async () => {
    const { type, status } = await mountNotes();
    type("E");
    type("Er");
    type("Erster Entwurf");
    expect(status()).toBe("");
    await flushPromises();
    expect(status()).toBe("Speichert …");
    expect(setNotes).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(800);
    expect(setNotes).toHaveBeenCalledTimes(1);
    expect(setNotes).toHaveBeenCalledWith(TARGET, doc("Erster Entwurf"));
    expect(status()).toBe("Gespeichert");
  });

  it("clears the notes when the editor is emptied", async () => {
    const { type } = await mountNotes();
    type(null);
    await vi.advanceTimersByTimeAsync(800);
    expect(setNotes).toHaveBeenCalledWith(TARGET, null);
  });

  it("sends what is typed at once when the view is left", async () => {
    const { wrapper, type } = await mountNotes();
    type("Noch schnell");
    wrapper.unmount();
    expect(setNotes).toHaveBeenCalledWith(TARGET, doc("Noch schnell"));
  });

  it("sends what is typed when the app goes into the background", async () => {
    const { type } = await mountNotes();
    type("Unterwegs");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(setNotes).toHaveBeenCalledWith(TARGET, doc("Unterwegs"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
  });

  it("keeps the text, says why saving failed and saves again on request", async () => {
    vi.mocked(setNotes).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );
    const { wrapper, type, status } = await mountNotes();
    type("Offline geschrieben");
    await vi.advanceTimersByTimeAsync(800);

    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Keine Verbindung zum Server",
    );
    expect(wrapper.get("[data-editor]").text()).toContain(
      "Offline geschrieben",
    );
    await wrapper.get(".quest-notes__retry").trigger("click");
    await flushPromises();
    expect(setNotes).toHaveBeenCalledTimes(2);
    expect(status()).toBe("Gespeichert");
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });

  it("does not call an older answer 'saved' while newer text is waiting", async () => {
    let finish: () => void = () => undefined;
    vi.mocked(setNotes).mockReturnValueOnce(
      new Promise((resolve) => (finish = () => resolve(null))),
    );
    const { type, status } = await mountNotes();
    type("Eins");
    await vi.advanceTimersByTimeAsync(800);
    type("Eins zwei");
    finish();
    await flushPromises();
    expect(status()).toBe("Speichert …");
    await vi.advanceTimersByTimeAsync(800);
    expect(status()).toBe("Gespeichert");
    expect(setNotes).toHaveBeenLastCalledWith(TARGET, doc("Eins zwei"));
  });

  it("says so when the notes cannot be loaded", async () => {
    vi.mocked(getNotes).mockRejectedValue(new Error("Nicht gefunden"));
    const wrapper = mount(QuestNotes, { props: { target: TARGET } });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toBe("Nicht gefunden");
    expect(wrapper.find("[data-editor]").exists()).toBe(false);
  });
});
