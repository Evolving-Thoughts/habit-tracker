<script setup lang="ts">
import { computed } from "vue";
import type { TextRange } from "../types/search";
import { highlightParts } from "../utils/search-entries";

/** A found text with the match in `<mark>`; every part stays plain text. */
const props = defineProps<{ text: string; range: TextRange | null }>();
const parts = computed(() => highlightParts(props.text, props.range));
</script>

<template>
  {{ parts.before
  }}<mark v-if="parts.match" class="search-highlight">{{ parts.match }}</mark
  >{{ parts.after }}
</template>

<style scoped>
.search-highlight {
  border-radius: 0.1875rem;
  background: var(--color-selection);
  color: inherit;
}
</style>
