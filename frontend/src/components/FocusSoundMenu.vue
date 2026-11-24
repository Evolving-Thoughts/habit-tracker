<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import AppIcon from "./AppIcon.vue";
import SoundChoices from "./SoundChoices.vue";
import type { FocusSound } from "../composables/useFocusSound";
import { singleKeys, useKeyboardLikely } from "../composables/useShortcuts";

/**
 * The Fokus-Klang in the Fokus-Modus' bar: a button that names the state
 * (icon shape and words: the sound's title while it plays, "Klang"
 * otherwise) and opens a small panel with the choice and the volume. The
 * panel is no modal: Escape or a tap beside it closes it.
 */
const props = defineProps<{ sound: FocusSound }>();

const id = useId();
const panelId = `focus-sound-${id}`;
const volumeId = `focus-sound-volume-${id}`;
const open = ref(false);
const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const keyboardLikely = useKeyboardLikely();

const state = computed(() => props.sound.state.value);
const title = computed(() => props.sound.sound.value?.title ?? null);
const icon = computed(() =>
  state.value === "playing"
    ? "speaker"
    : state.value === "paused"
      ? "speaker-idle"
      : "speaker-off",
);
const text = computed(() =>
  state.value === "playing" && title.value ? title.value : "Klang",
);
const label = computed(() => {
  if (state.value === "off") return "Klang: aus";
  const name = title.value ?? "gewählt";
  return `Klang: ${name}, ${state.value === "playing" ? "spielt" : "pausiert"}`;
});
const percent = computed(() => Math.round(props.sound.volume.value * 100));

function close(restoreFocus = true): void {
  if (!open.value) return;
  open.value = false;
  if (restoreFocus) trigger.value?.focus();
}

async function toggle(): Promise<void> {
  if (open.value) return close();
  open.value = true;
  await nextTick();
  root.value
    ?.querySelector<HTMLInputElement>(".focus-sound__panel input:checked")
    ?.focus();
}

/* Escape closes the panel here, before the Fokus-Modus takes it as "back". */
function onKeydown(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !open.value) return;
  event.preventDefault();
  close();
}

/*
 * A finished tap beside the panel closes it, not the first touch: a touch on
 * a line that a device reports elsewhere must not take the panel away before
 * the line is chosen.
 */
function onOutsideClick(event: MouseEvent): void {
  if (root.value && !event.composedPath().includes(root.value)) close(false);
}

function onFocusOut(event: FocusEvent): void {
  const next = event.relatedTarget as Node | null;
  if (next && !root.value?.contains(next)) close(false);
}

watch(open, (isOpen) => {
  if (isOpen) document.addEventListener("click", onOutsideClick, true);
  else document.removeEventListener("click", onOutsideClick, true);
});
onBeforeUnmount(() =>
  document.removeEventListener("click", onOutsideClick, true),
);

function onVolume(event: Event): void {
  props.sound.setVolume(Number((event.target as HTMLInputElement).value) / 100);
}
</script>

<template>
  <div
    ref="root"
    class="focus-sound"
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <button
      ref="trigger"
      type="button"
      class="btn btn--quiet focus-sound__trigger"
      :class="{ 'focus-sound__trigger--playing': state === 'playing' }"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="label"
      :data-sound-state="state"
      @click="toggle"
    >
      <AppIcon :name="icon" />
      <span class="focus-sound__text">{{ text }}</span>
    </button>
    <div
      v-if="open"
      :id="panelId"
      class="focus-sound__panel"
      role="group"
      aria-label="Fokus-Klang"
    >
      <SoundChoices
        label="Klang im Fokus-Modus"
        :music="sound.music.value"
        :ambience="sound.ambience.value"
        :model-value="sound.soundId.value"
        @update:model-value="sound.choose"
      />
      <div class="focus-sound__volume">
        <label :for="volumeId">Lautstärke</label>
        <input
          :id="volumeId"
          type="range"
          min="0"
          max="100"
          step="5"
          :value="percent"
          :aria-valuetext="`${percent} %`"
          @input="onVolume"
        />
      </div>
      <p v-if="sound.note.value" class="focus-sound__note" role="status">
        {{ sound.note.value }}
      </p>
      <p class="focus-sound__hint">
        Spielt, solange die Stoppuhr hier läuft.
        <template v-if="keyboardLikely && singleKeys">
          M schaltet ihn an und aus.
        </template>
      </p>
    </div>
  </div>
</template>

<style scoped>
.focus-sound {
  position: relative;
  min-width: 0;
}

.focus-sound__trigger {
  max-width: 100%;
  padding: 0 var(--space-3);
  color: var(--color-ink-muted);
}

.focus-sound__trigger[aria-expanded="true"],
.focus-sound__trigger--playing {
  color: var(--color-action-strong);
}

.focus-sound__trigger[aria-expanded="true"] {
  background: var(--color-action-tint);
}

.focus-sound__text {
  overflow: hidden;
  max-width: 10rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-sound__panel {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  z-index: 30;
  display: grid;
  gap: var(--space-3);
  width: min(20rem, calc(100vw - 2rem));
  max-height: calc(100dvh - 5rem);
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: var(--space-3);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  box-shadow: var(--shadow-popover);
  text-align: left;
}

.focus-sound__volume {
  display: grid;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
}

.focus-sound__volume input {
  width: 100%;
  min-height: var(--tap);
  margin: 0;
}

.focus-sound__note {
  margin: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  color: var(--color-ink);
  font-size: 0.875rem;
}

.focus-sound__hint {
  margin: 0;
  padding: 0 var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  text-wrap: pretty;
}
</style>
