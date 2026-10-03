import type { Ref } from "vue";

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
    return (
      original ??
      buttons[Math.min(index, buttons.length - 1)] ??
      root.value?.querySelector<HTMLElement>(".create-button") ??
      null
    );
  }
  return { remember, returnFocus };
}
