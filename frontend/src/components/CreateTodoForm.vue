<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId, watch } from "vue";
import { createTodo } from "../api/day-planner.api";
import {
  createNewPlaces,
  NewPlaceError,
  type CreatedPlaces,
} from "../api/new-places.api";
import { notifyDataChanged } from "../composables/data-sync";
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
import {
  categoryOfChoice,
  parentChoices,
  type ParentChoice,
} from "../utils/parent-choice";
import { categoryMark } from "../utils/category-mark";
import { isCampaignIcon } from "../utils/campaign-style";
import { parseQuest, type QuestParseKind } from "../utils/quest-parse";
import { whyBelow } from "../utils/why";
import CampaignFields from "./CampaignFields.vue";
import CategoryPicker from "./CategoryPicker.vue";
import ParentPicker from "./ParentPicker.vue";
import PlanFields from "./PlanFields.vue";
import AppointmentFields from "./AppointmentFields.vue";
import FormDisclosure from "./FormDisclosure.vue";
import WhyField from "./WhyField.vue";
import MicButton from "./MicButton.vue";
import QuestParseChips from "./QuestParseChips.vue";

const props = defineProps<{
  /** Created from inside a campaign or quest: it starts below that one. */
  parent?: HierarchyTodo | null;
  /** A new campaign: colour, icon and weekly goal instead of day and duration. */
  campaign?: boolean;
  /** Opened by a long press on Plus: dictation of the title starts at once. */
  dictate?: boolean;
  /** A suggested title to start from (a starter of Heute's welcome). */
  initialTitle?: string;
}>();

const emit = defineEmits<{
  /** The new quest, so a view can say where it now stands. */
  created: [todo: TodoResponse];
  busy: [value: boolean];
  cancel: [];
}>();

const title = ref(props.initialTitle ?? "");
const parentId = ref<number | null>(props.parent?.id ?? null);
/** What the new quest inherits from the quest it goes below. */
const inheritedWhy = ref<InheritedWhy | null>(
  props.parent ? whyBelow(props.parent) : null,
);
const date = ref("");
const time = ref("");
const durationMinutes = ref<string | number>("");
const categoryId = ref<number | null>(props.parent?.categoryId ?? null);
/** Null until the category picker loaded them. */
const categories = ref<CategoryResponse[] | null>(null);
/** The chosen category in words, for the closed disclosure. */
const categoryName = computed(() =>
  parsed.value?.newCategory
    ? `${parsed.value.newCategory} (neu)`
    : (categories.value?.find((entry) => entry.id === categoryId.value)
        ?.name ?? ""),
);
const why = ref("");
const color = ref<CampaignColor | null>(null);
const icon = ref<CampaignIcon | null>(null);
const weeklyTarget = ref<string | number>("");

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);

/*
 * Day and duration in a dictated title ("Steuererklärung morgen 30
 * Minuten") fill their fields while those are untouched, with the same chips
 * as the quick add. Only dictation is read: this form has its own fields for
 * day and duration, so a typed title stays exactly as typed ("Heute-Show
 * schauen"). A field set by hand keeps its value and leaves the words in the
 * title; a discarded chip does the same. Only on creating do the applied
 * words leave the title.
 *
 * A campaign or category named in it ("Kampagne Buch schreiben",
 * "Kategorie Sport") fills "Gehört zu" and Kategorie the same way, from the
 * lists the two pickers load. A named campaign brings its category, as a
 * chosen place does, unless a category was named too. A form opened inside
 * a campaign already has its place: only the category is read there.
 *
 * Named with its keyword but matching none ("Kategorie Haushalt"), a
 * campaign or category shows in its picker as "Neue Kategorie: Haushalt"
 * and is created on saving, before the quest, as the quick add does. A
 * pending new category wins over a preset one the way a named one does.
 */
const titleId = useId();
const mic = ref<InstanceType<typeof MicButton> | null>(null);
const untouched = (): Record<QuestParseKind, boolean> => ({
  date: false,
  duration: false,
  campaign: Boolean(props.parent),
  category: false,
});
const touched = ref(untouched());
/**
 * Every quest the parent picker loaded (null until then); its open
 * campaigns can be named. A list not loaded offers no new names either.
 */
const hierarchy = ref<HierarchyTodo[] | null>(null);
const campaignChoices = computed(() =>
  parentChoices(hierarchy.value ?? [], { campaignsOnly: true }),
);
const names = computed(() => ({
  campaigns: hierarchy.value
    ? campaignChoices.value.map(({ todo }) => ({
        id: todo.id,
        title: todo.title,
        icon: isCampaignIcon(todo.icon) ? todo.icon : null,
      }))
    : undefined,
  categories: categories.value?.map((category) => ({
    id: category.id,
    name: category.name,
    mark: categoryMark(category.name, category.color),
  })),
}));
/**
 * While dictation sets the category, the one it replaced (none, the
 * campaign's preset or a chosen place's) comes back when its chip goes.
 */
let categoryFromText = false;
let categoryBefore: number | null = null;
const ignored = ref<QuestParseKind[]>([]);
/** Set once dictation has written into the title; reading starts then. */
const dictated = ref(false);
const parsed = computed(() =>
  props.campaign || !dictated.value
    ? null
    : parseQuest(title.value, {
        ignore: [
          ...ignored.value,
          ...(["date", "duration", "campaign", "category"] as const).filter(
            (kind) => touched.value[kind],
          ),
        ],
        ...names.value,
        offerNew: true,
      }),
);
watch(parsed, (result) => {
  if (!result) return;
  if (!touched.value.date) date.value = result.scheduledDate ?? "";
  if (!touched.value.duration)
    durationMinutes.value = result.plannedDurationMinutes ?? "";
  const campaign = campaignChoices.value.find(
    (choice) => choice.todo.id === result.campaignId,
  );
  if (!touched.value.campaign) {
    const id = campaign?.todo.id ?? null;
    if (parentId.value !== id) {
      parentId.value = id;
      inheritedWhy.value = campaign ? whyBelow(campaign.todo) : null;
    }
  }
  if (!touched.value.category) {
    // A new category is none until saving; the picker shows it pending.
    const wanted =
      result.newCategory !== undefined
        ? null
        : (result.categoryId ??
          (campaign && !touched.value.campaign
            ? (categoryOfChoice(campaign) ?? undefined)
            : undefined));
    if (wanted !== undefined) {
      if (!categoryFromText) categoryBefore = categoryId.value;
      categoryFromText = true;
      categoryId.value = wanted;
    } else if (categoryFromText) {
      categoryFromText = false;
      categoryId.value = categoryBefore;
    }
  }
});
function setDate(value: string): void {
  touched.value.date = true;
  date.value = value;
}
function discard(kind: QuestParseKind): void {
  ignored.value = [...ignored.value, kind];
}

/** Dictated text joins what is typed, after a space. */
function onDictated(text: string): void {
  dictated.value = true;
  const typed = title.value.trimEnd();
  title.value = (typed ? `${typed} ${text}` : text).slice(0, 200);
}

onMounted(async () => {
  if (!props.dictate) return;
  await nextTick();
  void mic.value?.start();
});

/** A category the form would hold without dictation: none so far takes it. */
function suggestCategory(choice: ParentChoice): void {
  if (categoryFromText) categoryBefore ??= categoryOfChoice(choice);
  else if (categoryId.value === null)
    categoryId.value = categoryOfChoice(choice);
}
/** A chosen place brings its reason (live, never copied) and its category. */
function choose(choice: ParentChoice | null): void {
  touched.value.campaign = true;
  inheritedWhy.value = choice ? whyBelow(choice.todo) : null;
  if (choice) suggestCategory(choice);
}
/** Created inside a campaign: the campaign's category if the parent has none. */
function preset(choices: ParentChoice[], todos: HierarchyTodo[]): void {
  hierarchy.value = todos;
  const choice = choices.find((entry) => entry.todo.id === parentId.value);
  if (choice) suggestCategory(choice);
}
/** A category picked by hand stays, whatever the dictation names. */
function pickCategory(): void {
  touched.value.category = true;
  categoryFromText = false;
}

function buildInput(): CreateTodoInput {
  return buildTodoInput({
    title: parsed.value?.title ?? title.value,
    date: props.campaign ? "" : date.value,
    time: props.campaign ? "" : time.value,
    duration: props.campaign ? "" : durationMinutes.value,
  });
}

function resetForm(): void {
  title.value = "";
  dictated.value = false;
  date.value = "";
  time.value = "";
  durationMinutes.value = "";
  why.value = "";
  color.value = null;
  icon.value = null;
  weeklyTarget.value = "";
  touched.value = untouched();
  ignored.value = [];
  categoryFromText = false;
  createdBefore = {};
}

/**
 * Created on an earlier try whose quest then failed: taken again, never
 * created twice.
 */
let createdBefore: CreatedPlaces = {};

/** The new category and campaign the dictation named, created first. */
async function createPending(): Promise<CreatedPlaces> {
  const wanted = parsed.value;
  const reuse: CreatedPlaces = {
    ...(createdBefore.category?.name === wanted?.newCategory
      ? { category: createdBefore.category }
      : {}),
    ...(createdBefore.campaign?.title === wanted?.newCampaign
      ? { campaign: createdBefore.campaign }
      : {}),
  };
  const remember = (created: CreatedPlaces) => {
    createdBefore = { ...reuse, ...created };
    if (created.category || created.campaign) notifyDataChanged();
  };
  try {
    const created = await createNewPlaces(
      {
        category: reuse.category ? undefined : wanted?.newCategory,
        campaign: reuse.campaign ? undefined : wanted?.newCampaign,
      },
      reuse.category?.id ?? categoryId.value,
    );
    remember(created);
    return { ...reuse, ...created };
  } catch (error) {
    if (error instanceof NewPlaceError) remember(error.created);
    throw error;
  }
}

async function submit(): Promise<void> {
  if (isSubmitting.value) {
    return;
  }

  errorMessage.value = null;

  try {
    const input = buildInput();
    isSubmitting.value = true;
    emit("busy", true);
    const places = props.campaign ? {} : await createPending();
    input.parentId = props.campaign
      ? null
      : (places.campaign?.id ?? parentId.value);
    input.categoryId = places.category?.id ?? categoryId.value;
    if (why.value.trim()) input.why = why.value.trim();
    if (props.campaign) {
      const minutes = hoursToMinutes(weeklyTarget.value);
      if (minutes !== null) input.weeklyTargetMinutes = minutes;
      if (color.value) input.color = color.value;
      if (icon.value) input.icon = icon.value;
    }

    const todo = await createTodo(input);

    resetForm();
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
  <section class="create-todo">
    <form novalidate @submit.prevent="submit">
      <fieldset :disabled="isSubmitting">
        <div class="field">
          <label :for="titleId">Titel</label>
          <div class="mic-field">
            <input
              :id="titleId"
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
            <MicButton
              ref="mic"
              placement="field"
              label="Titel diktieren"
              @result="onDictated"
            />
          </div>
          <QuestParseChips
            v-if="parsed"
            :matches="parsed.matches"
            @remove="discard"
          />
        </div>

        <p v-if="campaign" class="create-todo__hint">
          Eine oberste Quest wird zur Kampagne, sobald sie Unter-Quests hat oder
          eine Farbe, ein Symbol oder ein Wochenziel bekommt.
        </p>

        <div v-else class="field">
          <label for="todo-parent">Gehört zu · optional</label>
          <ParentPicker
            id="todo-parent"
            v-model="parentId"
            :pending="parsed?.newCampaign ?? null"
            @chosen="choose"
            @ready="preset"
          />
        </div>

        <template v-if="!campaign">
          <PlanFields :date="date" id-prefix="todo" @update:date="setDate" />

          <div class="create-todo__row">
            <label class="field">
              Dauer in Minuten · optional
              <input
                v-model="durationMinutes"
                name="duration"
                type="number"
                min="1"
                step="1"
                placeholder="z. B. 30"
                @input="touched.duration = true"
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
              @update:model-value="pickCategory"
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
          <AppointmentFields
            v-model:time="time"
            :date="date"
            id-prefix="todo"
          />

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
                :pending="parsed?.newCategory ?? null"
                @update:model-value="pickCategory"
                @chosen="pickCategory"
                @loaded="categories = $event"
              />
            </div>
          </FormDisclosure>
        </div>
      </fieldset>

      <!-- It sticks to the dialog's bottom edge, like the editor's actions. -->
      <div
        class="create-todo__footer sticky-actions"
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
  </section>
</template>

<style scoped>
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
