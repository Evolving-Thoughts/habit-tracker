<script setup lang="ts">
import { computed, ref } from "vue";
import CreateHabitForm from "./CreateHabitForm.vue";
import CreateTodoForm from "./CreateTodoForm.vue";
import KindSwitch from "./KindSwitch.vue";
import ModalDialog from "./ModalDialog.vue";

/**
 * The plus button's dialog: "Quest | Daily" on top, the form below. The
 * switch only swaps the form; each keeps what was typed while the other is
 * shown, and nothing is saved before "… erstellen".
 */
const props = withDefaults(defineProps<{ kind?: "todo" | "habit" }>(), {
  kind: "todo",
});
const emit = defineEmits<{ close: []; created: [kind: "todo" | "habit"] }>();
const current = ref<"todo" | "habit">(props.kind);
const formBusy = ref(false);
const refreshing = ref(false);
const busy = computed(() => formBusy.value || refreshing.value);
/*
 * The dialog moves the focus into new content; once the switch was used it
 * stays on the switch, so arrowing between Quest and Daily keeps working.
 */
const switched = ref(false);
const focusSelector = computed(() =>
  switched.value ? '.kind-switch input:checked' : 'input[name="title"]',
);
function switchTo(kind: "todo" | "habit"): void {
  switched.value = true;
  current.value = kind;
}
const heading = computed(() =>
  current.value === "todo" ? "Neue Quest" : "Neues Daily",
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
    :focus-selector="focusSelector"
    @close="close"
  >
    <div class="create-dialog__body">
      <KindSwitch :model-value="current" @update:model-value="switchTo" />
      <KeepAlive>
        <CreateTodoForm
          v-if="current === 'todo'"
          embedded
          @busy="formBusy = $event"
          @created="created('todo')"
          @cancel="close"
        />
        <CreateHabitForm
          v-else
          embedded
          @busy="formBusy = $event"
          @created="created('habit')"
          @cancel="close"
        />
      </KeepAlive>
    </div>
  </ModalDialog>
</template>

<style scoped>
.create-dialog__body {
  display: grid;
  gap: var(--space-4);
}
</style>
