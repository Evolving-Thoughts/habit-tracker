<script setup lang="ts">
import { useId } from "vue";
import type { Sound } from "../types/sound";

/**
 * The choice of a Fokus-Klang: "Aus", then Musik and Geräusche. Native
 * radios under one name, so the arrow keys move through all of them; the
 * chosen one shows its filled circle and bold text, never colour alone.
 * Shared by the Fokus-Modus and Einstellungen.
 */
defineProps<{
  music: readonly Sound[];
  ambience: readonly Sound[];
  modelValue: string | null;
  /** The legend of the whole choice. */
  label: string;
}>();
const emit = defineEmits<{ "update:modelValue": [id: string | null] }>();
const name = `sound-${useId()}`;

/*
 * A tap anywhere on a line chooses it, the words included. The label's own
 * activation is not relied on: on some touch devices a tap on the text never
 * reached the radio, so the line picks itself and moves the focus there.
 */
/** A press on the words must not move the focus away from the choice. */
function keepFocus(event: MouseEvent): void {
  if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
}

function pick(event: MouseEvent, id: string | null): void {
  const target = event.target as HTMLElement;
  if (target instanceof HTMLInputElement) return;
  event.preventDefault();
  const input = (event.currentTarget as HTMLElement).querySelector("input");
  input?.focus();
  emit("update:modelValue", id);
}
</script>

<template>
  <fieldset class="sound-choices">
    <legend class="sound-choices__legend">{{ label }}</legend>
    <label
      class="sound-choices__option"
      @mousedown="keepFocus"
      @click="pick($event, null)"
    >
      <input
        type="radio"
        :name="name"
        value=""
        :checked="modelValue === null"
        @change="emit('update:modelValue', null)"
      />
      Aus
    </label>
    <template
      v-for="group in [
        { title: 'Musik', sounds: music },
        { title: 'Geräusche', sounds: ambience },
      ]"
      :key="group.title"
    >
      <fieldset v-if="group.sounds.length" class="sound-choices__group">
        <legend class="sound-choices__heading">{{ group.title }}</legend>
        <label
          v-for="sound in group.sounds"
          :key="sound.id"
          class="sound-choices__option"
          @mousedown="keepFocus"
          @click="pick($event, sound.id)"
        >
          <input
            type="radio"
            :name="name"
            :value="sound.id"
            :checked="modelValue === sound.id"
            @change="emit('update:modelValue', sound.id)"
          />
          {{ sound.title }}
        </label>
      </fieldset>
    </template>
  </fieldset>
</template>

<style scoped>
.sound-choices,
.sound-choices__group {
  display: grid;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.sound-choices__legend {
  padding: 0;
  margin-bottom: var(--space-1);
  color: var(--color-ink);
  font-size: 0.875rem;
  font-weight: 800;
}

.sound-choices__group {
  margin-top: var(--space-2);
}

.sound-choices__heading {
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.8125rem;
  font-weight: 700;
}

.sound-choices__option {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-2);
  border-radius: var(--radius-control);
  color: var(--color-ink);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.sound-choices__option:hover {
  background: var(--color-action-tint);
}

.sound-choices__option > input {
  width: 1.125rem;
  height: 1.125rem;
  margin: 0;
  flex: none;
}

.sound-choices__option:has(input:checked) {
  font-weight: 800;
}
</style>
