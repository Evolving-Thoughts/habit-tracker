<script setup lang="ts">
import { ref } from "vue";
import {
  createCategory,
  deleteCategory,
  getCategories,
  renameCategory,
  setCategoryTarget,
} from "../api/categories.api";
import { notifyDataChanged } from "../composables/data-sync";
import { useLoader } from "../composables/useLoader";
import type { CategoryResponse } from "../types/category";

const newName = ref("");
const editingId = ref<number | null>(null);
const editedName = ref("");
const deletingId = ref<number | null>(null);
const isSaving = ref(false);

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

async function run(action: () => Promise<unknown>): Promise<boolean> {
  if (isSaving.value) return false;
  isSaving.value = true;
  errorMessage.value = null;
  try {
    await action();
    notifyDataChanged();
    await reload(false);
    return true;
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Änderung konnte nicht gespeichert werden.";
    return false;
  } finally {
    isSaving.value = false;
  }
}

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

async function saveTarget(id: number, value: string): Promise<void> {
  const target = Number(value);
  if (!value) await run(() => setCategoryTarget(id, null));
  else if (Number.isInteger(target) && target >= 1)
    await run(() => setCategoryTarget(id, target));
  else errorMessage.value = "Das Wochensoll muss eine ganze Zahl ab 1 sein.";
}

async function remove(id: number): Promise<void> {
  if (await run(() => deleteCategory(id))) deletingId.value = null;
}
</script>

<template>
  <main class="categories-view">
    <h1>Kategorien</h1>

    <form class="categories-view__row" @submit.prevent="add">
      <label class="categories-view__grow">
        Neue Kategorie
        <input v-model="newName" name="name" maxlength="60" />
      </label>
      <button type="submit" :disabled="isSaving || !newName.trim()">
        Hinzufügen
      </button>
    </form>

    <p v-if="errorMessage" class="categories-view__error" role="alert">
      {{ errorMessage }}
    </p>
    <p v-if="isLoading">Kategorien werden geladen …</p>
    <p v-else-if="!categories.length && !errorMessage">
      Noch keine Kategorien. Zuordnen kannst du sie beim Bearbeiten eines Todos
      oder Habits.
    </p>

    <ul class="categories-view__list">
      <li v-for="category in categories" :key="category.id">
        <form
          v-if="editingId === category.id"
          class="categories-view__row"
          @submit.prevent="saveName(category.id)"
        >
          <input
            v-model="editedName"
            class="categories-view__grow"
            :aria-label="`${category.name} umbenennen`"
            maxlength="60"
          />
          <button type="submit" :disabled="isSaving">Speichern</button>
          <button type="button" @click="editingId = null">Abbrechen</button>
        </form>
        <div v-else-if="deletingId === category.id">
          <p>
            „{{ category.name }}“ löschen? Zugeordnete Einträge bleiben ohne
            Kategorie erhalten.
          </p>
          <div class="categories-view__row">
            <button
              type="button"
              :disabled="isSaving"
              @click="remove(category.id)"
            >
              Löschen
            </button>
            <button type="button" @click="deletingId = null">Abbrechen</button>
          </div>
        </div>
        <div v-else class="categories-view__row">
          <span class="categories-view__grow">{{ category.name }}</span>
          <label class="categories-view__target">
            Wochensoll
            <input
              type="number"
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
          <button type="button" @click="startEditing(category)">
            Umbenennen
          </button>
          <button type="button" @click="deletingId = category.id">
            Löschen
          </button>
        </div>
      </li>
    </ul>
  </main>
</template>

<style scoped>
.categories-view {
  display: grid;
  gap: 1rem;
  width: min(100%, 42rem);
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.categories-view h1,
.categories-view p {
  margin: 0;
}

.categories-view__row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: end;
}

.categories-view__grow {
  display: grid;
  flex: 1 1 12rem;
  gap: 0.25rem;
  min-width: 0;
  overflow-wrap: anywhere;
}

.categories-view__target {
  display: grid;
  gap: 0.25rem;
  width: 6rem;
  font-size: 0.8125rem;
}

.categories-view__target input {
  width: 100%;
  box-sizing: border-box;
}

.categories-view input {
  min-height: 2.75rem;
  padding: 0 0.625rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  font: inherit;
}

.categories-view button {
  min-height: 2.75rem;
  padding: 0 0.875rem;
  border: 1px solid #d9dde5;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #182033;
  font: inherit;
  cursor: pointer;
}

.categories-view__list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.categories-view__list li {
  padding: 0.75rem;
  border: 1px solid #d9dde5;
  border-radius: 0.875rem;
  background: #ffffff;
}

.categories-view__error {
  color: #b42318;
}
</style>
