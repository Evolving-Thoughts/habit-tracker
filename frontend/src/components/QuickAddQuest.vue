<script setup lang="ts">
import { ref } from "vue";
import { createTodo, reorderDay } from "../api/day-planner.api";

type OrderedItem = { type: "todo" | "habit"; id: number };

/**
 * One line to put a quest on a day: type a title, press Enter. It joins the
 * end of the day's order, or its head when "Oben" is chosen.
 */
const props = defineProps<{
  /** The day the quest is planned for, YYYY-MM-DD. */
  date: string;
  /** The day's current order; a quest added on top goes in front of it. */
  order: OrderedItem[];
  /** Tells the field apart when a view shows one per day. */
  label?: string;
}>();
const emit = defineEmits<{ created: [] }>();

const title = ref("");
const place = ref<"top" | "bottom">("bottom");
const busy = ref(false);
const errorMessage = ref<string | null>(null);

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
        v-model="title"
        class="input quick-add__title"
        name="quickTitle"
        type="text"
        maxlength="200"
        enterkeyhint="done"
        autocomplete="off"
        :placeholder="label ?? 'Quest hinzufügen …'"
        :aria-label="label ?? 'Quest für heute hinzufügen'"
        :disabled="busy"
      />
      <div class="segmented quick-add__place" role="group" aria-label="Einreihen">
        <button
          type="button"
          :aria-pressed="place === 'top'"
          @click="place = 'top'"
        >
          Oben
        </button>
        <button
          type="button"
          :aria-pressed="place === 'bottom'"
          @click="place = 'bottom'"
        >
          Unten
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

.quick-add__place {
  flex: none;
}
</style>
