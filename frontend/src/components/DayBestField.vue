<script setup lang="ts">
import { computed, onMounted, ref, useId, watch } from "vue";
import { saveDayBest } from "../api/day-bests.api";
import type { DayBest } from "../types/day-best";
import {
  counterLabel,
  counterText,
  DAY_BEST_MAX_LENGTH,
  normalizeLine,
} from "../utils/day-best";

/**
 * The one field for a day's best, in Heute, the Kalender and the timeline:
 * one short line that saves itself on Enter or when the field is left, like
 * the notes, and says so quietly. Escape gives up what was typed. Near the
 * limit a counter shows how much is left.
 */
const props = withDefaults(
  defineProps<{
    date: string;
    /** The stored line; empty when the day has none. */
    text: string;
    label: string;
    /** The label is for screen readers only; the card names it. */
    hideLabel?: boolean;
    placeholder?: string;
    autofocus?: boolean;
    disabled?: boolean;
  }>(),
  { placeholder: "Eine Zeile reicht.", hideLabel: false },
);
const emit = defineEmits<{
  saved: [entry: DayBest];
  cancel: [];
}>();

const id = useId();
const field = ref<HTMLTextAreaElement | null>(null);
const draft = ref(props.text);
const stored = ref(props.text);
const state = ref<"idle" | "saving" | "saved" | "failed">("idle");
const error = ref("");
/** Counts edits, so an answer to an older save does not report "saved". */
let revision = 0;

watch(
  () => props.text,
  (text) => {
    // A new stored line from outside; what is being typed stays.
    if (draft.value === stored.value) draft.value = text;
    stored.value = text;
  },
);
watch(
  () => props.date,
  () => {
    draft.value = stored.value = props.text;
    state.value = "idle";
    error.value = "";
  },
);

const changed = computed(
  () => normalizeLine(draft.value) !== normalizeLine(stored.value),
);
const counter = computed(() => counterText(draft.value.length));
const status = computed(() =>
  state.value === "saving"
    ? "Speichert …"
    : state.value === "saved"
      ? "Gespeichert"
      : "",
);

async function save(): Promise<void> {
  if (!changed.value || state.value === "saving") return;
  const date = props.date;
  const current = ++revision;
  state.value = "saving";
  error.value = "";
  try {
    const entry = await saveDayBest(date, draft.value);
    if (date !== props.date || current !== revision) return;
    stored.value = entry.text;
    if (normalizeLine(draft.value) === entry.text) draft.value = entry.text;
    state.value = "saved";
    emit("saved", entry);
  } catch (cause) {
    if (current !== revision) return;
    state.value = "failed";
    error.value =
      cause instanceof TypeError
        ? "Keine Verbindung zum Server. Deine Zeile bleibt hier stehen."
        : cause instanceof Error
          ? cause.message
          : "Die Zeile konnte nicht gespeichert werden.";
  }
}

function onInput(): void {
  revision += 1;
  if (state.value !== "saving") state.value = "idle";
}

/* One line: Enter saves instead of breaking it. */
function onEnter(event: KeyboardEvent): void {
  if (event.isComposing) return;
  event.preventDefault();
  void save();
}

function onEscape(event: KeyboardEvent): void {
  // Escape belongs to the field: it never closes a dialog around it.
  event.stopPropagation();
  draft.value = stored.value;
  state.value = "idle";
  error.value = "";
  emit("cancel");
}

onMounted(() => {
  if (props.autofocus) field.value?.focus();
});
defineExpose({ focus: () => field.value?.focus() });
</script>

<template>
  <div class="day-best-field">
    <label
      :for="`${id}-text`"
      class="day-best-field__label"
      :class="{ 'visually-hidden': hideLabel }"
      >{{ label }}</label
    >
    <textarea
      :id="`${id}-text`"
      ref="field"
      v-model="draft"
      class="input day-best-field__input"
      name="dayBest"
      rows="2"
      :maxlength="DAY_BEST_MAX_LENGTH"
      enterkeyhint="done"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-describedby="counter ? `${id}-count` : undefined"
      @input="onInput"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
      @blur="save"
    />
    <div class="day-best-field__foot">
      <p class="day-best-field__status" role="status">{{ status }}</p>
      <p v-if="counter" :id="`${id}-count`" class="day-best-field__count">
        <span aria-hidden="true">{{ counter }}</span>
        <span class="visually-hidden">{{ counterLabel(draft.length) }}</span>
      </p>
    </div>
    <p v-if="state === 'failed'" class="form-error" role="alert">
      {{ error }}
      <button type="button" class="day-best-field__retry" @click="save">
        Erneut speichern
      </button>
    </p>
  </div>
</template>

<style scoped>
.day-best-field {
  display: grid;
  gap: var(--space-1);
}

.day-best-field__label {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

/* Short by nature: two lines show a long one, it grows no further. */
.day-best-field__input {
  min-height: calc(2 * 1.45em + 2 * var(--space-3) + 3px);
  resize: none;
}

.day-best-field__input:disabled {
  color: var(--color-ink-soft);
}

.day-best-field__foot {
  display: flex;
  gap: var(--space-3);
  align-items: baseline;
  justify-content: space-between;
  min-height: 1.25rem;
}

.day-best-field__status,
.day-best-field__count {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.day-best-field__count {
  margin-inline-start: auto;
}

.day-best-field__retry {
  min-height: var(--tap);
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
</style>
