<script setup lang="ts">
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import AppIcon from "./AppIcon.vue";
import {
  SHEET_CLOSE_DRAG_PX,
  SHEET_QUERY,
  useMediaQuery,
} from "../composables/useMediaQuery";

/**
 * Every dialog of the app. From 40rem it is a card in the middle of the
 * window. Below 40rem it is a sheet from the bottom: full width, rounded on
 * top, with a grabber. Dragging the grabber or the title down past
 * SHEET_CLOSE_DRAG_PX closes it, a shorter drag springs back; the close
 * button and Escape stay. The sheet is never taller than the visible part
 * of the window and rides on top of an on-screen keyboard, so a sticky
 * footer (`.sticky-actions`) stays above it.
 */

const props = withDefaults(
  defineProps<{
    title: string;
    busy?: boolean;
    focusSelector?: string;
    returnFocus?: () => HTMLElement | null;
    /**
     * The person asked to type (Suchen): focus the field on a touch screen
     * too, which opens the keyboard. Otherwise touch screens skip it.
     */
    openKeyboard?: boolean;
  }>(),
  {
    busy: false,
    focusSelector: 'input[name="title"], [data-test="choose-todo"]',
    openKeyboard: false,
  },
);
const emit = defineEmits<{ close: [] }>();
const dialog = ref<HTMLDialogElement | null>(null);
let previousFocus: HTMLElement | null = null;
let focusedElement: HTMLElement | null = null;
let observer: MutationObserver | null = null;
let unlock: (() => void) | null = null;

function lockPageScroll(): () => void {
  const left = window.scrollX;
  const top = window.scrollY;
  const body = document.body;
  const keys = [
    "position",
    "top",
    "left",
    "width",
    "overflow",
    "paddingRight",
  ] as const;
  const original = keys.map((key) => [key, body.style[key]] as const);
  const scrollbar =
    document.documentElement.clientWidth > 0
      ? Math.max(0, window.innerWidth - document.documentElement.clientWidth)
      : 0;
  const padding = parseFloat(getComputedStyle(body).paddingRight) || 0;
  body.style.position = "fixed";
  body.style.top = `${-top}px`;
  body.style.left = `${-left}px`;
  body.style.width = "100%";
  body.style.overflow = "hidden";
  body.style.paddingRight = `${padding + scrollbar}px`;
  return () => {
    for (const [key, value] of original) body.style[key] = value;
    window.scrollTo({ left, top, behavior: "instant" });
  };
}
function close(): void {
  if (!props.busy) emit("close");
}
function guardSubmission(event: Event): void {
  if (props.busy) {
    event.preventDefault();
    event.stopPropagation();
  }
}
/** On touch screens a focused field would pop the keyboard up unasked. */
function opensKeyboard(target: HTMLElement): boolean {
  if (props.openKeyboard) return false;
  const touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  return touch && target.matches("input, textarea, select");
}
async function focusContent(): Promise<void> {
  await nextTick();
  const target = dialog.value?.querySelector<HTMLElement>(props.focusSelector);
  if (target && opensKeyboard(target)) return;
  if (target && target !== focusedElement && !target.matches(":disabled")) {
    focusedElement = target;
    target.focus({ preventScroll: true });
  }
}
watch(() => props.focusSelector, focusContent);

/* The sheet below 40rem: dragged down by its grabber or title. */
const sheet = useMediaQuery(SHEET_QUERY);
const dragOffset = ref(0);
const dragging = ref(false);
let dragStart: { y: number; pointerId: number } | null = null;
/* What a keyboard leaves visible; see fitViewport. */
const viewportHeight = ref<number | null>(null);
const keyboardInset = ref(0);
const sheetStyle = computed(() => ({
  "--sheet-viewport-height":
    viewportHeight.value === null ? undefined : `${viewportHeight.value}px`,
  "--sheet-keyboard": `${keyboardInset.value}px`,
  transform:
    dragOffset.value > 0 ? `translateY(${dragOffset.value}px)` : undefined,
  transition: dragging.value && dragOffset.value > 0 ? "none" : undefined,
}));
function startDrag(event: PointerEvent): void {
  if (!sheet.value || props.busy || event.button > 0) return;
  if (event.target instanceof Element && event.target.closest("button")) return;
  dragStart = { y: event.clientY, pointerId: event.pointerId };
  dragging.value = true;
  (event.currentTarget as HTMLElement | null)?.setPointerCapture?.(
    event.pointerId,
  );
}
function moveDrag(event: PointerEvent): void {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  dragOffset.value = Math.max(0, event.clientY - dragStart.y);
}
function endDrag(event: PointerEvent): void {
  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  const far = dragOffset.value >= SHEET_CLOSE_DRAG_PX;
  cancelDrag();
  if (far) close();
}
function cancelDrag(): void {
  dragStart = null;
  dragging.value = false;
  dragOffset.value = 0;
}

/*
 * The visible part of the window: an on-screen keyboard that overlays the
 * page (where the viewport does not shrink for it) lifts the sheet.
 */
function fitViewport(): void {
  const view = window.visualViewport;
  if (!view) return;
  viewportHeight.value = view.height;
  keyboardInset.value = Math.max(
    0,
    window.innerHeight - view.height - view.offsetTop,
  );
}
onMounted(async () => {
  fitViewport();
  window.visualViewport?.addEventListener("resize", fitViewport);
  window.visualViewport?.addEventListener("scroll", fitViewport);
  previousFocus =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  unlock = lockPageScroll();
  dialog.value?.showModal();
  dialog.value?.focus({ preventScroll: true });
  observer = new MutationObserver(() => {
    void focusContent();
  });
  if (dialog.value)
    observer.observe(dialog.value, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled"],
    });
  await focusContent();
});
onBeforeUnmount(() => {
  observer?.disconnect();
  window.visualViewport?.removeEventListener("resize", fitViewport);
  window.visualViewport?.removeEventListener("scroll", fitViewport);
});
onUnmounted(() => {
  unlock?.();
  const target = props.returnFocus?.() ?? previousFocus;
  if (target?.isConnected) target.focus({ preventScroll: true });
});
</script>

<template>
  <dialog
    ref="dialog"
    class="modal-dialog"
    :aria-label="title"
    tabindex="-1"
    :style="sheetStyle"
    @cancel.prevent="close"
  >
    <header
      class="modal-dialog__header"
      @pointerdown="startDrag"
      @pointermove="moveDrag"
      @pointerup="endDrag"
      @pointercancel="cancelDrag"
    >
      <span class="modal-dialog__grabber" aria-hidden="true" />
      <h2>{{ title }}</h2>
      <button
        class="modal-dialog__close"
        type="button"
        aria-label="Dialog schließen"
        :disabled="busy"
        @click="close"
      >
        <AppIcon name="close" />
      </button>
    </header>
    <fieldset
      class="modal-dialog__content"
      :disabled="busy"
      @submit.capture="guardSubmission"
    >
      <slot />
    </fieldset>
  </dialog>
</template>

<style scoped>
.modal-dialog {
  width: min(calc(100% - 2rem), 34rem);
  max-height: calc(100dvh - 2rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  box-sizing: border-box;
  /* Content that reaches the edges (a sticky footer) reads these. */
  --dialog-padding: var(--space-5);
  --dialog-padding-bottom: var(--dialog-padding);
  margin: auto;
  padding: var(--dialog-padding) var(--dialog-padding)
    var(--dialog-padding-bottom);
  border: 0;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: var(--shadow-dialog);
}
.modal-dialog::backdrop {
  background: var(--color-scrim);
}
.modal-dialog__header {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}
.modal-dialog__grabber {
  display: none;
}
.modal-dialog h2 {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.3;
}
.modal-dialog__close {
  display: grid;
  flex: 0 0 var(--tap);
  height: var(--tap);
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--color-action-tint);
  color: var(--color-ink-muted);
  cursor: pointer;
}
.modal-dialog__close:disabled {
  color: var(--color-ink-soft);
  cursor: progress;
}
.modal-dialog__content {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
/* One control language for every dialog body: tinted secondary, solid primary. */
.modal-dialog__content :deep(button) {
  min-height: var(--tap);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-action-tint);
  color: var(--color-action-strong);
  font-weight: 700;
  cursor: pointer;
}
.modal-dialog__content :deep(button[type="submit"]),
.modal-dialog__content :deep(button[data-primary]) {
  background: var(--color-action);
  color: var(--color-on-action);
}
.modal-dialog__content :deep(button:disabled) {
  background: var(--color-ground);
  color: var(--color-ink-soft);
  cursor: not-allowed;
}
/* A combobox styles its own field: it leaves room for a mark and its toggle. */
.modal-dialog__content
  :deep(input:not([type="checkbox"]):not([type="radio"]):not(.combo__input)),
.modal-dialog__content :deep(select),
.modal-dialog__content :deep(textarea) {
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border: 1.5px solid var(--color-line-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
}
.modal-dialog__content :deep(textarea) {
  padding: var(--space-2) var(--space-3);
}
@media (max-width: 32rem) {
  .modal-dialog {
    --dialog-padding: var(--space-4);
  }
}
/*
 * A phone: a sheet on the bottom edge, as wide as the window, never taller
 * than what the keyboard leaves visible, and lifted above a keyboard that
 * overlays the page. The header sticks while the content scrolls, so the
 * title, the grabber and the close button stay in reach.
 */
@media (max-width: 39.99rem) {
  .modal-dialog {
    --dialog-padding-bottom: calc(
      var(--dialog-padding) + env(safe-area-inset-bottom, 0px)
    );
    bottom: var(--sheet-keyboard, 0px);
    width: 100%;
    max-width: 100%;
    max-height: calc(
      var(--sheet-viewport-height, 100dvh) -
        max(var(--space-6), env(safe-area-inset-top, 0px) + var(--space-3))
    );
    margin: auto 0 0;
    padding-top: 0;
    border-radius: var(--radius-card) var(--radius-card) 0 0;
    transition: transform 240ms var(--ease-out);
  }
  .modal-dialog__header {
    position: sticky;
    top: 0;
    z-index: 3;
    margin: 0 calc(-1 * var(--dialog-padding)) var(--space-3);
    padding: var(--space-5) var(--dialog-padding) var(--space-2);
    background: var(--color-surface);
    cursor: grab;
    /* The drag is the sheet's; the page must not scroll or refresh. */
    touch-action: none;
  }
  .modal-dialog__grabber {
    position: absolute;
    top: var(--space-2);
    left: 50%;
    display: block;
    width: 2.5rem;
    height: 0.3125rem;
    border-radius: var(--radius-pill);
    background: var(--color-line-strong);
    translate: -50% 0;
  }
}
@media (max-width: 39.99rem) and (prefers-reduced-motion: no-preference) {
  .modal-dialog[open] {
    animation: sheet-in 280ms var(--ease-out);
  }
}
@keyframes sheet-in {
  from {
    transform: translateY(2.5rem);
    opacity: 0;
  }
}
</style>
