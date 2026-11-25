import {
  getCurrentInstance,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
} from "vue";

/**
 * Heute stays alive while another view is shown (`<KeepAlive>` in App.vue):
 * it is taken out of the page and put back, not built again. Anything a
 * component does in the background (a window listener, a timer, a key
 * handler) must rest while it is hidden, or it acts on a page no one sees.
 *
 * `whileActive` runs `start` while the component is in the page and `stop`
 * when it leaves it: on mount and unmount, and inside a kept-alive view also
 * when the view is hidden and shown again. Each runs once per change, in
 * whatever order Vue calls the hooks. `immediate` starts at setup, before
 * the first render, for state the template needs right away.
 */
export function whileActive(
  start: () => void,
  stop: () => void,
  { immediate = false }: { immediate?: boolean } = {},
): void {
  let on = false;
  const up = (): void => {
    if (on) return;
    on = true;
    start();
  };
  const down = (): void => {
    if (!on) return;
    on = false;
    stop();
  };
  if (immediate) up();
  else onMounted(up);
  onActivated(up);
  onDeactivated(down);
  onBeforeUnmount(down);
}

/**
 * Runs `handler` each time a kept-alive view comes back into the page, not
 * when it first appears (its mount does that work). Elsewhere it never runs.
 */
export function onShownAgain(handler: () => void): void {
  let away = false;
  // A part that first appears while its view is hidden (Heute's data
  // arriving after another view was opened) did its mount work out of
  // sight; the view coming back is then a return for it as well.
  const instance = getCurrentInstance();
  onMounted(() => {
    for (let current = instance; current; current = current.parent)
      if (current.isDeactivated) away = true;
  });
  onDeactivated(() => {
    away = true;
  });
  onActivated(() => {
    if (!away) return;
    away = false;
    handler();
  });
}
