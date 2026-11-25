<script setup lang="ts">
import { useOverlay } from "../composables/useOverlayStack";
import { computed, nextTick, ref, useId, watch } from "vue";
import AppIcon from "./AppIcon.vue";

type IconName = InstanceType<typeof AppIcon>["$props"]["name"];

/** One choice of the box; `value` is what the model holds. */
export type ComboOption = {
  value: string;
  /** The words the field shows once chosen, and what typing searches. */
  label: string;
  /** Quieter words in front of the label in the list ("Buch ›"). */
  lead?: string;
  /** A colour token for the option's mark (a category or campaign). */
  mark?: string;
  /** With a mark: an icon on a round badge (a campaign); else a small square. */
  icon?: IconName;
};

/**
 * A field to pick one option by typing or from its list (WAI-ARIA combobox
 * with a listbox popup). Typing filters; when nothing matches the typed
 * words exactly, `createLabel` may offer to make a new option of them
 * ("Neue Kategorie „Lesen“ anlegen"), which emits `create`. The chosen
 * option stays in words in the field; its mark is never the only sign.
 */
const props = defineProps<{
  id: string;
  options: ComboOption[];
  placeholder?: string;
  disabled?: boolean;
  /** Words of the create option for a typed text; null offers none. */
  createLabel?: (text: string) => string | null;
  /** Ids of hints that describe the field. */
  describedBy?: string;
}>();
const model = defineModel<string>({ required: true });
const emit = defineEmits<{ create: [text: string] }>();

const listId = useId();
const input = ref<HTMLInputElement | null>(null);
const open = ref(false);
/* The phone's Back closes the open list before its dialog, as Escape does. */
useOverlay(open, () => close());
/** What is typed while searching; null shows the chosen option. */
const query = ref<string | null>(null);
const active = ref(0);

const chosen = computed(() =>
  props.options.find((option) => option.value === model.value),
);
const shownText = computed(() =>
  query.value ?? (chosen.value ? fullText(chosen.value) : ""),
);

function fullText(option: ComboOption): string {
  return option.lead ? `${option.lead} ${option.label}` : option.label;
}

const typed = computed(() => (query.value ?? "").trim());
const filtered = computed(() => {
  const words = typed.value.toLocaleLowerCase("de");
  if (!words) return props.options;
  return props.options.filter((option) =>
    fullText(option).toLocaleLowerCase("de").includes(words),
  );
});
const createText = computed(() => {
  const text = typed.value;
  if (!text || !props.createLabel) return null;
  const exact = props.options.some(
    (option) =>
      option.label.toLocaleLowerCase("de") === text.toLocaleLowerCase("de"),
  );
  return exact ? null : props.createLabel(text);
});
/** Rows of the list: the matches, then the create option if offered. */
const rowCount = computed(
  () => filtered.value.length + (createText.value ? 1 : 0),
);
const optionId = (index: number) => `${listId}-${index}`;
watch(rowCount, (count) => {
  if (active.value >= count) active.value = Math.max(0, count - 1);
});

function show(): void {
  if (props.disabled) return;
  if (!open.value) {
    const index = filtered.value.findIndex(
      (option) => option.value === model.value,
    );
    active.value = Math.max(0, index);
  }
  open.value = true;
}
function close(): void {
  open.value = false;
  query.value = null;
}
function onInput(event: Event): void {
  query.value = (event.target as HTMLInputElement).value;
  active.value = 0;
  open.value = true;
}
function pick(index: number): void {
  const option = filtered.value[index];
  if (option) {
    model.value = option.value;
    close();
  } else if (createText.value) {
    const text = typed.value;
    close();
    emit("create", text);
  }
}
function move(step: number): void {
  if (!open.value) {
    show();
    return;
  }
  const count = rowCount.value;
  if (count) active.value = (active.value + step + count) % count;
  void scrollActive();
}
async function scrollActive(): Promise<void> {
  await nextTick();
  document
    .getElementById(optionId(active.value))
    ?.scrollIntoView?.({ block: "nearest" });
}
function onEnter(event: KeyboardEvent): void {
  // Enter picks inside the list; with the list closed it submits the form.
  if (!open.value) return;
  event.preventDefault();
  pick(active.value);
}
function onEscape(event: KeyboardEvent): void {
  if (!open.value) return;
  // The list closes first; only a second Escape closes the dialog.
  event.preventDefault();
  event.stopPropagation();
  close();
}
function toggle(): void {
  if (open.value) close();
  else {
    show();
    input.value?.focus();
  }
}
</script>

<template>
  <div class="combo" :class="{ 'combo--marked': chosen?.mark }">
    <span
      v-if="chosen?.mark"
      class="combo__mark"
      :class="{ 'combo__mark--badge': chosen.icon }"
      :style="{ '--mark': chosen.mark }"
      aria-hidden="true"
    >
      <AppIcon v-if="chosen.icon" :name="chosen.icon" />
    </span>
    <input
      :id="id"
      ref="input"
      class="combo__input"
      type="text"
      role="combobox"
      autocomplete="off"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && rowCount ? optionId(active) : undefined"
      :aria-describedby="describedBy"
      :value="shownText"
      :placeholder="placeholder"
      :disabled="disabled"
      @input="onInput"
      @focus="($event.target as HTMLInputElement).select()"
      @click="show"
      @blur="close"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
    />
    <!-- A pointer's way to the whole list; keys use the arrows instead. -->
    <button
      class="combo__toggle"
      type="button"
      tabindex="-1"
      :aria-label="open ? 'Liste schließen' : 'Liste öffnen'"
      :disabled="disabled"
      @mousedown.prevent
      @click="toggle"
    >
      <AppIcon name="chevron-down" />
    </button>
    <ul
      v-show="open"
      :id="listId"
      class="combo__list"
      role="listbox"
      @mousedown.prevent
    >
      <li
        v-for="(option, index) in filtered"
        :id="optionId(index)"
        :key="option.value"
        class="combo__option"
        :class="{ 'combo__option--active': index === active }"
        role="option"
        :aria-selected="option.value === model"
        @click="pick(index)"
        @mousemove="active = index"
      >
        <span
          v-if="option.mark"
          class="combo__mark"
          :class="{ 'combo__mark--badge': option.icon }"
          :style="{ '--mark': option.mark }"
          aria-hidden="true"
        >
          <AppIcon v-if="option.icon" :name="option.icon" />
        </span>
        <span class="combo__text">
          <span v-if="option.lead" class="combo__lead">{{
            `${option.lead} `
          }}</span
          >{{ option.label }}
        </span>
        <AppIcon
          v-if="option.value === model"
          name="check"
          class="combo__check"
        />
      </li>
      <li
        v-if="createText"
        :id="optionId(filtered.length)"
        class="combo__option combo__option--create"
        :class="{ 'combo__option--active': active === filtered.length }"
        role="option"
        aria-selected="false"
        @click="pick(filtered.length)"
        @mousemove="active = filtered.length"
      >
        <AppIcon name="plus" />
        <span class="combo__text">{{ createText }}</span>
      </li>
      <li v-if="!rowCount" class="combo__empty" role="presentation">
        Nichts gefunden.
      </li>
    </ul>
  </div>
</template>

<style scoped>
.combo {
  position: relative;
  display: grid;
}

.combo .combo__input {
  width: 100%;
  min-height: var(--tap);
  padding: 0 var(--tap) 0 var(--space-3);
  border: 1.5px solid var(--color-line-strong);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  color: var(--color-ink);
  font: inherit;
  font-weight: 400;
  text-overflow: ellipsis;
}

.combo--marked .combo__input {
  padding-left: 2.25rem;
}

.combo > .combo__mark {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  transform: translateY(-50%);
  pointer-events: none;
}

.combo__mark {
  display: inline-grid;
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  place-items: center;
  border-radius: 0.2rem;
  background: var(--mark);
  color: var(--color-on-action);
}

.combo__mark--badge {
  width: 1.125rem;
  height: 1.125rem;
  border-radius: 50%;
}

.combo__mark--badge :deep(svg) {
  width: 0.75rem;
  height: 0.75rem;
  stroke-width: 2.6;
}

/* Quiet and out of the tab order; ModalDialog's button tint is undone here. */
.combo .combo__toggle {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  width: var(--tap);
  min-height: var(--tap);
  height: 100%;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-control);
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
}

.combo .combo__toggle:disabled {
  background: transparent;
  color: var(--color-ink-soft);
}

.combo__list {
  position: absolute;
  top: calc(100% + var(--space-1));
  right: 0;
  left: 0;
  z-index: 3;
  max-height: 16rem;
  margin: 0;
  padding: var(--space-1);
  overflow-y: auto;
  border-radius: var(--radius-control);
  background: var(--color-surface);
  box-shadow: var(--shadow-popover);
  list-style: none;
}

.combo__option {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  padding: 0 var(--space-3);
  border-radius: var(--radius-control);
  color: var(--color-ink);
  font-weight: 600;
  cursor: pointer;
}

.combo__option--active {
  background: var(--color-action-tint);
  color: var(--color-action-strong);
}

.combo__option--create {
  color: var(--color-action-strong);
  font-weight: 700;
}

.combo__text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.combo__lead {
  color: var(--color-ink-muted);
  font-weight: 400;
}

.combo__check {
  flex: none;
  width: 1.125rem;
  height: 1.125rem;
}

.combo__empty {
  padding: var(--space-2) var(--space-3);
  color: var(--color-ink-muted);
}
</style>
