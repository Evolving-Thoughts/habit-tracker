<script setup lang="ts">
import { computed, onBeforeUnmount } from "vue";
import { useDictationAvailable } from "../composables/useDictation";
import { useMediaQuery, WIDE_QUERY } from "../composables/useMediaQuery";
import { useScrollDirection } from "../composables/useScrollDirection";

/**
 * The plus button. On a phone it floats above the stopwatch bar and the tab
 * bar, steps aside while the page scrolls down (so it never covers the row
 * one is reading) and comes back on the first scroll up. Keyboard focus
 * always shows it. From 56rem or with a mouse it is docked beside the page
 * column and stays. Heute leaves it out beside its day calendar (from
 * 64rem), where it would cover the rows' ▶: "Neue Quest" in its head
 * opens the same dialog there.
 *
 * Held for half a second (finger or mouse), it asks for a new quest by
 * voice instead (`dictate`, docs/voice-input.md), with a short buzz; moving
 * more than 10px or letting go earlier keeps it a normal tap. Only while a
 * microphone is available on this device.
 */
const props = defineProps<{ label: string; disabled?: boolean }>();
const emit = defineEmits<{ click: []; dictate: [] }>();

const direction = useScrollDirection();
const wide = useMediaQuery(WIDE_QUERY);
const hidden = computed(() => !wide.value && direction.value === "down");
const voice = useDictationAvailable();

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 10;
let timer: ReturnType<typeof setTimeout> | undefined;
let origin: { x: number; y: number } | null = null;
/** The press became a long one: the click that follows is not a tap. */
let longPressed = false;

function release(): void {
  clearTimeout(timer);
  timer = undefined;
  origin = null;
}
function onPointerDown(event: PointerEvent): void {
  longPressed = false;
  if (props.disabled || !voice.value || event.button !== 0) return;
  release();
  origin = { x: event.clientX, y: event.clientY };
  timer = setTimeout(() => {
    release();
    longPressed = true;
    navigator.vibrate?.(10);
    emit("dictate");
  }, LONG_PRESS_MS);
}
function onPointerMove(event: PointerEvent): void {
  if (!origin) return;
  const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
  if (moved > MOVE_TOLERANCE_PX) release();
}
function onClick(event: MouseEvent): void {
  const held = longPressed;
  longPressed = false;
  // A pointer's click after the long press; Enter and Space always tap.
  if (held && event.detail !== 0) return;
  emit("click");
}
onBeforeUnmount(release);
</script>
<template>
  <button
    class="create-button"
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
    :data-hidden="hidden || undefined"
    v-bind="voice ? { 'aria-description': 'Lange drücken zum Diktieren' } : {}"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="release"
    @pointercancel="release"
    @pointerleave="release"
    @contextmenu="voice && $event.preventDefault()"
    @click="onClick"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  </button>
</template>
<style scoped>
.create-button {
  position: fixed;
  right: calc(1rem + env(safe-area-inset-right, 0px));
  /* Above the tab bar and, while one runs, the stopwatch bar docked on it. */
  bottom: calc(
    var(--tab-bar-height) + var(--timer-bar-height, 0px) + var(--fab-offset) +
      env(safe-area-inset-bottom, 0px)
  );
  z-index: 20;
  display: grid;
  width: var(--fab-size);
  height: var(--fab-size);
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 1.125rem;
  background: var(--color-action);
  color: var(--color-on-action);
  box-shadow: var(--shadow-fab);
  cursor: pointer;
  /* Held for dictation: no text selection or callout on a long press. */
  user-select: none;
  -webkit-touch-callout: none;
  transition:
    transform 420ms var(--spring),
    opacity 200ms var(--ease-out),
    bottom 240ms var(--ease-out);
}
.create-button svg {
  display: block;
  width: 1.5rem;
  height: 1.5rem;
}
.create-button:hover:not(:disabled) {
  background: var(--color-action-strong);
}
.create-button:active:not(:disabled) {
  transform: var(--press);
}
.create-button:disabled {
  background: var(--color-ink-soft);
  cursor: not-allowed;
}
.create-button:focus-visible {
  outline: 3px solid var(--color-action-strong);
  outline-offset: 3px;
}
/* Stepped aside while the page scrolls down; focus brings it back. */
.create-button[data-hidden]:not(:focus-visible) {
  transform: translateY(1.5rem) scale(0.6);
  opacity: 0;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .create-button[data-hidden]:not(:focus-visible) {
    transform: none;
  }
}
@media (min-width: 56rem), (hover: hover) and (pointer: fine) {
  /* Docked beside the page column instead of drifting to the window edge. */
  .create-button {
    right: max(1rem, calc(50vw - (var(--page-width) / 2) - 4.5rem));
    bottom: calc(1.5rem + env(safe-area-inset-bottom, 0px));
  }
}
</style>
