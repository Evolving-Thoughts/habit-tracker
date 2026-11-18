<script setup lang="ts">
import { computed } from "vue";
import { isMac } from "../composables/useShortcuts";
import { keyCaps, type Shortcut } from "../utils/shortcuts";

/** The keys of a shortcut as key caps, e.g. "Strg" "K". */
const props = defineProps<{ shortcut: Shortcut }>();
const caps = computed(() => keyCaps(props.shortcut, isMac));
</script>

<template>
  <span class="key-combo">
    <kbd v-for="cap in caps" :key="cap" class="kbd">{{ cap }}</kbd>
  </span>
</template>

<style scoped>
.key-combo {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
}
</style>
