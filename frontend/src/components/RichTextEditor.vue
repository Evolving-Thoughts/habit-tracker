<script setup lang="ts">
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor, type Editor } from "@tiptap/vue-3";
import { computed, nextTick, ref, toRaw, watch } from "vue";
import type { NotesDocument } from "../api/todo-notes.api";
import AppIcon from "./AppIcon.vue";
import MicButton from "./MicButton.vue";

/**
 * A rich-text field: headings, lists, check lists, quotes, code and links.
 * Its value is the editor's own document, or null when nothing is written.
 * What the toolbar offers is what the server keeps (backend todo-notes.ts).
 * The microphone in the bar dictates plain text in at the cursor.
 */
const props = defineProps<{
  modelValue: NotesDocument | null;
  /** Names the text field for screen readers. */
  label: string;
  placeholder?: string;
}>();
const emit = defineEmits<{ "update:modelValue": [NotesDocument | null] }>();

const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

/** What this editor reported last: that value coming back is not new text. */
let reported: NotesDocument | null | undefined;

const editor = useEditor({
  content: toRaw(props.modelValue),
  extensions: [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      // A click places the cursor; the link row opens the target.
      link: { openOnClick: false, defaultProtocol: "https" },
    }),
    TaskList,
    TaskItem.configure({
      nested: true,
      a11y: {
        checkboxLabel: (node) => `Erledigt: ${node.textContent || "ohne Text"}`,
      },
    }),
    Placeholder.configure({ placeholder: props.placeholder ?? "" }),
  ],
  editorProps: {
    attributes: { "aria-label": props.label, "aria-multiline": "true" },
    handleKeyDown(view, event) {
      // Ctrl+Enter belongs to the view around the field, not to a line break.
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) return true;
      // Tab indents lists here, so Escape is the way out of the field.
      if (event.key === "Escape") {
        (view.dom as HTMLElement).blur();
        return true;
      }
      return false;
    },
  },
  onUpdate({ editor: current }) {
    reported = current.isEmpty ? null : (current.getJSON() as NotesDocument);
    emit("update:modelValue", reported);
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (toRaw(value) === reported) return;
    reported = undefined;
    editor.value?.commands.setContent(toRaw(value) ?? "", {
      emitUpdate: false,
    });
  },
);

/*
 * Block type: one choice for the paragraph the cursor is in. The same
 * select also inserts a divider (an action, not a type), which keeps the
 * tool row short enough for a phone.
 */
type Block = "text" | "h1" | "h2" | "h3" | "quote" | "code";
const DIVIDER = "divider";
const BLOCKS: { value: Block; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "h1", label: "Überschrift 1" },
  { value: "h2", label: "Überschrift 2" },
  { value: "h3", label: "Überschrift 3" },
  { value: "quote", label: "Zitat" },
  { value: "code", label: "Codeblock" },
];

function blockOf(current: Editor): Block {
  if (current.isActive("codeBlock")) return "code";
  for (const level of [1, 2, 3] as const)
    if (current.isActive("heading", { level })) return `h${level}`;
  return current.isActive("blockquote") ? "quote" : "text";
}
const block = computed<Block>(() =>
  editor.value ? blockOf(editor.value) : "text",
);

function setBlock(event: Event): void {
  const current = editor.value;
  const select = event.target as HTMLSelectElement;
  if (!current) return;
  if (select.value === DIVIDER) {
    current.chain().focus().setHorizontalRule().run();
    select.value = blockOf(current);
    return;
  }
  const value = select.value as Block;
  let chain = current.chain().focus();
  if (value !== "quote" && current.isActive("blockquote"))
    chain = chain.unsetBlockquote();
  if (value === "code") chain = chain.setCodeBlock();
  else if (value === "text") chain = chain.setParagraph();
  else if (value === "quote") {
    chain = chain.setParagraph();
    if (!current.isActive("blockquote")) chain = chain.setBlockquote();
  } else
    chain = chain.setHeading({ level: Number(value[1]) as 1 | 2 | 3 });
  chain.run();
  // Where a type cannot go, the choice falls back to what is there.
  select.value = blockOf(current);
}

/* Toolbar: one tab stop, arrow keys move between its buttons. */
type Tool = {
  name: string;
  label: string;
  glyph?: string;
  icon?: "code" | "link" | "list" | "list-ordered" | "list-check";
  active: (current: Editor) => boolean;
  run: (current: Editor) => void;
};
const TOOLS: Tool[] = [
  {
    name: "bold",
    label: "Fett",
    glyph: "B",
    active: (current) => current.isActive("bold"),
    run: (current) => current.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    label: "Kursiv",
    glyph: "I",
    active: (current) => current.isActive("italic"),
    run: (current) => current.chain().focus().toggleItalic().run(),
  },
  {
    name: "strike",
    label: "Durchgestrichen",
    glyph: "S",
    active: (current) => current.isActive("strike"),
    run: (current) => current.chain().focus().toggleStrike().run(),
  },
  {
    name: "code",
    label: "Code",
    icon: "code",
    active: (current) => current.isActive("code"),
    run: (current) => current.chain().focus().toggleCode().run(),
  },
  {
    name: "link",
    label: "Link",
    icon: "link",
    active: (current) => current.isActive("link") || linkOpen.value,
    run: toggleLinkRow,
  },
  {
    name: "bulletList",
    label: "Aufzählung",
    icon: "list",
    active: (current) => current.isActive("bulletList"),
    run: (current) => current.chain().focus().toggleBulletList().run(),
  },
  {
    name: "orderedList",
    label: "Nummerierte Liste",
    icon: "list-ordered",
    active: (current) => current.isActive("orderedList"),
    run: (current) => current.chain().focus().toggleOrderedList().run(),
  },
  {
    name: "taskList",
    label: "Checkliste",
    icon: "list-check",
    active: (current) => current.isActive("taskList"),
    run: (current) => current.chain().focus().toggleTaskList().run(),
  },
];

/** Dictated text goes in at the cursor as plain text, spaced from its neighbours. */
function insertDictation(text: string): void {
  const current = editor.value;
  if (!current) return;
  const { from, to } = current.state.selection;
  const { doc } = current.state;
  // Across a block boundary textBetween is "": no space needed there.
  const before = doc.textBetween(Math.max(0, from - 1), from);
  const after = doc.textBetween(to, Math.min(doc.content.size, to + 1));
  const spaced =
    (before && !/\s/.test(before) ? " " : "") +
    text +
    (after && !/\s/.test(after) ? " " : "");
  current.chain().focus().insertContent({ type: "text", text: spaced }).run();
}

const toolbar = ref<HTMLElement | null>(null);
const roving = ref(0);

function onToolbarKey(event: KeyboardEvent): void {
  const buttons = [
    ...(toolbar.value?.querySelectorAll<HTMLButtonElement>("button") ?? []),
  ];
  const index = buttons.indexOf(event.target as HTMLButtonElement);
  if (index < 0) return;
  const last = buttons.length - 1;
  const next =
    event.key === "ArrowRight"
      ? index === last
        ? 0
        : index + 1
      : event.key === "ArrowLeft"
        ? index === 0
          ? last
          : index - 1
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? last
            : -1;
  if (next < 0) return;
  event.preventDefault();
  roving.value = next;
  buttons[next]!.focus();
}

/* Link: a row under the toolbar instead of a browser prompt. */
const linkOpen = ref(false);
const linkUrl = ref("");
const linkError = ref("");
const linkInput = ref<HTMLInputElement | null>(null);
const currentLink = computed(() => {
  const href: unknown = editor.value?.getAttributes("link").href;
  return typeof href === "string" && SAFE_LINK.test(href) ? href : "";
});

function toggleLinkRow(): void {
  linkOpen.value = !linkOpen.value;
  linkError.value = "";
  if (!linkOpen.value) {
    editor.value?.commands.focus();
    return;
  }
  linkUrl.value = currentLink.value;
  void nextTick(() => linkInput.value?.focus());
}

function closeLinkRow(): void {
  linkOpen.value = false;
  linkError.value = "";
  editor.value?.commands.focus();
}

function applyLink(): void {
  const current = editor.value;
  if (!current) return;
  const typed = linkUrl.value.trim();
  if (!typed) return removeLink();
  const href = /^[a-z][a-z\d+.-]*:/i.test(typed) ? typed : `https://${typed}`;
  if (!SAFE_LINK.test(href)) {
    linkError.value = "Erlaubt sind Webadressen und mailto-Links.";
    return;
  }
  const chain = current.chain().focus();
  if (current.isActive("link"))
    chain.extendMarkRange("link").setLink({ href }).run();
  else if (current.state.selection.empty)
    // Nothing is selected: the address itself becomes the linked text.
    chain
      .insertContent({
        type: "text",
        text: typed,
        marks: [{ type: "link", attrs: { href } }],
      })
      .run();
  else chain.setLink({ href }).run();
  linkOpen.value = false;
  linkError.value = "";
}

function removeLink(): void {
  editor.value?.chain().focus().extendMarkRange("link").unsetLink().run();
  linkOpen.value = false;
  linkError.value = "";
}
</script>

<template>
  <div class="rich-text">
    <div class="rich-text__bar">
      <select
        class="rich-text__block"
        aria-label="Absatzformat"
        :value="block"
        :disabled="!editor"
        @change="setBlock"
      >
        <option v-for="option in BLOCKS" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
        <optgroup label="Einfügen">
          <option :value="DIVIDER">Trennlinie</option>
        </optgroup>
      </select>
      <MicButton
        class="rich-text__mic"
        mode="long"
        :label="`${label} diktieren`"
        @result="insertDictation"
      />
      <div
        ref="toolbar"
        class="rich-text__tools"
        role="toolbar"
        aria-label="Formatierung"
        @keydown="onToolbarKey"
      >
        <button
          v-for="(tool, index) in TOOLS"
          :key="tool.name"
          type="button"
          class="rich-text__tool"
          :class="`rich-text__tool--${tool.name}`"
          :data-tool="tool.name"
          :tabindex="index === roving ? 0 : -1"
          :aria-label="tool.label"
          :title="tool.label"
          :aria-pressed="!!editor && tool.active(editor)"
          :aria-expanded="tool.name === 'link' ? linkOpen : undefined"
          :disabled="!editor"
          @mousedown.prevent
          @focus="roving = index"
          @click="editor && tool.run(editor)"
        >
          <AppIcon v-if="tool.icon" :name="tool.icon" />
          <span v-else aria-hidden="true">{{ tool.glyph }}</span>
        </button>
      </div>
    </div>

    <div v-if="linkOpen" class="rich-text__link">
      <input
        ref="linkInput"
        v-model="linkUrl"
        class="input"
        type="url"
        inputmode="url"
        autocomplete="off"
        aria-label="Linkadresse"
        placeholder="https://…"
        :aria-invalid="linkError ? 'true' : undefined"
        @keydown.enter.prevent="applyLink"
        @keydown.esc.prevent.stop="closeLinkRow"
      />
      <button class="btn" type="button" @click="applyLink">Übernehmen</button>
      <a
        v-if="currentLink"
        class="btn btn--quiet"
        :href="currentLink"
        target="_blank"
        rel="noopener noreferrer"
      >
        Öffnen
      </a>
      <button
        v-if="currentLink"
        class="btn btn--quiet"
        type="button"
        @click="removeLink"
      >
        Entfernen
      </button>
      <p v-if="linkError" class="form-error" role="alert">{{ linkError }}</p>
    </div>

    <EditorContent class="rich-text__content" :editor="editor" />
  </div>
</template>

<style scoped>
.rich-text {
  container: rich-text / inline-size;
  border: 1.5px solid var(--color-line-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 400;
  text-align: left;
}

.rich-text:has(.ProseMirror:focus-visible) {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 2px;
}

.rich-text__bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  align-items: center;
  padding: var(--space-1);
  border-bottom: 1.5px solid var(--color-line);
}

/*
 * The controls of the bar are named through `.rich-text`: a dialog styles
 * every button and select in it, and the bar keeps its own look there.
 */
.rich-text .rich-text__block {
  min-height: var(--tap);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: calc(var(--radius-control) - var(--space-1));
  background: transparent;
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
  font-weight: 700;
  cursor: pointer;
}

/* One row of tools: beside the block type when there is room, below it on a phone. */
.rich-text__tools {
  display: flex;
  flex: 1 1 18rem;
  order: 2;
  min-width: 0;
}

/*
 * The microphone ends the bar; where the tools take a row of their own it
 * stays up beside the block type, at the right edge.
 */
.rich-text__mic {
  order: 3;
  margin-inline-start: auto;
}

@container rich-text (max-width: 30rem) {
  .rich-text__mic {
    order: 1;
  }
}

.rich-text .rich-text__tool {
  display: inline-grid;
  flex: 1 1 0;
  place-items: center;
  min-width: 2rem;
  max-width: var(--tap);
  height: var(--tap);
  padding: 0;
  border: 0;
  border-radius: calc(var(--radius-control) - var(--space-1));
  background: transparent;
  color: var(--color-ink-muted);
  font-size: 1.0625rem;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 160ms var(--ease-out);
}

.rich-text__tool :deep(svg) {
  width: 1.25rem;
  height: 1.25rem;
}

/* A finger gets a full tap per tool; the row wraps rather than squeezing them. */
@media (pointer: coarse) {
  .rich-text__tools {
    flex-wrap: wrap;
  }

  .rich-text .rich-text__tool {
    flex: 0 0 var(--tap);
    min-width: var(--tap);
  }
}

.rich-text__tool--italic {
  font-style: italic;
  font-weight: 700;
}

.rich-text__tool--strike {
  text-decoration: line-through;
}

.rich-text .rich-text__block:hover:not(:disabled),
.rich-text .rich-text__tool:hover:not(:disabled) {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.rich-text .rich-text__tool[aria-pressed="true"] {
  background: var(--color-action-tint-hover);
  color: var(--color-action-strong);
}

.rich-text .rich-text__block:disabled,
.rich-text .rich-text__tool:disabled {
  background: transparent;
  color: var(--color-ink-soft);
  cursor: default;
}

.rich-text__link {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  padding: var(--space-2);
  border-bottom: 1.5px solid var(--color-line);
}

.rich-text__link .input {
  flex: 1 1 12rem;
  width: auto;
}

.rich-text__link .form-error {
  flex-basis: 100%;
}

/* The text itself. ProseMirror renders it, so these rules reach into it. */
.rich-text__content :deep(.ProseMirror) {
  min-height: 7rem;
  padding: var(--space-3);
  outline: none;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.rich-text__content :deep(.ProseMirror > * + *) {
  margin-top: var(--space-2);
}

.rich-text__content :deep(:is(p, h1, h2, h3, ul, ol, pre, blockquote)) {
  margin: 0;
}

.rich-text__content :deep(:is(h1, h2, h3)) {
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.rich-text__content :deep(h1) {
  font-size: 1.5rem;
}

.rich-text__content :deep(h2) {
  font-size: 1.25rem;
}

.rich-text__content :deep(h3) {
  font-size: 1.0625rem;
}

.rich-text__content :deep(.ProseMirror > :is(h1, h2, h3):not(:first-child)) {
  margin-top: var(--space-4);
}

.rich-text__content :deep(:is(ul, ol)) {
  padding-left: 1.5rem;
}

.rich-text__content :deep(li > :is(ul, ol)) {
  margin-top: var(--space-1);
}

.rich-text__content :deep(ul[data-type="taskList"]) {
  padding-left: 0;
  list-style: none;
}

.rich-text__content :deep(ul[data-type="taskList"] > li) {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
}

.rich-text__content :deep(ul[data-type="taskList"] > li > label) {
  display: grid;
  flex: none;
  place-items: center;
  width: 1.5rem;
  height: 1.5rem;
  cursor: pointer;
}

.rich-text__content :deep(ul[data-type="taskList"] input) {
  width: 1.125rem;
  height: 1.125rem;
  margin: 0;
  cursor: pointer;
}

.rich-text__content :deep(ul[data-type="taskList"] > li > div) {
  flex: 1;
  min-width: 0;
}

.rich-text__content :deep(li[data-checked="true"] > div > p) {
  color: var(--color-ink-muted);
  text-decoration: line-through;
}

.rich-text__content :deep(blockquote) {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-action-tint);
  color: var(--color-ink-muted);
  font-style: italic;
}

.rich-text__content :deep(code) {
  padding: 0.1em 0.35em;
  border-radius: 0.375rem;
  background: var(--color-action-tint);
  font-family: ui-monospace, "Cascadia Mono", Consolas, monospace;
  font-size: 0.9em;
}

.rich-text__content :deep(pre) {
  padding: var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-action-tint);
  /* Long lines wrap: a field in a form never scrolls sideways. */
  white-space: pre-wrap;
}

.rich-text__content :deep(pre code) {
  padding: 0;
  background: none;
}

.rich-text__content :deep(hr) {
  height: 1.5px;
  margin: var(--space-4) 0;
  border: 0;
  background: var(--color-line);
}

.rich-text__content :deep(hr.ProseMirror-selectednode) {
  background: var(--color-action);
}

.rich-text__content :deep(a) {
  color: var(--color-action-strong);
  cursor: text;
}

.rich-text__content :deep(p.is-editor-empty:first-child::before) {
  float: left;
  height: 0;
  color: var(--color-ink-soft);
  content: attr(data-placeholder);
  pointer-events: none;
}
</style>
