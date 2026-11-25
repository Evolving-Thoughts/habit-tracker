<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { saveWeekReview } from "../api/week-review.api";
import type { WeekReviewAnswers, WeekReviewInput } from "../types/week-review";
import { answersChanged, answersInput } from "../utils/week-review";
import { insertAtCursor } from "../utils/insert-text";
import MicButton from "./MicButton.vue";

const props = defineProps<{
  week: string;
  answers: WeekReviewAnswers;
  /** A week still ahead has nothing to look back on yet. */
  ahead: boolean;
}>();
const emit = defineEmits<{ saved: [answers: WeekReviewAnswers] }>();

const QUESTIONS: { key: keyof WeekReviewInput; label: string; hint: string }[] =
  [
    {
      key: "wentWell",
      label: "Was lief gut?",
      hint: "Was hat geklappt, worauf bist du stolz?",
    },
    {
      key: "wentBadly",
      label: "Was lief nicht gut?",
      hint: "Was hat gehakt, was kam dazwischen?",
    },
    {
      key: "changeNext",
      label: "Was ändere ich?",
      hint: "Eine Sache für die nächste Woche.",
    },
  ];

/*
 * The answers save themselves, like the notes: a short pause after typing,
 * leaving a field, hiding the page or leaving the week sends what changed;
 * a quiet status says "Speichert …" and then "Gespeichert".
 */
const SAVE_DELAY_MS = 800;

const fields = ref<WeekReviewInput>(answersInput(props.answers));
const stored = ref<WeekReviewInput>(answersInput(props.answers));
const state = ref<"idle" | "pending" | "saving" | "saved" | "failed">("idle");
const error = ref("");
const changed = computed(() => answersChanged(fields.value, stored.value));
const status = computed(() =>
  state.value === "pending" || state.value === "saving"
    ? "Speichert …"
    : state.value === "saved"
      ? "Gespeichert"
      : "",
);
let timer: ReturnType<typeof setTimeout> | undefined;
/** Counts edits, so an answer to an older save does not report "saved". */
let revision = 0;

/*
 * A fresh read shows what the server holds, but never over unsaved typing,
 * and never just to trim the spaces of what is being typed.
 */
watch(
  () => props.answers,
  (answers) => {
    const incoming = answersInput(answers);
    if (!changed.value && answersChanged(fields.value, incoming))
      fields.value = incoming;
    stored.value = incoming;
  },
);

async function save(
  week = props.week,
  input: WeekReviewInput = { ...fields.value },
): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  const current = revision;
  state.value = "saving";
  error.value = "";
  try {
    const answers = await saveWeekReview(week, input);
    // The week left meanwhile: its answers are stored, this one shows another.
    if (week !== props.week) return;
    stored.value = answersInput(answers);
    emit("saved", answers);
    if (current === revision) state.value = "saved";
  } catch (cause) {
    if (week !== props.week || current !== revision) return;
    state.value = "failed";
    error.value =
      cause instanceof TypeError
        ? "Keine Verbindung zum Server. Deine Antworten bleiben hier stehen."
        : cause instanceof Error
          ? cause.message
          : "Der Rückblick konnte nicht gespeichert werden.";
  }
}

function schedule(): void {
  revision += 1;
  state.value = "pending";
  clearTimeout(timer);
  timer = setTimeout(() => void save(), SAVE_DELAY_MS);
}
/* Every change to a field counts, typed or filled in otherwise. */
watch(
  fields,
  () => {
    if (answersChanged(fields.value, stored.value)) schedule();
  },
  { deep: true },
);

/** What is typed but not yet sent goes out now. */
function flush(): void {
  if (state.value === "pending") void save();
}

/* Another week: what was typed for the last one is saved to that week. */
watch(
  () => props.week,
  (_week, previous) => {
    if (state.value === "pending") void save(previous, { ...fields.value });
    clearTimeout(timer);
    timer = undefined;
    fields.value = answersInput(props.answers);
    stored.value = answersInput(props.answers);
    state.value = "idle";
    error.value = "";
  },
);

/*
 * Dictated text goes in at the cursor of its field; the watch above then
 * saves it like typing.
 */
const MAX_LENGTH = 10000;
async function onDictated(
  key: keyof WeekReviewInput,
  text: string,
): Promise<void> {
  const field = document.getElementById(
    `review-${key}`,
  ) as HTMLTextAreaElement | null;
  const insertion = insertAtCursor(field, fields.value[key], text, MAX_LENGTH);
  fields.value[key] = insertion.value;
  await nextTick();
  field?.focus();
  field?.setSelectionRange(insertion.caret, insertion.caret);
}

function onVisibility(): void {
  if (document.visibilityState === "hidden") flush();
}
onMounted(() => document.addEventListener("visibilitychange", onVisibility));
onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onVisibility);
  flush();
});
</script>

<template>
  <section class="answers card" aria-labelledby="review-answers-title">
    <div class="card-head">
      <h2 id="review-answers-title" class="card-title">Rückblick</h2>
      <p v-if="!ahead" class="answers__status" role="status">{{ status }}</p>
    </div>
    <p v-if="ahead" class="answers__ahead">
      Die Fragen öffnen sich, sobald die Woche begonnen hat.
    </p>
    <form v-else class="answers__form" novalidate @submit.prevent="flush">
      <div class="answers__questions">
        <div v-for="question in QUESTIONS" :key="question.key" class="field">
          <label :for="`review-${question.key}`">{{ question.label }}</label>
          <div class="mic-field">
            <textarea
              :id="`review-${question.key}`"
              v-model="fields[question.key]"
              :name="question.key"
              rows="4"
              :maxlength="MAX_LENGTH"
              :placeholder="question.hint"
              @blur="flush"
            />
            <MicButton
              placement="field"
              mode="long"
              :label="`Antwort diktieren: ${question.label}`"
              @result="onDictated(question.key, $event)"
            />
          </div>
        </div>
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    </form>
  </section>
</template>

<style scoped>
.answers__form,
.answers__questions {
  display: grid;
  gap: var(--space-4);
}

/* The three questions side by side on a wide screen, like the figures above. */
@media (min-width: 56rem) {
  .answers__questions {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.answers__form .field label {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
}

.answers__ahead {
  margin: 0;
  color: var(--color-ink-muted);
}

.answers__status {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
