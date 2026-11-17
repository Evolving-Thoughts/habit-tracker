<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { InheritedWhy } from "../types/todo";

/**
 * The "Warum" of a quest or daily. Without an own reason the entry takes over
 * the one above it: the field then starts with that text, and leaving it
 * unchanged (or empty) keeps inheriting instead of storing a copy.
 */
const own = defineModel<string>({ required: true });
const props = defineProps<{ id: string; inherited?: InheritedWhy | null }>();

const inheritedText = computed(() => props.inherited?.text ?? "");
/** The own reason a typed text stands for; "" means "inherit". */
function ownOf(typed: string): string {
  const trimmed = typed.trim();
  return trimmed === inheritedText.value ? "" : trimmed;
}

const text = ref(own.value || inheritedText.value);
/** The own reason this field last reported, to tell typing from a reset. */
let reported = own.value.trim();
watch(text, (typed) => {
  reported = ownOf(typed);
  own.value = reported;
});
// The form was reset or loaded from outside: show what now applies.
watch(own, (value) => {
  if (value.trim() !== reported) text.value = value || inheritedText.value;
});
// What is inherited arrived or changed while the entry has no own reason.
watch(inheritedText, (now) => {
  if (!own.value.trim()) text.value = now;
});

const inherits = computed(() => !!props.inherited && !own.value.trim());

function takeOver(): void {
  text.value = inheritedText.value;
}
/** An emptied field inherits again, so it shows what it inherits. */
function refill(): void {
  if (!text.value.trim()) takeOver();
}
</script>

<template>
  <div class="field why-field">
    <label :for="id">Warum · optional</label>
    <textarea
      :id="id"
      v-model="text"
      name="why"
      maxlength="1000"
      rows="2"
      :aria-describedby="inherited ? `${id}-hint` : undefined"
      @blur="refill"
    />
    <p v-if="inherited" :id="`${id}-hint`" class="why-field__hint">
      <template v-if="inherits">
        Übernommen von „{{ inherited.fromTitle }}“. Ändere den Text für ein
        eigenes Warum.
      </template>
      <template v-else>
        Eigenes Warum.
        <button type="button" class="why-field__reset" @click="takeOver">
          Wieder von „{{ inherited.fromTitle }}“ übernehmen
        </button>
      </template>
    </p>
  </div>
</template>

<style scoped>
.why-field__hint {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}

.why-field__reset {
  min-height: var(--tap);
  padding: 0;
  border: 0;
  background: none;
  color: var(--color-action-strong);
  font: inherit;
  font-weight: 700;
  text-align: left;
  text-decoration: underline;
  text-underline-offset: 0.2em;
  cursor: pointer;
}
</style>
