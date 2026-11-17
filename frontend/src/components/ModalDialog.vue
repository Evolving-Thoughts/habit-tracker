<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import AppIcon from "./AppIcon.vue";

const props = withDefaults(
  defineProps<{
    title: string;
    busy?: boolean;
    focusSelector?: string;
    returnFocus?: () => HTMLElement | null;
  }>(),
  {
    busy: false,
    focusSelector: 'input[name="title"], [data-test="choose-todo"]',
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
onMounted(async () => {
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
onBeforeUnmount(() => observer?.disconnect());
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
    @cancel.prevent="close"
  >
    <header class="modal-dialog__header">
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
  margin: auto;
  padding: var(--space-5);
  border: 0;
  border-radius: var(--radius-card);
  background: var(--color-surface);
  color: var(--color-ink);
  box-shadow: 0 12px 40px rgb(43 29 22 / 22%);
}
.modal-dialog::backdrop {
  background: rgb(43 29 22 / 40%);
}
.modal-dialog__header {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-4);
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
.modal-dialog__content :deep(input:not([type="checkbox"]):not([type="radio"])),
.modal-dialog__content :deep(select),
.modal-dialog__content :deep(textarea) {
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border: 1.5px solid var(--color-line);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
}
.modal-dialog__content :deep(textarea) {
  padding: var(--space-2) var(--space-3);
}
@media (max-width: 32rem) {
  .modal-dialog {
    padding: var(--space-4);
  }
}
</style>
