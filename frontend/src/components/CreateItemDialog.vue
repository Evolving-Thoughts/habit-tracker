<script setup lang="ts">
import { computed, ref } from "vue";
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
        <button type="button" data-test="choose-todo" @click="step = 'todo'">
          <span class="create-dialog__choice-icon" aria-hidden="true">✓</span>
          <span
            ><strong>Todo</strong><small>Eine Aufgabe erledigen</small></span
          >
          <span aria-hidden="true">→</span>
        </button>
        <button type="button" data-test="choose-habit" @click="step = 'habit'">
          <span class="create-dialog__choice-icon" aria-hidden="true"
            ><svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M20 7v5h-5" />
              <path d="M20 12a8 8 0 1 0-2.3 5.7" /></svg
          ></span>
          <span
            ><strong>Habit</strong><small>Regelmäßig dranbleiben</small></span
          >
          <span aria-hidden="true">→</span>
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
        type="button"
        :disabled="busy"
        @click="step = 'choose'"
      >
        Zurück zur Auswahl
      </button>
      <button type="button" :disabled="busy" @click="close">Abbrechen</button>
    </footer>
  </ModalDialog>
</template>

<style scoped>
.create-dialog__intro {
  margin: 0 0 1.25rem;
  color: #59657a;
  font-size: 0.875rem;
  line-height: 1.5;
}
.create-dialog__choices {
  display: grid;
  gap: 0.75rem;
}
.create-dialog__choices button {
  display: flex;
  align-items: center;
  gap: 1rem;
  width: 100%;
  min-height: 5rem;
  padding: 1rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.625rem;
  background: #fff;
  color: #182033;
  text-align: left;
  font: inherit;
  cursor: pointer;
}
.create-dialog__choices button:hover {
  border-color: #2457c5;
  background: #f5f8ff;
}
.create-dialog__choice-icon {
  display: grid;
  flex: 0 0 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.5rem;
  background: #eaf0fc;
  color: #2457c5;
  font-size: 1.5rem;
}
.create-dialog__choices button > span:nth-child(2) {
  flex: 1;
  min-width: 0;
}
.create-dialog__choices strong,
.create-dialog__choices small {
  display: block;
}
.create-dialog__choices small {
  margin-top: 0.25rem;
  color: #59657a;
  font-size: 0.875rem;
}
.create-dialog__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-end;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #e5e7eb;
}
.create-dialog__footer button {
  min-height: 2.75rem;
  padding: 0.6rem 0.9rem;
  border: 1px solid #ccd2dc;
  border-radius: 0.5rem;
  background: #fff;
  color: #39445a;
  font: inherit;
  cursor: pointer;
}
.create-dialog button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.create-dialog button:focus-visible {
  outline: 3px solid rgb(53 103 220 / 30%);
  outline-offset: 2px;
}
.create-dialog__choice-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}
</style>
