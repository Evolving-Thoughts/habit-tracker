<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { saveWeekReview } from "../api/week-review.api";
import type { WeekReviewAnswers, WeekReviewInput } from "../types/week-review";
import { answersChanged, answersInput } from "../utils/week-review";

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

const fields = ref<WeekReviewInput>(answersInput(props.answers));
const stored = ref<WeekReviewInput>(answersInput(props.answers));
const saving = ref(false);
const saved = ref(false);
const error = ref("");
const changed = computed(() => answersChanged(fields.value, stored.value));

/* Two copies: the fields are edited in place, the stored ones stay put. */
function show(answers: WeekReviewAnswers): void {
  fields.value = answersInput(answers);
  stored.value = answersInput(answers);
}

/* A fresh read shows what the server holds, but never over unsaved typing. */
watch(
  () => props.answers,
  (answers) => {
    if (!changed.value) fields.value = answersInput(answers);
    stored.value = answersInput(answers);
  },
);
watch(
  () => props.week,
  () => {
    show(props.answers);
    saved.value = false;
    error.value = "";
  },
);

async function save(): Promise<void> {
  if (saving.value || !changed.value) return;
  const week = props.week;
  saving.value = true;
  saved.value = false;
  error.value = "";
  try {
    const answers = await saveWeekReview(week, fields.value);
    if (week !== props.week) return;
    show(answers);
    saved.value = true;
    emit("saved", answers);
  } catch (cause) {
    error.value =
      cause instanceof TypeError
        ? "Keine Verbindung zum Server. Deine Antworten bleiben hier stehen."
        : cause instanceof Error
          ? cause.message
          : "Der Rückblick konnte nicht gespeichert werden.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="answers" aria-labelledby="review-answers-title">
    <h2 id="review-answers-title" class="section-title">Rückblick</h2>
    <p v-if="ahead" class="answers__ahead card">
      Die Fragen öffnen sich, sobald die Woche begonnen hat.
    </p>
    <form v-else class="answers__form card" novalidate @submit.prevent="save">
      <div v-for="question in QUESTIONS" :key="question.key" class="field">
        <label :for="`review-${question.key}`">{{ question.label }}</label>
        <textarea
          :id="`review-${question.key}`"
          v-model="fields[question.key]"
          :name="question.key"
          rows="3"
          maxlength="10000"
          :placeholder="question.hint"
          @input="saved = false"
        />
      </div>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="answers__actions">
        <span v-if="saved" class="answers__saved" role="status"
          >Gespeichert</span
        >
        <button
          type="submit"
          class="btn btn--primary"
          :disabled="saving || !changed"
          :aria-busy="saving"
        >
          Speichern
        </button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.answers__form {
  display: grid;
  gap: var(--space-4);
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

.answers__actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: flex-end;
}

.answers__saved {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
