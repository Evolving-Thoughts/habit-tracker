<script setup lang="ts">
import { ref } from "vue";
import { createTodo } from "../api/day-planner.api";
import type { CreateTodoInput } from "../types/todo";
import { buildTodoInput } from "../utils/todo-input";
import CategorySelect, { type CategoryChoice } from "./CategorySelect.vue";

const props = defineProps<{ embedded?: boolean; parentId?: number | null }>();

const emit = defineEmits<{
  created: [];
  busy: [value: boolean];
}>();

const title = ref("");
const scheduledAt = ref("");
const durationMinutes = ref<string | number>("");
const isFixed = ref(false);
const category = ref<CategoryChoice>("default");
const why = ref("");

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

function buildInput(): CreateTodoInput {
  return buildTodoInput({
    title: title.value,
    scheduledAt: scheduledAt.value,
    duration: durationMinutes.value,
    isFixed: isFixed.value,
  });
}

function resetForm(): void {
  title.value = "";
  scheduledAt.value = "";
  durationMinutes.value = "";
  isFixed.value = false;
  category.value = "default";
  why.value = "";
}

async function submit(): Promise<void> {
  if (isSubmitting.value) {
    return;
  }

  errorMessage.value = null;
  successMessage.value = null;

  try {
    const input = buildInput();
    if (props.parentId !== undefined) input.parentId = props.parentId;
    if (category.value !== "default") input.categoryId = category.value;
    if (why.value.trim()) input.why = why.value.trim();

    isSubmitting.value = true;
    emit("busy", true);

    await createTodo(input);

    resetForm();

    successMessage.value =
      input.scheduledAt === null
        ? "Todo erstellt. Es liegt im Todo-Dump."
        : "Todo erstellt. Es steht am geplanten Tag in Heute.";

    emit("created");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Das Todo konnte nicht erstellt werden.";
  } finally {
    isSubmitting.value = false;
    emit("busy", false);
  }
}
</script>

<template>
  <section
    class="create-todo"
    :class="{ card: !embedded }"
    :aria-labelledby="embedded ? undefined : 'create-todo-heading'"
  >
    <h2 v-if="!embedded" id="create-todo-heading">Neues Todo</h2>

    <form novalidate @submit.prevent="submit">
      <fieldset :disabled="isSubmitting">
        <label class="field">
          Titel
          <input
            v-model="title"
            name="title"
            type="text"
            maxlength="200"
            required
            placeholder="Was möchtest du erledigen?"
          />
        </label>

        <label class="field">
          Kategorie · optional
          <CategorySelect
            id="todo-category"
            v-model="category"
            :inherits-from-parent="parentId != null"
          />
        </label>

        <label class="field">
          Warum · optional
          <textarea v-model="why" name="why" maxlength="1000" rows="2" />
        </label>

        <div class="create-todo__row">
          <label class="field">
            Zeitpunkt · optional
            <input
              v-model="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
            />
          </label>

          <label class="field">
            Dauer in Minuten · optional
            <input
              v-model="durationMinutes"
              name="duration"
              type="number"
              min="1"
              step="1"
              placeholder="30"
            />
          </label>
        </div>

        <label class="create-todo__checkbox">
          <input v-model="isFixed" name="isFixed" type="checkbox" />
          Fester Termin
        </label>

        <p class="create-todo__hint">Ohne Zeitpunkt landet es im Todo-Dump.</p>

        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>

        <button class="btn btn--primary create-todo__submit" type="submit">
          {{ isSubmitting ? "Wird gespeichert …" : "Todo erstellen" }}
        </button>
      </fieldset>
    </form>

    <p v-if="successMessage" class="create-todo__success" role="status">
      {{ successMessage }}
    </p>
  </section>
</template>

<style scoped>
.create-todo h2 {
  margin: 0 0 var(--space-4);
  font-size: 1.125rem;
  font-weight: 800;
}

.create-todo fieldset {
  display: grid;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.create-todo__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.create-todo__checkbox {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  min-height: var(--tap);
  font-weight: 600;
}

.create-todo__checkbox input {
  width: 1.25rem;
  height: 1.25rem;
}

.create-todo__hint,
.create-todo__success {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

.create-todo__success {
  margin-top: var(--space-3);
  font-weight: 600;
}

.create-todo__submit {
  justify-self: start;
}

@media (max-width: 32rem) {
  .create-todo__row {
    grid-template-columns: 1fr;
  }
}
</style>
