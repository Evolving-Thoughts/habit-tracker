<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { getTodo, updateTodo } from "../api/day-planner.api";
import ModalDialog from "./ModalDialog.vue";
import ParentPicker from "./ParentPicker.vue";
import type { HierarchyTodo } from "../types/todo-hierarchy";

/**
 * "In Kampagne verschieben …" from a card's menu: the editor's "Gehört zu"
 * in a small dialog, the way for keys and touch where dragging in the
 * Kampagnen tree is not at hand. The quest moves with everything below it.
 */
const props = defineProps<{
  todoId: number;
  title: string;
  returnFocus: () => HTMLElement | null;
}>();
const emit = defineEmits<{
  close: [];
  moved: [];
  busy: [value: boolean];
}>();

const parentId = ref<number | null>(null);
const original = ref<number | null>(null);
/** At the top a quest with quests below is a campaign; a single one stands alone. */
const noneLabel = ref("Keine");
function readTree(_choices: unknown, todos: HierarchyTodo[]): void {
  noneLabel.value = todos.some((todo) => todo.parentId === props.todoId)
    ? "Keine (eigene Kampagne)"
    : "Keine (lose Quest)";
}
const loaded = ref(false);
const busy = ref(false);
const errorMessage = ref<string | null>(null);
watch(busy, (value) => emit("busy", value));

onMounted(async () => {
  try {
    const todo = await getTodo(props.todoId);
    parentId.value = original.value = todo.parentId;
    loaded.value = true;
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Quest konnte nicht geladen werden.";
  }
});

async function move(): Promise<void> {
  if (busy.value || !loaded.value) return;
  if (parentId.value === original.value) {
    emit("close");
    return;
  }
  busy.value = true;
  errorMessage.value = null;
  try {
    await updateTodo(props.todoId, { parentId: parentId.value });
    emit("moved");
  } catch (error) {
    errorMessage.value =
      error instanceof Error
        ? error.message
        : "Die Quest konnte nicht verschoben werden.";
  } finally {
    busy.value = false;
  }
}

function close(): void {
  if (!busy.value) emit("close");
}
</script>

<template>
  <ModalDialog
    title="In Kampagne verschieben"
    :busy="busy"
    :return-focus="returnFocus"
    focus-selector='[role="combobox"]:not(:disabled)'
    @close="close"
  >
    <form class="campaign-move" novalidate @submit.prevent="move">
      <p class="campaign-move__title">{{ title }}</p>
      <div v-if="loaded" class="field">
        <label for="campaign-move-parent">Gehört zu</label>
        <ParentPicker
          id="campaign-move-parent"
          v-model="parentId"
          :exclude="todoId"
          :none-label="noneLabel"
          described-by="campaign-move-hint"
          @ready="readTree"
        />
        <small id="campaign-move-hint" class="campaign-move__hint"
          >Alle Unter-Quests ziehen mit. Eine Kampagne unter einer anderen Quest
          verliert Farbe, Symbol und Wochenziel.</small
        >
      </div>
      <p v-else-if="!errorMessage" role="status">Wird geladen …</p>
      <p v-if="errorMessage" class="form-error" role="alert">
        {{ errorMessage }}
      </p>
      <div class="campaign-move__actions">
        <button type="submit" :disabled="!loaded">Verschieben</button>
        <button type="button" @click="close">Abbrechen</button>
      </div>
    </form>
  </ModalDialog>
</template>

<style scoped>
.campaign-move {
  display: grid;
  gap: var(--space-4);
}

.campaign-move p {
  margin: 0;
}

.campaign-move__title {
  font-weight: 700;
}

.campaign-move__hint {
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 400;
}

.campaign-move__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
</style>
