<script setup lang="ts">
import { computed } from "vue";
import { useFocusBlock } from "../composables/useFocusBlock";
import type { FocusSetupIssue } from "../utils/focus-block";

/**
 * What keeps the Fokus-Sperre from blocking, with the step that fixes it
 * (`setupIssues` of `useFocusBlock`): an empty Sperrliste, the phone's
 * accessibility service switched off, no VPN consent. One component for
 * every place a block starts or is set: the stopwatch bar (`bar`: only the
 * phone's permissions, one line), the Fokus-Modus (`focus`: only the
 * phone's permissions, compact and centred below its buttons, read where
 * it stands instead of announced on every open; the empty list is its own
 * quiet line there) and Einstellungen (`settings`, without the link to
 * itself). Nothing to fix, nothing shown.
 */
const props = defineProps<{ where: "bar" | "focus" | "settings" }>();
const focus = useFocusBlock();

const issues = computed<FocusSetupIssue[]>(() => {
  const all = focus?.setupIssues.value ?? [];
  return props.where === "settings"
    ? all
    : all.filter((issue) => issue !== "empty");
});
const TEXT: Record<FocusSetupIssue, string> = {
  empty: "Die Sperrliste ist leer, also wird nichts gesperrt.",
  accessibility:
    "Apps sperrt sie erst, wenn die Bedienungshilfe „Fokus-Sperre“ an ist.",
  vpn: "Websites sperrt sie erst, wenn du das VPN erlaubst.",
};
</script>

<template>
  <div
    v-if="issues.length"
    class="focus-setup"
    :class="`focus-setup--${where}`"
    :role="where === 'focus' ? undefined : 'status'"
    data-test="focus-setup"
  >
    <p>
      <template v-if="where === 'focus'">Fokus-Sperre wirkt noch nicht.</template>
      <strong v-else>{{
        where === "bar"
          ? "Fokus-Sperre wirkt noch nicht."
          : "Die Fokus-Sperre wirkt so noch nicht."
      }}</strong>
      <template v-if="where !== 'bar'">
        <span v-for="issue in issues" :key="issue">{{ " " + TEXT[issue] }}</span>
      </template>
    </p>
    <div class="focus-setup__actions">
      <button
        v-if="issues.includes('accessibility')"
        class="btn btn--ground"
        type="button"
        data-test="focus-setup-accessibility"
        @click="focus?.openAccessibilitySettings()"
      >
        Bedienungshilfe einschalten
      </button>
      <button
        v-if="issues.includes('vpn')"
        class="btn btn--ground"
        type="button"
        data-test="focus-setup-vpn"
        @click="focus?.allowVpn()"
      >
        VPN erlauben
      </button>
    </div>
  </div>
</template>

<style scoped>
/* The calm surface of a hint in Apricot-Grund, as for blocked notifications. */
.focus-setup {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-control);
  background: var(--color-ground);
  color: var(--color-ink);
  text-align: start;
}

.focus-setup p {
  margin: 0;
  max-width: 65ch;
  text-wrap: pretty;
}

.focus-setup__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.focus-setup__actions:empty {
  display: none;
}

/* In the Fokus-Modus: a quiet centred note on the ground, its buttons below. */
.focus-setup--focus {
  justify-items: center;
  padding: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  text-align: center;
}

.focus-setup--focus p {
  max-width: 34ch;
}

.focus-setup--focus .focus-setup__actions {
  justify-content: center;
}

/* In the stopwatch bar: one short line, its buttons beside it when they fit. */
.focus-setup--bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-1) var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-1) var(--space-1) var(--space-1) var(--space-3);
  font-size: 0.875rem;
}
</style>
