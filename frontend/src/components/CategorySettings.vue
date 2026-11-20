<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  createCategory,
  deleteCategory,
  getCategories,
  renameCategory,
  setCategoryColor,
  setCategoryTarget,
} from "../api/categories.api";
import AppIcon from "../components/AppIcon.vue";
import MarkPicker from "../components/MarkPicker.vue";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import type { CampaignColor } from "../types/campaign";
import type { CategoryResponse } from "../types/category";
import { COLOR_NAMES, isCampaignColor } from "../utils/campaign-style";
import { categoryMark } from "../utils/category-mark";

const newName = ref("");
/** The new category's colour; null lets its name pick one. */
const newColor = ref<CampaignColor | null>(null);
const newColorOpen = ref(false);
/** The category whose palette is open below its row. */
const colorOpenId = ref<number | null>(null);
const editingId = ref<number | null>(null);
const editedName = ref("");
const deletingId = ref<number | null>(null);
/** Write errors stay next to the form; load errors get the recovery panel. */
const saveError = ref<string | null>(null);
/** Quiet per-row feedback after a weekly target change. */
const targetFeedback = ref<
  | { id: number; saved: true }
  | { id: number; saved: false; message: string }
  | null
>(null);
let feedbackTimer: ReturnType<typeof setTimeout> | undefined;

const {
  data: categories,
  isLoading,
  errorMessage,
  reload,
} = useLoader<CategoryResponse[]>(getCategories, {
  initial: [],
  fallbackError: "Die Kategorien konnten nicht geladen werden.",
  refreshOnChange: () => !isSaving.value && editingId.value === null,
});
const { write, busy: isSaving } = useWrites(reload, saveError);

onUnmounted(() => clearTimeout(feedbackTimer));

const run = (action: () => Promise<unknown>): Promise<boolean> =>
  write(action, {
    fallbackError: "Die Änderung konnte nicht gespeichert werden.",
  });

async function add(): Promise<void> {
  const name = newName.value.trim();
  if (name && (await run(() => createCategory(name, newColor.value)))) {
    newName.value = "";
    newColor.value = null;
    newColorOpen.value = false;
  }
}

/** The chosen colour as a key; null while the name picks it. */
const chosenColor = (category: CategoryResponse): CampaignColor | null =>
  isCampaignColor(category.color) ? category.color : null;

/** "Tanne" or "automatisch": what the dot shows, in words. */
const colorWords = (color: CampaignColor | null): string =>
  color ? COLOR_NAMES[color] : "automatisch";

function toggleColor(id: number): void {
  colorOpenId.value = colorOpenId.value === id ? null : id;
  editingId.value = null;
  deletingId.value = null;
}

async function saveColor(
  id: number,
  color: CampaignColor | null,
): Promise<void> {
  if (await run(() => setCategoryColor(id, color)))
    showTargetFeedback({ id, saved: true });
}

function startEditing(category: CategoryResponse): void {
  editingId.value = category.id;
  editedName.value = category.name;
  deletingId.value = null;
}

async function saveName(id: number): Promise<void> {
  const name = editedName.value.trim();
  if (name && (await run(() => renameCategory(id, name))))
    editingId.value = null;
}

function showTargetFeedback(
  feedback: NonNullable<typeof targetFeedback.value>,
): void {
  clearTimeout(feedbackTimer);
  targetFeedback.value = feedback;
  if (feedback.saved)
    feedbackTimer = setTimeout(() => (targetFeedback.value = null), 2000);
}

async function saveTarget(id: number, value: string): Promise<void> {
  const target = Number(value);
  if (value && !(Number.isInteger(target) && target >= 1)) {
    showTargetFeedback({
      id,
      saved: false,
      message: "Das Wochensoll muss eine ganze Zahl ab 1 sein.",
    });
    return;
  }
  const saved = await run(() => setCategoryTarget(id, value ? target : null));
  if (saved) showTargetFeedback({ id, saved: true });
  else {
    showTargetFeedback({
      id,
      saved: false,
      message:
        saveError.value ?? "Das Wochensoll konnte nicht gespeichert werden.",
    });
    saveError.value = null;
  }
}

async function remove(id: number): Promise<void> {
  if (await run(() => deleteCategory(id))) deletingId.value = null;
}
</script>

<template>
  <div class="category-settings">
    <p class="category-settings__lead">
      Kategorien ordnen deine Quests und Dailies. Ein Wochensoll ist
      freiwillig: so oft willst du pro Woche etwas aus der Kategorie
      erledigen.
    </p>

    <form class="category-settings__create" @submit.prevent="add">
      <button
        class="category-settings__dot"
        type="button"
        :style="{ '--mark': categoryMark(newName.trim(), newColor) }"
        :aria-label="`Farbe der neuen Kategorie: ${colorWords(newColor)}`"
        :aria-expanded="newColorOpen"
        aria-controls="new-category-color"
        title="Farbe wählen"
        @click="newColorOpen = !newColorOpen"
      >
        <span aria-hidden="true" />
      </button>
      <label class="field category-settings__grow">
        Neue Kategorie
        <input v-model="newName" name="name" maxlength="60" />
      </label>
      <button
        class="btn btn--primary"
        type="submit"
        :disabled="isSaving || !newName.trim()"
      >
        <AppIcon name="plus" />
        Anlegen
      </button>
      <MarkPicker
        v-if="newColorOpen"
        id="new-category-color"
        v-model="newColor"
        class="category-settings__picker"
        name="new-category-color"
        legend="Farbe der neuen Kategorie"
        :automatic="categoryMark(newName.trim())"
        automatic-label="Automatisch aus dem Namen"
      />
    </form>
    <p
      v-if="saveError"
      class="form-error category-settings__save-error"
      role="alert"
    >
      {{ saveError }}
    </p>

    <div
      v-if="isLoading"
      class="skeleton category-settings__state"
      role="status"
      aria-label="Kategorien werden geladen"
    >
      <span />
      <span />
      <span />
    </div>

    <div
      v-else-if="errorMessage"
      class="alert category-settings__state"
      role="alert"
    >
      <p>{{ errorMessage }}</p>
      <button class="btn btn--ground" type="button" @click="reload()">
        <AppIcon name="refresh" />
        Erneut versuchen
      </button>
    </div>

    <p v-else-if="!categories.length" class="category-settings__state">
      <strong>Noch keine Kategorien.</strong>
      Lege oben eine an. Zuordnen kannst du sie beim Bearbeiten einer Quest
      oder eines Dailys.
    </p>

    <ul v-else class="category-settings__list">
      <li
        v-for="category in categories"
        :key="category.id"
        class="category-settings__item"
      >
        <form
          v-if="editingId === category.id"
          class="category-settings__row"
          @submit.prevent="saveName(category.id)"
        >
          <input
            v-model="editedName"
            class="input category-settings__grow"
            :aria-label="`Neuer Name für ${category.name}`"
            maxlength="60"
          />
          <button class="btn" type="submit" :disabled="isSaving">
            Speichern
          </button>
          <button
            class="btn btn--quiet"
            type="button"
            @click="editingId = null"
          >
            Abbrechen
          </button>
        </form>

        <div
          v-else-if="deletingId === category.id"
          class="category-settings__confirm"
        >
          <p>
            „{{ category.name }}“ löschen? Zugeordnete Einträge bleiben ohne
            Kategorie erhalten.
          </p>
          <div class="category-settings__row">
            <button
              class="btn btn--danger"
              type="button"
              :disabled="isSaving"
              @click="remove(category.id)"
            >
              Löschen
            </button>
            <button
              class="btn btn--quiet"
              type="button"
              @click="deletingId = null"
            >
              Abbrechen
            </button>
          </div>
        </div>

        <div v-else class="category-settings__entry">
          <!-- The dot opens the palette, the same one campaigns use. -->
          <button
            class="category-settings__dot"
            type="button"
            :style="{
              '--mark': categoryMark(category.name, category.color),
            }"
            :aria-label="`Farbe von ${category.name}: ${colorWords(chosenColor(category))}`"
            :aria-expanded="colorOpenId === category.id"
            :aria-controls="`category-color-${category.id}`"
            title="Farbe wählen"
            @click="toggleColor(category.id)"
          >
            <span aria-hidden="true" />
          </button>
          <span class="category-settings__name">{{ category.name }}</span>
          <div class="category-settings__target">
            <label class="category-settings__target-field">
              <span aria-hidden="true">Wochensoll</span>
              <input
                class="input"
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                :value="category.weeklyTarget ?? ''"
                :aria-label="`Wochensoll für ${category.name}`"
                @change="
                  saveTarget(
                    category.id,
                    ($event.target as HTMLInputElement).value,
                  )
                "
              />
              <span aria-hidden="true">mal</span>
            </label>
            <span class="category-settings__status" aria-live="polite">
              <template
                v-if="
                  targetFeedback?.id === category.id && targetFeedback.saved
                "
                >Gespeichert</template
              >
            </span>
          </div>
          <div class="category-settings__actions">
            <button
              class="btn btn--quiet btn--icon"
              type="button"
              :aria-label="`${category.name} umbenennen`"
              @click="startEditing(category)"
            >
              <AppIcon name="edit" />
            </button>
            <button
              class="btn btn--quiet btn--icon"
              type="button"
              :aria-label="`${category.name} löschen`"
              @click="deletingId = category.id"
            >
              <AppIcon name="trash" />
            </button>
          </div>
          <MarkPicker
            v-if="colorOpenId === category.id"
            :id="`category-color-${category.id}`"
            class="category-settings__picker"
            :model-value="chosenColor(category)"
            :name="`category-color-${category.id}`"
            :legend="`Farbe von ${category.name}`"
            :automatic="categoryMark(category.name)"
            automatic-label="Automatisch aus dem Namen"
            @update:model-value="saveColor(category.id, $event)"
          />
          <p
            v-if="targetFeedback?.id === category.id && !targetFeedback.saved"
            class="form-error category-settings__row-error"
            role="alert"
          >
            {{ targetFeedback.message }}
          </p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.category-settings__lead {
  margin: 0 0 var(--space-3);
  color: var(--color-ink-muted);
}

.category-settings__create {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: end;
}

.category-settings__grow {
  flex: 1 1 12rem;
  min-width: 0;
}

.category-settings__save-error {
  margin-top: var(--space-2);
}

.category-settings__state,
.category-settings__list {
  margin: var(--space-4) 0 0;
}

p.category-settings__state {
  color: var(--color-ink-muted);
}

p.category-settings__state strong {
  color: var(--color-ink);
}

.category-settings__list {
  padding: 0;
  border-top: 1px solid var(--color-line);
  list-style: none;
}

.category-settings__item {
  padding: var(--space-2) 0;
}

.category-settings__item + .category-settings__item {
  border-top: 1px solid var(--color-line);
}

.category-settings__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
}

/* The mark in a tap-sized button: it opens the palette. */
.category-settings__dot {
  display: grid;
  flex: none;
  width: var(--tap);
  height: var(--tap);
  place-items: center;
  margin-inline: calc(var(--space-2) * -1) calc(var(--space-3) * -1);
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  transition: transform 420ms var(--spring);
}

.category-settings__dot span {
  width: 1rem;
  height: 1rem;
  border-radius: 0.3rem;
  background: var(--mark);
}

.category-settings__dot:hover {
  background: var(--color-action-tint);
}

.category-settings__dot:active {
  transform: var(--press);
  transition-duration: 90ms;
}

.category-settings__create .category-settings__dot {
  align-self: end;
  margin-inline: 0;
}

.category-settings__picker {
  flex: 1 0 100%;
  grid-area: picker;
  padding: var(--space-2) 0 var(--space-1);
}

.category-settings__name {
  flex: 1 1 8rem;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

/* Mobile: name and actions on one line, the weekly target below the name. */
.category-settings__entry {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "mark name actions"
    ". target target"
    "picker picker picker"
    ". error error";
  gap: 0 var(--space-3);
  align-items: center;
}

.category-settings__entry .category-settings__dot {
  grid-area: mark;
}

.category-settings__name {
  grid-area: name;
}

.category-settings__target {
  grid-area: target;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  padding-bottom: var(--space-1);
}

.category-settings__target-field {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.category-settings__target .input {
  width: 4.5rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.category-settings__actions {
  grid-area: actions;
  display: flex;
  margin-inline-end: calc(var(--space-2) * -1);
}

.category-settings__status {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.category-settings__row-error {
  grid-area: error;
  padding-bottom: var(--space-1);
}

@media (min-width: 36rem) {
  .category-settings__entry {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      "mark name target actions"
      "picker picker picker picker"
      ". error error error";
  }

  .category-settings__target {
    flex-direction: row-reverse;
    padding-bottom: 0;
  }
}

.category-settings__confirm {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.category-settings__confirm p {
  margin: 0;
}
</style>
