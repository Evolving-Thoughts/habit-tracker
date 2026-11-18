<script setup lang="ts">
import KeyCombo from "./KeyCombo.vue";
import { singleKeys } from "../composables/useShortcuts";
import {
  GROUP_HINTS,
  groupedShortcuts,
  isSingleKey,
  type Shortcut,
} from "../utils/shortcuts";

/** Every shortcut by group, straight from the registry. */
const groups = groupedShortcuts();
const off = (shortcut: Shortcut) => isSingleKey(shortcut) && !singleKeys.value;
</script>

<template>
  <div class="shortcut-list">
    <section
      v-for="{ group, shortcuts } in groups"
      :key="group"
      class="shortcut-list__group"
    >
      <h3 class="shortcut-list__title">{{ group }}</h3>
      <p v-if="GROUP_HINTS[group]" class="shortcut-list__hint">
        {{ GROUP_HINTS[group] }}
      </p>
      <dl class="shortcut-list__items">
        <div
          v-for="shortcut in shortcuts"
          :key="shortcut.id"
          class="shortcut-list__item"
          :class="{ 'shortcut-list__item--off': off(shortcut) }"
        >
          <dt>
            {{ shortcut.label
            }}<span v-if="off(shortcut)" class="visually-hidden">
              (ausgeschaltet)</span
            >
          </dt>
          <dd><KeyCombo :shortcut="shortcut" /></dd>
        </div>
      </dl>
    </section>
  </div>
</template>

<style scoped>
.shortcut-list {
  display: grid;
  gap: var(--space-5);
}

.shortcut-list__title {
  margin: 0 0 var(--space-2);
  font-size: 1rem;
  font-weight: 800;
}

.shortcut-list__hint {
  max-width: 60ch;
  margin: calc(var(--space-1) * -1) 0 var(--space-2);
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.shortcut-list__items {
  display: grid;
  margin: 0;
}

/* One line per shortcut, divided by hairlines like the other list cards. */
.shortcut-list__item {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap);
  padding: var(--space-1) 0;
}

.shortcut-list__item + .shortcut-list__item {
  border-top: 1px solid var(--color-line);
}

.shortcut-list__item dt {
  min-width: 0;
}

.shortcut-list__item dd {
  flex: none;
  margin: 0;
}

/* Switched off: still listed, so the switch says what it controls. */
.shortcut-list__item--off {
  color: var(--color-ink-soft);
}

.shortcut-list__item--off :deep(.kbd) {
  opacity: 0.6;
}
</style>
