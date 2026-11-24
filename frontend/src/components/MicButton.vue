<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import {
  useDictation,
  type DictationMode,
  type DictationState,
} from "../composables/useDictation";
import AppIcon from "./AppIcon.vue";

/**
 * The microphone next to a field (docs/voice-input.md). A tap starts, a tap
 * while listening stops, Escape discards. The state always shows as symbol
 * and word ("Hört zu …", "Wird erkannt …", "Lade Sprachmodell … 42 %"),
 * never by colour alone, and is announced. Before the first download of the
 * browser's model it asks; without the phone's offline pack it explains how
 * to get it. Without any way to recognise speech on this device, or with
 * Spracheingabe off, it renders nothing.
 */
const props = withDefaults(
  defineProps<{
    /** "long" for notes and reflections: runs until stopped. */
    mode?: DictationMode;
    /** The accessible name, e.g. "Titel diktieren". */
    label?: string;
    /**
     * "field": inside the right edge (top corner) of a field wrapped in
     * `.mic-field` (style.css), which then keeps its text clear of it.
     */
    placement?: "inline" | "field";
  }>(),
  { mode: "short", label: "Diktieren", placement: "inline" },
);
const emit = defineEmits<{
  /** The recognised text, trimmed and not empty. */
  result: [text: string];
  /** What was heard so far (the phone's recogniser only). */
  partial: [text: string];
  state: [state: DictationState];
}>();

const dictation = useDictation({
  mode: props.mode,
  onResult: (text) => emit("result", text),
  onPartial: (text) => emit("partial", text),
});
const { state, error, available, download, progress, setup, setupNote } =
  dictation;
watch(state, (value) => emit("state", value));

const listening = computed(() => state.value === "listening");
const busy = computed(
  () => state.value === "processing" || state.value === "downloading",
);
const percent = computed(() => Math.round(progress.value * 100));
const word = computed(() => {
  switch (state.value) {
    case "starting":
      return "Mikrofon …";
    case "listening":
      return "Hört zu …";
    case "processing":
      return "Wird erkannt …";
    case "downloading":
      return `Lade Sprachmodell … ${percent.value} %`;
    default:
      return "";
  }
});
/** Read out once per change; the bubbles have their own roles. */
const announcement = computed(() => {
  switch (state.value) {
    case "starting":
      return "Mikrofon wird geöffnet.";
    case "listening":
      return "Hört zu. Zum Beenden noch einmal tippen, Escape verwirft.";
    case "processing":
      return "Wird erkannt.";
    case "downloading":
      return "Sprachmodell wird geladen.";
    default:
      return "";
  }
});
const shown = computed(() => available.value || state.value !== "idle");

const primary = ref<HTMLButtonElement | null>(null);
// The question and the hint take the focus, so a keyboard can answer at once.
watch(state, async (value) => {
  if (value !== "confirming" && value !== "setup") return;
  await nextTick();
  primary.value?.focus();
});

/** For a caller that starts dictation itself (long press on Plus). */
defineExpose({
  start: () => {
    dictation.dismiss();
    return dictation.start();
  },
  stop: dictation.stop,
  cancel: dictation.cancel,
  available,
});
</script>

<template>
  <span
    v-if="shown"
    class="mic"
    :class="{ 'mic--field': placement === 'field' }"
    :data-state="state"
  >
    <button
      type="button"
      class="mic__button"
      :class="{ 'mic__button--word': word }"
      :aria-pressed="listening"
      :aria-busy="busy || undefined"
      @click="dictation.toggle()"
    >
      <AppIcon :name="listening ? 'stop' : 'mic'" />
      <span class="visually-hidden">{{ label }}</span>
      <span v-if="word" class="mic__word" aria-hidden="true">{{ word }}</span>
    </button>
    <span class="visually-hidden" role="status">{{ announcement }}</span>

    <span
      v-if="state === 'confirming' && download"
      class="mic__bubble"
      role="group"
      aria-label="Sprachmodell laden"
    >
      <span class="mic__text">
        Die Spracherkennung läuft auf diesem Gerät. Dafür einmalig ~{{
          download.megabytes
        }}&nbsp;MB laden, danach geht es offline. Die Aufnahme verlässt das
        Gerät nie.
      </span>
      <span class="mic__actions">
        <button
          ref="primary"
          type="button"
          class="btn btn--primary"
          data-primary
          @click="dictation.confirmDownload()"
        >
          Laden
        </button>
        <button
          type="button"
          class="btn btn--quiet"
          @click="dictation.cancel()"
        >
          Abbrechen
        </button>
      </span>
    </span>

    <span
      v-else-if="state === 'setup' && setup"
      class="mic__bubble"
      role="group"
      aria-label="Spracherkennung einrichten"
    >
      <span class="mic__text">{{ setup.message }}</span>
      <ol class="mic__steps">
        <li v-for="step in setup.steps" :key="step">{{ step }}</li>
      </ol>
      <span v-if="setupNote" class="mic__text" role="status">{{
        setupNote
      }}</span>
      <span class="mic__actions">
        <button
          v-if="setup.action"
          ref="primary"
          type="button"
          class="btn btn--primary"
          data-primary
          @click="dictation.runSetupAction()"
        >
          {{ setup.action.label }}
        </button>
        <button
          :ref="setup.action ? undefined : 'primary'"
          type="button"
          class="btn btn--quiet"
          @click="dictation.dismiss()"
        >
          Schließen
        </button>
      </span>
    </span>

    <span
      v-else-if="state === 'error' && error"
      class="mic__bubble mic__bubble--row"
      role="alert"
    >
      <span class="mic__text">{{ error }}</span>
      <button
        type="button"
        class="mic__dismiss"
        aria-label="Hinweis schließen"
        @click="dictation.dismiss()"
      >
        <AppIcon name="close" />
      </button>
    </span>
  </span>
</template>

<style scoped>
.mic {
  position: relative;
  display: inline-flex;
  flex: none;
}

.mic .mic__button {
  position: relative;
  display: inline-flex;
  gap: var(--space-2);
  align-items: center;
  justify-content: center;
  min-width: var(--tap);
  min-height: var(--tap);
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-ink-muted);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  line-height: 1.2;
  white-space: nowrap;
  cursor: pointer;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out),
    color 160ms var(--ease-out);
}

/*
 * The selectors name `.mic` first: a dialog styles every button in it, and
 * the microphone keeps its own look there.
 *
 * Inside a field: 2px in from its border, so the hover tint never covers
 * the frame; an invisible rim keeps the full tap size.
 */
.mic--field {
  position: absolute;
  top: 2px;
  right: 2px;
}

.mic.mic--field .mic__button {
  min-width: calc(var(--tap) - 4px);
  min-height: calc(var(--tap) - 4px);
  border-radius: calc(var(--radius-control) - 2px);
}

.mic.mic--field .mic__button::before {
  position: absolute;
  inset: -2px;
  content: "";
}

.mic .mic__button :deep(.app-icon) {
  width: 1.25rem;
  height: 1.25rem;
}

.mic .mic__button:hover {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.mic .mic__button:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.mic .mic__button--word {
  padding: 0 var(--space-3) 0 var(--space-2);
}

/* Listening: tinted, a square to stop, the word, and a slow ring. */
.mic .mic__button[aria-pressed="true"] {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.mic .mic__button[aria-pressed="true"]::after {
  position: absolute;
  inset: 0;
  border: 2px solid currentcolor;
  border-radius: inherit;
  content: "";
  opacity: 0;
  animation: mic-ring 1.6s var(--ease-out) infinite;
  pointer-events: none;
}

.mic .mic__button[aria-busy="true"] {
  color: var(--color-ink-muted);
  cursor: progress;
}

.mic__word {
  font-variant-numeric: tabular-nums;
}

.mic__bubble {
  position: absolute;
  z-index: 5;
  top: calc(100% + var(--space-1));
  right: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  width: max-content;
  max-width: min(20rem, calc(100vw - 2 * var(--space-4)));
  padding: var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-surface-raised);
  box-shadow: var(--shadow-popover);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.4;
  text-wrap: pretty;
  white-space: normal;
}

.mic__bubble--row {
  flex-direction: row;
  align-items: flex-start;
  gap: var(--space-1);
  padding: var(--space-2) var(--space-1) var(--space-2) var(--space-3);
}

.mic__bubble--row > .mic__text {
  padding-top: var(--space-1);
}

.mic__steps {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding-left: 1.25rem;
  color: var(--color-ink-muted);
}

.mic__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  justify-content: flex-end;
}

.mic .mic__dismiss {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--tap);
  height: var(--tap);
  margin: calc(-1 * var(--space-2)) 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
}

.mic .mic__dismiss:hover {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.mic .mic__dismiss :deep(.app-icon) {
  width: 1.125rem;
  height: 1.125rem;
}

@keyframes mic-ring {
  0% {
    opacity: 0.45;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.25);
  }
}

@media (prefers-reduced-motion: reduce) {
  .mic .mic__button[aria-pressed="true"]::after {
    animation: none;
    opacity: 0.35;
  }
}
</style>
