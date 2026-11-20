<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createTodo } from "../api/day-planner.api";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import type { TodoResponse } from "../types/todo";
import { campaignMark, colorOfName } from "../utils/category-mark";
import { isCampaignIcon } from "../utils/campaign-style";
import { parentChoices, type ParentChoice } from "../utils/parent-choice";
import ComboBox, { type ComboOption } from "./ComboBox.vue";

/**
 * "Gehört zu": the campaign, Questreihe or quest an entry belongs to, shown
 * as its path ("Buch schreiben › Kapitel 2") with the campaign's badge.
 * Typing searches; "Keine" detaches. A name that does not exist yet offers
 * "Neue Kampagne „…“ anlegen": a new top-level quest in the colour its
 * title picks, which makes it a campaign (PRODUCT.md › Glossar), chosen
 * right away. `campaignsOnly` lists just the campaigns (a daily's field).
 */
const props = defineProps<{
  id: string;
  /** The entry itself: it and everything below it are no place for it. */
  exclude?: number | null;
  campaignsOnly?: boolean;
  /** What "Keine" means here, e.g. "Keine (eigene Kampagne)". */
  noneLabel?: string;
  describedBy?: string;
}>();
const model = defineModel<number | null>({ required: true });
const emit = defineEmits<{
  /** A choice by the person; null for "Keine". */
  chosen: [choice: ParentChoice | null];
  /** The places once loaded (and every quest), so a form can read the preset one. */
  ready: [choices: ParentChoice[], todos: HierarchyTodo[]];
}>();

const todos = ref<HierarchyTodo[]>([]);
const loading = ref(true);
const creating = ref(false);
const errorMessage = ref<string | null>(null);

const choices = computed(() =>
  parentChoices(todos.value, {
    exclude: props.exclude ?? null,
    keep: model.value,
    campaignsOnly: props.campaignsOnly,
  }),
);

onMounted(async () => {
  try {
    todos.value = await getTodoHierarchy();
    // Only a real answer: a form must not read "no quests below" from a failure.
    emit("ready", choices.value, todos.value);
  } catch {
    errorMessage.value =
      "Die Kampagnen konnten nicht geladen werden. Die Zuordnung bleibt, wie sie ist.";
  } finally {
    loading.value = false;
  }
});

const options = computed<ComboOption[]>(() => [
  { value: "none", label: props.noneLabel ?? "Keine" },
  ...choices.value.map(
    ({ todo, path, campaign }): ComboOption => ({
    value: String(todo.id),
    label: todo.title,
    lead: path.length > 1 ? `${path.slice(0, -1).join(" › ")} ›` : undefined,
    mark: campaignMark(campaign) ?? undefined,
    icon: isCampaignIcon(campaign.icon) ? campaign.icon : "campaigns",
  })),
]);
const value = computed({
  get: () => (model.value === null ? "none" : String(model.value)),
  set: (next: string) => {
    // The model reads the parent's prop, which updates only after this.
    const id = next === "none" ? null : Number(next);
    model.value = id;
    emit("chosen", choices.value.find((choice) => choice.todo.id === id) ?? null);
  },
});

/** A just-created quest as a row of the tree, until the next load. */
function asHierarchy(todo: TodoResponse): HierarchyTodo {
  return {
    ...todo,
    progress: {
      mode: "count",
      completed: 0,
      total: 0,
      percentage: 0,
      knownDurationMinutes: 0,
      todoCount: 0,
      doneCount: 0,
    },
  };
}

async function create(title: string): Promise<void> {
  if (creating.value) return;
  if (title.length > 200) {
    errorMessage.value = "Der Titel darf höchstens 200 Zeichen enthalten.";
    return;
  }
  creating.value = true;
  errorMessage.value = null;
  try {
    const todo = await createTodo({
      title,
      scheduledDate: null,
      timeOfDay: null,
      plannedDurationMinutes: null,
      color: colorOfName(title),
    });
    todos.value = [...todos.value, asHierarchy(todo)];
    value.value = String(todo.id);
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Kampagne konnte nicht angelegt werden.";
  } finally {
    creating.value = false;
  }
}
const errorId = computed(() => `${props.id}-error`);
</script>

<template>
  <ComboBox
    :id="id"
    v-model="value"
    :options="options"
    :disabled="loading || creating"
    :described-by="
      [describedBy, errorMessage ? errorId : null].filter(Boolean).join(' ') ||
      undefined
    "
    :placeholder="
      loading
        ? 'Kampagnen werden geladen …'
        : 'Kampagne suchen oder neu anlegen'
    "
    :create-label="(text) => `Neue Kampagne „${text}“ anlegen`"
    @create="create"
  />
  <p v-if="errorMessage" :id="errorId" class="form-error" role="alert">
    {{ errorMessage }}
  </p>
</template>
