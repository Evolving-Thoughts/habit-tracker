<script setup lang="ts">
import { onUnmounted, ref } from "vue";
import {
  createCategory,
  deleteCategory,
  getCategories,
  renameCategory,
  setCategoryTarget,
} from "../api/categories.api";
import AppIcon from "../components/AppIcon.vue";
import { useLoader } from "../composables/useLoader";
import { useWrites } from "../composables/useWrites";
import type { CategoryResponse } from "../types/category";
import { categoryMark } from "../utils/category-mark";

const newName = ref("");
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
  if (name && (await run(() => createCategory(name)))) newName.value = "";
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
  <main class="page categories-view">
    <header class="page-header">
      <h1 class="page-title">Kategorien</h1>
      <p class="page-lead">
        Kategorien ordnen deine Aufgaben und Habits. Ein Wochensoll ist
        freiwillig.
      </p>
    </header>

    <form class="categories-view__create" @submit.prevent="add">
      <label class="field categories-view__grow">
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
    </form>
    <p
      v-if="saveError"
      class="form-error categories-view__save-error"
      role="alert"
    >
      {{ saveError }}
    </p>

    <div
      v-if="isLoading"
      class="skeleton categories-view__state"
      role="status"
      aria-label="Kategorien werden geladen"
    >
      <span />
      <span />
      <span />
    </div>

    <div
      v-else-if="errorMessage"
      class="alert categories-view__state"
      role="alert"
    >
      <p>{{ errorMessage }}</p>
      <button class="btn btn--ground" type="button" @click="reload()">
        <AppIcon name="refresh" />
        Erneut versuchen
      </button>
    </div>

    <div
      v-else-if="!categories.length"
      class="empty-state categories-view__state"
    >
      <strong>Noch keine Kategorien.</strong>
      <span>
        Lege oben eine an. Zuordnen kannst du sie beim Bearbeiten einer Aufgabe
        oder eines Habits.
      </span>
    </div>

    <ul v-else class="card categories-view__list">
      <li
        v-for="category in categories"
        :key="category.id"
        class="categories-view__item"
      >
        <form
          v-if="editingId === category.id"
          class="categories-view__row"
          @submit.prevent="saveName(category.id)"
        >
          <input
            v-model="editedName"
            class="input categories-view__grow"
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
          class="categories-view__confirm"
        >
          <p>
            „{{ category.name }}“ löschen? Zugeordnete Einträge bleiben ohne
            Kategorie erhalten.
          </p>
          <div class="categories-view__row">
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

        <div v-else class="categories-view__entry">
          <span
            class="category-mark"
            :style="{ background: categoryMark(category.name) }"
            aria-hidden="true"
          />
          <span class="categories-view__name">{{ category.name }}</span>
          <div class="categories-view__target">
            <label class="categories-view__target-field">
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
            </label>
            <span class="categories-view__status" aria-live="polite">
              <template
                v-if="
                  targetFeedback?.id === category.id && targetFeedback.saved
                "
                >Gespeichert</template
              >
            </span>
          </div>
          <div class="categories-view__actions">
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
          <p
            v-if="targetFeedback?.id === category.id && !targetFeedback.saved"
            class="form-error categories-view__row-error"
            role="alert"
          >
            {{ targetFeedback.message }}
          </p>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.categories-view__create {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: end;
}

.categories-view__grow {
  flex: 1 1 12rem;
  min-width: 0;
}

.categories-view__save-error {
  margin-top: var(--space-2);
}

.categories-view__state,
.categories-view__list {
  margin-top: var(--space-5);
}

.categories-view__list {
  margin-bottom: 0;
  padding: var(--space-1) var(--space-4);
  list-style: none;
}

.categories-view__item {
  padding: var(--space-2) 0;
}

.categories-view__item + .categories-view__item {
  border-top: 1px solid var(--color-line);
}

.categories-view__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
}

.category-mark {
  flex: none;
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 0.2rem;
}

.categories-view__name {
  flex: 1 1 8rem;
  min-width: 0;
  font-size: 1.0625rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

/* Mobile: name and actions on one line, the weekly target below the name. */
.categories-view__entry {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    "mark name actions"
    ". target target"
    ". error error";
  gap: 0 var(--space-3);
  align-items: center;
}

.categories-view__entry .category-mark {
  grid-area: mark;
}

.categories-view__name {
  grid-area: name;
}

.categories-view__target {
  grid-area: target;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-3);
  align-items: center;
  padding-bottom: var(--space-1);
}

.categories-view__target-field {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.categories-view__target .input {
  width: 4.5rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.categories-view__actions {
  grid-area: actions;
  display: flex;
  margin-inline-end: calc(var(--space-2) * -1);
}

.categories-view__status {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 700;
}

.categories-view__row-error {
  grid-area: error;
  padding-bottom: var(--space-1);
}

@media (min-width: 36rem) {
  .categories-view__entry {
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    grid-template-areas:
      "mark name target actions"
      ". error error error";
  }

  .categories-view__target {
    flex-direction: row-reverse;
    padding-bottom: 0;
  }
}

.categories-view__confirm {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) 0;
}

.categories-view__confirm p {
  margin: 0;
}
</style>
