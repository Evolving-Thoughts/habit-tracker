<script setup lang="ts">
import type { QuestParseKind, QuestParseMatch } from "../utils/quest-parse";
import AppIcon from "./AppIcon.vue";

/**
 * What `parseQuest` read out of a typed or dictated quest, as small chips
 * under the field (docs/voice-input.md): a symbol and the words ("morgen",
 * "30 Min."), never colour alone. A tap on a chip discards it: its words
 * then stay in the title and nothing is set from them.
 */
defineProps<{
  matches: readonly QuestParseMatch[];
  /** A recognised day takes the quest out of the Questlog: says so with →. */
  moves?: boolean;
}>();
const emit = defineEmits<{ remove: [kind: QuestParseKind] }>();

const KIND_NAME: Record<QuestParseKind, string> = {
  date: "Tag",
  duration: "Dauer",
};
</script>

<template>
  <ul v-if="matches.length" class="parse-chips" aria-label="Erkannt">
    <li v-for="match in matches" :key="match.kind">
      <button
        type="button"
        class="parse-chip"
        :data-kind="match.kind"
        :aria-label="`${KIND_NAME[match.kind]}: ${match.label}${
          moves && match.kind === 'date' ? ', plant sie ein statt ins Questlog' : ''
        }, entfernen`"
        @click="emit('remove', match.kind)"
      >
        <AppIcon :name="match.kind === 'date' ? 'calendar' : 'timer'" />
        <span class="parse-chip__label"
          ><span v-if="moves && match.kind === 'date'" aria-hidden="true"
            >→
          </span>{{ match.label }}</span
        >
        <AppIcon name="close" class="parse-chip__remove" />
      </button>
    </li>
  </ul>
</template>

<style scoped>
.parse-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * Quiet: a tinted pill in ink, smaller than a filter chip. Named through
 * `.parse-chips`, so a dialog's button style does not reach it.
 */
.parse-chips .parse-chip {
  display: inline-flex;
  gap: var(--space-1);
  align-items: center;
  min-height: 2rem;
  padding: 0 var(--space-1) 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-action-tint);
  color: var(--color-ink);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    transform 420ms var(--spring),
    background-color 160ms var(--ease-out);
}

.parse-chips .parse-chip :deep(.app-icon) {
  width: 1rem;
  height: 1rem;
  color: var(--color-action-strong);
}

.parse-chips .parse-chip :deep(.parse-chip__remove) {
  width: 0.875rem;
  height: 0.875rem;
  margin-inline-start: var(--space-1);
  color: var(--color-ink-muted);
}

.parse-chips .parse-chip:hover {
  background: var(--color-action-tint-hover);
}

.parse-chips .parse-chip:hover :deep(.parse-chip__remove) {
  color: var(--color-ink);
}

.parse-chips .parse-chip:active {
  transform: var(--press);
  transition-duration: 90ms;
}

/* A finger gets a full tap per chip. */
@media (pointer: coarse) {
  .parse-chips .parse-chip {
    min-height: var(--tap);
    padding: 0 var(--space-2) 0 var(--space-3);
  }
}
</style>
