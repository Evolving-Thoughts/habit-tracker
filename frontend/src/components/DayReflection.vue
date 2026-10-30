<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { getReflection, saveReflection } from "../api/reflections.api";

const props = defineProps<{ date: string }>();

const text = ref("");
const savedText = ref("");
const loading = ref(true);
const saving = ref(false);
const saved = ref(false);
const error = ref("");
let abort: AbortController | undefined;

const changed = computed(() => text.value.trim() !== savedText.value);

async function load(): Promise<void> {
  abort?.abort();
  const current = new AbortController();
  abort = current;
  loading.value = true;
  saved.value = false;
  error.value = "";
  try {
    const reflection = await getReflection(props.date, current.signal);
    if (current !== abort) return;
    text.value = savedText.value = reflection.text;
  } catch (cause) {
    if (current !== abort) return;
    error.value =
      cause instanceof Error
        ? cause.message
        : "Die Reflexion konnte nicht geladen werden.";
  } finally {
    if (current === abort) loading.value = false;
  }
}

async function save(): Promise<void> {
  if (saving.value || !changed.value) return;
  const date = props.date;
  saving.value = true;
  saved.value = false;
  error.value = "";
  try {
    const reflection = await saveReflection(date, text.value);
    if (date !== props.date) return;
    text.value = savedText.value = reflection.text;
    saved.value = true;
  } catch (cause) {
    error.value =
      cause instanceof Error
        ? cause.message
        : "Die Reflexion konnte nicht gespeichert werden.";
  } finally {
    saving.value = false;
  }
}

watch(() => props.date, () => void load(), { immediate: true });
onUnmounted(() => abort?.abort());
</script>

<template>
  <form class="day-reflection" @submit.prevent="save">
    <label for="day-reflection-text">Reflexion</label>
    <textarea
      id="day-reflection-text"
      v-model="text"
      name="reflection"
      rows="4"
      maxlength="10000"
      :disabled="loading"
      placeholder="Was hast du getan, wie lief es, was hat geholfen?"
      @input="saved = false"
    />
    <p v-if="error" class="day-reflection__error" role="alert">{{ error }}</p>
    <div class="day-reflection__actions">
      <span v-if="saved" role="status">Gespeichert</span>
      <button type="submit" :disabled="loading || saving || !changed">
        Speichern
      </button>
    </div>
  </form>
</template>

<style scoped>
.day-reflection {
  display: grid;
  gap: 0.5rem;
  margin: 1rem 0;
}

.day-reflection label {
  font-weight: 600;
}

.day-reflection textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 0.625rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  font: inherit;
  resize: vertical;
}

.day-reflection__actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  justify-content: flex-end;
}

.day-reflection__actions button {
  min-height: 2.75rem;
  padding: 0 0.875rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
  cursor: pointer;
}

.day-reflection__actions button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.day-reflection__error {
  margin: 0;
  color: #b42318;
}
</style>
