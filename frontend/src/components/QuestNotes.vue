<script setup lang="ts">
import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from "vue";
import {
  getTodoNotes,
  setTodoNotes,
  type NotesDocument,
} from "../api/todo-notes.api";
import { useLoader } from "../composables/useLoader";

/**
 * The notes of one quest. They save themselves a moment after the last
 * keystroke, and at once when the view is left, so nothing has to be confirmed.
 * Give the component a `key` per quest: it belongs to exactly one.
 */
const props = defineProps<{ todoId: number }>();

// The editor is the heaviest part of the app; it loads when notes are shown.
const RichTextEditor = defineAsyncComponent(
  () => import("./RichTextEditor.vue"),
);

const SAVE_DELAY_MS = 800;

// Shallow: the editor recognises its own document by identity.
const notes = shallowRef<NotesDocument | null>(null);
const state = ref<"idle" | "pending" | "saving" | "saved" | "failed">("idle");
const saveError = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
/** Counts edits, so an answer to an older save does not report "saved". */
let revision = 0;

const {
  data: stored,
  isLoading,
  hasLoaded,
  errorMessage: loadError,
} = useLoader((signal) => getTodoNotes(props.todoId, signal), {
  initial: null as NotesDocument | null,
  // No refresh after changes elsewhere: the notes are edited right here.
  fallbackError: "Die Notizen konnten nicht geladen werden.",
});
watch(stored, (document) => (notes.value = document));

const status = computed(() => {
  if (state.value === "saving" || state.value === "pending")
    return "Speichert …";
  if (state.value === "saved") return "Gespeichert";
  return "";
});

async function save(): Promise<void> {
  clearTimeout(timer);
  const current = revision;
  state.value = "saving";
  saveError.value = "";
  try {
    await setTodoNotes(props.todoId, notes.value);
    if (current === revision) state.value = "saved";
  } catch (cause) {
    if (current !== revision) return;
    state.value = "failed";
    saveError.value =
      cause instanceof TypeError
        ? "Keine Verbindung zum Server. Deine Notizen bleiben hier stehen."
        : cause instanceof Error
          ? cause.message
          : "Die Notizen konnten nicht gespeichert werden.";
  }
}

function onEdit(document: NotesDocument | null): void {
  notes.value = document;
  revision += 1;
  state.value = "pending";
  clearTimeout(timer);
  timer = setTimeout(() => void save(), SAVE_DELAY_MS);
}

/** What is typed but not yet sent goes out now. */
function flush(): void {
  if (state.value === "pending") void save();
}
function onVisibility(): void {
  if (document.visibilityState === "hidden") flush();
}
onMounted(() => document.addEventListener("visibilitychange", onVisibility));
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  flush();
});
</script>

<template>
  <section class="quest-notes" aria-labelledby="quest-notes-title">
    <header class="quest-notes__head">
      <h2 id="quest-notes-title" class="quest-notes__title">Notizen</h2>
      <p class="quest-notes__status" role="status">{{ status }}</p>
    </header>
    <p v-if="loadError" class="form-error" role="alert">{{ loadError }}</p>
    <p
      v-else-if="isLoading && !hasLoaded"
      class="quest-notes__loading"
      role="status"
    >
      Notizen werden geladen …
    </p>
    <RichTextEditor
      v-else
      :model-value="notes"
      label="Notizen zur Quest"
      placeholder="Gedanken, Schritte, Links …"
      @update:model-value="onEdit"
    />
    <p v-if="state === 'failed'" class="form-error" role="alert">
      {{ saveError }}
      <button type="button" class="quest-notes__retry" @click="save">
        Erneut speichern
      </button>
    </p>
  </section>
</template>

<style scoped>
.quest-notes {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-2);
  text-align: left;
}

.quest-notes__head {
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
  justify-content: space-between;
}

.quest-notes__title {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.quest-notes__status,
.quest-notes__loading {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.quest-notes__retry {
  min-height: var(--tap);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
</style>
