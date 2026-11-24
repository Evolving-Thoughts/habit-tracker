<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createTodo, reorderDay } from "../api/day-planner.api";
import { useInsertPlace } from "../composables/useInsertPlace";
import { contentWidth, firstThatFits } from "../utils/fit-text";
import { parseQuest, type QuestParseKind } from "../utils/quest-parse";
import AppIcon from "./AppIcon.vue";
import MicButton from "./MicButton.vue";
import QuestParseChips from "./QuestParseChips.vue";

type OrderedItem = { type: "todo" | "habit"; id: number };

/**
 * One line to put a quest on a day, or into the Questlog: type a title,
 * press Enter. It joins the end of the day's order (or of the Questlog's),
 * or its head while ↑ ("Oben einfügen") is chosen; the choice beside the
 * field holds for every quick add on the device.
 *
 * Typed or dictated (the microphone in the field), a day and a duration in
 * the text ("Steuererklärung morgen 30 Minuten") show as chips under the
 * field and are taken on adding: the day wins over the row's, so "morgen"
 * in Heute plans it for tomorrow, and a day typed into the Questlog plans
 * it out of there. A tap on a chip leaves its words in the title instead.
 */
const props = withDefaults(
  defineProps<{
    /** The day the quest is planned for, YYYY-MM-DD; null for the Questlog. */
    date: string | null;
    /** The day's current order; a quest added on top goes in front of it. */
    order?: OrderedItem[];
    /** Names the field when a view shows one per day. */
    label?: string;
  }>(),
  { order: () => [], label: "Quest für heute hinzufügen" },
);
const emit = defineEmits<{ created: [] }>();

const MAX_TITLE = 200;
const title = ref("");
const { place, choose } = useInsertPlace();
const busy = ref(false);
const errorMessage = ref<string | null>(null);
/** Where the last quest went when that is not this list ("Für morgen …"). */
const notice = ref<string | null>(null);

/** Chips discarded for the text being typed; a fresh title starts clean. */
const ignored = ref<QuestParseKind[]>([]);
const parsed = computed(() =>
  parseQuest(title.value, { ignore: ignored.value }),
);
watch(title, (text) => {
  if (text.trim()) notice.value = null;
  else ignored.value = [];
});
function discard(kind: QuestParseKind): void {
  ignored.value = [...ignored.value, kind];
  field.value?.focus();
}

/** Dictated text joins what is typed, after a space. */
async function onDictated(text: string): Promise<void> {
  const typed = title.value.trimEnd();
  title.value = (typed ? `${typed} ${text}` : text).slice(0, MAX_TITLE);
  await nextTick();
  field.value?.focus();
}

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
  placeholder.value = firstThatFits(
    PLACEHOLDERS,
    contentWidth(input),
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
  if (text.length > MAX_TITLE) {
    errorMessage.value = "Der Titel darf höchstens 200 Zeichen enthalten.";
    return;
  }
  const result = parsed.value;
  const date =
    result.scheduledDate !== undefined ? result.scheduledDate : props.date;
  const dateMatch = result.matches.find((match) => match.kind === "date");
  busy.value = true;
  errorMessage.value = null;
  try {
    // Into the Questlog the server places it at the head or the end itself.
    const created = await createTodo({
      title: result.title.trim(),
      scheduledDate: date,
      timeOfDay: null,
      plannedDurationMinutes: result.plannedDurationMinutes ?? null,
      ...(date === null ? { backlogPlace: place.value } : {}),
    });
    title.value = "";
    ignored.value = [];
    // The quest exists either way; a failed sort only leaves it at the end.
    if (
      date !== null &&
      date === props.date &&
      place.value === "top" &&
      props.order.length
    )
      await reorderDay([{ type: "todo", id: created.id }, ...props.order]);
    if (date !== props.date && dateMatch)
      notice.value = `Für ${dateMatch.label} eingeplant.`;
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
      <div class="mic-field quick-add__field">
        <input
          ref="field"
          v-model="title"
          class="input quick-add__title"
          name="quickTitle"
          type="text"
          :maxlength="MAX_TITLE"
          enterkeyhint="done"
          autocomplete="off"
          :placeholder="placeholder"
          :aria-label="label"
          :disabled="busy"
        />
        <MicButton
          placement="field"
          label="Quest diktieren"
          @result="onDictated"
        />
      </div>
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
    <QuestParseChips
      :matches="parsed.matches"
      :moves="date === null"
      @remove="discard"
    />
    <p v-if="errorMessage" class="form-error" role="alert">
      {{ errorMessage }}
    </p>
    <p
      class="quick-add__notice"
      :class="{ 'quick-add__notice--empty': !notice }"
      role="status"
    >
      {{ notice }}
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

.quick-add__field {
  flex: 1 1 auto;
}

.quick-add__notice {
  margin: 0;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

/* Kept in the page while empty, so the next notice is announced. */
.quick-add__notice--empty {
  position: absolute;
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

/* A finger gets a full tap per arrow; a mouse keeps the slim pair. */
@media (pointer: coarse) {
  .quick-add__place {
    padding: 0.125rem;
  }

  .quick-add__place > button {
    width: var(--tap);
    min-height: var(--tap);
  }
}
</style>
