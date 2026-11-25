<script setup lang="ts">
import { useInsertPlace } from "../composables/useInsertPlace";
import AppIcon from "./AppIcon.vue";

/**
 * Where a new quest from a quick add joins its list: ↑ ("Oben einfügen") or
 * ↓ ("Unten einfügen"). One choice per device for every quick add; Heute and
 * the Questlog show it beside their field, the Plan once in its head.
 */
const { place, choose } = useInsertPlace();
</script>

<template>
  <!-- Two small toggles, named in words. -->
  <div class="segmented insert-place" role="group" aria-label="Neue Quests einfügen">
    <button
      type="button"
      aria-label="Oben einfügen"
      title="Oben einfügen"
      :aria-pressed="place === 'top'"
      @click="choose('top')"
    >
      <AppIcon name="arrow-up" />
    </button>
    <button
      type="button"
      aria-label="Unten einfügen"
      title="Unten einfügen"
      :aria-pressed="place === 'bottom'"
      @click="choose('bottom')"
    >
      <AppIcon name="arrow-down" />
    </button>
  </div>
</template>

<style scoped>
/* Compact beside a field, so the field keeps most of the width. */
.insert-place {
  flex: none;
  gap: 0.125rem;
  padding: 0.1875rem;
}

.insert-place > button {
  display: grid;
  place-items: center;
  width: 2rem;
  min-height: calc(var(--tap) - 0.375rem);
  padding: 0;
}

.insert-place :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
}

/* A finger gets a full tap per arrow; a mouse keeps the slim pair. */
@media (pointer: coarse) {
  .insert-place {
    padding: 0.125rem;
  }

  .insert-place > button {
    width: var(--tap);
    min-height: var(--tap);
  }
}
</style>
