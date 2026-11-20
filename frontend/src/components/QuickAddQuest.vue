<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createTodo, reorderDay } from "../api/day-planner.api";
import { useInsertPlace } from "../composables/useInsertPlace";
import { firstThatFits } from "../utils/fit-text";
import AppIcon from "./AppIcon.vue";

type OrderedItem = { type: "todo" | "habit"; id: number };

/**
 * One line to put a quest on a day: type a title, press Enter. It joins the
 * end of the day's order, or its head while ↑ ("Oben einfügen") is chosen;
 * the choice beside the field holds for every quick add on the device.
 */
const props = withDefaults(
  defineProps<{
    /** The day the quest is planned for, YYYY-MM-DD. */
    date: string;
    /** The day's current order; a quest added on top goes in front of it. */
    order?: OrderedItem[];
    /** Names the field when a view shows one per day. */
    label?: string;
  }>(),
  { order: () => [], label: "Quest für heute hinzufügen" },
);
const emit = defineEmits<{ created: [] }>();

const title = ref("");
const { place, choose } = useInsertPlace();
const busy = ref(false);
const errorMessage = ref<string | null>(null);

/*
 * The placeholder says as much as its field holds: a narrow day column of the
 * Plan gets the short form instead of one cut off in the middle of a word.
 */
const PLACEHOLDERS = ["Quest hinzufügen …", "Hinzufügen …"];
const placeholder = ref(PLACEHOLDERS[0]!);
const field = ref<HTMLInputElement | null>(null);
let observer: ResizeObserver | null = null;
let context: CanvasRenderingContext2D | null = null;
function fitPlaceholder(): void {
  const input = field.value;
  if (!input) return;
  context ??= document.createElement("canvas").getContext("2d");
  if (!context) return;
  const style = getComputedStyle(input);
  context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const available =
    input.clientWidth -
    parseFloat(style.paddingLeft) -
    parseFloat(style.paddingRight);
  placeholder.value = firstThatFits(
    PLACEHOLDERS,
    available,
    (text) => context!.measureText(text).width,
  );
}
onMounted(() => {
  // Browsers only: without layout (tests) the full placeholder stays.
  if (typeof ResizeObserver === "undefined" || !field.value) return;
  observer = new ResizeObserver(fitPlaceholder);
  observer.observe(field.value);
  // The web font changes the widths once it has arrived.
  void document.fonts?.ready.then(fitPlaceholder);
});
onBeforeUnmount(() => observer?.disconnect());

async function add(): Promise<void> {
  const text = title.value.trim();
  if (!text || busy.value) return;
  if (text.length > 200) {
    errorMessage.value = "Der Titel darf höchstens 200 Zeichen enthalten.";
    return;
  }
  busy.value = true;
  errorMessage.value = null;
  try {
    const created = await createTodo({
      title: text,
      scheduledDate: props.date,
      timeOfDay: null,
      plannedDurationMinutes: null,
    });
    title.value = "";
    // The quest exists either way; a failed sort only leaves it at the end.
    if (place.value === "top" && props.order.length)
      await reorderDay([{ type: "todo", id: created.id }, ...props.order]);
    emit("created");
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Quest konnte nicht erstellt werden.";
    if (!title.value) emit("created");
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <form class="quick-add" @submit.prevent="add">
    <div class="quick-add__row">
      <input
        ref="field"
        v-model="title"
        class="input quick-add__title"
        name="quickTitle"
        type="text"
        maxlength="200"
        enterkeyhint="done"
        autocomplete="off"
        :placeholder="placeholder"
        :aria-label="label"
        :disabled="busy"
      />
      <!-- Where a new quest joins the list: two small toggles, named in words. -->
      <div
        class="segmented quick-add__place"
        role="group"
        aria-label="Neue Quests einfügen"
      >
        <button
          type="button"
          aria-label="Oben einfügen"
          title="Oben einfügen"
          :aria-pressed="place === 'top'"
          @click="choose('top')"
        >
          <AppIcon name="arrow-up" />
        </button>
        <button
          type="button"
          aria-label="Unten einfügen"
          title="Unten einfügen"
          :aria-pressed="place === 'bottom'"
          @click="choose('bottom')"
        >
          <AppIcon name="arrow-down" />
        </button>
      </div>
    </div>
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
  </form>
</template>

<style scoped>
.quick-add {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-3);
}

.quick-add__row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.quick-add__title {
  flex: 1 1 auto;
  min-width: 0;
}

/* Compact: in a narrow Plan column the field keeps most of the width. */
.quick-add__place {
  flex: none;
  gap: 0.125rem;
  padding: 0.1875rem;
}

.quick-add__place > button {
  display: grid;
  place-items: center;
  width: 2rem;
  min-height: calc(var(--tap) - 0.375rem);
  padding: 0;
}

.quick-add__place :deep(svg) {
  width: 1.125rem;
  height: 1.125rem;
}
</style>
