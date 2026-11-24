<script setup lang="ts">
import { isCampaignIcon } from "../utils/campaign-style";
import type { QuestParseKind, QuestParseMatch } from "../utils/quest-parse";
import AppIcon from "./AppIcon.vue";

/**
 * What `parseQuest` read out of a typed or dictated quest, as small chips
 * under the field (docs/voice-input.md): a symbol and the words ("morgen",
 * "30 Min."), never colour alone. A campaign shows its own symbol and a
 * category its mark, both with the kind in words ("Kampagne: Buch
 * schreiben", "Kategorie: Sport"). A tap on a chip discards it: its words
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
  campaign: "Kampagne",
  category: "Kategorie",
};

/** Day and duration speak for themselves; a name says what it names. */
const named = (match: QuestParseMatch) =>
  match.kind === "campaign" || match.kind === "category";
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
        <AppIcon v-if="match.kind === 'date'" name="calendar" />
        <AppIcon v-else-if="match.kind === 'duration'" name="timer" />
        <AppIcon
          v-else-if="match.kind === 'campaign'"
          :name="isCampaignIcon(match.icon) ? match.icon : 'campaigns'"
        />
        <span
          v-else
          class="parse-chip__mark"
          :style="match.mark ? { '--mark': match.mark } : undefined"
          aria-hidden="true"
        ></span>
        <span class="parse-chip__label"
          ><span v-if="moves && match.kind === 'date'" aria-hidden="true"
            >→
          </span
          ><template v-if="named(match)">{{ KIND_NAME[match.kind] }}: </template
          >{{ match.label }}</span
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
.parse-chips > li {
  min-width: 0;
  max-width: 100%;
}

.parse-chips .parse-chip {
  display: inline-flex;
  max-width: 100%;
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

/* A long campaign name ends with an ellipsis; the chip keeps its ✕. */
.parse-chip__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parse-chips .parse-chip :deep(.app-icon),
.parse-chip__mark {
  flex: none;
}

/* A category's mark: the small square it carries everywhere. */
.parse-chip__mark {
  width: 0.625rem;
  height: 0.625rem;
  margin-inline: 0.1875rem;
  border-radius: 0.2rem;
  background: var(--mark, var(--color-ink-muted));
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
