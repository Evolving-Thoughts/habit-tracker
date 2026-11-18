import { nextTick, type Ref } from "vue";

// Resolve against the current DOM, because saving can replace or remove a row.
export function useListFocus(root: Ref<HTMLElement | null>) {
  let key: string | null = null;
  let index = 0;
  const editButtons = () =>
    Array.from(
      root.value?.querySelectorAll<HTMLButtonElement>(
        "[data-focus-key] [data-edit-button]",
      ) ?? [],
    );
  function remember(itemKey: string): void {
    key = itemKey;
    const buttons = editButtons();
    index = Math.max(
      0,
      buttons.findIndex(
        (button) =>
          button.closest<HTMLElement>("[data-focus-key]")?.dataset.focusKey ===
          key,
      ),
    );
  }
  function returnFocus(): HTMLElement | null {
    const buttons = editButtons();
    const original = buttons.find(
      (button) =>
        button.closest<HTMLElement>("[data-focus-key]")?.dataset.focusKey ===
        key,
    );
    return original ?? successor();
  }
  /** Whatever row now stands where the remembered one stood. */
  function successor(): HTMLElement | null {
    const buttons = editButtons();
    return (
      buttons[Math.min(index, buttons.length - 1)] ??
      root.value?.querySelector<HTMLElement>(".create-button") ??
      null
    );
  }
  /**
   * Runs an action on a row (a shortcut). When the focus was in that row, it
   * moves on to the row that takes its place, since the row itself usually
   * leaves: done, or moved to another day.
   */
  async function around(
    itemKey: string,
    action: () => Promise<unknown>,
  ): Promise<void> {
    const row = root.value?.querySelector(`[data-focus-key="${itemKey}"]`);
    const hadFocus = !!row?.contains(document.activeElement);
    remember(itemKey);
    await action();
    await nextTick();
    if (hadFocus) successor()?.focus();
  }
  return { remember, returnFocus, around };
}
