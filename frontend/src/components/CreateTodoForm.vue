<script setup lang="ts">
import { ref } from "vue";
import { createTodo } from "../api/day-planner.api";
import type {
  CreateTodoInput,
  InheritedWhy,
  TodoResponse,
} from "../types/todo";
import { buildTodoInput } from "../utils/todo-input";
import type { CampaignColor, CampaignIcon } from "../types/campaign";
import { hoursToMinutes } from "../utils/quest-hours";
import CampaignFields from "./CampaignFields.vue";
import CategorySelect, { type CategoryChoice } from "./CategorySelect.vue";
import PlanFields from "./PlanFields.vue";
import WhyField from "./WhyField.vue";

const props = defineProps<{
  embedded?: boolean;
  parentId?: number | null;
  /** What the new quest inherits from the quest it is created below. */
  parentWhy?: InheritedWhy | null;
  /** A new campaign: offers colour, icon and weekly goal. */
  campaign?: boolean;
}>();

const emit = defineEmits<{
  /** The new quest, so a view can say where it now stands. */
  created: [todo: TodoResponse];
  busy: [value: boolean];
}>();

const title = ref("");
const date = ref("");
const time = ref("");
const durationMinutes = ref<string | number>("");
const category = ref<CategoryChoice>("default");
const why = ref("");
const color = ref<CampaignColor | null>(null);
const icon = ref<CampaignIcon | null>(null);
const weeklyTarget = ref<string | number>("");

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

function buildInput(): CreateTodoInput {
  return buildTodoInput({
    title: title.value,
    date: date.value,
    time: time.value,
    duration: durationMinutes.value,
  });
}

function resetForm(): void {
  title.value = "";
  date.value = "";
  time.value = "";
  durationMinutes.value = "";
  category.value = "default";
  why.value = "";
  color.value = null;
  icon.value = null;
  weeklyTarget.value = "";
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
    if (props.campaign) {
      const minutes = hoursToMinutes(weeklyTarget.value);
      if (minutes !== null) input.weeklyTargetMinutes = minutes;
      if (color.value) input.color = color.value;
      if (icon.value) input.icon = icon.value;
    }

    isSubmitting.value = true;
    emit("busy", true);

    const todo = await createTodo(input);

    resetForm();

    successMessage.value =
      input.scheduledDate === null
        ? "Quest erstellt. Sie liegt im Questlog."
        : "Quest erstellt. Sie steht am geplanten Tag in Heute.";

    emit("created", todo);
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Quest konnte nicht erstellt werden.";
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
    <h2 v-if="!embedded" id="create-todo-heading">Neue Quest</h2>

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

        <WhyField id="todo-why" v-model="why" :inherited="parentWhy" />

        <PlanFields v-model:date="date" v-model:time="time" id-prefix="todo" />

        <div class="create-todo__row">
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

        <CampaignFields
          v-if="campaign"
          v-model:color="color"
          v-model:icon="icon"
          v-model:target="weeklyTarget"
          id-prefix="todo-campaign"
          :title="title"
        />

        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>

        <button class="btn btn--primary create-todo__submit" type="submit">
          {{ isSubmitting ? "Wird gespeichert …" : "Quest erstellen" }}
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
