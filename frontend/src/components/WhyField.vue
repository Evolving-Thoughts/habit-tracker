<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import type { InheritedWhy } from "../types/todo";
import AppIcon from "./AppIcon.vue";

/**
 * The "Warum" of a quest or daily. Without an own reason the entry takes over
 * the one above it, live. That reason is shown as a quiet quote, never as
 * editable text, so a stray keystroke cannot turn it into a copy: an own
 * reason starts only with "Eigenes Warum schreiben", and "Wieder übernehmen"
 * clears it so the entry inherits again.
 */
const own = defineModel<string>({ required: true });
const props = defineProps<{ id: string; inherited?: InheritedWhy | null }>();

const inheritedText = computed(() => props.inherited?.text ?? "");
/** The own reason a typed text stands for; "" means "inherit". */
function ownOf(typed: string): string {
  const trimmed = typed.trim();
  return trimmed === inheritedText.value ? "" : trimmed;
}

const text = ref(own.value);
/** Writing an own reason; without anything to inherit always. */
const writing = ref(!props.inherited || !!own.value.trim());
/** The own reason this field last reported, to tell typing from a reset. */
let reported = own.value.trim();
watch(text, (typed) => {
  reported = ownOf(typed);
  own.value = reported;
});
// The form was reset or loaded from outside: show what now applies.
watch(own, (value) => {
  if (value.trim() === reported) return;
  reported = value.trim();
  text.value = value;
  writing.value = !props.inherited || !!reported;
});
// Something to inherit arrived or went while the entry has no own reason.
watch(
  () => props.inherited,
  (now) => {
    if (!now) writing.value = true;
    else if (!text.value.trim()) writing.value = false;
  },
);

const area = ref<HTMLTextAreaElement | null>(null);
const start = ref<HTMLButtonElement | null>(null);

async function writeOwn(): Promise<void> {
  writing.value = true;
  await nextTick();
  area.value?.focus();
}
async function takeOver(): Promise<void> {
  text.value = "";
  writing.value = false;
  await nextTick();
  start.value?.focus();
}
</script>

<template>
  <div v-if="!inherited" class="field why-field">
    <label :for="id">Warum · optional</label>
    <textarea :id="id" v-model="text" name="why" maxlength="1000" rows="2" />
  </div>

  <div
    v-else
    class="why-field why-field--inherits"
    role="group"
    :aria-labelledby="`${id}-label`"
  >
    <span :id="`${id}-label`" class="why-field__label">Warum</span>
    <blockquote
      :id="`${id}-inherited`"
      class="why-field__quote"
      :class="{ 'why-field__quote--replaced': writing }"
    >
      <span class="why-field__from"
        >{{ writing ? "Ersetzt das Warum" : "Übernommen" }} von „{{
          inherited.fromTitle
        }}“:</span
      >
      <p>{{ inherited.text }}</p>
    </blockquote>

    <button
      v-if="!writing"
      ref="start"
      class="btn why-field__action"
      type="button"
      data-test="why-write-own"
      @click="writeOwn"
    >
      <AppIcon name="edit" />Eigenes Warum schreiben
    </button>

    <template v-else>
      <div class="field">
        <label :for="id">Eigenes Warum</label>
        <textarea
          :id="id"
          ref="area"
          v-model="text"
          name="why"
          maxlength="1000"
          rows="2"
          :aria-describedby="`${id}-inherited ${id}-hint`"
        />
        <small :id="`${id}-hint`" class="why-field__hint"
          >Leer gelassen gilt weiter das übernommene.</small
        >
      </div>
      <button
        class="btn why-field__action"
        type="button"
        data-test="why-take-over"
        @click="takeOver"
      >
        <AppIcon name="refresh" />Wieder übernehmen
      </button>
    </template>
  </div>
</template>

<style scoped>
.why-field--inherits {
  display: grid;
  gap: var(--space-2);
  justify-items: start;
}

.why-field--inherits > .field {
  justify-self: stretch;
}

.why-field__label {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

/* Quoted, quiet and not editable: it lives in the quest it comes from. */
.why-field__quote {
  justify-self: stretch;
  margin: 0;
  padding: var(--space-1) 0 var(--space-1) var(--space-3);
  border-left: 2px solid var(--color-line);
  color: var(--color-ink-muted);
  overflow-wrap: anywhere;
}

.why-field__quote p {
  margin: 0;
  color: var(--color-ink);
}

/* While an own reason is written, the inherited one steps back. */
.why-field__quote--replaced p {
  color: var(--color-ink-muted);
  font-size: 0.9375rem;
}

.why-field__from {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
}

.why-field__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}
</style>
