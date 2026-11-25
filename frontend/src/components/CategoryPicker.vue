<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { createCategory, getCategories } from "../api/categories.api";
import type { CategoryResponse } from "../types/category";
import { markToken } from "../utils/campaign-style";
import { categoryMark, newCategoryColor } from "../utils/category-mark";
import ComboBox, { type ComboOption } from "./ComboBox.vue";

/**
 * "Kategorie": choose one by typing or from the list, each with its colour
 * mark beside the name, or type a new name and create it on the spot
 * ("Neue Kategorie „Lesen“ anlegen"); it is chosen right away.
 *
 * `pending` shows a category the form will create on saving (a dictated
 * "Kategorie Haushalt") as the choice while none is chosen: "Neue
 * Kategorie: Haushalt" with a plus. Any other choice replaces it.
 */
const props = defineProps<{
  id: string;
  describedBy?: string;
  /** The name of a category created on saving; shown while none is chosen. */
  pending?: string | null;
}>();
const model = defineModel<number | null>({ required: true });
/**
 * The list once loaded or grown, so a form can name the chosen category.
 * Not after a failed load: a form then knows no category, not "none".
 */
const emit = defineEmits<{
  loaded: [categories: CategoryResponse[]];
  /** A pick by the person, also of the value held ("Keine" over a pending one). */
  chosen: [];
}>();

const categories = ref<CategoryResponse[]>([]);
const creating = ref(false);
const errorMessage = ref<string | null>(null);

onMounted(async () => {
  try {
    categories.value = await getCategories();
    emit("loaded", categories.value);
  } catch {
    // Saving an entry must still work without the optional category list.
    categories.value = [];
  }
});

const PENDING = "pending";
const showsPending = computed(
  () => Boolean(props.pending) && model.value === null,
);
// Last, so typing a name picks an existing category first.
const options = computed<ComboOption[]>(() => [
  { value: "none", label: "Keine" },
  ...categories.value.map((category) => ({
    value: String(category.id),
    label: category.name,
    mark: categoryMark(category.name, category.color),
  })),
  ...(showsPending.value
    ? [
        {
          value: PENDING,
          label: `Neue Kategorie: ${props.pending}`,
          mark: markToken(
            newCategoryColor(
              props.pending!,
              categories.value.map((category) => category.color),
            ),
          ),
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
    model.value = next === "none" ? null : Number(next);
    emit("chosen");
  },
});

async function create(name: string): Promise<void> {
  if (creating.value) return;
  if (name.length > 60) {
    errorMessage.value = "Der Name darf höchstens 60 Zeichen haben.";
    return;
  }
  creating.value = true;
  errorMessage.value = null;
  try {
    const category = await createCategory(name);
    categories.value = [...categories.value, category];
    emit("loaded", categories.value);
    model.value = category.id;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Kategorie konnte nicht angelegt werden.";
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
    :disabled="creating"
    :described-by="
      [describedBy, errorMessage ? errorId : null].filter(Boolean).join(' ') ||
      undefined
    "
    placeholder="Kategorie suchen oder neu anlegen"
    :create-label="(text) => `Neue Kategorie „${text}“ anlegen`"
    @create="create"
  />
  <p v-if="errorMessage" :id="errorId" class="form-error" role="alert">
    {{ errorMessage }}
  </p>
</template>
