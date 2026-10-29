import { ref } from "vue";
import { deleteTodo } from "../api/day-planner.api";
import { getDeletionPreview } from "../api/todo-hierarchy.api";
import type { DeletionPreview } from "../types/todo-hierarchy";
import { notifyDataChanged } from "./data-sync";

/**
 * Preview → confirm → delete for a todo and its subtree. A delete always
 * sends the token of the preview the user saw; if the subtree changed
 * meanwhile the server answers 409 and the preview is dropped, so the user
 * has to look at the new one.
 */
export function useTodoDeletion() {
  const preview = ref<DeletionPreview | null>(null);
  let todoId: number | null = null;

  /** Loads what a delete of `id` would remove. */
  async function prepare(id: number): Promise<void> {
    cancel();
    const loaded = await getDeletionPreview(id);
    todoId = id;
    preview.value = loaded;
  }

  /** Deletes exactly the previewed subtree; always clears the preview. */
  async function confirm(): Promise<void> {
    const current = preview.value;
    const id = todoId;
    cancel();
    if (!current || id === null)
      throw new Error("Bitte zuerst die Löschvorschau prüfen.");
    await deleteTodo(id, current.confirmationToken);
    notifyDataChanged();
  }

  function cancel(): void {
    preview.value = null;
    todoId = null;
  }

  return { preview, prepare, confirm, cancel };
}
