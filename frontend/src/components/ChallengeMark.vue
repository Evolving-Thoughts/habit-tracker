<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

/**
 * The small marker on the rows of the Daily that carries this month's
 * Monats-Challenge (Heute, Plan, Dailies, Fokus): its icon in the row's own
 * muted ink, named for screen readers and in the tooltip. Never a colour of
 * its own.
 */
</script>

<template>
  <span
    class="challenge-mark"
    role="img"
    aria-label="Monats-Challenge"
    title="Monats-Challenge"
  >
    <AppIcon name="challenge" />
  </span>
</template>

<style scoped>
.challenge-mark {
  display: inline-flex;
  flex: none;
  align-items: center;
  color: inherit;
}

.challenge-mark :deep(svg) {
  width: 0.9375rem;
  height: 0.9375rem;
}
</style>
