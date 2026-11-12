<script setup lang="ts">
import { computed, ref } from "vue";
import AppIcon from "./AppIcon.vue";
import CreateHabitForm from "./CreateHabitForm.vue";
import CreateTodoForm from "./CreateTodoForm.vue";
import ModalDialog from "./ModalDialog.vue";
type CreationStep = "choose" | "todo" | "habit";
const props = defineProps<{ mode: CreationStep }>();
const emit = defineEmits<{ close: []; created: [kind: "todo" | "habit"] }>();
const step = ref<CreationStep>(props.mode);
const formBusy = ref(false);
const refreshing = ref(false);
const busy = computed(() => formBusy.value || refreshing.value);
const heading = computed(() =>
  step.value === "choose"
    ? "Was möchtest du erstellen?"
    : step.value === "todo"
      ? "Neues Todo"
      : "Neues Habit",
);
function close(): void {
  if (!busy.value) emit("close");
}
function created(kind: "todo" | "habit"): void {
  refreshing.value = true;
  emit("created", kind);
}
</script>

<template>
  <ModalDialog
    class="create-dialog"
    :title="heading"
    :busy="busy"
    @close="close"
  >
    <template v-if="step === 'choose'">
      <p class="create-dialog__intro">
        Eine einzelne Aufgabe oder eine wiederkehrende Gewohnheit.
      </p>
      <div class="create-dialog__choices">
        <button
          class="create-dialog__choice"
          type="button"
          data-test="choose-todo"
          @click="step = 'todo'"
        >
          <span class="create-dialog__choice-icon" aria-hidden="true"
            ><AppIcon name="check"
          /></span>
          <span
            ><strong>Todo</strong><small>Eine Aufgabe erledigen</small></span
          >
          <AppIcon name="chevron" class="create-dialog__chevron" />
        </button>
        <button
          class="create-dialog__choice"
          type="button"
          data-test="choose-habit"
          @click="step = 'habit'"
        >
          <span class="create-dialog__choice-icon" aria-hidden="true"
            ><AppIcon name="habits"
          /></span>
          <span
            ><strong>Habit</strong><small>Regelmäßig dranbleiben</small></span
          >
          <AppIcon name="chevron" class="create-dialog__chevron" />
        </button>
      </div>
    </template>
    <CreateTodoForm
      v-else-if="step === 'todo'"
      embedded
      @busy="formBusy = $event"
      @created="created('todo')"
    />
    <CreateHabitForm
      v-else
      embedded
      @busy="formBusy = $event"
      @created="created('habit')"
    />
    <footer class="create-dialog__footer">
      <button
        v-if="mode === 'choose' && step !== 'choose'"
        class="btn"
        type="button"
        :disabled="busy"
        @click="step = 'choose'"
      >
        Zurück zur Auswahl
      </button>
      <button class="btn" type="button" :disabled="busy" @click="close">
        Abbrechen
      </button>
    </footer>
  </ModalDialog>
</template>

<style scoped>
.create-dialog__intro {
  margin: 0 0 var(--space-4);
  color: var(--color-ink-muted);
}
.create-dialog__choices {
  display: grid;
  gap: var(--space-2);
}
/* Choice rows: a calm ground-deep panel, not a second button colour. */
.create-dialog__choices .create-dialog__choice {
  display: flex;
  gap: var(--space-4);
  align-items: center;
  width: 100%;
  min-height: 4.5rem;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-card);
  background: var(--color-ground-deep);
  color: var(--color-ink);
  text-align: left;
  transition: transform 420ms var(--spring);
}
.create-dialog__choices .create-dialog__choice:active {
  transform: var(--press);
  transition-duration: 90ms;
}
.create-dialog__choice-icon {
  display: grid;
  flex: 0 0 var(--tap);
  height: var(--tap);
  place-items: center;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-action-strong);
}
.create-dialog__choice > span:nth-child(2) {
  flex: 1;
  min-width: 0;
}
.create-dialog__choices strong,
.create-dialog__choices small {
  display: block;
}
.create-dialog__choices strong {
  font-size: 1.0625rem;
  font-weight: 800;
}
.create-dialog__choices small {
  margin-top: 0.125rem;
  color: var(--color-ink-muted);
  font-size: 0.875rem;
  font-weight: 600;
}
.create-dialog__chevron {
  color: var(--color-ink-muted);
}
.create-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: flex-end;
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-line);
}
</style>
