import { readonly, ref, shallowRef, type Ref } from "vue";
import type { DeleteTarget } from "../components/DeleteItemDialog.vue";
import type { MoveTarget } from "../components/MoveItemDialog.vue";
import { useListFocus } from "./useListFocus";

/** The editor a row opens: a quest's or a daily's, with the notes of its run. */
export type EditTarget = {
  kind: "todo" | "habit";
  id: number;
  occurrenceId?: number | null;
  /** Where the focus starts in the editor, such as its day field. */
  focus?: string;
  /** Known to be a campaign before the editor has loaded it. */
  campaign?: boolean;
};

/** A quest for "In Kampagne verschieben …". */
export type ReparentTarget = { todoId: number; title: string };

/** The one dialog a row asked for. */
export type RowDialog =
  | { kind: "edit"; target: EditTarget }
  | { kind: "move"; target: MoveTarget; offerToday: boolean }
  | { kind: "reparent"; target: ReparentTarget }
  | { kind: "delete"; target: DeleteTarget };

/**
 * "This row asked for its editor, another day, another campaign or its
 * deletion", once for every view (rendered by `RowDialogs`). One dialog at
 * a time, and none while one saves, the session writes or the view says it
 * is `blocked`. While a dialog is open or saving the view's session holds
 * (feed `holding` into `useViewSession`), so a change heard meanwhile loads
 * once it closes. The focus goes back to the row the dialog came from, or
 * to the row now standing in its place. After a save the session takes in
 * the change (`applied`), the view says what happened (`saved`), then the
 * dialog closes.
 */
export function useRowDialogs({
  root,
  session,
  today,
  blocked = () => false,
  opened,
  saved,
}: {
  /** The page holding the rows (their `data-focus-key`). */
  root: Ref<HTMLElement | null>;
  session: { busy: Readonly<Ref<boolean>>; applied: () => Promise<void> };
  /** Today, for the move dialog's days. */
  today: () => string;
  /** The view's own reasons not to open one, such as a first load. */
  blocked?: () => boolean;
  /** Runs as a dialog opens, such as clearing an old status line. */
  opened?: () => void;
  /** Runs once a dialog's change is loaded: the view's status line. */
  saved?: (dialog: RowDialog) => void;
}) {
  const dialog = shallowRef<RowDialog | null>(null);
  const busy = ref(false);
  const focus = useListFocus(root);

  const holding = (): boolean => dialog.value !== null || busy.value;

  /** Opens `next` for the row `key` unless something runs or one is open. */
  function open(key: string, next: RowDialog): void {
    if (holding() || session.busy.value || blocked()) return;
    focus.remember(key);
    opened?.();
    dialog.value = next;
  }

  /** Closes whatever is open; the dialogs themselves refuse while saving. */
  function close(): void {
    dialog.value = null;
    busy.value = false;
  }

  /** A dialog saved: load the change, say it, close. */
  async function done(): Promise<void> {
    const finished = dialog.value;
    if (!finished) return;
    await session.applied();
    saved?.(finished);
    close();
  }

  return {
    dialog: readonly(dialog),
    busy: readonly(busy),
    holding,
    today,
    returnFocus: focus.returnFocus,
    edit: (key: string, target: EditTarget) =>
      open(key, { kind: "edit", target }),
    /** "Anderer Tag …"; `offerToday` for a row not on today. */
    pickDay: (key: string, target: MoveTarget, { offerToday = false } = {}) =>
      open(key, { kind: "move", target, offerToday }),
    reparent: (key: string, target: ReparentTarget) =>
      open(key, { kind: "reparent", target }),
    remove: (key: string, target: DeleteTarget) =>
      open(key, { kind: "delete", target }),
    /** For `RowDialogs`: the open dialog's busy flag, its close and its save. */
    report: (value: boolean) => (busy.value = value),
    close,
    done,
  };
}

export type RowDialogs = ReturnType<typeof useRowDialogs>;
