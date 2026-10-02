<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import {
  getToday,
  updateOccurrenceStatus,
  updateTodoCompletion,
} from "../api/day-planner.api";
import CreateTodoForm from "../components/CreateTodoForm.vue";
import PlannerItem from "../components/PlannerItem.vue";
import PlannerItemEditor from "../components/PlannerItemEditor.vue";
import type {
  DayPlannerHabitItem,
  DayPlannerItem,
  DayPlannerResponse,
} from "../types/day-planner";
import { formatDateForGermanDisplay } from "../utils/date";

type EditingTarget = {
  kind: "todo" | "habit";
  entityId: number;
};

const planner = ref<DayPlannerResponse | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

const updatingKeys = ref<string[]>([]);

const editingTarget = ref<EditingTarget | null>(null);
const editorBusy = ref(false);

const formattedDate = computed(() => {
  if (!planner.value) {
    return "";
  }

  return formatDateForGermanDisplay(planner.value.date);
});

const overdueItems = computed(() => {
  return planner.value?.items.filter((item) => item.isOverdue) ?? [];
});

const openItems = computed(() => {
  return (
    planner.value?.items.filter(
      (item) => !item.isOverdue && item.status === "pending",
    ) ?? []
  );
});

const resolvedItems = computed(() => {
  return (
    planner.value?.items.filter(
      (item) => item.status === "completed" || item.status === "skipped",
    ) ?? []
  );
});

const hasItems = computed(() => {
  return (planner.value?.items.length ?? 0) > 0;
});

function getItemKey(item: DayPlannerItem): string {
  return item.type === "todo"
    ? `todo-${item.todoId}`
    : `habit-${item.occurrenceId}`;
}

function isUpdating(item: DayPlannerItem): boolean {
  return editorBusy.value || updatingKeys.value.includes(getItemKey(item));
}

function startUpdating(item: DayPlannerItem): void {
  const key = getItemKey(item);

  if (!updatingKeys.value.includes(key)) {
    updatingKeys.value.push(key);
  }
}

function stopUpdating(item: DayPlannerItem): void {
  const key = getItemKey(item);

  updatingKeys.value = updatingKeys.value.filter(
    (existingKey) => existingKey !== key,
  );
}

async function loadToday(showPageLoading = true): Promise<void> {
  if (showPageLoading) {
    isLoading.value = true;
  }

  errorMessage.value = null;

  try {
    planner.value = await getToday();
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Ein unbekannter Fehler ist aufgetreten.";
  } finally {
    if (showPageLoading) {
      isLoading.value = false;
    }
  }
}

async function toggleItem(item: DayPlannerItem): Promise<void> {
  if (isUpdating(item)) {
    return;
  }

  startUpdating(item);
  errorMessage.value = null;

  try {
    if (item.type === "todo") {
      await updateTodoCompletion(item.todoId, item.status !== "completed");
    } else {
      await updateOccurrenceStatus(
        item.occurrenceId,
        item.status === "pending" ? "completed" : "pending",
      );
    }

    await loadToday(false);
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Der Eintrag konnte nicht aktualisiert werden.";
  } finally {
    stopUpdating(item);
  }
}

async function skipHabit(item: DayPlannerHabitItem): Promise<void> {
  if (isUpdating(item)) {
    return;
  }

  startUpdating(item);
  errorMessage.value = null;

  try {
    await updateOccurrenceStatus(item.occurrenceId, "skipped");

    await loadToday(false);
  } catch (error: unknown) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Das Habit konnte nicht übersprungen werden.";
  } finally {
    stopUpdating(item);
  }
}

function openEditing(item: DayPlannerItem): void {
  if (editorBusy.value || updatingKeys.value.length > 0) {
    return;
  }

  editingTarget.value =
    item.type === "todo"
      ? {
          kind: "todo",
          entityId: item.todoId,
        }
      : {
          kind: "habit",
          entityId: item.habitId,
        };
}

function closeEditing(): void {
  editingTarget.value = null;
  editorBusy.value = false;
}

async function onEditorChanged(): Promise<void> {
  closeEditing();

  await loadToday(false);
}

onMounted(() => loadToday());
</script>

<template>
  <main class="today-view">
    <header class="today-view__header">
      <div>
        <p class="today-view__eyebrow">Tagesplan</p>

        <h1>Heute</h1>

        <p v-if="formattedDate" class="today-view__date">
          {{ formattedDate }}
        </p>
      </div>

      <button
        class="today-view__refresh"
        type="button"
        :disabled="isLoading || editorBusy"
        @click="loadToday()"
      >
        Aktualisieren
      </button>
    </header>

    <CreateTodoForm @created="loadToday(false)" />

    <PlannerItemEditor
      v-if="editingTarget"
      :key="`${editingTarget.kind}-${editingTarget.entityId}`"
      :kind="editingTarget.kind"
      :entity-id="editingTarget.entityId"
      @busy="editorBusy = $event"
      @changed="onEditorChanged"
      @close="closeEditing"
    />

    <p v-if="errorMessage" class="today-view__error" role="alert">
      {{ errorMessage }}
    </p>

    <div v-if="isLoading" class="today-view__state">
      Tagesplan wird geladen …
    </div>

    <div v-else-if="!hasItems && !errorMessage" class="today-view__state">
      <strong>Für heute ist nichts geplant.</strong>

      <span> Genieße den freien Raum oder plane einen neuen Eintrag. </span>
    </div>

    <div v-else-if="hasItems" class="today-view__sections">
      <section v-if="overdueItems.length > 0" class="today-section">
        <header class="today-section__header">
          <h2>Überfällig</h2>
          <span>{{ overdueItems.length }}</span>
        </header>

        <div class="today-section__items">
          <PlannerItem
            v-for="item in overdueItems"
            :key="getItemKey(item)"
            :item="item"
            :is-updating="isUpdating(item)"
            @toggle="toggleItem"
            @skip="skipHabit"
            @edit="openEditing"
          />
        </div>
      </section>

      <section v-if="openItems.length > 0" class="today-section">
        <header class="today-section__header">
          <h2>Offen</h2>
          <span>{{ openItems.length }}</span>
        </header>

        <div class="today-section__items">
          <PlannerItem
            v-for="item in openItems"
            :key="getItemKey(item)"
            :item="item"
            :is-updating="isUpdating(item)"
            @toggle="toggleItem"
            @skip="skipHabit"
            @edit="openEditing"
          />
        </div>
      </section>

      <section v-if="resolvedItems.length > 0" class="today-section">
        <header class="today-section__header">
          <h2>Abgeschlossen</h2>
          <span>{{ resolvedItems.length }}</span>
        </header>

        <div class="today-section__items">
          <PlannerItem
            v-for="item in resolvedItems"
            :key="getItemKey(item)"
            :item="item"
            :is-updating="isUpdating(item)"
            @toggle="toggleItem"
            @skip="skipHabit"
            @edit="openEditing"
          />
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.today-view {
  width: min(100% - 2rem, 46rem);
  margin: 0 auto;
  padding: 2rem 0 4rem;
}

.today-view__header {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 2rem;
}

.today-view__eyebrow {
  margin: 0 0 0.25rem;
  color: #68758b;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.today-view h1 {
  margin: 0;
  color: #151c2c;
  font-size: clamp(2rem, 8vw, 3rem);
  line-height: 1;
}

.today-view__date {
  margin: 0.5rem 0 0;
  color: #677287;
}

.today-view__refresh {
  padding: 0.65rem 0.9rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #ffffff;
  color: #2f3a4f;
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;
}

.today-view__refresh:disabled {
  cursor: wait;
  opacity: 0.5;
}

.today-view__error {
  margin: 0 0 1.5rem;
  padding: 0.875rem 1rem;
  border: 1px solid #f2aaaa;
  border-radius: 0.75rem;
  background: #fff0f0;
  color: #9b1c1c;
}

.today-view__state {
  display: grid;
  gap: 0.5rem;
  padding: 3rem 1.5rem;
  border: 1px dashed #c7ced9;
  border-radius: 1rem;
  color: #697386;
  text-align: center;
}

.today-view__sections {
  display: grid;
  gap: 2rem;
}

.today-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.today-section__header h2 {
  margin: 0;
  color: #273146;
  font-size: 1rem;
}

.today-section__header span {
  display: grid;
  min-width: 1.75rem;
  height: 1.75rem;
  place-items: center;
  border-radius: 999px;
  background: #e8ebf0;
  color: #59657a;
  font-size: 0.75rem;
  font-weight: 700;
}

.today-section__items {
  display: grid;
  gap: 0.75rem;
}

@media (max-width: 32rem) {
  .today-view {
    width: min(100% - 1rem, 46rem);
    padding-top: 1rem;
  }

  .today-view__header {
    align-items: center;
  }
}
</style>
