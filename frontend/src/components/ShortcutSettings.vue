<script setup lang="ts">
import ShortcutList from "./ShortcutList.vue";
import { isMac, setSingleKeys, singleKeys } from "../composables/useShortcuts";

/**
 * The switch for single-key shortcuts (WCAG 2.1.4), stored on this device,
 * and the list of every shortcut below it.
 */
const modifier = isMac ? "⌘" : "Strg";
</script>

<template>
  <div class="shortcut-settings">
    <div class="shortcut-settings__row">
      <span id="shortcut-settings-label" class="shortcut-settings__label">
        Tastenkürzel
      </span>
      <button
        class="switch"
        type="button"
        role="switch"
        aria-labelledby="shortcut-settings-label"
        aria-describedby="shortcut-settings-text"
        :aria-checked="singleKeys"
        @click="setSingleKeys(!singleKeys)"
      >
        <span class="switch__track" aria-hidden="true">
          <span class="switch__thumb" />
        </span>
      </button>
    </div>
    <p id="shortcut-settings-text" class="shortcut-settings__text">
      Einzelne Tasten wie H, X oder ? lösen auf diesem Gerät Aktionen aus.
      {{ modifier }}+K und {{ modifier }}+Enter wirken immer.
    </p>
    <p class="visually-hidden" role="status">
      {{
        singleKeys
          ? "Einzelne Tasten sind eingeschaltet."
          : "Einzelne Tasten sind ausgeschaltet."
      }}
    </p>
    <ShortcutList class="shortcut-settings__list" />
  </div>
</template>

<style scoped>
.shortcut-settings {
  display: grid;
  gap: var(--space-2);
}

.shortcut-settings p {
  margin: 0;
}

.shortcut-settings__row {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
}

.shortcut-settings__label {
  font-weight: 700;
}

.shortcut-settings__text {
  max-width: 65ch;
  color: var(--color-ink-muted);
  text-wrap: pretty;
}

.shortcut-settings__list {
  margin-top: var(--space-4);
}
</style>
