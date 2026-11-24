<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createCampaign } from "../api/new-places.api";
import { getTodoHierarchy } from "../api/todo-hierarchy.api";
import type { HierarchyTodo } from "../types/todo-hierarchy";
import { campaignMark, categoryMark } from "../utils/category-mark";
import { isCampaignIcon } from "../utils/campaign-style";
import { parentChoices, type ParentChoice } from "../utils/parent-choice";
import { asHierarchyTodo } from "../utils/todo-hierarchy";
import ComboBox, { type ComboOption } from "./ComboBox.vue";

/**
 * "Gehört zu": the campaign, Questreihe or quest an entry belongs to, shown
 * as its path ("Buch schreiben › Kapitel 2") with the campaign's badge.
 * Typing searches; "Keine" detaches. A name that does not exist yet offers
 * "Neue Kampagne „…“ anlegen": a new top-level quest in the colour its
 * title picks, which makes it a campaign (PRODUCT.md › Glossar), chosen
 * right away. `campaignsOnly` lists just the campaigns (a daily's field).
 *
 * `pending` shows a campaign the form will create on saving (a dictated
 * "Kampagne Umzug") as the choice while none is chosen: "Neue Kampagne:
 * Umzug" with a plus on its badge. Any other choice replaces it.
 */
const props = defineProps<{
  id: string;
  /** The entry itself: it and everything below it are no place for it. */
  exclude?: number | null;
  campaignsOnly?: boolean;
  /** What "Keine" means here, e.g. "Keine (eigene Kampagne)". */
  noneLabel?: string;
  describedBy?: string;
  /** The title of a campaign created on saving; shown while none is chosen. */
  pending?: string | null;
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

const PENDING = "pending";
const showsPending = computed(
  () => Boolean(props.pending) && model.value === null,
);
// Last, so typing a name picks an existing place first.
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
  ...(showsPending.value
    ? [
        {
          value: PENDING,
          label: `Neue Kampagne: ${props.pending}`,
          mark: categoryMark(props.pending!),
          icon: "plus" as const,
        },
      ]
    : []),
]);
const value = computed({
  get: () =>
    showsPending.value
      ? PENDING
      : model.value === null
        ? "none"
        : String(model.value),
  set: (next: string) => {
    if (next === PENDING) return;
    // The model reads the parent's prop, which updates only after this.
    const id = next === "none" ? null : Number(next);
    model.value = id;
    emit("chosen", choices.value.find((choice) => choice.todo.id === id) ?? null);
  },
});

async function create(title: string): Promise<void> {
  if (creating.value) return;
  if (title.length > 200) {
    errorMessage.value = "Der Titel darf höchstens 200 Zeichen enthalten.";
    return;
  }
  creating.value = true;
  errorMessage.value = null;
  try {
    const todo = await createCampaign(title);
    todos.value = [...todos.value, asHierarchyTodo(todo)];
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
