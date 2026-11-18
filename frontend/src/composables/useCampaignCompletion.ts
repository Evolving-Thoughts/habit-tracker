import { onUnmounted, shallowRef } from "vue";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import { openBelow } from "../utils/todo-hierarchy";

export type CampaignQuestion = { title: string; open: number };

/**
 * Asks before a campaign is completed while quests below it are still open.
 * Completing touches only the campaign itself (TodosService.update), so the
 * question says they stay open. The view shows CampaignCompletionDialog
 * while `question` is set and passes the answer to `reply`.
 */
export function useCampaignCompletion() {
  const question = shallowRef<CampaignQuestion | null>(null);
  let answer: ((go: boolean) => void) | undefined;

  /** Whether to go ahead: at once without open quests, else after a yes. */
  function confirm(title: string, open: number): Promise<boolean> {
    if (open <= 0) return Promise.resolve(true);
    answer?.(false);
    question.value = { title, open };
    return new Promise((resolve) => (answer = resolve));
  }

  function reply(go: boolean): void {
    const resolve = answer;
    answer = undefined;
    question.value = null;
    resolve?.(go);
  }

  /**
   * Open quests below a campaign, for views without the tree at hand. A
   * failed read asks nothing: the completion still offers its undo.
   */
  async function openQuestsBelow(todoId: number): Promise<number> {
    try {
      const todo = (await getTodoHierarchy()).find(({ id }) => id === todoId);
      return todo ? openBelow(todo.progress) : 0;
    } catch {
      return 0;
    }
  }

  onUnmounted(() => reply(false));
  return { question, confirm, reply, openQuestsBelow };
}
