<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { getDayBest, getDayBestSettings } from "../api/day-bests.api";
import { useDayClock } from "../composables/useDayClock";
import { hrefOf } from "../routes";
import type { DayBest, DayBestSettings } from "../types/day-best";
import { cardVisible, nextCardChange } from "../utils/day-best";
import AppIcon from "./AppIcon.vue";
import DayBestField from "./DayBestField.vue";

/**
 * "Das Beste des Tages?" at the end of Heute: from the card time on (20:00
 * unless set otherwise) a calm card with one short line; before it nothing.
 * Once the day has its line, the card shows it quietly with a pencil to
 * change it. No count, no streak: a day without a line is just a day.
 */
const props = defineProps<{ date: string }>();

const settings = ref<DayBestSettings | null>(null);
const entry = ref<DayBest | null>(null);
const editing = ref(false);
const message = ref("");
const editButton = ref<HTMLButtonElement | null>(null);
const field = ref<InstanceType<typeof DayBestField> | null>(null);

async function loadSettings(): Promise<void> {
  try {
    settings.value = await getDayBestSettings();
  } catch {
    // Without its settings the card simply stays away; Heute is not about it.
  }
}
void loadSettings();

/* The clock wakes exactly when the card is due, while the page stays open. */
const now = useDayClock((minutes) =>
  settings.value ? nextCardChange(minutes, settings.value.cardTime) : null,
);
const visible = computed(
  () => !!settings.value && cardVisible(now.value, settings.value.cardTime),
);

let loadedFor: string | null = null;
async function loadEntry(): Promise<void> {
  const date = props.date;
  loadedFor = date;
  try {
    const found = await getDayBest(date);
    if (date === props.date) entry.value = found;
  } catch {
    if (date === props.date) entry.value = { date, text: "" };
  }
}
watch(
  [visible, () => props.date],
  ([shown, date]) => {
    if (shown && loadedFor !== date) void loadEntry();
  },
  { immediate: true },
);

const hasLine = computed(() => !!entry.value?.text);

async function edit(): Promise<void> {
  editing.value = true;
  message.value = "";
  await nextTick();
  field.value?.focus();
}

async function onSaved(saved: DayBest): Promise<void> {
  entry.value = saved;
  if (!saved.text) {
    message.value = "Entfernt.";
    return;
  }
  message.value = "Gespeichert.";
  // Saved with Enter, the focus is still in the card; left by Tab, it is not.
  const hadFocus = !!document.activeElement?.closest(".day-best-card");
  editing.value = false;
  // The field gives way to the line; the pencil keeps the place in the page.
  await nextTick();
  if (hadFocus) editButton.value?.focus();
}

async function onCancel(): Promise<void> {
  if (!hasLine.value) return;
  editing.value = false;
  await nextTick();
  editButton.value?.focus();
}
</script>

<template>
  <section
    v-if="visible && entry"
    class="day-best-card card"
    aria-labelledby="day-best-card-title"
  >
    <div class="card-head">
      <h2 id="day-best-card-title" class="card-title day-best-card__title">
        {{ hasLine ? "Das Beste des Tages" : "Das Beste des Tages?" }}
      </h2>
      <a class="day-best-card__all" :href="hrefOf('best')">Alle ansehen</a>
    </div>
    <div v-if="hasLine && !editing" class="day-best-card__line">
      <p class="day-best-card__text">{{ entry.text }}</p>
      <button
        ref="editButton"
        type="button"
        class="btn btn--icon btn--quiet"
        aria-label="Das Beste des Tages bearbeiten"
        title="Bearbeiten"
        @click="edit"
      >
        <AppIcon name="edit" />
      </button>
    </div>
    <DayBestField
      v-else
      ref="field"
      :date="date"
      :text="entry.text"
      label="Was war heute das Beste?"
      hide-label
      placeholder="Was war heute das Beste? Eine Zeile reicht."
      @saved="onSaved"
      @cancel="onCancel"
    />
    <p class="visually-hidden" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.day-best-card {
  margin-top: var(--space-6);
}

.day-best-card__title {
  color: var(--color-ink);
  font-size: 1rem;
  font-weight: 800;
}

.day-best-card__all {
  display: inline-flex;
  align-items: center;
  min-height: var(--tap);
  color: var(--color-action-strong);
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: underline;
  text-decoration-color: var(--color-line);
  text-underline-offset: 0.2em;
}

.day-best-card__line {
  display: flex;
  gap: var(--space-2);
  align-items: flex-start;
  justify-content: space-between;
}

.day-best-card__text {
  margin: 0;
  padding-top: var(--space-2);
  font-size: 1.0625rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.day-best-card__line .btn {
  margin: calc(var(--space-1) * -1) calc(var(--space-2) * -1) 0 0;
}
</style>
