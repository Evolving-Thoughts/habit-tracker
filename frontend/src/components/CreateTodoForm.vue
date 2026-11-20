<script setup lang="ts">
import { computed, ref } from "vue";
import { createTodo } from "../api/day-planner.api";
import type { CategoryResponse } from "../types/category";
import type {
  CreateTodoInput,
  InheritedWhy,
  TodoResponse,
} from "../types/todo";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import { buildTodoInput } from "../utils/todo-input";
import type { CampaignColor, CampaignIcon } from "../types/campaign";
import { hoursToMinutes } from "../utils/quest-hours";
import { categoryOfChoice, type ParentChoice } from "../utils/parent-choice";
import { whyBelow } from "../utils/why";
import CampaignFields from "./CampaignFields.vue";
import CategoryPicker from "./CategoryPicker.vue";
import ParentPicker from "./ParentPicker.vue";
import PlanFields from "./PlanFields.vue";
import AppointmentFields from "./AppointmentFields.vue";
import FormDisclosure from "./FormDisclosure.vue";
import WhyField from "./WhyField.vue";

const props = defineProps<{
  embedded?: boolean;
  /** Created from inside a campaign or quest: it starts below that one. */
  parent?: HierarchyTodo | null;
  /** A new campaign: colour, icon and weekly goal instead of day and duration. */
  campaign?: boolean;
}>();

const emit = defineEmits<{
  /** The new quest, so a view can say where it now stands. */
  created: [todo: TodoResponse];
  busy: [value: boolean];
  cancel: [];
}>();

const title = ref("");
const parentId = ref<number | null>(props.parent?.id ?? null);
/** What the new quest inherits from the quest it goes below. */
const inheritedWhy = ref<InheritedWhy | null>(
  props.parent ? whyBelow(props.parent) : null,
);
const date = ref("");
const time = ref("");
const durationMinutes = ref<string | number>("");
const categoryId = ref<number | null>(props.parent?.categoryId ?? null);
const categories = ref<CategoryResponse[]>([]);
/** The chosen category in words, for the closed disclosure. */
const categoryName = computed(
  () =>
    categories.value.find((entry) => entry.id === categoryId.value)?.name ??
    "",
);
const why = ref("");
const color = ref<CampaignColor | null>(null);
const icon = ref<CampaignIcon | null>(null);
const weeklyTarget = ref<string | number>("");

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);
const successMessage = ref<string | null>(null);

/** A chosen place brings its reason (live, never copied) and its category. */
function choose(choice: ParentChoice | null): void {
  inheritedWhy.value = choice ? whyBelow(choice.todo) : null;
  if (choice && categoryId.value === null)
    categoryId.value = categoryOfChoice(choice);
}
/** Created inside a campaign: the campaign's category if the parent has none. */
function preset(choices: ParentChoice[]): void {
  const choice = choices.find((entry) => entry.todo.id === parentId.value);
  if (choice && categoryId.value === null)
    categoryId.value = categoryOfChoice(choice);
}

function buildInput(): CreateTodoInput {
  return buildTodoInput({
    title: title.value,
    date: props.campaign ? "" : date.value,
    time: props.campaign ? "" : time.value,
    duration: props.campaign ? "" : durationMinutes.value,
  });
}

function resetForm(): void {
  title.value = "";
  date.value = "";
  time.value = "";
  durationMinutes.value = "";
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
    input.parentId = props.campaign ? null : parentId.value;
    input.categoryId = categoryId.value;
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
            :placeholder="
              campaign
                ? 'Welches längere Ziel nimmst du dir vor?'
                : 'Was möchtest du erledigen?'
            "
          />
        </label>

        <p v-if="campaign" class="create-todo__hint">
          Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat oder
          eine Farbe, ein Symbol oder ein Wochenziel bekommt.
        </p>

        <div v-else class="field">
          <label for="todo-parent">Gehört zu · optional</label>
          <ParentPicker
            id="todo-parent"
            v-model="parentId"
            @chosen="choose"
            @ready="preset"
          />
        </div>

        <template v-if="!campaign">
          <PlanFields v-model:date="date" id-prefix="todo" />

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
        </template>

        <WhyField id="todo-why" v-model="why" :inherited="inheritedWhy" />

        <!-- A new campaign is made for these, so they stand open. -->
        <template v-if="campaign">
          <div class="field">
            <label for="todo-category">Kategorie · optional</label>
            <CategoryPicker
              id="todo-category"
              v-model="categoryId"
              @loaded="categories = $event"
            />
          </div>
          <CampaignFields
            v-model:color="color"
            v-model:icon="icon"
            v-model:target="weeklyTarget"
            id-prefix="todo-campaign"
            :title="title"
          />
        </template>

        <div v-else class="create-todo__more">
          <AppointmentFields v-model:time="time" :date="date" id-prefix="todo" />

          <FormDisclosure
            label="Kategorie"
            :summary="categoryName"
            :start-open="categoryId !== null"
          >
            <div class="field">
              <label for="todo-category">Kategorie</label>
              <CategoryPicker
                id="todo-category"
                v-model="categoryId"
                @loaded="categories = $event"
              />
            </div>
          </FormDisclosure>
        </div>
      </fieldset>

      <!-- In a dialog it sticks to the bottom edge, like the editor's actions. -->
      <div
        class="create-todo__footer"
        :class="{ 'sticky-actions': embedded }"
        data-test="editor-actions"
      >
        <p v-if="errorMessage" class="form-error" role="alert">
          {{ errorMessage }}
        </p>

        <div class="create-todo__actions">
          <button
            class="btn btn--primary"
            type="submit"
            :disabled="isSubmitting"
          >
            {{
              isSubmitting
                ? "Wird gespeichert …"
                : campaign
                  ? "Kampagne erstellen"
                  : "Quest erstellen"
            }}
          </button>
          <button
            v-if="embedded"
            class="btn"
            type="button"
            :disabled="isSubmitting"
            @click="emit('cancel')"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </form>

    <p
      v-if="successMessage && !embedded"
      class="create-todo__success"
      role="status"
    >
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

.create-todo form,
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

.create-todo__hint {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
}

/* The optional groups read as one list between hairlines. */
.create-todo__more {
  display: grid;
  border-bottom: 1px solid var(--color-line);
}

.create-todo__success {
  margin: var(--space-3) 0 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.create-todo__footer {
  display: grid;
  gap: var(--space-3);
}

.create-todo__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  align-items: center;
}

@media (max-width: 32rem) {
  .create-todo__row {
    grid-template-columns: 1fr;
  }
}
</style>
