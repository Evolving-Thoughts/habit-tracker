<script setup lang="ts">
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";

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
async function focusContent(): Promise<void> {
  await nextTick();
  const target = dialog.value?.querySelector<HTMLElement>(props.focusSelector);
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
        <span aria-hidden="true">×</span>
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
  padding: 1.5rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #fff;
  color: #182033;
  box-shadow: 0 4px 24px rgb(15 23 42 / 15%);
}
.modal-dialog::backdrop {
  background: rgb(15 23 42 / 40%);
}
.modal-dialog__header {
  display: flex;
  gap: 1rem;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}
.modal-dialog h2 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.4;
}
.modal-dialog__close {
  flex: 0 0 2.75rem;
  height: 2.75rem;
  padding: 0;
  border: 0;
  border-radius: 0.5rem;
  background: #f2f4f8;
  color: #39445a;
  font-size: 1.75rem;
  cursor: pointer;
}
.modal-dialog__close:disabled {
  opacity: 0.5;
  cursor: wait;
}
.modal-dialog__close:focus-visible {
  outline: 3px solid rgb(53 103 220 / 30%);
  outline-offset: 2px;
}
.modal-dialog__content {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
@media (max-width: 32rem) {
  .modal-dialog {
    padding: 1rem;
  }
}
</style>
