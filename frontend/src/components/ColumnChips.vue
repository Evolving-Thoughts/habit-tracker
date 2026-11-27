<script setup lang="ts">
import { ref, watch } from "vue";

/**
 * The phone's strip above a board of snapping columns (the Plan, the
 * campaign board; see `useSnapColumns`): one chip per column, the one in
 * view marked by its ink frame and weight (`aria-current`), never by a
 * colour alone. A tap brings its column. It sticks to the top while the
 * columns scroll down and scrolls sideways in itself when the chips do not
 * all fit, keeping the marked one in sight.
 */
const props = defineProps<{
  chips: readonly {
    key: string;
    /** What the chip shows ("Heute", "Mi", "To-Do"). */
    label: string;
    /** What a screen reader hears, when more than the label ("Mittwoch, 25. Nov."). */
    name: string;
    /** A count shown after the label, in tabular figures. */
    count?: number;
  }[];
  /** The column in view. */
  current: number;
  /** The strip's name ("Spalten des Plans"). */
  label: string;
}>();
const emit = defineEmits<{ show: [index: number] }>();

const strip = ref<HTMLElement | null>(null);
watch(
  () => props.current,
  (index) => {
    const element = strip.value;
    const chip = element?.children[index];
    if (!element || !(chip instanceof HTMLElement)) return;
    const edge = 16;
    if (chip.offsetLeft - edge < element.scrollLeft)
      element.scrollLeft = chip.offsetLeft - edge;
    else if (
      chip.offsetLeft + chip.offsetWidth + edge >
      element.scrollLeft + element.clientWidth
    )
      element.scrollLeft =
        chip.offsetLeft + chip.offsetWidth + edge - element.clientWidth;
  },
  { flush: "post" },
);
</script>

<template>
  <nav ref="strip" class="column-chips" :aria-label="label">
    <button
      v-for="(chip, index) in chips"
      :key="chip.key"
      type="button"
      class="column-chips__chip"
      :aria-current="index === current ? 'true' : undefined"
      :aria-label="chip.name === chip.label ? undefined : chip.name"
      @click="emit('show', index)"
    >
      {{ chip.label
      }}<span v-if="chip.count !== undefined" class="column-chips__count">{{
        chip.count
      }}</span>
    </button>
  </nav>
</template>

<style scoped>
.column-chips {
  position: sticky;
  top: env(safe-area-inset-top, 0px);
  z-index: 2;
  display: flex;
  gap: var(--space-2);
  margin: calc(-1 * var(--space-2)) -1rem var(--space-2);
  padding: var(--space-2) 1rem;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  background: var(--color-ground);
  scrollbar-width: none;
}

.column-chips__chip {
  display: inline-flex;
  flex: none;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-4);
  border: 1.5px solid var(--color-line);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-ink-muted);
  font: inherit;
  font-size: 0.9375rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.column-chips__chip:active {
  transform: var(--press);
  transition-duration: 90ms;
}

/* The column in view: ink on white in an ink frame, heavier, never a colour alone. */
.column-chips__chip[aria-current="true"] {
  border-color: var(--color-ink);
  background: var(--color-surface);
  box-shadow: inset 0 0 0 1px var(--color-ink);
  color: var(--color-ink);
  font-weight: 800;
}

.column-chips__count {
  font-variant-numeric: tabular-nums;
}
</style>
