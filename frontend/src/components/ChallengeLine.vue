<script setup lang="ts">
import { computed } from "vue";
import AppIcon from "./AppIcon.vue";

/**
 * The Monats-Challenge in the meta line of its run on Heute (row and focus
 * card): its icon and "Monats-Challenge · Tag 2 · noch 4" in words, in the
 * line's own muted ink. It breaks only between its parts, never inside
 * "Tag 2" or "noch 4". Never a colour of its own.
 */
const props = defineProps<{ line: string }>();
const parts = computed(() => props.line.split(" · "));
</script>

<template>
  <span class="challenge-line">
    <AppIcon name="challenge" />
    <template v-for="(part, index) in parts" :key="index"
      >{{ index ? " " : ""
      }}<span class="challenge-line__part">{{
        index < parts.length - 1 ? `${part} ·` : part
      }}</span></template
    >
  </span>
</template>

<style scoped>
.challenge-line {
  min-width: 0;
  font-weight: 700;
}

.challenge-line :deep(svg) {
  display: inline-block;
  width: 0.9375rem;
  height: 0.9375rem;
  margin-right: 0.25rem;
  vertical-align: -0.15em;
}

.challenge-line__part {
  white-space: nowrap;
}
</style>
