<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getReflection, saveReflection } from "../api/reflections.api";
import { useLoader } from "../composables/useLoader";

const props = defineProps<{ date: string }>();

const text = ref("");
const savedText = ref("");
const saving = ref(false);
const saved = ref(false);
const saveError = ref("");
const {
  data: stored,
  isLoading: loading,
  errorMessage: loadError,
} = useLoader((signal) => getReflection(props.date, signal), {
  initial: null as { text: string } | null,
  fallbackError: "Die Reflexion konnte nicht geladen werden.",
  params: [() => props.date],
});
const error = computed(() => saveError.value || loadError.value);

const changed = computed(() => text.value.trim() !== savedText.value);

async function save(): Promise<void> {
  if (saving.value || !changed.value) return;
  const date = props.date;
  saving.value = true;
  saved.value = false;
  saveError.value = "";
  try {
    const reflection = await saveReflection(date, text.value);
    if (date !== props.date) return;
    text.value = savedText.value = reflection.text;
    saved.value = true;
  } catch (cause) {
    saveError.value =
      cause instanceof TypeError
        ? "Keine Verbindung zum Server. Dein Text bleibt hier stehen."
        : cause instanceof Error
          ? cause.message
          : "Die Reflexion konnte nicht gespeichert werden.";
  } finally {
    saving.value = false;
  }
}

watch(
  () => props.date,
  () => {
    saved.value = false;
    saveError.value = "";
  },
);
watch(stored, (reflection) => {
  if (reflection) text.value = savedText.value = reflection.text;
});
</script>

<template>
  <form class="day-reflection card" @submit.prevent="save">
    <label class="day-reflection__label" for="day-reflection-text"
      >Reflexion</label
    >
    <textarea
      id="day-reflection-text"
      v-model="text"
      class="input"
      name="reflection"
      rows="3"
      maxlength="10000"
      :disabled="loading"
      placeholder="Was hast du getan, wie lief es, was hat geholfen?"
      @input="saved = false"
    />
    <p v-if="error" class="form-error" role="alert">{{ error }}</p>
    <div v-if="saved || changed || saving" class="day-reflection__actions">
      <span v-if="saved" class="day-reflection__saved" role="status"
        >Gespeichert</span
      >
      <button
        v-if="changed || saving"
        type="submit"
        class="btn btn--primary"
        :disabled="saving"
      >
        Speichern
      </button>
    </div>
  </form>
</template>

<style scoped>
.day-reflection {
  display: grid;
  gap: var(--space-2);
}

.day-reflection__label {
  font-size: 1.125rem;
  font-weight: 800;
}

.day-reflection textarea:disabled {
  color: var(--color-ink-soft);
}

.day-reflection__actions {
  display: flex;
  gap: var(--space-3);
  align-items: center;
  justify-content: flex-end;
}

.day-reflection__saved {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}
</style>
