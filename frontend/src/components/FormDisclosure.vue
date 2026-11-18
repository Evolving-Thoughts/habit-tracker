<script setup lang="ts">
import { nextTick, ref, useId } from "vue";
import AppIcon from "./AppIcon.vue";

/**
 * Optional fields of a form behind one quiet button. It opens in place and
 * takes the focus to its first field. Whatever is set inside stays named on
 * the button while it is closed, and a group that already holds a value
 * starts open, so nothing set is ever hidden.
 */
const props = defineProps<{
  label: string;
  /** A quieter addition to the label, as in "Termin (feste Uhrzeit)". */
  detail?: string;
  /** What is set inside, in words; shown on the button while closed. */
  summary?: string;
  /** Opens at the start, because the entry already has a value here. */
  startOpen?: boolean;
}>();

const open = ref(props.startOpen ?? false);
const id = useId();
const panel = ref<HTMLElement | null>(null);
const FIRST_FIELD =
  "input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])";

async function toggle(): Promise<void> {
  open.value = !open.value;
  if (!open.value) return;
  await nextTick();
  panel.value?.querySelector<HTMLElement>(FIRST_FIELD)?.focus();
}
</script>

<template>
  <div class="form-disclosure" :class="{ 'form-disclosure--open': open }">
    <button
      :id="`${id}-toggle`"
      class="form-disclosure__toggle"
      type="button"
      :aria-expanded="open"
      :aria-controls="`${id}-panel`"
      @click="toggle"
    >
      <span class="form-disclosure__label"
        >{{ label
        }}<span v-if="detail" class="form-disclosure__detail">
          ({{ detail }})</span
        ></span
      ><!-- A space, so the name reads "Termin (feste Uhrzeit) 10:00 Uhr". -->{{
        " "
      }}<span v-if="summary && !open" class="form-disclosure__summary">{{
        summary
      }}</span>
      <AppIcon class="form-disclosure__chevron" name="chevron-down" />
    </button>
    <div
      v-show="open"
      :id="`${id}-panel`"
      ref="panel"
      class="form-disclosure__panel"
      role="group"
      :aria-labelledby="`${id}-toggle`"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
.form-disclosure {
  display: grid;
  gap: var(--space-3);
  border-top: 1px solid var(--color-line);
}

/*
 * A row, not a pill: the button reads as a heading over its fields. The
 * extra class wins over the dialog's tinted button style.
 */
.form-disclosure .form-disclosure__toggle {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  width: 100%;
  min-height: var(--tap);
  margin-top: var(--space-1);
  padding: 0 var(--space-2);
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink);
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  transition: background-color 160ms var(--ease-out);
}

.form-disclosure .form-disclosure__toggle:hover:not(:disabled) {
  background: var(--color-action-tint);
}

.form-disclosure .form-disclosure__toggle:disabled {
  background: transparent;
  color: var(--color-ink-soft);
  cursor: progress;
}

.form-disclosure__label {
  flex: 0 1 auto;
  min-width: 0;
}

.form-disclosure__detail {
  color: var(--color-ink-muted);
  font-weight: 600;
}

/* What is set, so a closed group never hides a value. */
.form-disclosure__summary {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-disclosure__chevron {
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
  margin-left: auto;
  color: var(--color-ink-muted);
  transform: rotate(-90deg);
  transition: transform 240ms var(--ease-out);
}

.form-disclosure__summary + .form-disclosure__chevron {
  margin-left: 0;
}

.form-disclosure--open .form-disclosure__chevron {
  transform: none;
}

.form-disclosure__panel {
  display: grid;
  gap: var(--space-4);
  padding-bottom: var(--space-2);
}
</style>
